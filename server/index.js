const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Multer with strict limits and file-type filtering (CRIT-11)
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf'
]);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10 MB per file, max 5 files
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed: ${file.mimetype}`));
        }
    }
});

// Load environment variables from both root and server directory
// server/.env takes precedence for backend-specific configs
const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env')
];

envPaths.forEach(envPath => {
    if (existsSync(envPath)) {
        require('dotenv').config({ path: envPath, override: true });
    }
});

const app = express();

// Trust the Railway / Render load-balancer so express-rate-limit reads
// the real client IP from X-Forwarded-For instead of the proxy's IP.
// '1' means trust exactly one proxy hop.
app.set('trust proxy', 1);

const PORT = process.env.PORT || 8080;
if (!process.env.PORT) {
    console.warn('[SERVER] PORT env var not set — falling back to 8080. Railway should inject this automatically.');
}

// Core Dependencies (Must be before autoSeed)
const db = require('./db');
const driverAuth = require('./driver-auth');
const staffAuth = require('./staff-auth');
const driverData = require('./driver-data');


// 1. Security headers — must come before routes (HIGH-01)
// CSP allows the API origin and external resources used by the SPA
const API_ORIGIN = process.env.API_URL || process.env.PAYMENT_API || '';
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.r2.dev'],
            connectSrc: ["'self'", ...(API_ORIGIN ? [API_ORIGIN] : [])],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        }
    },
    crossOriginEmbedderPolicy: false, // Needed for some SPA assets
}));

// 2. CORS — whitelist explicit origins only (CRIT-01)
// Apply only to /api routes — static assets never need CORS headers
const ALLOWED_ORIGINS = [
    process.env.TRACKER_URL,
    process.env.PORTAL_URL,
    process.env.DRIVER_PORTAL_URL,
    process.env.ADMIN_PORTAL_URL,  // e.g. https://dash.segecha.com
].filter(Boolean);

const corsOptions = {
    origin: (origin, cb) => {
        // Allow server-to-server (no origin) and whitelisted origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        // In development, allow localhost on any port
        if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
            return cb(null, true);
        }
        // Use cb(null, false) — not cb(new Error(...)) — to avoid triggering the 500 error handler
        console.warn(`[CORS] Rejected origin: ${origin}`);
        cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
};

// Only apply CORS to API routes — static file requests are same-origin and don't need it
app.use('/api', cors(corsOptions));



app.get('/health', async (req, res) => {
    try {
        // Verify DB connectivity on every health check (LOW-03)
        await db.query('SELECT 1');
        res.status(200).json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch (e) {
        console.error('[HEALTH] DB check failed:', e.message);
        // Return 200 so Railway doesn't mark the deployment unhealthy on a brief DB cold-start.
        // DB errors surface on individual API calls — static file serving must keep working.
        res.status(200).json({ status: 'degraded', db: 'unavailable', timestamp: new Date().toISOString() });
    }
});

// Crash logging
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});


app.use(express.json());
app.use(cookieParser());

// 3. Rate limiters for auth endpoints (CRIT-04)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,                   // max 20 attempts per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    skipSuccessfulRequests: true, // Only count failures
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Please try again in 1 hour.' },
});

// 4. Admin Auth Middleware
const JWT_SECRET = process.env.JWT_SECRET;
// ADMIN_KEY: only use ADMIN_KEY, never fall back to the frontend VITE_ADMIN_KEY (CRIT-09, LOW-01)
const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();
if (!ADMIN_KEY) console.error('CRITICAL: ADMIN_KEY not set in environment.');

if (!JWT_SECRET || !ADMIN_KEY) {
    console.warn('[SECURITY] CRITICAL: JWT_SECRET or ADMIN_KEY not set. Using insecure defaults is dangerous.');
} else {
    const maskedKey = ADMIN_KEY.substring(0, 4) + '...' + ADMIN_KEY.substring(ADMIN_KEY.length - 4);
    console.log(`[AUTH] ADMIN_KEY loaded (Length: ${ADMIN_KEY.length}): ${maskedKey}`);
}

const PUBLIC_ROUTES = [
    '/admin/login', '/admin/logout', '/health',
    '/driver/login', '/driver/forgot-password', '/driver/set-password',
    '/staff/login',  '/staff/forgot-password',  '/staff/set-password',
];

const adminAuth = async (req, res, next) => {
    // 0. Skip for preflight
    if (req.method === 'OPTIONS') return next();

    // 1. Whitelist public routes (relative to /api mount point)
    const path = req.path.replace(/\/$/, '');
    if (PUBLIC_ROUTES.includes(path)) {
        return next();
    }

    // 2. Check for Admin Key (header only — never accept from body or query) or JWT Token (CRIT-09)
    const adminKey = req.headers['x-admin-key'];
    const authHeader = req.headers.authorization;

    // Check Admin Key (header only)
    if (adminKey && adminKey.trim() === ADMIN_KEY && ADMIN_KEY !== '') {
        return next();
    }

    // Check JWT Token (Bearer header or HttpOnly cookie — MED-06)
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const cookieToken = req.cookies?.admin_token;
    const jwtToken = bearerToken || cookieToken;

    if (jwtToken) {
        try {
            const decoded = jwt.verify(jwtToken, JWT_SECRET);
            if (decoded.role === 'superadmin' || decoded.role === 'admin') {
                // Force logout check: Compare session_version in token vs DB
                const dbRes = await db.query('SELECT session_version FROM admins WHERE id = $1', [decoded.id]);
                if (dbRes.rows.length > 0) {
                    const currentVersion = dbRes.rows[0].session_version || 1;
                    const tokenVersion = decoded.version || 1;
                    if (tokenVersion < currentVersion) {
                        console.warn(`[AUTH] Session invalidated (version mismatch) for ${req.method} ${req.path}`);
                        return res.status(401).json({ error: 'Session expired (password changed). Please log in again.' });
                    }
                }
                req.admin = decoded;
                return next();
            }
            // Token valid but role not permitted
            console.warn(`[AUTH] Forbidden role "${decoded.role}" for ${req.method} ${req.path}`);
            return res.status(403).json({ error: 'Insufficient permissions' });
        } catch (e) {
            console.warn(`[AUTH] Invalid token for ${req.method} ${req.path}: ${e.message}`);
            return res.status(401).json({ error: 'Session expired or invalid' });
        }
    }

    // No credentials at all
    console.warn(`[AUTH] No credentials for ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'Unauthorized access' });
};


