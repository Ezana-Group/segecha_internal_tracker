const path = require('path');
const { existsSync } = require('fs');

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

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { uploadBuffer } = require('./cloudinary');
const { uploadToR2 } = require('./r2');
const upload = multer();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.set('trust proxy', true);

async function saveSystemSetting(key, value) {
    await db.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [key, typeof value === 'object' ? JSON.stringify(value) : value]);
}
const PORT = process.env.PORT;
if (!PORT) console.warn('WARNING: PORT not set, some environments may fail to bind.');

// Core Dependencies (Must be before autoSeed)
const db = require('./db');
const { upsertEntity, syncFullData } = require('./utils/db-helpers');
const driverAuth = require('./driver-auth');
const staffAuth = require('./staff-auth');
const driverData = require('./driver-data');


// 1. CORS - MUST BE FIRST for production reliability
app.use(cors({
    origin: true, // Reflect the request origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
    credentials: true,
    maxAge: 86400
}));



app.get('/health', (req, res) => {
    try {
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (e) {
        console.error('[DEBUG] Health check failed:', e);
        res.status(500).send(e.message);
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

// 3. Admin Auth Middleware
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY_SOURCE = process.env.ADMIN_KEY ? 'process.env.ADMIN_KEY' : (process.env.VITE_ADMIN_KEY ? 'process.env.VITE_ADMIN_KEY' : 'NONE');
const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY || '').trim();
if (!ADMIN_KEY) console.error('CRITICAL: ADMIN_KEY not set in environment.');

if (!JWT_SECRET || !ADMIN_KEY) {
    console.warn('[SECURITY] CRITICAL: JWT_SECRET or ADMIN_KEY not set. Using insecure defaults is dangerous.');
} else {
    const maskedKey = ADMIN_KEY.substring(0, 4) + '...' + ADMIN_KEY.substring(ADMIN_KEY.length - 4);
    console.log(`[AUTH] ADMIN_KEY loaded from ${ADMIN_KEY_SOURCE}: ${maskedKey} (Length: ${ADMIN_KEY.length})`);
}

const PUBLIC_ROUTES = [
    '/admin/login', 
    '/driver/login', '/driver/forgot-password', '/driver/set-password',
    '/staff/login', '/staff/forgot-password', '/staff/set-password',
    '/health'
];

const adminAuth = async (req, res, next) => {
    // 0. Skip for preflight
    if (req.method === 'OPTIONS') return next();

    // 1. Whitelist public routes (relative to /api mount point)
    const path = req.path.replace(/\/$/, '');
    if (PUBLIC_ROUTES.includes(path)) {
        return next();
    }

    // 2. Check for Admin Key (Legacy/Internal) or JWT Token
    const adminKey = req.headers['x-admin-key'] || req.body?.adminKey || req.query?.adminKey;
    const authHeader = req.headers.authorization;

    // Check Admin Key
    if (adminKey && adminKey.trim() === ADMIN_KEY && ADMIN_KEY !== '') {
        return next();
    }

    // Diagnostic logging for auth failure
    if (adminKey || authHeader) {
        console.warn(`[AUTH] Authentication failure for ${req.method} ${req.path}`);
        console.warn(`  - Admin Key received: "${adminKey || '(none)'}" (Matches server? ${adminKey?.trim() === ADMIN_KEY})`);
        console.warn(`  - Auth Header: "${authHeader || '(none)'}"`);
        console.warn(`  - Full Headers: ${JSON.stringify(req.headers)}`);
    }

    // Check JWT Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            // 1. Full Admin/Superadmin Access
            if (decoded.role === 'superadmin' || decoded.role === 'admin') {
                const dbRes = await db.query('SELECT session_version FROM admins WHERE id = $1', [decoded.id]);
                if (dbRes.rows.length > 0) {
                    const currentVersion = dbRes.rows[0].session_version || 1;
                    if ((decoded.version || 1) < currentVersion) {
                        return res.status(401).json({ error: 'Session expired (password changed). Please log in again.' });
                    }
                }
                req.admin = decoded;
                return next();
            }

            // 2. Driver Access (Restricted to /driver and /documents)
            if (decoded.driverId && (path.startsWith('/driver') || path.startsWith('/documents'))) {
                req.driver = decoded;
                return next();
            }

            // 3. Staff Access (Restricted to /staff and /documents)
            if (decoded.staffId && (path.startsWith('/staff') || path.startsWith('/documents'))) {
                req.staff = decoded;
                return next();
            }
        } catch (e) {
            console.warn(`[AUTH] JWT Verification failed for ${path}: ${e.message}`);
            return res.status(401).json({ error: 'Session expired or invalid' });
        }
    }

    if (authHeader) {
        console.warn(`[AUTH] Unauthorized access (token missing or invalid role) for ${req.method} ${req.path}`);
    }

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
// Domain-based static serving (for driver.segecha.com, track.segecha.com etc)
app.use((req, res, next) => {
    const host = (req.hostname || req.get('host') || '').toLowerCase();
    if (host.startsWith('driver.')) return express.static(DRIVER_DIST)(req, res, next);
    if (host.startsWith('track.')) return express.static(TRACK_DIST)(req, res, next);
    if (host.startsWith('pay.') || host.startsWith('payment.')) return express.static(PAY_DIST)(req, res, next);
    next();
});
// 1. Specific Portals first (more specific routes)
app.use('/driver', express.static(DRIVER_DIST));
app.use('/track', express.static(TRACK_DIST));
app.use('/pay', express.static(PAY_DIST));
// 2. Root Admin Panel
app.use(express.static(ADMIN_DIST));
// Handle React routing (SPA)
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();

    const host = (req.hostname || req.get('host') || '').toLowerCase();

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
    if (existsSync(indexFile)) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(indexFile);
    }
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

        // 0. Schema Migrations (Ensure session_version exists for force-logout feature)
        await db.query(`
            DO $$ 
            BEGIN 
                -- Admin column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='session_version') THEN
                    ALTER TABLE admins ADD COLUMN session_version INTEGER DEFAULT 1;
                END IF;
                -- Documents columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='filename') THEN
                    ALTER TABLE documents ADD COLUMN filename TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='mime_type') THEN
                    ALTER TABLE documents ADD COLUMN mime_type TEXT;
                END IF;
                -- Staff columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='joined') THEN
                    ALTER TABLE staff ADD COLUMN joined TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='salary') THEN
                    ALTER TABLE staff ADD COLUMN salary DECIMAL(12,2);
                END IF;
                -- Drivers columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='email') THEN
                    ALTER TABLE drivers ADD COLUMN email TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='role') THEN
                    ALTER TABLE drivers ADD COLUMN role TEXT DEFAULT 'Driver';
                END IF;
            END $$;
        `);


        console.log(`[SEED] Syncing superadmin (${initialAdminEmail})...`);

        // 1. Core Admin Login (Always Sync password on boot during dev/staging)
        await db.query(`
            INSERT INTO admins (id, email, password_hash, role, display_name)
            VALUES ($1, $2, $3, 'superadmin', 'System Admin')
            ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
        `, [staffId, initialAdminEmail, initialHash]);

        // 2. Staff Record
        await db.query(`
            INSERT INTO staff (id, name, email, phone, role)
            VALUES ($1, 'System Admin', $2, $3, 'superadmin')
            ON CONFLICT (id) DO NOTHING
        `, [staffId, initialAdminEmail, initialAdminPhone]);

        // 3. Staff Portal Auth
        await db.query(`
            INSERT INTO staff_auth (staff_id, email, phone, password_hash, account_status)
            VALUES ($1, $2, $3, $4, 'active')
            ON CONFLICT (staff_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
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
app.get('/api/tracker/data', async (req, res) => {
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

// Normalize DB rows back to frontend field names
function normalizeTruck(t) {
    return { ...t, reg: t.registration_number, odom: t.current_mileage, ...t.metadata };
}
function normalizeTrailer(t) {
    return { ...t, reg: t.registration_number, ...t.metadata };
}
function normalizeDriver(d) {
    return { ...d, license: d.license_number, ...d.metadata };
}
function normalizeJourney(j) {
    return { ...j, truck: j.truck_id, driver: j.driver_id, date: j.start_date, endDate: j.end_date, dest: j.destination, cargo: j.cargo_type, customerId: j.customer_id, ...j.metadata };
}
function normalizeFuel(f) {
    return { ...f, truck: f.truck_id, journey: f.journey_id, ...f.metadata };
}
function normalizeExpense(e) {
    return { ...e, journey: e.journey_id, cat: e.category, desc: e.description, ...e.metadata };
}
function normalizeInvoice(i) {
    return { ...i, journey: i.journey_id, due: i.due_date, customerId: i.customer_id, ...i.metadata };
}
function normalizeMaintenance(m) {
    return { ...m, truck: m.truck_id, desc: m.description, ...m.metadata };
}
function normalizePayroll(p) {
    return { ...p, driver: p.entity_id, ...p.metadata };
}
function normalizeDocument(d) {
    return { 
        ...d, 
        entityType: d.entity_type, 
        entityId: d.entity_id, 
        expiryDate: d.expiry_date,
        mimeType: d.mime_type,
        ...d.metadata 
    };
}
function normalizeRow(table, row) {
    if (table === 'trucks') return normalizeTruck(row);
    if (table === 'trailers') return normalizeTrailer(row);
    if (table === 'drivers') return normalizeDriver(row);
    if (table === 'journeys') return normalizeJourney(row);
    if (table === 'fuel_logs') return normalizeFuel(row);
    if (table === 'expenses') return normalizeExpense(row);
    if (table === 'invoices') return normalizeInvoice(row);
    if (table === 'maintenance_logs') return normalizeMaintenance(row);
    if (table === 'payroll') return normalizePayroll(row);
    if (table === 'documents') return normalizeDocument(row);
    return row;
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

// Helper to upsert any entity into its table
// Note: upsertEntity is now imported from ./utils/db-helpers

// Generic utility functions for data normalization and database operations are now consolidated.





// Ensure directories exist
if (!existsSync(__dirname)) {
    // For local dev, but in production Render uses ephemeral disk anyway
}
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!require('fs').existsSync(BACKUPS_DIR)) {
    require('fs').mkdirSync(BACKUPS_DIR, { recursive: true });
}

async function backupEverything() {
    const backup = {
        version: '5.0',
        timestamp: new Date().toISOString(),
        tables: {}
    };
    for (const table of DB_TABLES) {
        const res = await db.query(`SELECT * FROM ${table}`);
        backup.tables[table] = res.rows.map(r => normalizeRow(table, r));
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

// Login
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
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
        res.json({ success: true, documents: result.rows.map(r => normalizeDocument(r)) });
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

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    console.log(`[DEBUG] Document Upload hit: ${req.method} ${req.url}`);
    console.log(`[DEBUG] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[DEBUG] File in req: ${req.file ? req.file.originalname : 'MISSING'}`);
    console.log(`[DEBUG] Body keys: ${Object.keys(req.body || {})}`);

    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        const isDoc = ['.pdf', '.doc', '.docx'].includes(ext);

        if (!isDoc) {
            return res.status(400).json({ error: 'Only PDF and DOC/DOCX files are allowed for documents.' });
        }

        const body = req.body || {};
        const { entityType, entityId, label, expiryDate, ...rest } = body;

        // Upload to Cloudflare R2
        const folder = `documents/${entityType}/${entityId}`;
        const key = `${folder}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);

        const id = Date.now().toString();
        await db.query(
            'INSERT INTO documents (id, entity_type, entity_id, label, url, expiry_date, metadata, filename, mime_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, entityType, entityId, label || req.file.originalname, url, expiryDate || null, JSON.stringify(rest), req.file.originalname, req.file.mimetype]
        );

        res.json({ success: true, document: { id, entityType, entityId, label: label || req.file.originalname, url, expiryDate, ...rest } });
    } catch (e) {
        console.error('DOC_UPLOAD_ERROR:', e);
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


// Admin upload (Cloudinary for images, R2 for docs)
app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        const isDoc = ['.pdf', '.doc', '.docx'].includes(ext);
        const folder = req.body.folder || 'admin_uploads';


        if (isDoc) {
            // Upload to Cloudflare R2
            const key = `${folder}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
            return res.json({ success: true, url });
        } else if (isImage) {
            // Upload to Cloudinary
            const result = await uploadBuffer(req.file.buffer, folder, req.file.originalname);
            return res.json({ success: true, url: result.secure_url });
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Use PDF, DOC, or Images.' });
        }
    } catch (e) {
        res.status(500).json({ error: 'File upload failed' });
    }
});


// Generic update for collections
app.put('/api/admin/:col/:id', (req, res) => {
    res.status(501).json({ error: 'PUT not directly supported for generic collections yet. Please use POST to upsert.' });
});

// Generic Admin Entity Delete
app.delete('/api/admin/:table/:id', async (req, res) => {
    let { table, id } = req.params;

    // Map camelCase from frontend to snake_case in DB
    if (table === 'maintenanceLogs') table = 'maintenance_logs';
    if (table === 'fuel') table = 'fuel_logs';
    if (table === 'tyreLogs') table = 'tyre_logs';

    const allowed = ['trucks', 'drivers', 'staff', 'journeys', 'fuel_logs', 'expenses', 'incidents', 'customers', 'trailers', 'payroll', 'invoices', 'payments', 'maintenance_logs', 'tyre_logs'];

    if (!allowed.includes(table)) {
        return res.status(400).json({ error: 'Invalid entity type: ' + table });
    }

    try {
        await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
        res.json({ success: true, message: `Deleted ${id} from ${table}` });
    } catch (e) {
        console.error(`DELETE_ERROR (${table}):`, e);
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

// Deep Reset - Wipes all server data
app.post('/api/admin/reset', async (req, res) => {
    try {
        // 1. Reset all database tables (CASCADE handles order)
        for (const table of DB_TABLES) {
            await db.query(`TRUNCATE TABLE ${table} CASCADE`);
        }

        // 2. Re-seed default superadmin to prevent lockout
        const defaultEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com';
        const defaultPass = 'segecha2025';
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(defaultPass, salt);
        const adminId = 'adm-' + Math.random().toString(36).substr(2, 9);

        await db.query(
            'INSERT INTO admins (id, email, password_hash, display_name, role) VALUES ($1, $2, $3, $4, $5)',
            [adminId, defaultEmail, hash, 'System Administrator', 'superadmin']
        );

        res.json({ success: true, message: 'All database data destroyed and re-seeded.' });
    } catch (e) {
        console.error('RESET_ERROR:', e);
        res.status(500).json({ error: 'Reset failed: ' + e.message });
    }
});

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

// Get current system settings
app.get('/api/admin/settings', async (req, res) => {
    try {
        const result = await db.query("SELECT key, value FROM system_settings");
        const settings = {};
        result.rows.forEach(r => settings[r.key] = r.value);
        res.json({ success: true, settings });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update system settings (Unified segecha_settings blob)
app.post('/api/admin/settings', async (req, res) => {
    const { settings } = req.body;
    try {
        await saveSystemSetting('segecha_settings', settings);
        res.json({ success: true, message: 'Settings saved to database' });
    } catch (e) {
        console.error('SETTINGS_SAVE_ERROR:', e);
        res.status(500).json({ error: 'Failed to save settings: ' + e.message });
    }
});

app.post('/api/tracker/data', async (req, res) => {
    const { data } = req.body;
    try {
        if (!data) return res.status(400).json({ error: 'No data provided' });
        await syncFullData(data);
        res.json({ success: true, message: 'Live data synchronized to PostgreSQL' });
    } catch (e) {
        console.error('SYNC_ERROR:', e);
        res.status(500).json({ error: 'Sync failed: ' + e.message });
    }
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

        require('fs').writeFileSync(path.join(BACKUPS_DIR, filename), JSON.stringify(backup, null, 2));
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
        require('fs').writeFileSync(path.join(BACKUPS_DIR, filename), JSON.stringify(backup, null, 2));
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
    const { driverId, email, phone, driverName } = req.body;
    try {
        // Ensure driver record exists (prerequisite for auth)
        await db.query(`
            INSERT INTO drivers (id, name, email, phone)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone
        `, [driverId, driverName || 'Driver', email, phone || '']);

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
        res.status(500).json({ error: e.message });
    }
});


app.post('/api/driver/account/regenerate-credentials', async (req, res) => {
    const { driverId, email, phone, driverName, forcePasswordReset } = req.body;
    try {
        // Ensure driver record exists (foreign key prerequisite)
        await db.query(`
            INSERT INTO drivers (id, name, email, phone)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone
        `, [driverId, driverName || 'Driver', email, phone || '']);

        const result = await driverAuth.regenerateDriverCredentials(driverId, { email, phone, forcePasswordReset });
        res.json(result);
    } catch (e) {
        console.error('DRIVER_REGEN_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});


app.get('/api/driver/account-export/:id', async (req, res) => {
    try {
        const exportData = await driverAuth.exportDriverAccount(req.params.id);
        if (!exportData) return res.status(404).json({ error: 'Account not found' });
        res.json(exportData);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/driver/account/:id', async (req, res) => {
    try {
        const success = await driverAuth.deleteDriverAccount(req.params.id);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- STAFF ACCOUNT MANAGEMENT (ADMIN) ---

app.post('/api/staff/save', async (req, res) => {
    try {
        await upsertEntity('staff', req.body);
        res.json({ success: true });
    } catch (e) {
        console.error('STAFF_SAVE_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/save', async (req, res) => {
    try {
        await upsertEntity('drivers', req.body);
        res.json({ success: true });
    } catch (e) {
        console.error('DRIVER_SAVE_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

// Generic Admin Entity Save
app.post('/api/admin/:table', async (req, res) => {
    const { table } = req.params;

    // Validate table name against allowed list
    const allowed = ['trucks', 'drivers', 'staff', 'journeys', 'fuel_logs', 'expenses', 'incidents', 'customers', 'trailers', 'payroll', 'invoices', 'payments', 'maintenance_logs', 'tyre_logs'];
    if (!allowed.includes(table)) {
        return res.status(400).json({ error: 'Invalid entity type: ' + table });
    }

    try {
        await upsertEntity(table, req.body);
        res.json({ success: true });
    } catch (e) {
        // Fallback for some pluralization differences between frontend collections and DB tables
        if (e.message.includes('relation') && e.message.includes('does not exist')) {
            try {
                // Try plural if singular failed, or vice versa
                const fallbackTable = table.endsWith('s') ? table.slice(0, -1) : table + 's';
                await upsertEntity(fallbackTable, req.body);
                return res.json({ success: true });
            } catch (innerE) { /* ignore and throw original */ }
        }
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/staff/create-account', async (req, res) => {
    const { staffId, email, phone, name, role } = req.body;
    try {
        // Ensure staff record exists in the staff table (foreign key prerequisite)
        await db.query(`
            INSERT INTO staff (id, name, email, phone, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, role = EXCLUDED.role
        `, [staffId, name || 'Staff Member', email, phone || '', role || 'Staff']);

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
    const { staffId, email, phone, name, role, forcePasswordReset } = req.body;
    try {
        // Ensure staff record exists (foreign key prerequisite)
        await db.query(`
            INSERT INTO staff (id, name, email, phone, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, role = EXCLUDED.role
        `, [staffId, name || 'Staff Member', email, phone || '', role || 'Staff']);

        const result = await staffAuth.regenerateStaffCredentials(staffId, { email, phone, forcePasswordReset });
        res.json(result);
    } catch (e) {
        console.error('STAFF_REGEN_ERROR:', e);
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

app.get('/api/driver/portal-data', driverAuth.authMiddleware, async (req, res) => {
    try {
        const data = await driverData.getDriverData(req.driver.driverId);
        if (!data) return res.status(404).json({ error: 'Driver data not found' });
        res.json({ success: true, ...data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journeys/status', driverAuth.authMiddleware, async (req, res) => {
    const { journeyId, status, ...extras } = req.body;
    try {
        const result = await driverData.updateJourneyStatus(req.driver.driverId, journeyId, status, extras);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journey/:id/status', driverAuth.authMiddleware, async (req, res) => {
    const { status, ...extras } = req.body;
    try {
        const result = await driverData.updateJourneyStatus(req.driver.driverId, req.params.id, status, extras);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journey/:id/customers', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await driverData.updateJourneyPartyCustomers(req.driver.driverId, req.params.id, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journeys/start-request', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await driverData.createJourneyStartRequest(req.driver.driverId, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/fuel', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await driverData.addPendingSubmission(req.driver.driverId, 'fuel', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/expense', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await driverData.addPendingSubmission(req.driver.driverId, 'expense', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/incident', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await driverData.addPendingSubmission(req.driver.driverId, 'incident', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/maintenance', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await driverData.addPendingSubmission(req.driver.driverId, 'maintenance', req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/journeys/start-placeholder', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await driverData.createJourneyStartPlaceholder(req.driver.driverId, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/upload', driverAuth.authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        const folder = req.body.folder || `drivers/${req.driver.driverId}`;

        if (isImage) {
            const result = await uploadBuffer(req.file.buffer, folder);
            res.json({ success: true, url: result.secure_url });
        } else {
            // General driver upload (like a scan of something) - use R2
            const key = `${folder}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
            res.json({ success: true, url });
        }
    } catch (e) {
        console.error('DRIVER_UPLOAD_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/documents/mine', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM documents WHERE entity_id = $1 OR metadata->>\'driverId\' = $1',
            [req.driver.driverId]
        );
        res.json({ success: true, documents: result.rows.map(r => normalizeDocument(r)) });
    } catch (e) {
        console.error('DOCUMENTS_MINE_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/documents/driver-upload', driverAuth.authMiddleware, upload.single('file'), async (req, res) => {
    console.log(`[DEBUG] Driver Document Upload hit: ${req.method} ${req.url}`);
    console.log(`[DEBUG] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[DEBUG] File in req: ${req.file ? req.file.originalname : 'MISSING'}`);
    console.log(`[DEBUG] Body keys: ${Object.keys(req.body || {})}`);

    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        const isDoc = ['.pdf', '.doc', '.docx'].includes(ext);

        if (!isDoc) {
            return res.status(400).json({ error: 'Only PDF and DOC/DOCX files are allowed for documents.' });
        }

        const body = req.body || {};
        const folder = `documents/driver/${req.driver.driverId}`;
        const key = `${folder}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);

        const id = Date.now().toString();
        const { docType, label, expiryDate, ...metadata } = body;

        await db.query(
            'INSERT INTO documents (id, entity_type, entity_id, label, url, expiry_date, metadata, filename, mime_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, 'driver', req.driver.driverId, label || req.file.originalname, url, expiryDate || null, JSON.stringify(metadata), req.file.originalname, req.file.mimetype]
        );

        res.json({
            success: true,
            document: {
                id,
                entityType: 'driver',
                entityId: req.driver.driverId,
                label: label || req.file.originalname,
                url,
                expiryDate,
                ...metadata
            }
        });
    } catch (e) {
        console.error('DRIVER_DOC_UPLOAD_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- DRIVER LOGIN & AUTH ---
app.post('/api/driver/login', async (req, res) => {
    const { identifier, password, method } = req.body;
    const result = await driverAuth.loginDriver(identifier, password, method);
    if (!result.success) return res.status(200).json(result);
    res.json(result);
});

app.post('/api/driver/forgot-password', async (req, res) => {
    const { identifier } = req.body;
    try {
        const result = await driverAuth.requestPasswordReset(identifier);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/driver/set-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const result = await driverAuth.resetPasswordWithToken(token, password);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- STAFF LOGIN & AUTH ---
app.post('/api/staff/login', async (req, res) => {
    const { identifier, password, method } = req.body;
    const result = await staffAuth.loginStaff(identifier, password, method);
    if (!result.success) return res.status(200).json(result);
    res.json(result);
});

app.post('/api/staff/forgot-password', async (req, res) => {
    const { identifier } = req.body;
    const result = await staffAuth.requestStaffPasswordReset(identifier);
    res.json(result);
});

app.post('/api/staff/set-password', async (req, res) => {
    const { token, password } = req.body;
    const result = await staffAuth.resetStaffPasswordWithToken(token, password);
    res.json(result);
});


// Global Error Handler

app.use((err, req, res, next) => {
    console.error('SERVER_ERROR:', err);
    writeFileSync(path.join(__dirname, 'error.log'), `${new Date().toISOString()} - ${req.url} - ${err.message}\n${err.stack}\n\n`, { flag: 'a' });
    res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
});

module.exports = { app, db };