// Helper to resolve static paths correctly in both local and production (Railway) environments
const resolveDistPath = (folderName) => {
    const rootPath = folderName === 'admin' ? path.join(__dirname, '..', 'dist') : path.join(__dirname, '..', folderName, 'dist');
    const localPath = folderName === 'admin' ? path.join(__dirname, 'dist') : path.join(__dirname, folderName, 'dist');

    if (existsSync(rootPath)) return rootPath;
    if (existsSync(localPath)) return localPath;

    // Fallback to process.cwd() as last resort
    const cwdPath = folderName === 'admin' ? path.join(process.cwd(), 'dist') : path.join(process.cwd(), folderName, 'dist');
    return cwdPath;
};

const DRIVER_DIST = resolveDistPath('driver-portal');
const TRACK_DIST = resolveDistPath('track-portal');
const PAY_DIST = resolveDistPath('payment-portal');
const ADMIN_DIST = resolveDistPath('admin');

// Diagnostic logging for production debugging
console.log(`[SERVER] Static paths resolved at ${new Date().toISOString()}:`);
[
    { name: 'Admin', path: ADMIN_DIST },
    { name: 'Driver', path: DRIVER_DIST },
    { name: 'Track', path: TRACK_DIST },
    { name: 'Pay', path: PAY_DIST }
].forEach(p => {
    const exists = existsSync(p.path);
    console.log(`  - ${p.name}: ${p.path} [${exists ? 'EXISTS' : 'MISSING'}]`);
    if (exists) {
        try {
            const files = require('fs').readdirSync(p.path);
            console.log(`    (Contains: ${files.join(', ')})`);
        } catch (e) {
            console.log(`    (Error reading: ${e.message})`);
        }
    }
});

// --- PUBLIC FRONTEND & STATIC ASSETS ---
// Cache headers helper for static portals
const staticOpts = {
    setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (/\/assets\//.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
};

// Domain-based static serving (for driver.segecha.com, track.segecha.com etc)
app.use((req, res, next) => {
    const host = req.hostname || '';
    if (host.startsWith('driver.')) return express.static(DRIVER_DIST, staticOpts)(req, res, next);
    if (host.startsWith('track.')) return express.static(TRACK_DIST, staticOpts)(req, res, next);
    if (host.startsWith('pay.') || host.startsWith('payment.')) return express.static(PAY_DIST, staticOpts)(req, res, next);
    next();
});
// 1. Specific Portals first (more specific routes)
app.use('/driver', express.static(DRIVER_DIST, staticOpts));
app.use('/track', express.static(TRACK_DIST, staticOpts));
app.use('/pay', express.static(PAY_DIST, staticOpts));
// 2. Root Admin Panel
app.use(express.static(ADMIN_DIST, staticOpts));
// Handle React routing (SPA)
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();

    const host = req.hostname || '';

    // Determine dist path based on hostname or path prefix
    let distPath = ADMIN_DIST;
    if (host.startsWith('driver.') || req.path.startsWith('/driver')) {
        distPath = DRIVER_DIST;
    } else if (host.startsWith('track.') || req.path.startsWith('/track')) {
        distPath = TRACK_DIST;
    } else if (host.startsWith('pay.') || host.startsWith('payment.') || req.path.startsWith('/pay')) {
        distPath = PAY_DIST;
    }

    // Prevent sending index.html for missing assets (avoids MIME type errors)
    const isAsset = req.path.includes('/assets/') ||
        req.path.match(/\.(css|js|png|jpg|jpeg|svg|ico|json|txt|woff2?|ttf|eot|webp)$/i);
    if (isAsset) {
        const assetFile = path.join(distPath, req.path);
        if (existsSync(assetFile)) return res.sendFile(assetFile);
        console.warn(`[SERVER] Asset not found: ${req.path}`);
        return res.status(404).set('Content-Type', 'text/plain').send('Asset not found');
    }

    // SPA fallback
    const indexFile = path.join(distPath, 'index.html');
    if (existsSync(indexFile)) return res.sendFile(indexFile);
    return res.status(404).send('Portal not found');
});


// --- AUTHENTICATED API ROUTES ---
// Apply AUTH to all /api routes except public ones
app.use('/api', adminAuth);





async function autoSeed() {
    try {
        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
        const initialAdminPhone = process.env.INITIAL_ADMIN_PHONE || '+254700000000';
        const staffId = 'staff-admin-init';
        const initialHash = bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_KEY, 10);

        console.log(`[SEED] Ensuring system tables and columns...`);

        // 0a. Apply schema.sql — creates all tables (IF NOT EXISTS) so they always exist
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (existsSync(schemaPath)) {
            try {
                const schemaSql = readFileSync(schemaPath, 'utf8');
                await db.query(schemaSql);
                console.log('[SEED] schema.sql applied successfully.');
            } catch (schemaErr) {
                console.warn('[SEED] schema.sql apply warning (tables may already exist):', schemaErr.message);
            }
        }
        
        // 0. Schema Migrations
        await db.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='session_version') THEN
                    ALTER TABLE admins ADD COLUMN session_version INTEGER DEFAULT 1;
                END IF;
                -- updated_at columns needed by upsertCollectionRow UPDATE queries
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_logs' AND column_name='updated_at') THEN
                    ALTER TABLE fuel_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='updated_at') THEN
                    ALTER TABLE expenses ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='updated_at') THEN
                    ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='updated_at') THEN
                    ALTER TABLE payroll ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                -- status columns used by ADMIN_COLLECTIONS extract functions
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_logs' AND column_name='status') THEN
                    ALTER TABLE fuel_logs ADD COLUMN status TEXT DEFAULT 'Pending';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='status') THEN
                    ALTER TABLE expenses ADD COLUMN status TEXT DEFAULT 'Pending';
                END IF;
            END $$;
        `);

        console.log(`[SEED] Ensuring superadmin exists (${initialAdminEmail})...`);

        // 1. Core Admin Login — only create if not already exists; never overwrite an existing
        //    password (HIGH-08: avoids resetting a manually-changed password on every restart)
        await db.query(`
            INSERT INTO admins (id, email, password_hash, role, display_name)
            VALUES ($1, $2, $3, 'superadmin', 'System Admin')
            ON CONFLICT (email) DO NOTHING
        `, [staffId, initialAdminEmail, initialHash]);

        // 2. Staff Record
        await db.query(`
            INSERT INTO staff (id, name, email, phone, role)
            VALUES ($1, 'System Admin', $2, $3, 'superadmin')
            ON CONFLICT (id) DO NOTHING
        `, [staffId, initialAdminEmail, initialAdminPhone]);

        // 3. Staff Portal Auth — only create; never overwrite existing password
        await db.query(`
            INSERT INTO staff_auth (staff_id, email, phone, password_hash, account_status)
            VALUES ($1, $2, $3, $4, 'active')
            ON CONFLICT (staff_id) DO NOTHING
        `, [staffId, initialAdminEmail, initialAdminPhone, initialHash]);


        // 4. Base Settings
        await db.query(`
            INSERT INTO system_settings (key, value) 
            VALUES 
            ('companyName', $1),
            ('companyEmail', $2),
            ('defaultCurrency', '"KES"')
            ON CONFLICT (key) DO NOTHING
        `, [JSON.stringify(process.env.COMPANY_NAME), JSON.stringify(process.env.EMAIL_FROM)]);

        console.log(`[SEED] SUCCESS: Superadmin created (${initialAdminEmail}). Password is your ADMIN_KEY.`);
    } catch (e) {
        console.warn('[SEED] Skipping auto-seed (likely DB not ready):', e.message);
    }
}
autoSeed();

// --- AUTHENTICATED ENDPOINTS ---

// Change Own Password
app.post('/api/admin/change-password', async (req, res) => {
    const { oldPassword, newPassword, email: bodyEmail } = req.body;
    
    // If authenticated via JWT, use the ID from the token
    // If authenticated via adminKey, use the email from the body
    let adminId = req.admin?.id;
    let email = req.admin?.email || bodyEmail;

    if (!adminId && !email) {
        return res.status(400).json({ error: 'Missing admin identification (session or email)' });
    }

    try {
        // Find in admins table
        let result;
        if (adminId) {
            result = await db.query('SELECT * FROM admins WHERE id = $1', [adminId]);
        } else {
            result = await db.query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase().trim()]);
        }

        if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });

        const admin = result.rows[0];
        const actualAdminId = admin.id;

        const valid = bcrypt.compareSync(oldPassword, admin.password_hash);
        if (!valid) return res.status(401).json({ error: 'Incorrect current password' });

        const newHash = bcrypt.hashSync(newPassword, 10);
        await db.query('UPDATE admins SET password_hash = $1, session_version = session_version + 1 WHERE id = $2', [newHash, actualAdminId]);

        // Also update staff_auth if exists for same user (staff login doesn't use session_version yet but password should align)
        await db.query('UPDATE staff_auth SET password_hash = $1 WHERE staff_id = $2', [newHash, actualAdminId]);

        res.json({ success: true, message: 'Password updated. All other sessions have been signed out.' });
    } catch (e) {
        console.error('CHANGE_PASSWORD_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- SYSTEM & MAINTENANCE (High Priority) ---


// MASTER RESET - Truncates all Neon PostgreSQL tables
app.post('/api/admin/reset', async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] SYSTEM RESET REQUESTED BY ADMIN`);
        const tables = [
            'invoices', 'payroll', 'fuel_logs', 'expenses', 'incidents', 'maintenance_logs', 'tyre_logs',
            'documents', 'journeys', 'driver_auth', 'staff_auth',
            'trucks', 'trailers', 'drivers', 'staff', 'customers', 'admins', 'superadmins', 'system_settings'
        ];
        for (const table of tables) {
            await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        }

        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
        const initialAdminPhone = process.env.INITIAL_ADMIN_PHONE;

        // 1. Create a dummy staff record for the superadmin (satisfies foreign key)
        const staffId = 'staff-admin-init';
        await db.query(`
            INSERT INTO staff (id, name, email, phone, role)
            VALUES ($1, 'System Admin', $2, $3, 'superadmin')
            ON CONFLICT (id) DO NOTHING
        `, [staffId, initialAdminEmail, initialAdminPhone]);

        // 2. Create the auth record with a secure hashed password
        const initialHash = bcrypt.hashSync(ADMIN_KEY, 10);
        await db.query(`
            INSERT INTO staff_auth (staff_id, email, phone, password_hash, account_status)
            VALUES ($1, $2, $3, $4, 'active')
            ON CONFLICT (staff_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
        `, [staffId, initialAdminEmail, initialAdminPhone, initialHash]);

        // 3. Populate base settings
        await db.query(`
            INSERT INTO system_settings (key, value) 
            VALUES 
            ('companyName', $2),
            ('companyEmail', $3),
            ('defaultCurrency', '"KES"'),
            ('admin_email', $1)
        `, [JSON.stringify(initialAdminEmail), JSON.stringify(process.env.COMPANY_NAME), JSON.stringify(process.env.EMAIL_FROM)]);
        res.json({ success: true, message: 'All database data destroyed and re-seeded.' });
    } catch (e) {
        console.error('RESET_FAILED:', e);
        res.status(500).json({ error: 'Reset failed: ' + e.message });
    }
});

// FULL DATA VIEW (Unified)
app.get('/api/tracker/data-full', async (req, res) => {
    try {
        const data = await backupEverything();
        res.json({ success: true, data });
    } catch (e) {
        console.error('DATA_FULL_ERROR:', e);
        res.status(500).json({ error: 'Failed to fetch full data: ' + e.message });
    }
});

// Auth Utilities (already required above)

// Core Dependencies already required at top level


// Database Configuration
const DB_TABLES = [
    'admins', 'superadmins', 'trucks', 'trailers', 'drivers',
    'staff', 'customers', 'journeys', 'fuel_logs', 'expenses',
    'invoices', 'payroll', 'maintenance_logs', 'tyre_logs',
    'incidents', 'documents', 'system_settings', 'staff_auth', 'driver_auth'
];

// Helper to get all data for a specific entity (replaces getData for JSON)
async function getEntityData(table) {
    const res = await db.query(`SELECT * FROM ${table}`);
    return res.rows;
}

// Helper to save settings to DB
async function saveSetting(key, value) {
    await db.query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, JSON.stringify(value)]);
}

// Helper to get settings from DB
async function getSettings() {
    const res = await db.query('SELECT * FROM system_settings');
    const settings = {};
    res.rows.forEach(r => settings[r.key] = r.value);
    return settings;
}

// Ensure directories exist
if (!existsSync(__dirname)) mkdirSync(__dirname);
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR);

// Helper to read/write data
const getData = (file, defaultVal = { journeys: [], history: [] }) => {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return defaultVal; }
};
const saveData = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2));

// Master Backup Helper
async function backupEverything() {
    const backup = {
        version: '5.0',
        timestamp: new Date().toISOString(),
        tables: {}
    };
    for (const table of DB_TABLES) {
        const res = await db.query(`SELECT * FROM ${table}`);
        backup.tables[table] = res.rows;
    }
    return backup;
}

// Master Restore Helper
async function restoreEverything(backup) {
    if (!backup.tables) return;

    // Use a single transaction for atomicity and performance
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        for (const [table, rows] of Object.entries(backup.tables)) {
            if (!DB_TABLES.includes(table)) continue;

            await client.query(`TRUNCATE TABLE ${table} CASCADE`);
            if (!rows || rows.length === 0) continue;

            const CHUNK_SIZE = 500;
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE);
                const cols = Object.keys(chunk[0]);
                const validCols = cols.filter(c => /^[a-z0-9_]+$/.test(c));
                if (validCols.length !== cols.length) {
                    throw new Error(`Invalid column names detected in table ${table}`);
                }

                const placeholders = chunk.map((_, rowIndex) =>
                    `(${validCols.map((_, colIndex) => `$${rowIndex * validCols.length + colIndex + 1}`).join(',')})`
                ).join(',');

                const values = chunk.flatMap(row => validCols.map(c => row[c]));
                const query = `INSERT INTO ${table} (${validCols.join(',')}) VALUES ${placeholders}`;
                await client.query(query, values);
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}


// --- ADMIN ROUTES ---

// Login — rate-limited (CRIT-04)
app.post('/api/admin/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    try {
        const result = await db.query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase().trim()]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];
        const valid = bcrypt.compareSync(password, admin.password_hash);

        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Real JWT Token
        const token = jwt.sign(
            { 
                id: admin.id, 
                email: admin.email, 
                role: admin.role,
                version: admin.session_version || 1
            }, 
            JWT_SECRET, 
            { expiresIn: '12h' }
        );

        // Set HttpOnly cookie for XSS protection (MED-06)
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000  // 8 hours
        });

        res.json({
            token,
            user: {
                id: admin.id,
                email: admin.email,
                displayName: admin.display_name,
                role: admin.role
            }
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Database authentication error' });
    }
});

// Admin logout — clears HttpOnly cookie (MED-06)
app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.json({ ok: true });
});

// Pending verification (Used by Admin Panel)
app.get(['/api/admin/journeys/pending', '/api/admin/journeys/pending-verification'], async (req, res) => {
    try {
        const journeys = (await db.query("SELECT * FROM journeys WHERE status IN ('Awaiting Start Verification', 'Awaiting Verification')")).rows;
        const fuel = (await db.query("SELECT * FROM fuel_logs WHERE metadata->>'_pendingApproval' = 'true'")).rows;
        const expenses = (await db.query("SELECT * FROM expenses WHERE metadata->>'_pendingApproval' = 'true'")).rows;
        const docs = (await db.query("SELECT * FROM documents")).rows;
        const customers = (await db.query("SELECT * FROM customers")).rows;
        const incidents = (await db.query("SELECT * FROM incidents WHERE status = 'Open'")).rows;

        res.json({
            success: true,
            journeys,
            fuel,
            expenses,
            documents: docs,
            customers,
            incidents
        });
    } catch (e) {
        console.error('Pending fetch error:', e);
        res.status(500).json({ error: 'Failed to access journey data' });
    }
});

// Admin: log an incident directly (no driver submission required)
app.post('/admin/incidents', async (req, res) => {
    const { incidentType, description, driverId, truck, location, date } = req.body;
    const id = `INC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    try {
        await db.query(
            `INSERT INTO incidents (id, type, description, status, metadata) VALUES ($1,$2,$3,'Open',$4)`,
            [
                id,
                incidentType || 'Other',
                description || '',
                JSON.stringify({
                    driverId: driverId || '',
                    truck: truck || '',
                    location: location || '',
                    date: date || now.split('T')[0],
                    incidentType: incidentType || 'Other',
                    _pendingApproval: false,
                    _submittedAt: now,
                    _loggedBy: req.admin?.email || 'admin',
                }),
            ]
        );
        res.json({ success: true, id });
    } catch (e) {
        console.error('[INCIDENTS] Failed to create incident:', e);
        res.status(500).json({ error: e.message });
    }
});

// Import history (Now using DB journeys)
app.get(['/api/admin/history', '/api/admin/import-history'], async (req, res) => {
    try {
        const journeys = (await db.query("SELECT * FROM journeys ORDER BY created_at DESC LIMIT 500")).rows;
        res.json({ success: true, history: journeys });
    } catch (e) { res.status(500).json({ error: 'Failed to fetch history' }); }
});

// Record import history (Called by Excel Import Engine)
app.post('/api/admin/import-history', async (req, res) => {
    const { record } = req.body;
    try {
        console.log('[IMPORT] History record received:', record);
        // For now, we just log it as primary journey data is already in PostgreSQL.
        // If we want a separate table for import events, we'd insert here.
        res.json({ success: true, message: 'Import history recorded' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to record import history: ' + e.message });
    }
});

// Stats (Aggregated from DB)
app.get('/api/admin/stats', async (req, res) => {
    try {
        const journeyCount = (await db.query("SELECT COUNT(*) FROM journeys")).rows[0].count;
        const activeTrucks = (await db.query("SELECT COUNT(*) FROM trucks WHERE status = 'Active'")).rows[0].count;
        const totalRevenue = (await db.query("SELECT SUM(amount) FROM invoices")).rows[0].sum || 0;

        res.json({
            success: true,
            stats: {
                totalJourneys: parseInt(journeyCount),
                activeTrucks: parseInt(activeTrucks),
                totalRevenue: parseFloat(totalRevenue)
            }
        });
    } catch (e) { res.status(500).json({ error: 'Failed to compute stats' }); }
});

// --- DOCUMENTS MANAGEMENT ---

app.get('/api/documents', async (req, res) => {
    try {
        const { entityType, entityId } = req.query;
        let query = 'SELECT * FROM documents WHERE 1=1';
        const params = [];
        if (entityType) { params.push(entityType); query += ` AND entity_type = $${params.length}`; }
        if (entityId) { params.push(entityId); query += ` AND (entity_id = $${params.length} OR metadata->>'driverId' = $${params.length})`; }

        const result = await db.query(query, params);
        res.json({ success: true, documents: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/documents/expiring', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const result = await db.query("SELECT * FROM documents WHERE expiry_date <= CURRENT_DATE + interval '1 day' * $1", [parseInt(days)]);
        res.json({ success: true, documents: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/documents/upload', upload.any(), async (req, res) => {
    try {
        const body = req.body || {};
        const id = Date.now().toString();
        const { entityType, entityId, label, url, expiryDate, ...rest } = body;

        await db.query(
            'INSERT INTO documents (id, entity_type, entity_id, label, url, expiry_date, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, entityType, entityId, label, url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg', expiryDate, JSON.stringify(rest)]
        );

        res.json({ success: true, document: { id, ...body, url: url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg' } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/documents/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin upload — replaced by /api/documents/upload (HIGH-07)
app.post('/api/admin/upload', (req, res) => {
    res.status(410).json({ error: 'Deprecated. Use POST /api/documents/upload instead.' });
});

// ─── GENERIC ADMIN CRUD ────────────────────────────────────────────────────
// Maps frontend collection names → DB tables + dedicated column extraction.
// The ENTIRE frontend object is always stored in metadata (lossless).
// Dedicated columns are ALSO extracted so transformDBTables() reads them correctly.

const ADMIN_COLLECTIONS = {
    trucks: {
        table: 'trucks',
        extract: (item) => ({
            registration_number: item.reg || item.registration_number || '',
            model:               item.make || item.model || '',
            status:              item.status || 'Active',
            current_mileage:     Number(item.odom || item.current_mileage) || 0,
            tyre_odom:           Number(item.tyreOdom || item.tyre_odom) || 0,
            tyre_limit:          Number(item.tyreLimit || item.tyre_limit) || 0,
        }),
    },
    trailers: {
        table: 'trailers',
        extract: (item) => ({
            registration_number: item.reg || item.registration_number || '',
            type:                item.type || '',
            status:              item.status || 'Active',
        }),
    },
    drivers: {
        table: 'drivers',
        extract: (item) => ({
            name:           item.name    || '',
            phone:          item.phone   || '',
            license_number: item.license || item.license_number || '',
            status:         item.status  || 'Active',
            truck_id:       item.truck   || item.truck_id || null,
        }),
    },
    staff: {
        table: 'staff',
        extract: (item) => ({
            name:   item.name   || '',
            role:   item.role   || '',
            email:  item.email  || '',
            phone:  item.phone  || '',
            status: item.status || 'Active',
        }),
    },
    customers: {
        table: 'customers',
        extract: (item) => ({
            name:    item.name    || '',
            phone:   item.phone   || '',
            email:   item.email   || '',
            address: item.address || '',
            status:  item.status  || 'Active',
        }),
    },
    journeys: {
        table: 'journeys',
        extract: (item) => ({
            truck_id:             item.truck   || item.truck_id             || null,
            driver_id:            item.driver  || item.driver_id            || null,
            trailer_id:           item.trailer || item.trailer_id           || null,
            customer_id:          item.customerId || item.customer_id       || null,
            delivery_customer_id: item.deliveryCustomerId || item.delivery_customer_id || null,
            origin:               item.origin      || '',
            destination:          item.dest || item.destination             || '',
            cargo_type:           item.cargo || item.cargoType || item.cargo_type || '',
            status:               item.status      || 'Loading',
            start_date:           item.date || item.start_date              || null,
            end_date:             item.endDate || item.end_date             || null,
            notes:                item.notes       || '',
        }),
    },
    fuel: {
        table: 'fuel_logs',
        extract: (item) => ({
            truck_id:   item.truck   || item.truck_id   || null,
            journey_id: item.journey || item.journey_id || null,
            date:       item.date    || null,
            // amount = total cost (litres × pricePerL); pricePerL lives in metadata via full-object JSON
            amount:     (Number(item.litres) || 0) * (Number(item.pricePerL) || 0),
            litres:     Number(item.litres) || 0,
            station:    item.station || '',
            status:     item.status  || 'Pending',
        }),
    },
    expenses: {
        table: 'expenses',
        extract: (item) => ({
            journey_id:  item.journey  || item.journey_id || null,
            category:    item.cat      || item.category   || '',
            amount:      Number(item.amount) || 0,
            date:        item.date     || null,
            description: item.desc     || item.description || '',
            status:      item.status   || 'Pending',
        }),
    },
    invoices: {
        table: 'invoices',
        extract: (item) => ({
            customer_id: item.customerId || item.customer_id || null,
            journey_id:  item.journey    || item.journey_id  || null,
            amount:      Number(item.amount) || 0,
            due_date:    item.due || item.dueDate || item.due_date || null,
            status:      item.status || 'Pending',
        }),
    },
    payroll: {
        table: 'payroll',
        extract: (item) => ({
            entity_id:   item.driver     || item.entity_id   || null,
            entity_type: item.entityType || item.entity_type || 'driver',
            amount:      Number(item.amount || item.baseSalary) || 0,
            month:       item.month  || '',
            status:      item.status || 'Pending',
        }),
    },
    maintenanceLogs: {
        table: 'maintenance_logs',
        extract: (item) => ({
            truck_id:             item.truck || item.truck_id || null,
            date:                 item.date  || null,
            description:          item.desc  || item.description || '',
            cost:                 Number(item.amount || item.cost) || 0,
            next_service_mileage: Number(item.nextOdom || item.next_service_mileage) || 0,
        }),
    },
    tyreLogs: {
        table: 'tyre_logs',
        extract: (item) => ({
            truck_id:      item.truck  || item.truck_id || null,
            position:      item.position     || '',
            serial_number: item.serialNumber || item.serial_number || '',
            status:        item.status       || 'Active',
        }),
    },
};

// Helper: build INSERT/UPDATE SQL for a collection row
async function upsertCollectionRow(collection, item) {
    const cfg = ADMIN_COLLECTIONS[collection];
    if (!cfg) throw new Error(`Unknown collection: ${collection}`);
    const cols = cfg.extract(item);
    const meta = JSON.stringify(item); // full frontend object → lossless metadata

    const colNames  = Object.keys(cols);
    const colValues = Object.values(cols);

    // Check if row exists
    const existing = await db.query(`SELECT id FROM ${cfg.table} WHERE id = $1`, [item.id]);
    if (existing.rows.length > 0) {
        // UPDATE
        const sets = colNames.map((c, i) => `${c} = $${i + 2}`).join(', ');
        await db.query(
            `UPDATE ${cfg.table} SET ${sets}, metadata = $${colNames.length + 2}, updated_at = NOW() WHERE id = $1`,
            [item.id, ...colValues, meta]
        );
    } else {
        // INSERT
        const placeholders = colNames.map((_, i) => `$${i + 3}`).join(', ');
        await db.query(
            `INSERT INTO ${cfg.table} (id, metadata, ${colNames.join(', ')}) VALUES ($1, $2, ${placeholders})`,
            [item.id, meta, ...colValues]
        );
    }
}

// POST /api/admin/collection/:col — create or upsert a record
app.post('/api/admin/collection/:col', async (req, res) => {
    const { col } = req.params;
    if (!ADMIN_COLLECTIONS[col]) return res.status(400).json({ error: `Unknown collection: ${col}` });
    try {
        await upsertCollectionRow(col, req.body);
        res.json({ success: true });
    } catch (e) {
        console.error(`[CRUD] POST ${col} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/admin/collection/:col/:id — update a record
app.put('/api/admin/collection/:col/:id', async (req, res) => {
    const { col } = req.params;
    if (!ADMIN_COLLECTIONS[col]) return res.status(400).json({ error: `Unknown collection: ${col}` });
    try {
        await upsertCollectionRow(col, { ...req.body, id: req.params.id });
        res.json({ success: true });
    } catch (e) {
        console.error(`[CRUD] PUT ${col}/${req.params.id} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/admin/collection/:col/:id — delete a record
app.delete('/api/admin/collection/:col/:id', async (req, res) => {
    const { col, id } = req.params;
    const cfg = ADMIN_COLLECTIONS[col];
    if (!cfg) return res.status(400).json({ error: `Unknown collection: ${col}` });
    try {
        await db.query(`DELETE FROM ${cfg.table} WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (e) {
        console.error(`[CRUD] DELETE ${col}/${id} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/admin/collection/:col/:id — partial update (e.g. markPaid)
app.patch('/api/admin/collection/:col/:id', async (req, res) => {
    const { col, id } = req.params;
    const cfg = ADMIN_COLLECTIONS[col];
    if (!cfg) return res.status(400).json({ error: `Unknown collection: ${col}` });
    try {
        // Fetch existing row, merge patch, then upsert
        const result = await db.query(`SELECT * FROM ${cfg.table} WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        const existing = result.rows[0];
        const existingMeta = existing.metadata || {};
        const merged = { ...existingMeta, ...req.body, id };
        await upsertCollectionRow(col, merged);
        res.json({ success: true });
    } catch (e) {
        console.error(`[CRUD] PATCH ${col}/${id} failed:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

// Legacy PUT /api/admin/:col/:id — now forwards to the collection handler
app.put('/api/admin/:col/:id', async (req, res) => {
    const { col, id } = req.params;
    if (!ADMIN_COLLECTIONS[col]) return res.status(501).json({ error: `No handler for collection: ${col}` });
    try {
        await upsertCollectionRow(col, { ...req.body, id });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin verification for journeys (start or completion)
app.post('/api/admin/journey/:id/verify', async (req, res) => {
    const { approved, rejectionReason, rejectedFields } = req.body;

    try {
        const result = await db.query('SELECT * FROM journeys WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Journey not found' });
        const j = result.rows[0];

        const isStart = j.status === 'Awaiting Start Verification';
        const now = new Date();
        const ts = now.toISOString();

        let newStatus = approved ? (isStart ? 'Approved' : 'Verified') : (isStart ? 'Loading' : 'In Transit');
        const metadata = j.metadata || {};
        metadata._isRejected = !approved;
        if (!approved) {
            metadata._rejectionReason = rejectionReason;
            metadata._rejectedFields = rejectedFields || [];
        }
        const notes = (j.notes || '') + (j.notes ? '\n' : '') + `[${approved ? 'APPROVED' : 'REJECTED'} @ ${ts}]${!approved ? ': ' + rejectionReason : ''}`;

        await db.query(
            'UPDATE journeys SET status = $1, notes = $2, metadata = $3 WHERE id = $4',
            [newStatus, notes, JSON.stringify(metadata), req.params.id]
        );

        res.json({ success: true, action: isStart ? 'start' : 'completion', journey: { ...j, status: newStatus, notes, metadata } });
    } catch (e) {
        console.error('Journey verification error:', e);
        console.error('Request headers on failure:', req.headers);
        res.status(500).json({ error: e.message });
    }
});

// Admin verification for fuel/expenses (Now strictly DB-driven internally)
// NOTE: Logic moved to specific endpoints or handled via metadata updates in DB
app.post('/api/admin/submission/verify', async (req, res) => {
    const { id, type, approved, reason, rejectedFields } = req.body;

    try {
        let table = '';
        if (type === 'fuel') table = 'fuel_logs';
        else if (type === 'expense') table = 'expenses';
        else if (type === 'incident') table = 'incidents';
        else return res.status(400).json({ error: 'Invalid type' });

        const status = approved ? (type === 'incident' ? 'Resolved' : 'Approved') : (type === 'incident' ? 'Rejected' : 'Rejected');

        await db.query(`
            UPDATE ${table} SET 
                metadata = jsonb_set(
                    jsonb_set(
                        jsonb_set(metadata, '{_pendingApproval}', 'false'),
                        '{_isRejected}', $1
                    ),
                    '{_rejectionReason}', $2
                ),
                status = $3
            WHERE id = $4
        `, [JSON.stringify(!approved), JSON.stringify(reason || ''), status, id]);

        res.json({ success: true });
    } catch (e) {
        console.error('Submission verification error:', e);
        console.error('Request headers on failure:', req.headers);
        res.status(500).json({ error: e.message });
    }
});

// NOTE: Duplicate /api/admin/reset removed (CRIT-03/CRIT-06).
// The authoritative reset route is defined above (line ~343).
// It uses ADMIN_KEY from the environment — never a hardcoded password.

// --- TRACKER SYNC & BACKUP ---

// Sync Snapshot (Local -> Server) - Now only for settings as primary data is in DB
app.post('/api/tracker/snapshot', async (req, res) => {
    const { settings } = req.body;
    try {
        if (settings) {
            for (const [key, val] of Object.entries(settings)) {
                await saveSetting(key, val);
            }
            const frequency = settings?.backupFrequency || 'Disabled';
            updateBackupScheduler(frequency);
        }
        res.json({ success: true, message: 'Server settings updated' });
    } catch (e) {
        res.status(500).json({ error: 'Sync failed: ' + e.message });
    }
});

// FULL DATA VIEW logic moved to top

app.post('/api/tracker/data', (req, res) => {
    res.json({ success: true, message: 'Live data is handled via PostgreSQL' });
});

// List Backups
app.get('/api/tracker/backups', (req, res) => {
    const { readdirSync, statSync } = require('fs');
    try {
        const files = readdirSync(BACKUPS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const stats = statSync(path.join(BACKUPS_DIR, f));
                return {
                    name: f,
                    timestamp: stats.mtime,
                    size: stats.size
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);
        res.json({ success: true, backups: files });
    } catch (e) {
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// Create Manual Backup (Unified)
app.post('/api/tracker/backup-now', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_master_${timestamp}.json`;
        const backup = await backupEverything();

        saveData(path.join(BACKUPS_DIR, filename), backup);
        res.json({ success: true, message: 'Master backup created: ' + filename });
    } catch (e) {
        console.error('BACKUP_ERROR:', e);
        res.status(500).json({ error: 'Backup failed: ' + e.message });
    }
});

// Restore from Backup (Unified)
// MASTER RESET logic moved to top for middleware reachability

app.post('/api/tracker/restore', async (req, res) => {
    const { filename } = req.body;
    try {
        const backupPath = path.join(BACKUPS_DIR, filename);
        if (!existsSync(backupPath)) return res.status(404).json({ error: 'Backup file not found' });

        const backup = JSON.parse(readFileSync(backupPath, 'utf8'));

        // Handle both legacy (just data/settings) and new unified format
        if (backup.version === '5.0' || backup.version === '4.0') {
            await restoreEverything(backup);
        } else {
            console.warn('[RESTORE] Attempted to restore legacy JSON format which is no longer supported.');
            return res.status(400).json({ error: 'Legacy backup format no longer supported. Please use a version 4.0 or 5.0 master backup.' });
        }

        res.json({ success: true, message: 'System restored from ' + filename });
    } catch (e) {
        console.error('RESTORE_ERROR:', e);
        res.status(500).json({ error: 'Restore failed: ' + e.message });
    }
});

// Download Backup
app.get('/api/tracker/backups/download/:filename', (req, res) => {
    try {
        const file = req.params.filename;
        const safeName = path.basename(file);
        const backupPath = path.join(BACKUPS_DIR, safeName);
        if (!existsSync(backupPath)) return res.status(404).json({ error: 'Backup not found' });
        res.download(backupPath);
    } catch (e) {
        res.status(500).json({ error: 'Download failed' });
    }
});

// Upload Backup
app.post('/api/tracker/upload-backup', (req, res) => {
    try {
        const { filename, content } = req.body;
        if (!filename || !content) return res.status(400).json({ error: 'Missing filename or content' });

        const safeName = path.basename(filename);
        if (!safeName.endsWith('.json')) return res.status(400).json({ error: 'Only JSON backup files are allowed' });

        const backupPath = path.join(BACKUPS_DIR, safeName);
        writeFileSync(backupPath, content, 'utf8');

        res.json({ success: true, message: 'Backup uploaded successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Upload failed: ' + e.message });
    }
});

// --- AUTOMATED BACKUP SCHEDULER ---
let backupInterval = null;
let currentFrequency = 'Disabled';

async function performAutoBackup() {
    console.log(`[${new Date().toISOString()}] Running automated database backup...`);
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `auto_backup_db_${timestamp}.json`;
        const backup = await backupEverything();
        saveData(path.join(BACKUPS_DIR, filename), backup);
    } catch (e) {
        console.error('Automated backup failed:', e.message);
    }
}

function updateBackupScheduler(frequency) {
    if (frequency === currentFrequency) return;
    currentFrequency = frequency;

    if (backupInterval) {
        clearInterval(backupInterval);
        backupInterval = null;
    }

    let intervalMs = 0;
    switch (frequency) {
        case 'Every 6 Hours': intervalMs = 6 * 60 * 60 * 1000; break;
        case 'Daily': intervalMs = 24 * 60 * 60 * 1000; break;
        case 'Weekly': intervalMs = 7 * 24 * 60 * 60 * 1000; break;
    }

    if (intervalMs > 0) {
        console.log(`Backup scheduler set to: ${frequency} (${intervalMs}ms)`);
        backupInterval = setInterval(performAutoBackup, intervalMs);
    } else {
        console.log('Backup scheduler disabled');
    }
}

// Initial scheduler start
(async () => {
    try {
        const settings = await getSettings();
        if (settings?.backupFrequency) {
            updateBackupScheduler(settings.backupFrequency);
        }
    } catch (e) {
        console.warn('Could not start initial backup scheduler:', e.message);
    }
})();


// --- DRIVER ACCOUNT MANAGEMENT (ADMIN) ---

app.post('/api/driver/create-account', async (req, res) => {
    const { driverId, email, phone } = req.body;
    try {
        const result = await driverAuth.createDriverAccount(driverId, email, phone);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/driver/account-status/:id', async (req, res) => {
    try {
        const status = await driverAuth.getDriverAccountStatus(req.params.id);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch account status' });
    }
});

app.post('/api/driver/account/regenerate-credentials', async (req, res) => {
    const { driverId, email, phone, forcePasswordReset } = req.body;
    try {
        const result = await driverAuth.regenerateDriverCredentials(driverId, { email, phone, forcePasswordReset });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/driver/account-export/:id', async (req, res) => {
    try {
        const exportData = await driverAuth.exportDriverAccount(req.params.id);
        if (!exportData) return res.status(404).json({ error: 'Account not found' });
        res.json(exportData);
    } catch (e) {
        res.status(500).json({ error: 'Failed to export account' });
    }
});

app.delete('/api/driver/account/:id', async (req, res) => {
    try {
        const success = await driverAuth.deleteDriverAccount(req.params.id);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// --- STAFF ACCOUNT MANAGEMENT (ADMIN) ---

app.post('/api/staff/create-account', async (req, res) => {
    const { staffId, email, phone } = req.body;
    try {
        const result = await staffAuth.createStaffAccount(staffId, email, phone);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/staff/account-status/:id', async (req, res) => {
    try {
        const status = await staffAuth.getStaffAccountStatus(req.params.id);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/staff/account/regenerate-credentials', async (req, res) => {
    const { staffId, email, phone, forcePasswordReset } = req.body;
    try {
        const result = await staffAuth.regenerateStaffCredentials(staffId, { email, phone, forcePasswordReset });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/staff/account-export/:id', async (req, res) => {
    try {
        const exportData = await staffAuth.exportStaffAccount(req.params.id);
        if (!exportData) return res.status(404).json({ error: 'Account not found' });
        res.json(exportData);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/staff/account/:id', async (req, res) => {
    try {
        const success = await staffAuth.deleteStaffAccount(req.params.id);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- DRIVER PORTAL ENDPOINTS (Authenticated) ---

app.get('/api/driver/me', driverAuth.authMiddleware, (req, res) => {
    const profile = driverAuth.exportDriverAccount(req.driver.driverId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({ success: true, driver: profile });
});

app.get('/api/driver/portal-data', driverAuth.authMiddleware, (req, res) => {
    try {
        const data = driverData.getDriverData(req.driver.driverId);
        if (!data) return res.status(404).json({ error: 'Driver data not found' });
        res.json({ success: true, ...data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journeys/status', driverAuth.authMiddleware, (req, res) => {
    const { journeyId, status, ...extras } = req.body;
    try {
        const result = driverData.updateJourneyStatus(req.driver.driverId, journeyId, status, extras);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journey/:id/status', driverAuth.authMiddleware, (req, res) => {
    const { status, ...extras } = req.body;
    try {
        const result = driverData.updateJourneyStatus(req.driver.driverId, req.params.id, status, extras);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journey/:id/customers', driverAuth.authMiddleware, (req, res) => {
    try {
        const result = driverData.updateJourneyPartyCustomers(req.driver.driverId, req.params.id, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journeys/start-request', driverAuth.authMiddleware, (req, res) => {
    try {
        const result = driverData.createJourneyStartRequest(req.driver.driverId, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/fuel', driverAuth.authMiddleware, (req, res) => {
    try {
        const result = driverData.addPendingSubmission(req.driver.driverId, 'fuel', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/expense', driverAuth.authMiddleware, (req, res) => {
    try {
        const result = driverData.addPendingSubmission(req.driver.driverId, 'expense', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/incident', driverAuth.authMiddleware, (req, res) => {
    try {
        const result = driverData.addPendingSubmission(req.driver.driverId, 'incident', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/maintenance', driverAuth.authMiddleware, (req, res) => {
    try {
        const result = driverData.addPendingSubmission(req.driver.driverId, 'maintenance', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journeys/start-placeholder', driverAuth.authMiddleware, (req, res) => {
    try {
        const result = driverData.createJourneyStartPlaceholder(req.driver.driverId, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/upload', driverAuth.authMiddleware, (req, res) => {
    res.json({ success: true, url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' });
});

app.get('/api/documents/mine', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM documents WHERE entity_id = $1 OR metadata->>\'driverId\' = $1',
            [req.driver.driverId]
        );
        res.json({ success: true, documents: result.rows });
    } catch (e) {
        console.error('DOCUMENTS_MINE_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/documents/driver-upload', driverAuth.authMiddleware, upload.any(), async (req, res) => {
    try {
        const body = req.body || {};
        const id = Date.now().toString();
        const doc = {
            id,
            driverId: req.driver.driverId,
            entityType: 'driver',
            entityId: req.driver.driverId,
            url: body.url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            ...body,
            uploadedAt: new Date().toISOString()
        };

        const { entityType, entityId, label, url, expiryDate, ...metadata } = doc;
        await db.query(
            'INSERT INTO documents (id, entity_type, entity_id, label, url, expiry_date, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, entityType, entityId, label || 'Driver Upload', url, expiryDate || null, JSON.stringify(metadata)]
        );

        res.json({ success: true, document: doc });
    } catch (e) {
        console.error('DRIVER_UPLOAD_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- DRIVER LOGIN & AUTH ---
// Rate-limited (CRIT-04) — 20 attempts per 15 min per IP
app.post('/api/driver/login', authLimiter, async (req, res) => {
    const { identifier, password, method } = req.body;
    try {
        const result = await driverAuth.loginDriver(identifier, password, method);
        // Return 401 on failure — not 200 (CRIT-12)
        if (!result.success) return res.status(401).json(result);
        res.json(result);
    } catch (e) {
        console.error('[DRIVER_LOGIN_ERROR]', e.message, e.stack);
        res.status(500).json({ error: 'Login failed', detail: e.message });
    }
});

app.post('/api/driver/forgot-password', passwordResetLimiter, async (req, res) => {
    const { identifier } = req.body;
    try {
        const result = await driverAuth.requestPasswordReset(identifier);
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Password reset request failed' }); }
});

app.post('/api/driver/set-password', passwordResetLimiter, async (req, res) => {
    const { token, password } = req.body;
    try {
        const result = await driverAuth.resetPasswordWithToken(token, password);
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Password reset failed' }); }
});

// --- STAFF LOGIN & AUTH ---
// Rate-limited (CRIT-04) — 20 attempts per 15 min per IP
app.post('/api/staff/login', authLimiter, async (req, res) => {
    const { identifier, password, method } = req.body;
    try {
        const result = await staffAuth.loginStaff(identifier, password, method);
        // Return 401 on failure — not 200 (CRIT-12)
        if (!result.success) return res.status(401).json(result);
        res.json(result);
    } catch (e) {
        console.error('[STAFF_LOGIN_ERROR]', e.message, e.stack);
        res.status(500).json({ error: 'Login failed', detail: e.message });
    }
});

app.post('/api/staff/forgot-password', passwordResetLimiter, async (req, res) => {
    const { identifier } = req.body;
    try {
        const result = await staffAuth.requestStaffPasswordReset(identifier);
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Password reset request failed' }); }
});

app.post('/api/staff/set-password', passwordResetLimiter, async (req, res) => {
    const { token, password } = req.body;
    try {
        const result = await staffAuth.resetStaffPasswordWithToken(token, password);
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Password reset failed' }); }
});


// Global Error Handler (HIGH-10, HIGH-03)
// - No synchronous writeFileSync (event loop blocking removed)
// - Error details hidden from clients in production
app.use((err, req, res, next) => {
    const isDev = process.env.NODE_ENV !== 'production';
    console.error(`[SERVER_ERROR] ${req.method} ${req.url}:`, err);
    const clientMessage = isDev ? err.message : 'An unexpected error occurred. Please try again.';
    res.status(err.status || 500).json({ error: clientMessage });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
});

module.exports = { app, db };


