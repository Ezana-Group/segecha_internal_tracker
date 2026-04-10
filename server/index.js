const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } = require('fs');
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

/** Custom R2 public hostname (e.g. files.example.com) for CSP img/connect — *.r2.dev already allowed */
function cspOriginsFromR2PublicUrl() {
    const u = process.env.R2_PUBLIC_URL;
    if (!u) return [];
    try {
        const { origin } = new URL(u);
        if (origin && !/\.r2\.dev$/i.test(origin)) return [origin];
    } catch { /* ignore */ }
    return [];
}

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
const { persistUploadedFile } = require('./persistUpload');
const {
    isR2Configured,
    uploadBackupToR2,
    listR2Backups,
    getR2ObjectBuffer,
    BACKUPS_PREFIX,
    uploadToR2,
    buildKey,
} = require('./r2');
const PDFDocument = require('pdfkit');
const { sendPayslipEmail } = require('./email');


// 1. Security headers — must come before routes (HIGH-01)
// CSP allows the API origin and external resources used by the SPA
const API_ORIGIN = process.env.API_URL || process.env.PAYMENT_API || '';
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            // Allow blob: previews created by the browser for local uploads.
            imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.r2.dev', ...cspOriginsFromR2PublicUrl()],
            connectSrc: ["'self'", ...(API_ORIGIN ? [API_ORIGIN] : []), ...cspOriginsFromR2PublicUrl()],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        }
    },
    crossOriginEmbedderPolicy: false, // Needed for some SPA assets
}));

// 2. CORS — whitelist explicit origins only (CRIT-01)
// Apply only to /api routes — static assets never need CORS headers
//
// Typical env (matches .env.example.local / SYSTEM_AUDIT):
//   TRACKER_URL      → admin SPA (e.g. https://dash.segecha.com)
//   PORTAL_URL       → payment / secondary portal origin (browser payment flow uses this)
//   DRIVER_PORTAL_URL, ADMIN_PORTAL_URL → as named
// Optional additions when those apps use their own hostname:
//   TRACK_PORTAL_URL or TRACK_URL → public track SPA (e.g. https://track.segecha.com)
//   PAYMENT_PORTAL_URL → only if payment origin is not the same as PORTAL_URL
const ALLOWED_ORIGINS = [...new Set([
    process.env.TRACKER_URL,
    process.env.PORTAL_URL,
    process.env.DRIVER_PORTAL_URL,
    process.env.ADMIN_PORTAL_URL,
    process.env.TRACK_PORTAL_URL,
    process.env.TRACK_URL,
    process.env.PAYMENT_PORTAL_URL,
].filter(Boolean))];

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


// Default body limit is ~100kb — too small for fuel/expense photos (base64) and full tracker sync payloads (413).
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '32mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
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

const clientErrorLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many error reports. Try again later.' },
});

// 4. Admin Auth Middleware
const JWT_SECRET = process.env.JWT_SECRET;
// ADMIN_KEY: only use ADMIN_KEY, never fall back to the frontend VITE_ADMIN_KEY (CRIT-09, LOW-01)
const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();
const ALLOW_ADMIN_KEY_AUTH = String(process.env.ALLOW_ADMIN_KEY_AUTH || 'false').toLowerCase() === 'true';
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
    '/client-error',
];

// Driver/staff portal routes — protected by driverAuth.authMiddleware / staffAuth.authMiddleware,
// NOT by adminAuth. These prefixes bypass adminAuth so the JWT middleware on each route can run.
// NOTE: admin-managed account routes (/driver/create-account, /driver/account-status, etc.)
// are NOT listed here and remain admin-protected.
const DRIVER_PORTAL_PREFIXES = [
    '/driver/me',
    '/driver/portal-data',
    '/driver/journey/',
    '/driver/journeys/',
    '/driver/fuel',
    '/driver/expense',
    '/driver/incident',
    '/driver/maintenance',
    '/driver/upload',
    '/documents/mine',
    '/documents/driver-upload',
];

const STAFF_PORTAL_PREFIXES = [
    '/staff/me',
    '/staff/portal-data',
];

const adminAuth = async (req, res, next) => {
    // 0. Skip for preflight
    if (req.method === 'OPTIONS') return next();

    // 1. Whitelist public routes (relative to /api mount point)
    const path = req.path.replace(/\/$/, '');
    if (PUBLIC_ROUTES.includes(path)) {
        return next();
    }

    // 2. Pass through driver/staff portal routes — they have their own JWT middleware
    if (
        DRIVER_PORTAL_PREFIXES.some(p => path === p || path.startsWith(p)) ||
        STAFF_PORTAL_PREFIXES.some(p => path === p || path.startsWith(p))
    ) {
        return next();
    }

    // 2. Check for Admin Key (header only — never accept from body or query) or JWT Token (CRIT-09)
    const adminKey = req.headers['x-admin-key'];
    const authHeader = req.headers.authorization;

    // Admin key bypass is disabled by default; allow only for controlled break-glass scenarios.
    if (ALLOW_ADMIN_KEY_AUTH && adminKey && adminKey.trim() === ADMIN_KEY && ADMIN_KEY !== '') {
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
        // Graceful fallback for stale hashed entry assets (e.g. cached index.html
        // requesting /assets/index-OLDHASH.js after a redeploy).
        const staleEntryMatch = req.path.match(/^\/assets\/index-[^/]+\.(js|css)$/i);
        if (staleEntryMatch) {
            try {
                const ext = staleEntryMatch[1].toLowerCase();
                const assetsDir = path.join(distPath, 'assets');
                if (existsSync(assetsDir)) {
                    const candidates = readdirSync(assetsDir)
                        .filter((f) => new RegExp(`^index-[^/]+\\.${ext}$`, 'i').test(f))
                        .map((f) => ({ name: f, full: path.join(assetsDir, f) }))
                        .filter((f) => existsSync(f.full))
                        .sort((a, b) => {
                            try {
                                const aStat = statSync(a.full).mtimeMs;
                                const bStat = statSync(b.full).mtimeMs;
                                return bStat - aStat;
                            } catch {
                                return 0;
                            }
                        });
                    if (candidates.length > 0) {
                        console.warn(`[SERVER] Missing ${req.path}; serving fallback ${candidates[0].name}`);
                        return res.sendFile(candidates[0].full);
                    }
                }
            } catch (e) {
                console.warn('[SERVER] Asset fallback failed:', e.message);
            }
        }
        console.warn(`[SERVER] Asset not found: ${req.path}`);
        return res.status(404).set('Content-Type', 'text/plain').send('Asset not found');
    }

    // SPA fallback — same cache policy as express.static so HTML is not cached at the edge
    // while hashed /assets/* stay long-lived (see staticOpts).
    const indexFile = path.join(distPath, 'index.html');
    if (existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
                -- updated_at columns needed by upsertCollectionRow UPDATE … updated_at = NOW()
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trucks' AND column_name='updated_at') THEN
                    ALTER TABLE trucks ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trailers' AND column_name='updated_at') THEN
                    ALTER TABLE trailers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='updated_at') THEN
                    ALTER TABLE drivers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='email') THEN
                    ALTER TABLE drivers ADD COLUMN email TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='personal_email') THEN
                    ALTER TABLE drivers ADD COLUMN personal_email TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='national_id') THEN
                    ALTER TABLE drivers ADD COLUMN national_id TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='date_of_birth') THEN
                    ALTER TABLE drivers ADD COLUMN date_of_birth DATE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='employee_number') THEN
                    ALTER TABLE drivers ADD COLUMN employee_number TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='kra_pin') THEN
                    ALTER TABLE drivers ADD COLUMN kra_pin TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='updated_at') THEN
                    ALTER TABLE staff ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='national_id') THEN
                    ALTER TABLE staff ADD COLUMN national_id TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='employee_number') THEN
                    ALTER TABLE staff ADD COLUMN employee_number TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='kra_pin') THEN
                    ALTER TABLE staff ADD COLUMN kra_pin TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='updated_at') THEN
                    ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journeys' AND column_name='updated_at') THEN
                    ALTER TABLE journeys ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
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
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payment_reference') THEN
                    ALTER TABLE payroll ADD COLUMN payment_reference TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payment_date') THEN
                    ALTER TABLE payroll ADD COLUMN payment_date DATE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payment_confirmed_at') THEN
                    ALTER TABLE payroll ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payslip_dispatch_allowed') THEN
                    ALTER TABLE payroll ADD COLUMN payslip_dispatch_allowed BOOLEAN DEFAULT FALSE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs' AND column_name='updated_at') THEN
                    ALTER TABLE maintenance_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_logs' AND column_name='updated_at') THEN
                    ALTER TABLE tyre_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='updated_at') THEN
                    ALTER TABLE incidents ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
                -- status columns used by ADMIN_COLLECTIONS extract functions
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_logs' AND column_name='status') THEN
                    ALTER TABLE fuel_logs ADD COLUMN status TEXT DEFAULT 'Pending';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='status') THEN
                    ALTER TABLE expenses ADD COLUMN status TEXT DEFAULT 'Pending';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='truck_id') THEN
                    ALTER TABLE expenses ADD COLUMN truck_id TEXT REFERENCES trucks(id) ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journeys' AND column_name='deposit_amount') THEN
                    ALTER TABLE journeys ADD COLUMN deposit_amount DECIMAL(14,2) DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journeys' AND column_name='deposit_date') THEN
                    ALTER TABLE journeys ADD COLUMN deposit_date DATE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journeys' AND column_name='final_payment_amount') THEN
                    ALTER TABLE journeys ADD COLUMN final_payment_amount DECIMAL(14,2) DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journeys' AND column_name='final_payment_date') THEN
                    ALTER TABLE journeys ADD COLUMN final_payment_date DATE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='paid_amount') THEN
                    ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(14,2) DEFAULT 0;
                END IF;
            END $$;
        `);

        // Create assets table if not exists (added in ProductionV7)
        await db.query(`
            CREATE TABLE IF NOT EXISTS assets (
                id                  TEXT PRIMARY KEY,
                name                TEXT NOT NULL,
                category            TEXT NOT NULL,
                purchase_date       DATE,
                cost                DECIMAL(14,2) DEFAULT 0,
                salvage_value       DECIMAL(14,2) DEFAULT 0,
                useful_life_years   INTEGER DEFAULT 5,
                depreciation_method TEXT DEFAULT 'straight-line',
                supplier            TEXT,
                linked_truck_id     TEXT REFERENCES trucks(id) ON DELETE SET NULL,
                status              TEXT DEFAULT 'Active',
                metadata            JSONB DEFAULT '{}',
                created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='updated_at') THEN
                    ALTER TABLE assets ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS error_logs (
                id BIGSERIAL PRIMARY KEY,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                source TEXT NOT NULL,
                level TEXT NOT NULL DEFAULT 'error',
                message TEXT NOT NULL,
                stack TEXT,
                url TEXT,
                user_agent TEXT,
                meta JSONB DEFAULT '{}'
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs (source);`);
        await db.query(`
            CREATE TABLE IF NOT EXISTS mpesa_transactions (
                id TEXT PRIMARY KEY,
                txn_date DATE,
                direction TEXT NOT NULL DEFAULT 'Incoming',
                amount DECIMAL(14,2) DEFAULT 0,
                reference TEXT,
                counterparty_name TEXT,
                counterparty_phone TEXT,
                linked_type TEXT,
                linked_id TEXT,
                status TEXT DEFAULT 'Unreconciled',
                notes TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`
            DO $$
            BEGIN
                -- Backward compatibility: older schemas used "date" instead of "txn_date".
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mpesa_transactions' AND column_name='txn_date') THEN
                    ALTER TABLE mpesa_transactions ADD COLUMN txn_date DATE;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mpesa_transactions' AND column_name='date') THEN
                    UPDATE mpesa_transactions
                    SET txn_date = COALESCE(txn_date, date)
                    WHERE txn_date IS NULL;
                END IF;
            END $$;
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_mpesa_txn_date ON mpesa_transactions (txn_date DESC);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_mpesa_reference ON mpesa_transactions (reference);`);
        await db.query(`
            CREATE TABLE IF NOT EXISTS payroll_statutory_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config_type TEXT NOT NULL,
                formula JSONB DEFAULT '{}',
                effective_date DATE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_by TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS payroll_statutory_change_log (
                id BIGSERIAL PRIMARY KEY,
                config_name TEXT NOT NULL,
                old_value JSONB,
                new_value JSONB,
                changed_by TEXT,
                changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                effective_date DATE
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS deduction_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                default_amount DECIMAL(12,2) DEFAULT 0,
                default_type TEXT DEFAULT 'fixed',
                requires_authorization BOOLEAN DEFAULT FALSE,
                metadata JSONB DEFAULT '{}',
                created_by TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS employee_deductions (
                id TEXT PRIMARY KEY,
                entity_id TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                deduction_type TEXT NOT NULL,
                name TEXT NOT NULL,
                amount DECIMAL(12,2) DEFAULT 0,
                amount_type TEXT DEFAULT 'fixed',
                start_month TEXT,
                end_month TEXT,
                remaining_balance DECIMAL(12,2) DEFAULT 0,
                authorization_ref TEXT,
                employee_acknowledged BOOLEAN DEFAULT FALSE,
                employee_acknowledged_at TIMESTAMPTZ,
                metadata JSONB DEFAULT '{}',
                created_by TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS payslip_dispatch_queue (
                id TEXT PRIMARY KEY,
                payroll_id TEXT NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
                recipient_email TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER DEFAULT 0,
                last_error TEXT,
                scheduled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMPTZ,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS ledger_entries (
                id TEXT PRIMARY KEY,
                entry_date DATE NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                account_code TEXT NOT NULL,
                account_name TEXT NOT NULL,
                debit DECIMAL(14,2) DEFAULT 0,
                credit DECIMAL(14,2) DEFAULT 0,
                currency TEXT DEFAULT 'KES',
                notes TEXT,
                metadata JSONB DEFAULT '{}',
                created_by TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
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

        const schemaHealth = await getSchemaHealth();
        if (!schemaHealth.ok) {
            console.warn('[SCHEMA] Missing tables:', schemaHealth.missingTables);
            console.warn('[SCHEMA] Missing columns:', schemaHealth.missingColumns);
        } else {
            console.log('[SCHEMA] Health check passed: required tables/columns are present.');
        }

        console.log(`[SEED] SUCCESS: Superadmin created (${initialAdminEmail}). Password is your ADMIN_KEY.`);
    } catch (e) {
        console.warn('[SEED] Skipping auto-seed (likely DB not ready):', e.message);
    }
}
autoSeed();

// --- AUTHENTICATED ENDPOINTS ---

async function writeErrorLog({
    source = 'server',
    level = 'error',
    message = '(no message)',
    stack = null,
    url = null,
    userAgent = null,
    meta = {},
} = {}) {
    try {
        await db.query(
            `INSERT INTO error_logs (source, level, message, stack, url, user_agent, meta)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
            [
                String(source).slice(0, 32),
                String(level).slice(0, 24),
                String(message).slice(0, 4000),
                stack != null ? String(stack).slice(0, 12000) : null,
                url != null ? String(url).slice(0, 2000) : null,
                userAgent != null ? String(userAgent).slice(0, 500) : null,
                JSON.stringify(meta && typeof meta === 'object' ? meta : {}),
            ]
        );
    } catch (e) {
        console.warn('[error-log-write-failed]', e.message);
    }
}

// Public client error reporting (all SPAs: dash, driver, track, payment)
app.post('/api/client-error', clientErrorLimiter, async (req, res) => {
    try {
        const body = req.body || {};
        const allowed = new Set(['admin', 'driver', 'track', 'payment', 'server', 'backend', 'frontend', 'database', 'unknown']);
        const source = allowed.has(String(body.source)) ? body.source : 'unknown';
        const level = String(body.level || 'error').slice(0, 24);
        const message = String(body.message || '(no message)').slice(0, 4000);
        const stack = body.stack != null ? String(body.stack).slice(0, 12000) : null;
        const url = body.url != null ? String(body.url).slice(0, 2000) : null;
        const userAgent = body.userAgent != null ? String(body.userAgent).slice(0, 500) : null;
        let meta = {};
        if (body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)) {
            try {
                meta = JSON.parse(JSON.stringify(body.meta));
            } catch { /* ignore */ }
        }
        await writeErrorLog({ source, level, message, stack, url, userAgent, meta });
        res.json({ success: true });
    } catch (e) {
        console.warn('[client-error] insert failed:', e.message);
        res.status(500).json({ success: false });
    }
});

// Admin: recent client / portal error logs
app.get('/api/admin/error-logs', async (req, res) => {
    try {
        const lim = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 150));
        const src = req.query.source ? String(req.query.source).slice(0, 32) : null;
        let rows;
        if (src) {
            rows = await db.query(
                `SELECT id, created_at, source, level, message, stack, url, user_agent, meta
                 FROM error_logs WHERE source = $1 ORDER BY created_at DESC LIMIT $2`,
                [src, lim]
            );
        } else {
            rows = await db.query(
                `SELECT id, created_at, source, level, message, stack, url, user_agent, meta
                 FROM error_logs ORDER BY created_at DESC LIMIT $1`,
                [lim]
            );
        }
        res.json({ success: true, logs: rows.rows });
    } catch (e) {
        console.error('[error-logs]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Admin: verify schema completeness expected by frontend/backend flows
app.get('/api/admin/schema-health', async (_req, res) => {
    try {
        const health = await getSchemaHealth();
        res.json({ success: true, ...health });
    } catch (e) {
        await writeErrorLog({
            source: 'database',
            level: 'error',
            message: e.message || 'Failed to compute schema health',
            stack: e.stack || null,
            meta: { endpoint: '/api/admin/schema-health' },
        });
        res.status(500).json({ error: e.message });
    }
});

// Admin: pull M-Pesa transactions from external API (wire-up endpoint)
app.get('/api/admin/mpesa/transactions', async (req, res) => {
    try {
        const providerUrl = process.env.MPESA_TRANSACTIONS_URL || '';
        if (!providerUrl) {
            return res.json({ success: true, transactions: [] });
        }
        const qs = new URLSearchParams();
        if (req.query.limit) qs.set('limit', String(req.query.limit));
        if (req.query.from) qs.set('from', String(req.query.from));
        if (req.query.to) qs.set('to', String(req.query.to));
        const url = `${providerUrl}${providerUrl.includes('?') ? '&' : '?'}${qs.toString()}`;
        const headers = {};
        if (process.env.MPESA_API_KEY) headers['Authorization'] = `Bearer ${process.env.MPESA_API_KEY}`;
        const upstream = await fetch(url, { headers });
        const payload = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
            await writeErrorLog({
                source: 'backend',
                level: 'error',
                message: `M-Pesa upstream error: ${upstream.status}`,
                meta: { providerUrl, status: upstream.status, payload },
            });
            return res.status(502).json({ error: payload.error || `Upstream HTTP ${upstream.status}` });
        }
        const tx = Array.isArray(payload.transactions) ? payload.transactions : (Array.isArray(payload.data) ? payload.data : []);
        res.json({ success: true, transactions: tx });
    } catch (e) {
        await writeErrorLog({
            source: 'backend',
            level: 'error',
            message: e.message || 'Failed to fetch M-Pesa transactions',
            stack: e.stack || null,
            meta: { endpoint: '/api/admin/mpesa/transactions' },
        });
        res.status(500).json({ error: e.message });
    }
});

function inDateRange(dateLike, from, to) {
    if (!dateLike) return true;
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return true;
    if (from) {
        const f = new Date(from);
        if (!Number.isNaN(f.getTime()) && d < f) return false;
    }
    if (to) {
        const t = new Date(to);
        if (!Number.isNaN(t.getTime()) && d > t) return false;
    }
    return true;
}

// Admin: tax summary foundation (VAT, WHT, corporate tax estimate)
app.get('/api/admin/reports/tax-summary', async (req, res) => {
    try {
        const from = req.query.from ? String(req.query.from) : '';
        const to = req.query.to ? String(req.query.to) : '';
        const defaultVatRate = Number(req.query.vatRate || 0.16);

        const invoices = (await db.query('SELECT amount, due_date, metadata FROM invoices')).rows || [];
        const expenses = (await db.query('SELECT amount, date, metadata FROM expenses')).rows || [];

        let outputVat = 0;
        let vatableRevenue = 0;
        let inputVat = 0;
        let vatablePurchases = 0;
        let whtResident3 = 0;
        let whtNonResident5 = 0;

        for (const inv of invoices) {
            const meta = inv.metadata || {};
            const rowDate = meta.invoiceDate || inv.due_date || meta.date;
            if (!inDateRange(rowDate, from, to)) continue;
            const amount = Number(meta.subtotal ?? inv.amount ?? 0);
            const vatable = Boolean(meta.vatable === true || meta.vatApplicable === true);
            const vatRate = Number(meta.vatRate ?? defaultVatRate);
            if (vatable && amount > 0) {
                vatableRevenue += amount;
                outputVat += amount * vatRate;
            }
        }

        for (const ex of expenses) {
            const meta = ex.metadata || {};
            const rowDate = meta.date || ex.date;
            if (!inDateRange(rowDate, from, to)) continue;
            const amount = Number(meta.amount ?? ex.amount ?? 0);
            const vatable = Boolean(meta.vatable === true || meta.vatApplicable === true);
            const vatRate = Number(meta.vatRate ?? defaultVatRate);
            if (vatable && amount > 0) {
                vatablePurchases += amount;
                inputVat += amount * vatRate;
            }

            const whtClass = String(meta.whtClass || '').toLowerCase();
            if (whtClass === 'resident') whtResident3 += amount * 0.03;
            if (whtClass === 'non-resident' || whtClass === 'nonresident') whtNonResident5 += amount * 0.05;
        }

        const vatPayable = Math.max(0, outputVat - inputVat);
        const netOperatingProfit = Number(req.query.netOperatingProfit || 0);
        const corporateTaxProvision = Math.max(0, netOperatingProfit * 0.30);

        res.json({
            success: true,
            period: { from: from || null, to: to || null },
            vat: {
                outputVat: Number(outputVat.toFixed(2)),
                inputVat: Number(inputVat.toFixed(2)),
                vatPayable: Number(vatPayable.toFixed(2)),
                vatableRevenue: Number(vatableRevenue.toFixed(2)),
                vatablePurchases: Number(vatablePurchases.toFixed(2)),
            },
            wht: {
                resident3: Number(whtResident3.toFixed(2)),
                nonResident5: Number(whtNonResident5.toFixed(2)),
                total: Number((whtResident3 + whtNonResident5).toFixed(2)),
            },
            corporateTax: {
                netOperatingProfit: Number(netOperatingProfit.toFixed(2)),
                provision30pct: Number(corporateTaxProvision.toFixed(2)),
            },
        });
    } catch (e) {
        await writeErrorLog({
            source: 'backend',
            level: 'error',
            message: e.message || 'Failed to generate tax summary report',
            stack: e.stack || null,
            meta: { endpoint: '/api/admin/reports/tax-summary' },
        });
        res.status(500).json({ error: e.message });
    }
});

function daysBetween(a, b) {
    const da = new Date(a);
    const db = new Date(b);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
    return Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function extractInvoicePaidAmount(invoice) {
    const meta = invoice?.metadata || {};
    const paidAmount =
        Number(meta.paidAmount ?? invoice.paid_amount ?? invoice.paidAmount ?? 0) ||
        Number(Array.isArray(meta.payments)
            ? meta.payments.reduce((s, p) => s + Number(p?.amount || 0), 0)
            : 0);
    return Number.isFinite(paidAmount) ? paidAmount : 0;
}

function monthStartEnd(month) {
    const m = String(month || '');
    if (!/^\d{4}-\d{2}$/.test(m)) return null;
    const start = `${m}-01`;
    const d = new Date(`${m}-01T00:00:00.000Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    const end = `${m}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return { start, end };
}

function toCsv(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

app.get('/api/admin/reports/receivables-payables', async (req, res) => {
    try {
        const from = req.query.from ? String(req.query.from) : '';
        const to = req.query.to ? String(req.query.to) : '';
        const today = new Date().toISOString().slice(0, 10);

        const invoiceRows = (await db.query('SELECT id, amount, due_date, customer_id, journey_id, metadata FROM invoices')).rows || [];
        const expenseRows = (await db.query('SELECT id, amount, date, category, truck_id, metadata FROM expenses')).rows || [];
        const payrollRows = (await db.query('SELECT id, entity_id, amount, month, status, metadata FROM payroll')).rows || [];

        const receivables = [];
        for (const inv of invoiceRows) {
            const meta = inv.metadata || {};
            const invDate = meta.invoiceDate || inv.due_date;
            if (!inDateRange(invDate, from, to)) continue;
            const total = Number(inv.amount || 0);
            const paid = extractInvoicePaidAmount(inv);
            const outstanding = Math.max(0, total - paid);
            if (outstanding <= 0) continue;
            receivables.push({
                id: inv.id,
                type: 'Invoice',
                dueDate: inv.due_date || null,
                daysOverdue: inv.due_date ? Math.max(0, daysBetween(inv.due_date, today)) : 0,
                amount: Number(outstanding.toFixed(2)),
                customerId: meta.customerId || inv.customer_id || '',
                linkedJourneyId: meta.journey || inv.journey_id || '',
            });
        }

        const payables = [];
        for (const ex of expenseRows) {
            const meta = ex.metadata || {};
            const d = meta.date || ex.date;
            if (!inDateRange(d, from, to)) continue;
            const amount = Number(ex.amount || meta.amount || 0);
            if (amount <= 0) continue;
            if (String(meta.status || '').toLowerCase() === 'paid') continue;
            payables.push({
                id: ex.id,
                type: `Expense:${meta.category || ex.category || 'General'}`,
                dueDate: d || null,
                daysOverdue: d ? Math.max(0, daysBetween(d, today)) : 0,
                amount: Number(amount.toFixed(2)),
                vendor: meta.vendor || meta.supplier || '',
                linkedTruckId: meta.truck || ex.truck_id || '',
            });
        }

        for (const p of payrollRows) {
            const meta = p.metadata || {};
            const d = meta.paidDate || (p.month ? `${String(p.month)}-28` : null);
            if (!inDateRange(d, from, to)) continue;
            if (String(meta.status || p.status || '').toLowerCase() === 'paid') continue;
            const amount = Number(meta.netPay ?? meta.amount ?? p.amount ?? 0);
            if (amount <= 0) continue;
            payables.push({
                id: p.id,
                type: 'Payroll',
                dueDate: d || null,
                daysOverdue: d ? Math.max(0, daysBetween(d, today)) : 0,
                amount: Number(amount.toFixed(2)),
                vendor: meta.employeeName || meta.driverName || meta.driver || p.entity_id || '',
                linkedTruckId: '',
            });
        }

        const totalReceivables = receivables.reduce((s, r) => s + Number(r.amount || 0), 0);
        const totalPayables = payables.reduce((s, r) => s + Number(r.amount || 0), 0);

        res.json({
            success: true,
            period: { from: from || null, to: to || null },
            totals: {
                receivables: Number(totalReceivables.toFixed(2)),
                payables: Number(totalPayables.toFixed(2)),
                netWorkingCapitalGap: Number((totalReceivables - totalPayables).toFixed(2)),
            },
            receivables,
            payables,
        });
    } catch (e) {
        await writeErrorLog({
            source: 'backend',
            level: 'error',
            message: e.message || 'Failed receivables/payables report',
            stack: e.stack || null,
            meta: { endpoint: '/api/admin/reports/receivables-payables' },
        });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/mpesa/transactions', async (req, res) => {
    try {
        const body = req.body || {};
        const id = String(body.id || `MPESA-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
        const txnDate = body.txnDate || body.date || new Date().toISOString().slice(0, 10);
        const direction = body.direction === 'Outgoing' ? 'Outgoing' : 'Incoming';
        const amount = Number(body.amount || 0);
        const reference = String(body.reference || '');
        const counterpartyName = String(body.counterpartyName || '');
        const counterpartyPhone = String(body.counterpartyPhone || '');
        const linkedType = body.linkedType ? String(body.linkedType) : null;
        const linkedId = body.linkedId ? String(body.linkedId) : null;
        const status = String(body.status || 'Unreconciled');
        const notes = String(body.notes || '');
        await db.query(
            `INSERT INTO mpesa_transactions
             (id, txn_date, direction, amount, reference, counterparty_name, counterparty_phone, linked_type, linked_id, status, notes, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
             ON CONFLICT (id) DO UPDATE SET
                txn_date=EXCLUDED.txn_date,
                direction=EXCLUDED.direction,
                amount=EXCLUDED.amount,
                reference=EXCLUDED.reference,
                counterparty_name=EXCLUDED.counterparty_name,
                counterparty_phone=EXCLUDED.counterparty_phone,
                linked_type=EXCLUDED.linked_type,
                linked_id=EXCLUDED.linked_id,
                status=EXCLUDED.status,
                notes=EXCLUDED.notes,
                metadata=EXCLUDED.metadata,
                updated_at=NOW()`,
            [id, txnDate, direction, amount, reference, counterpartyName, counterpartyPhone, linkedType, linkedId, status, notes, JSON.stringify(body.metadata || {})]
        );
        res.json({ success: true, id });
    } catch (e) {
        await writeErrorLog({
            source: 'backend',
            level: 'error',
            message: e.message || 'Failed to upsert mpesa transaction',
            stack: e.stack || null,
            meta: { endpoint: '/api/admin/mpesa/transactions' },
        });
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/mpesa/reconciliation', async (req, res) => {
    try {
        const hasTxnDate = (await db.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_name = 'mpesa_transactions' AND column_name = 'txn_date'
             LIMIT 1`
        )).rows.length > 0;
        const hasLegacyDate = (await db.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_name = 'mpesa_transactions' AND column_name = 'date'
             LIMIT 1`
        )).rows.length > 0;
        const dateExpr = hasTxnDate
            ? (hasLegacyDate ? 'COALESCE(txn_date, date)' : 'txn_date')
            : (hasLegacyDate ? 'date' : 'NULL');
        const rows = (await db.query(
            `SELECT *, ${dateExpr} AS effective_txn_date
             FROM mpesa_transactions
             ORDER BY ${dateExpr} DESC NULLS LAST, created_at DESC
             LIMIT 1000`
        )).rows || [];
        const invoices = (await db.query('SELECT id, amount, metadata FROM invoices')).rows || [];
        const payroll = (await db.query('SELECT id, amount, metadata FROM payroll')).rows || [];

        const invoiceById = new Map(invoices.map((i) => [String(i.id), i]));
        const payrollById = new Map(payroll.map((p) => [String(p.id), p]));

        const reconciled = [];
        const unreconciled = [];
        for (const tx of rows) {
            const linkedType = String(tx.linked_type || '').toLowerCase();
            const linkedId = String(tx.linked_id || '');
            let matched = false;
            let expectedAmount = null;
            if (linkedType === 'invoice' && invoiceById.has(linkedId)) {
                const inv = invoiceById.get(linkedId);
                expectedAmount = Number(inv.amount || 0);
                matched = true;
            } else if (linkedType === 'payroll' && payrollById.has(linkedId)) {
                const pr = payrollById.get(linkedId);
                expectedAmount = Number((pr.metadata || {}).netPay ?? pr.amount ?? 0);
                matched = true;
            }

            const item = {
                id: tx.id,
                txnDate: tx.effective_txn_date || tx.txn_date || tx.date || null,
                direction: tx.direction,
                amount: Number(tx.amount || 0),
                reference: tx.reference,
                linkedType: tx.linked_type || null,
                linkedId: tx.linked_id || null,
                status: tx.status || 'Unreconciled',
                matchStatus: matched ? 'Matched' : 'Unmatched',
                variance: matched && expectedAmount != null ? Number((Number(tx.amount || 0) - expectedAmount).toFixed(2)) : null,
            };
            if (matched) reconciled.push(item);
            else unreconciled.push(item);
        }

        res.json({
            success: true,
            summary: {
                total: rows.length,
                reconciled: reconciled.length,
                unreconciled: unreconciled.length,
            },
            reconciled,
            unreconciled,
        });
    } catch (e) {
        await writeErrorLog({
            source: 'backend',
            level: 'error',
            message: e.message || 'Failed M-Pesa reconciliation report',
            stack: e.stack || null,
            meta: { endpoint: '/api/admin/mpesa/reconciliation' },
        });
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/p10', async (req, res) => {
    try {
        const month = String(req.query.month || '');
        if (!monthStartEnd(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
        const rows = (await db.query('SELECT id, entity_id, entity_type, metadata, month FROM payroll WHERE month = $1 ORDER BY entity_id', [month])).rows || [];
        const driverRows = (await db.query('SELECT id, name, kra_pin, nssf_number, nhif_number FROM drivers')).rows || [];
        const staffRows = (await db.query('SELECT id, name, kra_pin, nssf_number, nhif_number FROM staff')).rows || [];
        const ref = new Map();
        for (const r of driverRows) ref.set(`driver:${r.id}`, r);
        for (const r of staffRows) ref.set(`staff:${r.id}`, r);
        const out = rows.map((r) => {
            const m = parseJsonObj(r.metadata);
            const typ = String(r.entity_type || m.entityType || 'driver').toLowerCase() === 'staff' ? 'staff' : 'driver';
            const emp = ref.get(`${typ}:${r.entity_id}`) || {};
            return {
                month,
                employeeId: r.entity_id,
                employeeType: typ,
                employeeName: emp.name || m._name || '',
                kraPin: emp.kra_pin || m.kraPin || '',
                nssfNumber: emp.nssf_number || m.nssfNumber || '',
                nhifNumber: emp.nhif_number || m.nhifNumber || '',
                grossPay: Number(m.grossPay ?? 0).toFixed(2),
                taxablePay: Number(m.taxablePay ?? 0).toFixed(2),
                paye: Number(m.paye ?? 0).toFixed(2),
                personalRelief: Number(m.personalRelief ?? 2400).toFixed(2),
                nssfEmployee: Number(m.nssfEmployee ?? 0).toFixed(2),
                nhifShif: Number(m.nhif ?? 0).toFixed(2),
                housingLevyEmployee: Number(m.housingLevyEmployee ?? 0).toFixed(2),
                netPay: Number(m.netPay ?? 0).toFixed(2),
            };
        });
        if (String(req.query.format || '').toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(toCsv(out));
        }
        res.json({ success: true, month, records: out });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/p9a', async (req, res) => {
    try {
        const year = Number(req.query.year || 0);
        if (!Number.isInteger(year) || year < 2000) return res.status(400).json({ error: 'year required' });
        const start = `${year}-01`;
        const end = `${year}-12`;
        const rows = (await db.query('SELECT id, entity_id, entity_type, metadata, month FROM payroll WHERE month >= $1 AND month <= $2', [start, end])).rows || [];
        const driverRows = (await db.query('SELECT id, name, kra_pin FROM drivers')).rows || [];
        const staffRows = (await db.query('SELECT id, name, kra_pin FROM staff')).rows || [];
        const ref = new Map();
        for (const r of driverRows) ref.set(`driver:${r.id}`, r);
        for (const r of staffRows) ref.set(`staff:${r.id}`, r);
        const grouped = new Map();
        for (const r of rows) {
            const m = parseJsonObj(r.metadata);
            const typ = String(r.entity_type || m.entityType || 'driver').toLowerCase() === 'staff' ? 'staff' : 'driver';
            const key = `${typ}:${String(r.entity_id || '')}`;
            const emp = ref.get(key) || {};
            const prev = grouped.get(key) || {
                employeeId: key,
                employeeType: typ,
                employeeName: emp.name || '',
                kraPin: emp.kra_pin || m.kraPin || '',
                year,
                grossPay: 0,
                taxablePay: 0,
                paye: 0,
                nssfEmployee: 0,
                nhifShif: 0,
                housingLevyEmployee: 0,
                netPay: 0,
            };
            prev.grossPay += Number(m.grossPay ?? 0);
            prev.taxablePay += Number(m.taxablePay ?? 0);
            prev.paye += Number(m.paye ?? 0);
            prev.nssfEmployee += Number(m.nssfEmployee ?? 0);
            prev.nhifShif += Number(m.nhif ?? 0);
            prev.housingLevyEmployee += Number(m.housingLevyEmployee ?? 0);
            prev.netPay += Number(m.netPay ?? 0);
            grouped.set(key, prev);
        }
        const out = Array.from(grouped.values()).map((r) => ({
            ...r,
            employeeId: String(r.employeeId || '').split(':')[1] || r.employeeId,
            grossPay: Number(r.grossPay.toFixed(2)),
            taxablePay: Number(r.taxablePay.toFixed(2)),
            paye: Number(r.paye.toFixed(2)),
            nssfEmployee: Number(r.nssfEmployee.toFixed(2)),
            nhifShif: Number(r.nhifShif.toFixed(2)),
            housingLevyEmployee: Number(r.housingLevyEmployee.toFixed(2)),
            netPay: Number(r.netPay.toFixed(2)),
        }));
        if (String(req.query.format || '').toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(toCsv(out));
        }
        res.json({ success: true, year, records: out });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/vat3', async (req, res) => {
    try {
        const month = String(req.query.month || '');
        const rng = monthStartEnd(month);
        if (!rng) return res.status(400).json({ error: 'month must be YYYY-MM' });
        const vatRate = Number(req.query.vatRate || 0.16);
        const invoices = (await db.query('SELECT amount, due_date, metadata FROM invoices')).rows || [];
        const expenses = (await db.query('SELECT amount, date, metadata FROM expenses')).rows || [];
        let outputVat = 0;
        let inputVat = 0;
        for (const inv of invoices) {
            const m = inv.metadata || {};
            const d = m.invoiceDate || inv.due_date;
            if (!inDateRange(d, rng.start, rng.end)) continue;
            if (m.vatable === true || m.vatApplicable === true) outputVat += Number(inv.amount || 0) * Number(m.vatRate ?? vatRate);
        }
        for (const ex of expenses) {
            const m = ex.metadata || {};
            const d = m.date || ex.date;
            if (!inDateRange(d, rng.start, rng.end)) continue;
            if (m.vatable === true || m.vatApplicable === true) inputVat += Number(ex.amount || 0) * Number(m.vatRate ?? vatRate);
        }
        const payload = {
            month,
            outputVat: Number(outputVat.toFixed(2)),
            inputVat: Number(inputVat.toFixed(2)),
            vatPayable: Number(Math.max(0, outputVat - inputVat).toFixed(2)),
        };
        if (String(req.query.format || '').toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(toCsv([payload]));
        }
        res.json({ success: true, ...payload });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/wht-schedule', async (req, res) => {
    try {
        const month = String(req.query.month || '');
        const rng = monthStartEnd(month);
        if (!rng) return res.status(400).json({ error: 'month must be YYYY-MM' });
        const expenses = (await db.query('SELECT id, amount, date, metadata FROM expenses')).rows || [];
        const records = [];
        for (const ex of expenses) {
            const m = ex.metadata || {};
            const d = m.date || ex.date;
            if (!inDateRange(d, rng.start, rng.end)) continue;
            const klass = String(m.whtClass || '').toLowerCase();
            let rate = 0;
            if (klass === 'resident') rate = 0.03;
            if (klass === 'non-resident' || klass === 'nonresident') rate = 0.05;
            if (!rate) continue;
            const amount = Number(ex.amount || 0);
            records.push({
                expenseId: ex.id,
                date: d || '',
                supplier: m.vendor || m.supplier || '',
                residencyClass: klass,
                taxableBase: Number(amount.toFixed(2)),
                rate: Number((rate * 100).toFixed(2)),
                withholdingTax: Number((amount * rate).toFixed(2)),
            });
        }
        if (String(req.query.format || '').toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(toCsv(records));
        }
        res.json({
            success: true,
            month,
            totalWithholdingTax: Number(records.reduce((s, r) => s + Number(r.withholdingTax || 0), 0).toFixed(2)),
            records,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/nssf-schedule', async (req, res) => {
    try {
        const month = String(req.query.month || '');
        if (!monthStartEnd(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
        const rows = (await db.query('SELECT entity_id, entity_type, metadata, month FROM payroll WHERE month = $1 ORDER BY entity_id', [month])).rows || [];
        const driverRows = (await db.query('SELECT id, name, kra_pin, nssf_number FROM drivers')).rows || [];
        const staffRows = (await db.query('SELECT id, name, kra_pin, nssf_number FROM staff')).rows || [];
        const ref = new Map();
        for (const r of driverRows) ref.set(`driver:${r.id}`, r);
        for (const r of staffRows) ref.set(`staff:${r.id}`, r);
        const records = rows.map((r) => {
            const m = parseJsonObj(r.metadata);
            const typ = String(r.entity_type || m.entityType || 'driver').toLowerCase() === 'staff' ? 'staff' : 'driver';
            const emp = ref.get(`${typ}:${r.entity_id}`) || {};
            const nssfEmployee = Number(m.nssfEmployee ?? 0);
            const nssfEmployer = Number(m.nssfEmployer ?? nssfEmployee);
            return {
                month,
                employeeId: r.entity_id,
                employeeType: typ,
                employeeName: emp.name || m._name || '',
                kraPin: emp.kra_pin || m.kraPin || '',
                nssfNumber: emp.nssf_number || m.nssfNumber || '',
                pensionablePay: Number(m.pensionablePay ?? m.basicSalary ?? m.baseSalary ?? 0).toFixed(2),
                nssfEmployee: nssfEmployee.toFixed(2),
                nssfEmployer: nssfEmployer.toFixed(2),
                totalNssf: Number(nssfEmployee + nssfEmployer).toFixed(2),
            };
        });
        const totals = records.reduce((acc, r) => {
            acc.nssfEmployee += Number(r.nssfEmployee || 0);
            acc.nssfEmployer += Number(r.nssfEmployer || 0);
            return acc;
        }, { nssfEmployee: 0, nssfEmployer: 0 });
        const payload = {
            success: true,
            month,
            totals: {
                nssfEmployee: Number(totals.nssfEmployee.toFixed(2)),
                nssfEmployer: Number(totals.nssfEmployer.toFixed(2)),
                totalNssf: Number((totals.nssfEmployee + totals.nssfEmployer).toFixed(2)),
            },
            records,
        };
        if (String(req.query.format || '').toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(toCsv(records));
        }
        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/nhif-schedule', async (req, res) => {
    try {
        const month = String(req.query.month || '');
        if (!monthStartEnd(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
        const rows = (await db.query('SELECT entity_id, entity_type, metadata, month FROM payroll WHERE month = $1 ORDER BY entity_id', [month])).rows || [];
        const driverRows = (await db.query('SELECT id, name, kra_pin, nhif_number FROM drivers')).rows || [];
        const staffRows = (await db.query('SELECT id, name, kra_pin, nhif_number FROM staff')).rows || [];
        const ref = new Map();
        for (const r of driverRows) ref.set(`driver:${r.id}`, r);
        for (const r of staffRows) ref.set(`staff:${r.id}`, r);
        const records = rows.map((r) => {
            const m = parseJsonObj(r.metadata);
            const typ = String(r.entity_type || m.entityType || 'driver').toLowerCase() === 'staff' ? 'staff' : 'driver';
            const emp = ref.get(`${typ}:${r.entity_id}`) || {};
            const nhifShif = Number(m.nhif ?? 0);
            return {
                month,
                employeeId: r.entity_id,
                employeeType: typ,
                employeeName: emp.name || m._name || '',
                kraPin: emp.kra_pin || m.kraPin || '',
                nhifNumber: emp.nhif_number || m.nhifNumber || '',
                grossPay: Number(m.grossPay ?? 0).toFixed(2),
                nhifShif: nhifShif.toFixed(2),
            };
        });
        const total = Number(records.reduce((s, r) => s + Number(r.nhifShif || 0), 0).toFixed(2));
        if (String(req.query.format || '').toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(toCsv(records));
        }
        res.json({ success: true, month, totalNhifShif: total, records });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/housing-levy-schedule', async (req, res) => {
    try {
        const month = String(req.query.month || '');
        if (!monthStartEnd(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
        const rows = (await db.query('SELECT entity_id, entity_type, metadata, month FROM payroll WHERE month = $1 ORDER BY entity_id', [month])).rows || [];
        const driverRows = (await db.query('SELECT id, name, kra_pin FROM drivers')).rows || [];
        const staffRows = (await db.query('SELECT id, name, kra_pin FROM staff')).rows || [];
        const ref = new Map();
        for (const r of driverRows) ref.set(`driver:${r.id}`, r);
        for (const r of staffRows) ref.set(`staff:${r.id}`, r);
        const records = rows.map((r) => {
            const m = parseJsonObj(r.metadata);
            const typ = String(r.entity_type || m.entityType || 'driver').toLowerCase() === 'staff' ? 'staff' : 'driver';
            const emp = ref.get(`${typ}:${r.entity_id}`) || {};
            const employee = Number(m.housingLevyEmployee ?? 0);
            const employer = Number(m.housingLevyEmployer ?? employee);
            return {
                month,
                employeeId: r.entity_id,
                employeeType: typ,
                employeeName: emp.name || m._name || '',
                kraPin: emp.kra_pin || m.kraPin || '',
                grossPay: Number(m.grossPay ?? 0).toFixed(2),
                housingLevyEmployee: employee.toFixed(2),
                housingLevyEmployer: employer.toFixed(2),
                totalHousingLevy: Number(employee + employer).toFixed(2),
            };
        });
        const totals = records.reduce((acc, r) => {
            acc.employee += Number(r.housingLevyEmployee || 0);
            acc.employer += Number(r.housingLevyEmployer || 0);
            return acc;
        }, { employee: 0, employer: 0 });
        if (String(req.query.format || '').toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(toCsv(records));
        }
        res.json({
            success: true,
            month,
            totals: {
                housingLevyEmployee: Number(totals.employee.toFixed(2)),
                housingLevyEmployer: Number(totals.employer.toFixed(2)),
                totalHousingLevy: Number((totals.employee + totals.employer).toFixed(2)),
            },
            records,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/ledger-summary', async (req, res) => {
    try {
        const from = String(req.query.from || '').trim();
        const to = String(req.query.to || '').trim();
        let params = [];
        let where = '';
        if (from && to) {
            where = 'WHERE entry_date >= $1 AND entry_date <= $2';
            params = [from, to];
        }
        const rows = (await db.query(
            `SELECT account_code, account_name, SUM(debit) AS debit_total, SUM(credit) AS credit_total
             FROM ledger_entries
             ${where}
             GROUP BY account_code, account_name
             ORDER BY account_code`,
            params
        )).rows || [];
        const totals = rows.reduce((acc, r) => {
            acc.debit += Number(r.debit_total || 0);
            acc.credit += Number(r.credit_total || 0);
            return acc;
        }, { debit: 0, credit: 0 });
        res.json({
            success: true,
            from: from || null,
            to: to || null,
            totals: {
                debit: Number(totals.debit.toFixed(2)),
                credit: Number(totals.credit.toFixed(2)),
            },
            rows: rows.map((r) => ({
                accountCode: r.account_code,
                accountName: r.account_name,
                debit: Number(r.debit_total || 0),
                credit: Number(r.credit_total || 0),
                net: Number((Number(r.debit_total || 0) - Number(r.credit_total || 0)).toFixed(2)),
            })),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/ledger-entries', async (req, res) => {
    try {
        const from = String(req.query.from || '').trim();
        const to = String(req.query.to || '').trim();
        const lim = Math.min(1000, Math.max(1, Number(req.query.limit || 300)));
        let where = '';
        const params = [];
        if (from && to) {
            where = 'WHERE entry_date >= $1 AND entry_date <= $2';
            params.push(from, to);
        }
        params.push(lim);
        const limitPos = params.length;
        const rows = (await db.query(
            `SELECT id, entry_date, source_type, source_id, account_code, account_name, debit, credit, currency, notes, metadata, created_by, created_at
             FROM ledger_entries
             ${where}
             ORDER BY entry_date DESC, created_at DESC
             LIMIT $${limitPos}`,
            params
        )).rows || [];
        res.json({
            success: true,
            from: from || null,
            to: to || null,
            rows: rows.map((r) => ({
                id: r.id,
                entryDate: r.entry_date,
                sourceType: r.source_type,
                sourceId: r.source_id,
                accountCode: r.account_code,
                accountName: r.account_name,
                debit: Number(r.debit || 0),
                credit: Number(r.credit || 0),
                currency: r.currency || 'KES',
                notes: r.notes || '',
                metadata: parseJsonObj(r.metadata),
                createdBy: r.created_by || '',
                createdAt: r.created_at || null,
            })),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/route-profitability', async (req, res) => {
    try {
        const from = req.query.from ? String(req.query.from) : '';
        const to = req.query.to ? String(req.query.to) : '';
        const journeys = (await db.query('SELECT id, origin, destination, start_date, metadata FROM journeys')).rows || [];
        const fuel = (await db.query('SELECT journey_id, amount, date FROM fuel_logs')).rows || [];
        const expenses = (await db.query('SELECT journey_id, amount, date, metadata FROM expenses')).rows || [];

        const fuelByJourney = new Map();
        for (const f of fuel) {
            if (!inDateRange(f.date, from, to)) continue;
            const key = String(f.journey_id || '');
            fuelByJourney.set(key, (fuelByJourney.get(key) || 0) + Number(f.amount || 0));
        }
        const expenseByJourney = new Map();
        for (const e of expenses) {
            const d = e.date || (e.metadata || {}).date;
            if (!inDateRange(d, from, to)) continue;
            const key = String(e.journey_id || '');
            expenseByJourney.set(key, (expenseByJourney.get(key) || 0) + Number(e.amount || 0));
        }

        const routeMap = new Map();
        for (const j of journeys) {
            const date = j.start_date || (j.metadata || {}).date;
            if (!inDateRange(date, from, to)) continue;
            const route = `${j.origin || 'Unknown'} -> ${j.destination || 'Unknown'}`;
            const revenue = Number((j.metadata || {}).amount || 0);
            const cost = Number(fuelByJourney.get(String(j.id)) || 0) + Number(expenseByJourney.get(String(j.id)) || 0);
            const prev = routeMap.get(route) || { route, trips: 0, revenue: 0, directCost: 0, contribution: 0, marginPct: 0 };
            prev.trips += 1;
            prev.revenue += revenue;
            prev.directCost += cost;
            prev.contribution += (revenue - cost);
            routeMap.set(route, prev);
        }
        const rows = Array.from(routeMap.values())
            .map((r) => ({
                ...r,
                revenue: Number(r.revenue.toFixed(2)),
                directCost: Number(r.directCost.toFixed(2)),
                contribution: Number(r.contribution.toFixed(2)),
                marginPct: r.revenue > 0 ? Number(((r.contribution / r.revenue) * 100).toFixed(2)) : 0,
            }))
            .sort((a, b) => b.contribution - a.contribution);
        res.json({ success: true, period: { from: from || null, to: to || null }, routes: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/reports/driver-costs', async (req, res) => {
    try {
        const from = req.query.from ? String(req.query.from) : '';
        const to = req.query.to ? String(req.query.to) : '';
        const payroll = (await db.query('SELECT entity_id, month, amount, metadata FROM payroll')).rows || [];
        const journeys = (await db.query('SELECT id, driver_id, start_date, metadata FROM journeys')).rows || [];

        const tripCountByDriver = new Map();
        for (const j of journeys) {
            const d = j.start_date || (j.metadata || {}).date;
            if (!inDateRange(d, from, to)) continue;
            const key = String(j.driver_id || (j.metadata || {}).driver || '');
            if (!key) continue;
            tripCountByDriver.set(key, (tripCountByDriver.get(key) || 0) + 1);
        }

        const costsByDriver = new Map();
        for (const p of payroll) {
            const m = String(p.month || '');
            const key = String(p.entity_id || '');
            if (!key || !m) continue;
            const refDate = `${m}-15`;
            if (!inDateRange(refDate, from, to)) continue;
            const net = Number((p.metadata || {}).netPay ?? p.amount ?? 0);
            const employerCost = Number((p.metadata || {}).employerCost ?? net);
            const prev = costsByDriver.get(key) || { driverId: key, netPay: 0, employerCost: 0, payslips: 0, trips: 0, costPerTrip: 0 };
            prev.netPay += net;
            prev.employerCost += employerCost;
            prev.payslips += 1;
            costsByDriver.set(key, prev);
        }

        const rows = Array.from(costsByDriver.values()).map((r) => {
            const trips = Number(tripCountByDriver.get(r.driverId) || 0);
            return {
                ...r,
                trips,
                netPay: Number(r.netPay.toFixed(2)),
                employerCost: Number(r.employerCost.toFixed(2)),
                costPerTrip: trips > 0 ? Number((r.employerCost / trips).toFixed(2)) : 0,
            };
        }).sort((a, b) => b.employerCost - a.employerCost);

        res.json({ success: true, period: { from: from || null, to: to || null }, drivers: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Generate a short-lived preview token for a specific driver (admin only — NOT stored in driver_auth)
app.post('/api/admin/driver-preview-token', async (req, res) => {
    try {
        const { driverId } = req.body;
        if (!driverId) return res.status(400).json({ error: 'driverId required' });
        // Verify driver exists
        const dr = await db.query('SELECT id FROM drivers WHERE id = $1', [driverId]);
        if (!dr.rows[0]) return res.status(404).json({ error: 'Driver not found' });
        // Issue 30-minute preview JWT — same shape as loginDriver() so portal-data works
        const token = jwt.sign(
            { driverId, email: '_preview_', _isPreview: true },
            JWT_SECRET,
            { expiresIn: '30m' }
        );
        res.json({ success: true, token });
    } catch (e) {
        console.error('[PREVIEW_TOKEN_ERROR]', e.message);
        res.status(500).json({ error: e.message });
    }
});

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
        if (!req.admin || req.admin.role !== 'superadmin') {
            return res.status(403).json({ error: 'Only superadmins can run a full system reset.' });
        }
        console.log(`[${new Date().toISOString()}] SYSTEM RESET REQUESTED BY ADMIN`);
        const tables = [
            'invoices', 'payroll', 'fuel_logs', 'expenses', 'incidents', 'maintenance_logs', 'tyre_logs',
            'documents', 'journeys', 'assets', 'mpesa_transactions', 'payslip_dispatch_queue', 'ledger_entries',
            'payroll_statutory_configs', 'payroll_statutory_change_log', 'deduction_templates', 'employee_deductions',
            'error_logs', 'driver_auth', 'staff_auth',
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

        // 2b. Re-create admin login principals after reset
        await db.query(`
            INSERT INTO admins (id, email, password_hash, role, display_name)
            VALUES ($1, $2, $3, 'superadmin', 'System Admin')
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                display_name = EXCLUDED.display_name
        `, [staffId, initialAdminEmail, initialHash]);
        await db.query(`
            INSERT INTO superadmins (email, created_at)
            VALUES ($1, CURRENT_TIMESTAMP)
            ON CONFLICT (email) DO NOTHING
        `, [initialAdminEmail]);

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
    'incidents', 'documents', 'assets', 'mpesa_transactions', 'payroll_statutory_configs', 'payroll_statutory_change_log',
    'deduction_templates', 'employee_deductions', 'payslip_dispatch_queue', 'ledger_entries', 'system_settings', 'staff_auth', 'driver_auth'
];

const REQUIRED_SCHEMA = {
    journeys: ['id', 'truck_id', 'driver_id', 'customer_id', 'start_date', 'status', 'metadata', 'deposit_amount', 'deposit_date', 'final_payment_amount', 'final_payment_date'],
    expenses: ['id', 'journey_id', 'truck_id', 'category', 'amount', 'date', 'status', 'metadata'],
    invoices: ['id', 'customer_id', 'journey_id', 'amount', 'paid_amount', 'status', 'due_date', 'metadata'],
    payroll: ['id', 'entity_id', 'entity_type', 'amount', 'month', 'status', 'payment_reference', 'payment_date', 'payment_confirmed_at', 'payslip_dispatch_allowed', 'metadata'],
    drivers: ['id', 'name', 'phone', 'email', 'national_id', 'employee_number', 'kra_pin', 'status', 'metadata'],
    staff: ['id', 'name', 'email', 'phone', 'employee_number', 'department_name', 'kra_pin', 'status', 'metadata'],
    incidents: ['id', 'type', 'status', 'metadata', 'updated_at'],
    documents: ['id', 'entity_type', 'entity_id', 'url', 'metadata'],
    assets: ['id', 'name', 'category', 'cost', 'depreciation_method', 'metadata'],
    mpesa_transactions: ['id', 'txn_date', 'direction', 'amount', 'reference', 'linked_type', 'linked_id', 'status', 'metadata'],
    payroll_statutory_configs: ['id', 'name', 'config_type', 'formula', 'effective_date', 'is_active'],
    payroll_statutory_change_log: ['id', 'config_name', 'old_value', 'new_value', 'changed_by', 'changed_at', 'effective_date'],
    deduction_templates: ['id', 'name', 'default_amount', 'default_type', 'requires_authorization', 'metadata'],
    employee_deductions: ['id', 'entity_id', 'entity_type', 'deduction_type', 'name', 'amount', 'amount_type', 'metadata'],
    payslip_dispatch_queue: ['id', 'payroll_id', 'recipient_email', 'status', 'attempts', 'scheduled_at', 'metadata'],
    ledger_entries: ['id', 'entry_date', 'source_type', 'source_id', 'account_code', 'account_name', 'debit', 'credit', 'currency'],
};

async function getSchemaHealth() {
    const tablesRes = await db.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'`
    );
    const existingTables = new Set((tablesRes.rows || []).map((r) => String(r.table_name)));
    const missingTables = Object.keys(REQUIRED_SCHEMA).filter((t) => !existingTables.has(t));
    const missingColumns = {};
    for (const [table, cols] of Object.entries(REQUIRED_SCHEMA)) {
        if (!existingTables.has(table)) {
            missingColumns[table] = [...cols];
            continue;
        }
        const colRes = await db.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1`,
            [table]
        );
        const existingCols = new Set((colRes.rows || []).map((r) => String(r.column_name)));
        const absent = cols.filter((c) => !existingCols.has(c));
        if (absent.length) missingColumns[table] = absent;
    }
    return {
        ok: missingTables.length === 0 && Object.keys(missingColumns).length === 0,
        missingTables,
        missingColumns,
    };
}

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

const DEFAULT_PAYROLL_SETTINGS = {
    personalRelief: 2400,
    payeBands: [
        { lowerLimit: 0, upperLimit: 24000, ratePercent: 10 },
        { lowerLimit: 24001, upperLimit: 32333, ratePercent: 25 },
        { lowerLimit: 32334, upperLimit: 40667, ratePercent: 30 },
        { lowerLimit: 40668, upperLimit: 57333, ratePercent: 32.5 },
        { lowerLimit: 57334, upperLimit: null, ratePercent: 35 },
    ],
    nssfTier1Ceiling: 7000,
    nssfTier2Ceiling: 36000,
    nssfEmployeeRate: 6,
    nssfEmployerRate: 6,
    shifEnabled: true,
    shifRatePercent: 2.75,
    housingLevyEmployeeRate: 1.5,
    housingLevyEmployerRate: 1.5,
    driverAllowanceDefaults: {
        nightOutPerNight: 2000,
        tripAllowancePerTrip: 1500,
        overtimePerHour: 300,
    },
};

const PAYROLL_STATUTORY_TYPE_MAP = {
    personalRelief: 'personal_relief',
    payeBands: 'paye_bands',
    nssfTier1Ceiling: 'nssf_tier1_ceiling',
    nssfTier2Ceiling: 'nssf_tier2_ceiling',
    nssfEmployeeRate: 'nssf_employee_rate',
    nssfEmployerRate: 'nssf_employer_rate',
    shifEnabled: 'shif_enabled',
    shifRatePercent: 'shif_rate_percent',
    housingLevyEmployeeRate: 'housing_levy_employee_rate',
    housingLevyEmployerRate: 'housing_levy_employer_rate',
    driverAllowanceDefaults: 'driver_allowance_defaults',
};

async function getDbBackedPayrollSettings() {
    const settings = await getSettings();
    const stored = settings?.payrollSettings || {};
    const merged = { ...DEFAULT_PAYROLL_SETTINGS, ...(stored || {}) };
    const rows = await db.query(
        `SELECT config_type, formula
         FROM payroll_statutory_configs
         WHERE is_active = TRUE
         ORDER BY effective_date DESC, created_at DESC`
    );
    const seen = new Set();
    for (const row of rows.rows || []) {
        const type = String(row.config_type || '').trim();
        if (!type || seen.has(type)) continue;
        seen.add(type);
        const key = Object.keys(PAYROLL_STATUTORY_TYPE_MAP).find((k) => PAYROLL_STATUTORY_TYPE_MAP[k] === type);
        if (!key) continue;
        const formula = parseJsonObj(row.formula);
        if (Object.prototype.hasOwnProperty.call(formula, 'value')) {
            merged[key] = formula.value;
        }
    }
    return merged;
}

app.get('/api/admin/payroll/settings', async (_req, res) => {
    try {
        const payrollSettings = await getDbBackedPayrollSettings();
        res.json({ success: true, payrollSettings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/admin/payroll/settings', async (req, res) => {
    try {
        const actor = req.admin?.email || req.admin?.id || 'system';
        const previous = await getDbBackedPayrollSettings();
        const next = req.body?.payrollSettings && typeof req.body.payrollSettings === 'object'
            ? req.body.payrollSettings
            : {};
        const merged = { ...DEFAULT_PAYROLL_SETTINGS, ...previous, ...next };
        const effectiveDate = req.body?.effectiveDate || new Date().toISOString().slice(0, 10);
        await saveSetting('payrollSettings', merged);
        for (const key of Object.keys(PAYROLL_STATUTORY_TYPE_MAP)) {
            const configType = PAYROLL_STATUTORY_TYPE_MAP[key];
            const value = Object.prototype.hasOwnProperty.call(merged, key) ? merged[key] : DEFAULT_PAYROLL_SETTINGS[key];
            await db.query(
                `INSERT INTO payroll_statutory_configs (id, name, config_type, formula, effective_date, is_active, created_by)
                 VALUES ($1,$2,$3,$4::jsonb,$5,TRUE,$6)`,
                [randomId('psc'), key, configType, JSON.stringify({ value }), effectiveDate, String(actor)]
            );
        }
        await db.query(
            `INSERT INTO payroll_statutory_change_log (config_name, old_value, new_value, changed_by, effective_date)
             VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)`,
            [
                'payrollSettings',
                JSON.stringify(previous || {}),
                JSON.stringify(merged || {}),
                String(actor),
                effectiveDate,
            ]
        );
        res.json({ success: true, payrollSettings: merged });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

/** Write backup JSON to disk and mirror to Cloudflare R2 when configured (R2 failure does not remove local copy). */
async function persistBackupFile(filename, backupObj) {
    const safeName = path.basename(filename);
    if (!/^[\w.\-]+\.json$/i.test(safeName)) throw new Error('Invalid backup filename');
    const fullPath = path.join(BACKUPS_DIR, safeName);
    saveData(fullPath, backupObj);
    try {
        const r = await uploadBackupToR2(safeName, JSON.stringify(backupObj, null, 2));
        if (r.ok) console.log(`[BACKUP] Mirrored to R2: ${safeName}`);
    } catch (e) {
        if (isR2Configured()) console.warn('[BACKUP] Cloudflare R2 mirror failed (local copy saved):', e.message);
    }
}

async function persistBackupRawString(safeFilename, contentUtf8) {
    const safeName = path.basename(safeFilename);
    if (!/^[\w.\-]+\.json$/i.test(safeName)) throw new Error('Invalid backup filename');
    writeFileSync(path.join(BACKUPS_DIR, safeName), contentUtf8, 'utf8');
    try {
        const r = await uploadBackupToR2(safeName, contentUtf8);
        if (r.ok) console.log(`[BACKUP] Mirrored to R2: ${safeName}`);
    } catch (e) {
        if (isR2Configured()) console.warn('[BACKUP] Cloudflare R2 mirror failed (local copy saved):', e.message);
    }
}

async function readBackupJsonString(safeName) {
    const localPath = path.join(BACKUPS_DIR, safeName);
    if (existsSync(localPath)) return readFileSync(localPath, 'utf8');
    if (isR2Configured()) {
        try {
            const buf = await getR2ObjectBuffer(`${BACKUPS_PREFIX}${safeName}`);
            return buf.toString('utf8');
        } catch {
            return null;
        }
    }
    return null;
}

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

function normalizeDocumentRow(row) {
    const metaRaw = row?.metadata;
    let meta = metaRaw;
    if (typeof metaRaw === 'string') {
        try { meta = JSON.parse(metaRaw); } catch { meta = {}; }
    }
    if (!meta || typeof meta !== 'object') meta = {};
    return {
        ...meta,
        id: row.id,
        entityType: row.entity_type || meta.entityType || '',
        entityId: row.entity_id || meta.entityId || '',
        docType: meta.docType || meta.doc_type || '',
        label: row.label || meta.label || '',
        url: row.url || meta.url || '',
        expiryDate: row.expiry_date || meta.expiryDate || null,
        filename: meta.filename || '',
        mimeType: meta.mimeType || '',
        fileSize: Number(meta.fileSize || 0),
        uploadedBy: meta.uploadedBy || '',
        uploadedAt: meta.uploadedAt || row.created_at || null,
        entity_type: row.entity_type || '',
        entity_id: row.entity_id || '',
        doc_type: meta.docType || meta.doc_type || '',
        expiry_date: row.expiry_date || null,
        created_at: row.created_at || null,
    };
}

app.get('/api/documents', async (req, res) => {
    try {
        const { entityType, entityId } = req.query;
        let query = 'SELECT * FROM documents WHERE 1=1';
        const params = [];
        if (entityType) { params.push(entityType); query += ` AND entity_type = $${params.length}`; }
        if (entityId) { params.push(entityId); query += ` AND (entity_id = $${params.length} OR metadata->>'driverId' = $${params.length})`; }

        const result = await db.query(query, params);
        res.json({ success: true, documents: result.rows.map(normalizeDocumentRow) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/documents/expiring', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const result = await db.query("SELECT * FROM documents WHERE expiry_date <= CURRENT_DATE + interval '1 day' * $1", [parseInt(days)]);
        res.json({ success: true, documents: result.rows.map(normalizeDocumentRow) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/documents/upload', upload.any(), async (req, res) => {
    try {
        const body = req.body || {};
        const file = req.files?.[0];
        const id = Date.now().toString();
        const { entityType, entityId, label, url, expiryDate, ...rest } = body;
        let uploadedUrl = '';
        if (file) {
            uploadedUrl = await persistUploadedFile(file, {
                entityType: entityType || 'documents',
                entityId: entityId || 'admin',
                docType: label ? String(label).slice(0, 40) : 'uploads',
            });
        }
        const finalUrl = url || uploadedUrl;
        if (!finalUrl) return res.status(400).json({ error: 'Document URL or file is required' });

        const metadata = {
            ...rest,
            entityType: entityType || '',
            entityId: entityId || '',
            docType: rest.docType || rest.doc_type || '',
            uploadedBy: rest.uploadedBy || 'admin',
            uploadedAt: new Date().toISOString(),
            filename: file?.originalname || rest.filename || '',
            mimeType: file?.mimetype || rest.mimeType || '',
            fileSize: Number(file?.size || rest.fileSize || 0),
        };

        await db.query(
            'INSERT INTO documents (id, entity_type, entity_id, label, url, expiry_date, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, entityType, entityId, label, finalUrl, expiryDate, JSON.stringify(metadata)]
        );
        const inserted = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
        res.json({ success: true, document: normalizeDocumentRow(inserted.rows[0]) });
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
app.post('/api/admin/upload', upload.any(), async (req, res) => {
    try {
        const file = req.files?.[0];
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        const url = await persistUploadedFile(file, {
            entityType: 'admin',
            entityId: 'inline',
            docType: 'uploads',
            cloudinaryFolder: 'tracker_inline',
        });
        if (!url) {
            return res.status(503).json({ error: 'Upload storage unavailable. Configure Cloudinary or Cloudflare R2.' });
        }
        res.json({ success: true, url });
    } catch (e) {
        console.error('[ADMIN_UPLOAD]', e);
        res.status(500).json({ error: e.message || 'Upload failed' });
    }
});

// ─── GENERIC ADMIN CRUD ────────────────────────────────────────────────────
// Maps frontend collection names → DB tables + dedicated column extraction.
// The ENTIRE frontend object is always stored in metadata (lossless).
// Dedicated columns are ALSO extracted so transformDBTables() reads them correctly.

const normalizeDateInput = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
        const dd = slash[1].padStart(2, '0');
        const mm = slash[2].padStart(2, '0');
        const yyyy = slash[3];
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
};

const randomId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function buildPayslipPdfBuffer({ companyName, employeeName, employeeId, role, month, payrollId, grossPay, totalDeductions, netPay, paidDate, paymentReference }) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).text(companyName || 'Segecha Group Ltd', { align: 'left' });
        doc.moveDown(0.3);
        doc.fontSize(12).fillColor('#555').text('Monthly Payslip', { align: 'left' }).fillColor('#000');
        doc.moveDown();

        doc.fontSize(11);
        doc.text(`Employee: ${employeeName || 'N/A'}`);
        doc.text(`Employee ID: ${employeeId || 'N/A'}`);
        doc.text(`Role: ${role || 'N/A'}`);
        doc.text(`Month: ${month || 'N/A'}`);
        doc.text(`Payroll Ref: ${payrollId || 'N/A'}`);
        doc.moveDown();

        doc.fontSize(12).text('Earnings & Deductions', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Gross Pay: KES ${Number(grossPay || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.text(`Total Deductions: KES ${Number(totalDeductions || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.fontSize(13).text(`Net Pay: KES ${Number(netPay || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { underline: true });
        doc.moveDown();
        doc.fontSize(11).text(`Payment Date: ${paidDate || 'Pending'}`);
        doc.text(`Payment Reference: ${paymentReference || 'Pending'}`);
        doc.moveDown();
        doc.fontSize(9).fillColor('#666').text('System generated payslip. For disputes, contact payroll office.');
        doc.end();
    });
}

async function postPayrollLedgerEntries({ payrollId, amount = 0, paidDate, actor = 'system', metadata = {} }) {
    const src = String(payrollId || '');
    if (!src) return;
    const rows = await db.query('SELECT id FROM ledger_entries WHERE source_type = $1 AND source_id = $2 LIMIT 1', ['payroll', src]);
    if ((rows.rows || []).length > 0) return;
    const amt = round2(amount);
    if (amt <= 0) return;
    const entryDate = normalizeDateInput(paidDate) || new Date().toISOString().slice(0, 10);
    await db.query(
        `INSERT INTO ledger_entries
         (id, entry_date, source_type, source_id, account_code, account_name, debit, credit, currency, notes, metadata, created_by)
         VALUES
         ($1,$2,'payroll',$3,'5000','Payroll Expense',$4,0,'KES',$5,$6::jsonb,$7),
         ($8,$2,'payroll',$3,'1001','Cash / M-Pesa Float',0,$4,'KES',$5,$6::jsonb,$7)`,
        [
            randomId('led'),
            entryDate,
            src,
            amt,
            'Payroll disbursement posting',
            JSON.stringify(metadata || {}),
            actor,
            randomId('led'),
        ]
    );
}

async function postInvoicePaymentLedgerEntries({ invoiceId, deltaPaidAmount = 0, paidDate, actor = 'system', metadata = {} }) {
    const src = String(invoiceId || '');
    const amt = round2(deltaPaidAmount);
    if (!src || amt <= 0) return;
    const existing = await db.query(
        `SELECT id FROM ledger_entries
         WHERE source_type = 'invoice_payment'
           AND source_id = $1
           AND metadata->>'paymentAmount' = $2
         LIMIT 1`,
        [src, String(amt)]
    );
    if ((existing.rows || []).length > 0) return;
    const entryDate = normalizeDateInput(paidDate) || new Date().toISOString().slice(0, 10);
    await db.query(
        `INSERT INTO ledger_entries
         (id, entry_date, source_type, source_id, account_code, account_name, debit, credit, currency, notes, metadata, created_by)
         VALUES
         ($1,$2,'invoice_payment',$3,'1001','Cash / M-Pesa Float',$4,0,'KES',$5,$6::jsonb,$7),
         ($8,$2,'invoice_payment',$3,'1100','Accounts Receivable',0,$4,'KES',$5,$6::jsonb,$7)`,
        [
            randomId('led'),
            entryDate,
            src,
            amt,
            'Invoice payment posting',
            JSON.stringify({ ...metadata, paymentAmount: amt }),
            actor,
            randomId('led'),
        ]
    );
}

async function postExpenseLedgerEntries({ expenseId, amount = 0, entryDate, actor = 'system', metadata = {} }) {
    const src = String(expenseId || '');
    const amt = round2(amount);
    if (!src || amt <= 0) return;
    const existing = await db.query('SELECT id FROM ledger_entries WHERE source_type = $1 AND source_id = $2 LIMIT 1', ['expense', src]);
    if ((existing.rows || []).length > 0) return;
    const date = normalizeDateInput(entryDate) || new Date().toISOString().slice(0, 10);
    await db.query(
        `INSERT INTO ledger_entries
         (id, entry_date, source_type, source_id, account_code, account_name, debit, credit, currency, notes, metadata, created_by)
         VALUES
         ($1,$2,'expense',$3,'5100','Operating Expense',$4,0,'KES',$5,$6::jsonb,$7),
         ($8,$2,'expense',$3,'1001','Cash / M-Pesa Float',0,$4,'KES',$5,$6::jsonb,$7)`,
        [
            randomId('led'),
            date,
            src,
            amt,
            'Expense posting',
            JSON.stringify(metadata || {}),
            actor,
            randomId('led'),
        ]
    );
}

async function postMonthlyDepreciationLedgerEntries({ actor = 'system' } = {}) {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const check = await db.query(
        `SELECT id FROM ledger_entries
         WHERE source_type = 'depreciation'
           AND source_id = $1
         LIMIT 1`,
        [month]
    );
    if ((check.rows || []).length > 0) return;
    const assetsRes = await db.query(`SELECT id, cost, salvage_value, useful_life_years, depreciation_method FROM assets WHERE status <> 'Disposed'`);
    let total = 0;
    for (const a of assetsRes.rows || []) {
        const cost = Number(a.cost || 0);
        const salvage = Number(a.salvage_value || 0);
        const years = Math.max(1, Number(a.useful_life_years || 1));
        const method = String(a.depreciation_method || 'straight-line').toLowerCase();
        if (cost <= 0) continue;
        const monthly = method.includes('reducing')
            ? ((cost * 0.3) / 12)
            : Math.max(0, (cost - salvage) / (years * 12));
        total += monthly;
    }
    const amt = round2(total);
    if (amt <= 0) return;
    const entryDate = `${month}-01`;
    await db.query(
        `INSERT INTO ledger_entries
         (id, entry_date, source_type, source_id, account_code, account_name, debit, credit, currency, notes, metadata, created_by)
         VALUES
         ($1,$2,'depreciation',$3,'5200','Depreciation Expense',$4,0,'KES',$5,$6::jsonb,$7),
         ($8,$2,'depreciation',$3,'1500','Accumulated Depreciation',0,$4,'KES',$5,$6::jsonb,$7)`,
        [
            randomId('led'),
            entryDate,
            month,
            amt,
            'Monthly depreciation posting',
            JSON.stringify({ month }),
            actor,
            randomId('led'),
        ]
    );
}

function parseJsonObj(v) {
    if (!v) return {};
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return {}; }
}

async function getPayrollContext(payrollId) {
    const res = await db.query('SELECT * FROM payroll WHERE id = $1', [payrollId]);
    if (!(res.rows || []).length) return null;
    const row = res.rows[0];
    const meta = parseJsonObj(row.metadata);
    const entityId = row.entity_id || meta.driver || '';
    const entityType = String(row.entity_type || meta.entityType || 'driver').toLowerCase();
    const table = entityType === 'staff' ? 'staff' : 'drivers';
    const empRes = entityId ? await db.query(`SELECT * FROM ${table} WHERE id = $1`, [entityId]) : { rows: [] };
    const employee = (empRes.rows || [])[0] || {};
    return { row, meta, entityId, entityType, employee };
}

async function generatePayslipDocument({ payrollId, actor = 'system' }) {
    const ctx = await getPayrollContext(payrollId);
    if (!ctx) throw new Error('Payroll record not found');
    const { row, meta, entityId, entityType, employee } = ctx;
    const settings = await getSettings();
    const companyName = settings.companyName || process.env.COMPANY_NAME || 'Segecha Group Ltd';
    const employeeName = employee.name || meta._name || entityId || 'Employee';
    const role = employee.role || meta._role || (entityType === 'staff' ? 'Staff' : 'Driver');
    const grossPay = Number(meta.grossPay ?? ((meta.baseSalary || 0) + (meta.allowance || 0)));
    const totalDeductions = Number(meta.totalDeductions ?? meta.deductions ?? 0);
    const netPay = Number(meta.netPay ?? (grossPay - totalDeductions));
    const paidDate = row.payment_date || meta.paidDate || null;
    const paymentReference = row.payment_reference || meta.mpesaRef || null;
    const fileName = `payslip_${String(entityId || 'employee')}_${String(row.month || 'month')}.pdf`;
    const pdfBuffer = await buildPayslipPdfBuffer({
        companyName,
        employeeName,
        employeeId: entityId,
        role,
        month: row.month || meta.month,
        payrollId: row.id,
        grossPay,
        totalDeductions,
        netPay,
        paidDate,
        paymentReference,
    });
    const key = buildKey(entityType || 'payroll', entityId || 'unknown', 'payslips', fileName);
    const payslipUrl = await uploadToR2(pdfBuffer, key, 'application/pdf');
    const docId = randomId('doc');
    const label = `Payslip ${row.month || ''}`.trim();
    const metaDoc = {
        docType: 'Payslip',
        payrollId: row.id,
        month: row.month || null,
        filename: fileName,
        mimeType: 'application/pdf',
        fileSize: pdfBuffer.length,
        uploadedBy: actor,
        uploadedAt: new Date().toISOString(),
    };
    await db.query(
        `INSERT INTO documents (id, entity_type, entity_id, label, url, metadata)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [docId, entityType, entityId, label, payslipUrl, JSON.stringify(metaDoc)]
    );
    const mergedMeta = { ...meta, payslipUrl, payslipDocId: docId, payslipGeneratedAt: new Date().toISOString() };
    await db.query(
        `UPDATE payroll
         SET metadata = $2::jsonb, updated_at = NOW(), payslip_dispatch_allowed = CASE WHEN status = 'Paid' THEN TRUE ELSE payslip_dispatch_allowed END
         WHERE id = $1`,
        [row.id, JSON.stringify(mergedMeta)]
    );
    return { payslipUrl, docId, entityType, entityId, employeeName, month: row.month, netPay, grossPay, totalDeductions };
}

const ADMIN_COLLECTIONS = {
    trucks: {
        table: 'trucks',
        extract: (item) => ({
            registration_number: item.reg || item.registration_number || '',
            model:               item.model || '',
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
            load_capacity_kg:    Number(item.capacity || item.load_capacity_kg) || 0,
            gross_weight_kg:     Number(item.grossWeightKg || item.gross_weight_kg) || 0,
            registration_date:   normalizeDateInput(item.registeredOn || item.registration_date),
            status:              item.status || 'Active',
        }),
    },
    drivers: {
        table: 'drivers',
        extract: (item) => ({
            name:           item.name    || '',
            phone:          item.phone   || '',
            email:          item.email   || '',
            personal_email: item.personalEmail || item.personal_email || item.email || '',
            national_id:    item.nationalId || item.national_id || '',
            date_of_birth:  normalizeDateInput(item.dateOfBirth || item.date_of_birth),
            gender:         item.gender || '',
            physical_address: item.physicalAddress || item.physical_address || '',
            next_of_kin_name: item.nextOfKinName || item.next_of_kin_name || '',
            next_of_kin_relationship: item.nextOfKinRelationship || item.next_of_kin_relationship || '',
            next_of_kin_phone: item.nextOfKinPhone || item.next_of_kin_phone || '',
            employee_number: item.employeeNumber || item.employee_number || '',
            employment_type: item.employmentType || item.employment_type || '',
            date_of_hire: normalizeDateInput(item.dateOfHire || item.date_of_hire),
            department: item.department || 'Operations',
            job_title: item.jobTitle || item.job_title || 'Driver',
            license_number: item.license || item.license_number || '',
            bank_name: item.bankName || item.bank_name || '',
            bank_account_number: item.bankAccountNumber || item.bank_account_number || '',
            bank_branch: item.bankBranch || item.bank_branch || '',
            kra_pin: item.kraPin || item.kra_pin || '',
            nssf_number: item.nssfNumber || item.nssf_number || '',
            nhif_number: item.nhifNumber || item.nhif_number || '',
            night_out_rate: Number(item.nightOutRate || item.night_out_rate) || 0,
            trip_allowance_rate: Number(item.tripAllowanceRate || item.trip_allowance_rate) || 0,
            overtime_rate: Number(item.overtimeRate || item.overtime_rate) || 0,
            status:         item.status  || 'Active',
            truck_id:       item.truck   || item.truck_id || null,
            lock_vehicle_assignment: Boolean(item.lockVehicleAssignment ?? item.lock_vehicle_assignment ?? false),
        }),
    },
    staff: {
        table: 'staff',
        extract: (item) => ({
            name:   item.name   || '',
            role:   item.role   || '',
            email:  item.email  || '',
            phone:  item.phone  || '',
            national_id: item.nationalId || item.national_id || '',
            date_of_birth: normalizeDateInput(item.dateOfBirth || item.date_of_birth),
            gender: item.gender || '',
            physical_address: item.physicalAddress || item.physical_address || '',
            next_of_kin_name: item.nextOfKinName || item.next_of_kin_name || '',
            next_of_kin_relationship: item.nextOfKinRelationship || item.next_of_kin_relationship || '',
            next_of_kin_phone: item.nextOfKinPhone || item.next_of_kin_phone || '',
            employee_number: item.employeeNumber || item.employee_number || '',
            employment_type: item.employmentType || item.employment_type || '',
            date_of_hire: normalizeDateInput(item.dateOfHire || item.date_of_hire),
            department_name: item.department || item.department_name || '',
            job_title: item.jobTitle || item.job_title || item.role || '',
            reports_to_staff_id: item.reportsTo || item.reports_to_staff_id || null,
            bank_name: item.bankName || item.bank_name || '',
            bank_account_number: item.bankAccountNumber || item.bank_account_number || '',
            bank_branch: item.bankBranch || item.bank_branch || '',
            mpesa_number: item.mpesa || item.mpesa_number || '',
            kra_pin: item.kraPin || item.kra_pin || '',
            nssf_number: item.nssfNumber || item.nssf_number || '',
            nhif_number: item.nhifNumber || item.nhif_number || '',
            basic_salary: Number(item.basicSalary || item.baseSalary || item.basic_salary || item.salary) || 0,
            house_allowance: Number(item.houseAllowance || item.house_allowance) || 0,
            transport_allowance: Number(item.transportAllowance || item.transport_allowance) || 0,
            airtime_allowance: Number(item.airtimeAllowance || item.airtime_allowance) || 0,
            other_allowance_name: item.otherAllowanceName || item.other_allowance_name || '',
            other_allowance_amount: Number(item.otherAllowanceAmount || item.other_allowance_amount) || 0,
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
            truck_id:    item.truck    || item.truck_id   || null,  // enables DB-side truck filtering
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
            payment_reference: item.paymentReference || item.payment_reference || item.mpesaRef || '',
            payment_date: normalizeDateInput(item.paymentDate || item.payment_date || item.paidDate),
            payment_confirmed_at: item.paymentConfirmedAt || item.payment_confirmed_at || null,
            confirmed_by: item.confirmedBy || item.confirmed_by || null,
            payslip_dispatch_allowed: Boolean(item.payslipDispatchAllowed ?? item.payslip_dispatch_allowed ?? false),
        }),
    },
    incidents: {
        table: 'incidents',
        extract: (item) => ({
            type:        item.incidentType || item.type || 'Other',
            description: item.description || '',
            status:      item.status || 'Open',
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
    assets: {
        table: 'assets',
        extract: (item) => ({
            name:                 item.name                 || '',
            category:             item.category             || '',
            purchase_date:        item.purchaseDate || item.purchase_date || null,
            cost:                 Number(item.cost)         || 0,
            salvage_value:        Number(item.salvageValue  || item.salvage_value) || 0,
            useful_life_years:    Number(item.usefulLifeYears || item.useful_life_years) || 5,
            depreciation_method:  item.depreciationMethod  || item.depreciation_method || 'straight-line',
            supplier:             item.supplier             || '',
            linked_truck_id:      item.linkedTruckId || item.linked_truck_id || null,
            status:               item.status               || 'Active',
        }),
    },
    documents: {
        table: 'documents',
        extract: (item) => ({
            entity_type: item.entityType || item.entity_type || '',
            entity_id: item.entityId || item.entity_id || '',
            label: item.label || '',
            url: item.url || '',
            expiry_date: item.expiryDate || item.expiry_date || null,
        }),
    },
};

// Helper: build INSERT/UPDATE SQL for a collection row
async function upsertCollectionRow(collection, item) {
    const cfg = ADMIN_COLLECTIONS[collection];
    if (!cfg) throw new Error(`Unknown collection: ${collection}`);

    const existing = await db.query(`SELECT * FROM ${cfg.table} WHERE id = $1`, [item.id]);
    let merged = item;
    if (existing.rows.length > 0) {
        const row = existing.rows[0];
        let meta = row.metadata;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { meta = {}; }
        } else if (!meta || typeof meta !== 'object') {
            meta = {};
        }
        merged = { ...meta, ...item };
    }
    const cols = cfg.extract(merged);
    const metaJson = JSON.stringify(merged);

    const colNames  = Object.keys(cols);
    const colValues = Object.values(cols);

    if (existing.rows.length > 0) {
        const sets = colNames.map((c, i) => `${c} = $${i + 2}`).join(', ');
        await db.query(
            `UPDATE ${cfg.table} SET ${sets}, metadata = $${colNames.length + 2}, updated_at = NOW() WHERE id = $1`,
            [item.id, ...colValues, metaJson]
        );
    } else {
        const placeholders = colNames.map((_, i) => `$${i + 3}`).join(', ');
        await db.query(
            `INSERT INTO ${cfg.table} (id, metadata, ${colNames.join(', ')}) VALUES ($1, $2, ${placeholders})`,
            [item.id, metaJson, ...colValues]
        );
    }
    const actor = String(item?._updatedBy || item?._createdBy || 'system');
    if (collection === 'expenses') {
        const amount = Number(merged.amount ?? cols.amount ?? 0);
        const date = merged.date || cols.date || null;
        await postExpenseLedgerEntries({
            expenseId: item.id,
            amount,
            entryDate: date,
            actor,
            metadata: { category: merged.cat || cols.category || null },
        });
    }
    if (collection === 'invoices') {
        const previousPaid = Number(parseJsonObj(existing.rows?.[0]?.metadata).paidAmount || existing.rows?.[0]?.paid_amount || 0);
        const currentPaid = Number(merged.paidAmount ?? merged.amountPaid ?? 0);
        const delta = round2(currentPaid - previousPaid);
        if (delta > 0) {
            await postInvoicePaymentLedgerEntries({
                invoiceId: item.id,
                deltaPaidAmount: delta,
                paidDate: merged.paidDate || merged.paymentDate || new Date().toISOString().slice(0, 10),
                actor,
                metadata: { invoiceNumber: merged.invoiceNo || merged.uId || item.id },
            });
        }
    }
}

// POST /api/admin/collection/:col — create or upsert a record
app.post('/api/admin/collection/:col', async (req, res) => {
    const { col } = req.params;
    if (!ADMIN_COLLECTIONS[col]) return res.status(400).json({ error: `Unknown collection: ${col}` });
    if (!req.body || !req.body.id) {
        return res.status(400).json({ error: 'Missing required field: id' });
    }
    try {
        const actor = req.admin?.email || req.admin?.id || 'system';
        await upsertCollectionRow(col, {
            ...req.body,
            _createdBy: req.body?._createdBy || actor,
            _updatedBy: actor,
            _isDeleted: false,
            deletedAt: null,
            deletedBy: null,
        });
        res.json({ success: true });
    } catch (e) {
        console.error(`[CRUD] POST ${col} failed:`, e.message);
        await writeErrorLog({ source: 'database', level: 'error', message: `[CRUD] POST ${col} failed: ${e.message}`, stack: e.stack || null, meta: { col, op: 'post' } });
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/admin/collection/:col/:id — update a record
app.put('/api/admin/collection/:col/:id', async (req, res) => {
    const { col } = req.params;
    if (!ADMIN_COLLECTIONS[col]) return res.status(400).json({ error: `Unknown collection: ${col}` });
    try {
        const actor = req.admin?.email || req.admin?.id || 'system';
        await upsertCollectionRow(col, { ...req.body, id: req.params.id, _updatedBy: actor });
        res.json({ success: true });
    } catch (e) {
        console.error(`[CRUD] PUT ${col}/${req.params.id} failed:`, e.message);
        await writeErrorLog({ source: 'database', level: 'error', message: `[CRUD] PUT ${col}/${req.params.id} failed: ${e.message}`, stack: e.stack || null, meta: { col, id: req.params.id, op: 'put' } });
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/admin/collection/:col/:id — soft-delete a record (audit-safe)
app.delete('/api/admin/collection/:col/:id', async (req, res) => {
    const { col, id } = req.params;
    const cfg = ADMIN_COLLECTIONS[col];
    if (!cfg) return res.status(400).json({ error: `Unknown collection: ${col}` });
    try {
        const existing = await db.query(`SELECT metadata FROM ${cfg.table} WHERE id = $1`, [id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        const nowIso = new Date().toISOString();
        const actor = req.admin?.email || req.admin?.id || 'system';
        const meta = { ...(existing.rows[0]?.metadata || {}) };
        await upsertCollectionRow(col, {
            ...meta,
            id,
            _isDeleted: true,
            deletedAt: nowIso,
            deletedBy: actor,
            _updatedBy: actor,
            status: meta.status || 'Deleted',
        });
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
        const actor = req.admin?.email || req.admin?.id || 'system';
        const merged = { ...existingMeta, ...req.body, id, _updatedBy: actor };
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

// List Backups (local disk + Cloudflare R2 when configured)
app.get('/api/tracker/backups', async (req, res) => {
    const { readdirSync, statSync } = require('fs');
    try {
        const localFiles = readdirSync(BACKUPS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const stats = statSync(path.join(BACKUPS_DIR, f));
                return {
                    name: f,
                    timestamp: stats.mtime,
                    size: stats.size,
                    local: true,
                    r2: false,
                };
            });

        const byName = new Map();
        for (const f of localFiles) {
            byName.set(f.name, { ...f });
        }

        if (isR2Configured()) {
            try {
                const remote = await listR2Backups();
                for (const f of remote) {
                    const cur = byName.get(f.name);
                    const r2Time = new Date(f.timestamp).getTime();
                    if (cur) {
                        cur.r2 = true;
                        const localTime = cur.timestamp instanceof Date ? cur.timestamp.getTime() : new Date(cur.timestamp).getTime();
                        if (r2Time > localTime) cur.timestamp = f.timestamp;
                        if ((f.size || 0) > (cur.size || 0)) cur.size = f.size;
                    } else {
                        byName.set(f.name, {
                            name: f.name,
                            timestamp: f.timestamp,
                            size: f.size,
                            local: false,
                            r2: true,
                        });
                    }
                }
            } catch (e) {
                console.warn('[BACKUP] Could not list R2 backups:', e.message);
            }
        }

        const backups = [...byName.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json({ success: true, backups });
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

        await persistBackupFile(filename, backup);
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
        const safeName = path.basename(filename || '');
        const raw = await readBackupJsonString(safeName);
        if (raw == null) return res.status(404).json({ error: 'Backup file not found (disk and R2)' });

        const backup = JSON.parse(raw);

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

// Download Backup (local file first, then Cloudflare R2)
app.get('/api/tracker/backups/download/:filename', async (req, res) => {
    try {
        const safeName = path.basename(req.params.filename);
        if (!/^[\w.\-]+\.json$/i.test(safeName)) return res.status(400).json({ error: 'Invalid filename' });
        const backupPath = path.join(BACKUPS_DIR, safeName);
        if (existsSync(backupPath)) return res.download(backupPath);
        if (isR2Configured()) {
            try {
                const buf = await getR2ObjectBuffer(`${BACKUPS_PREFIX}${safeName}`);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
                return res.send(buf);
            } catch (e) {
                console.warn('[BACKUP] R2 download failed:', e.message);
            }
        }
        return res.status(404).json({ error: 'Backup not found' });
    } catch (e) {
        res.status(500).json({ error: 'Download failed' });
    }
});

// Upload Backup
app.post('/api/tracker/upload-backup', async (req, res) => {
    try {
        const { filename, content } = req.body;
        if (!filename || !content) return res.status(400).json({ error: 'Missing filename or content' });

        const safeName = path.basename(filename);
        if (!safeName.endsWith('.json')) return res.status(400).json({ error: 'Only JSON backup files are allowed' });

        await persistBackupRawString(safeName, content);

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
        await persistBackupFile(filename, backup);
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

app.get('/api/driver/me', driverAuth.authMiddleware, async (req, res) => {
    try {
        const profile = await driverAuth.exportDriverAccount(req.driver.driverId);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json({ success: true, driver: profile });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/driver/portal-data', driverAuth.authMiddleware, async (req, res) => {
    try {
        const data = await driverData.getDriverData(req.driver.driverId);
        if (!data) return res.status(404).json({ error: 'Driver data not found' });
        res.json({ success: true, ...data });
    } catch (e) {
        console.error('[PORTAL_DATA_ERROR]', e.message, e.stack);
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

app.post('/api/driver/upload', driverAuth.authMiddleware, upload.any(), async (req, res) => {
    try {
        const file = req.files?.[0];
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        const driverId = req.driver.driverId;
        const url = await persistUploadedFile(file, {
            entityType: 'driver',
            entityId: driverId,
            docType: 'portal',
            cloudinaryFolder: 'driver_portal',
        });
        if (!url) {
            return res.status(503).json({ error: 'Upload storage unavailable. Configure Cloudinary or Cloudflare R2.' });
        }
        res.json({ success: true, url });
    } catch (e) {
        console.error('[DRIVER_UPLOAD_INLINE]', e);
        res.status(500).json({ error: e.message || 'Upload failed' });
    }
});

app.get('/api/documents/mine', driverAuth.authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM documents WHERE entity_id = $1 OR metadata->>\'driverId\' = $1',
            [req.driver.driverId]
        );
        res.json({ success: true, documents: result.rows.map(normalizeDocumentRow) });
    } catch (e) {
        console.error('DOCUMENTS_MINE_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/documents/driver-upload', driverAuth.authMiddleware, upload.any(), async (req, res) => {
    try {
        const body = req.body || {};
        const file = req.files?.[0];
        const id = Date.now().toString();
        const driverId = req.driver.driverId;
        let fileUrl = '';
        if (file) {
            fileUrl = await persistUploadedFile(file, {
                entityType: 'driver',
                entityId: driverId,
                docType: body.label ? String(body.label).slice(0, 40) : 'documents',
                cloudinaryFolder: 'driver_documents',
            });
        }
        const doc = {
            ...body,
            id,
            driverId,
            entityType: 'driver',
            entityId: driverId,
            url: (body.url && String(body.url).trim()) || fileUrl,
            uploadedAt: new Date().toISOString(),
            filename: file?.originalname || '',
            mimeType: file?.mimetype || '',
            fileSize: Number(file?.size || 0),
        };
        if (!doc.url) return res.status(400).json({ error: 'Document URL or file is required' });

        const { entityType, entityId, label, url, expiryDate, ...metadata } = doc;
        await db.query(
            'INSERT INTO documents (id, entity_type, entity_id, label, url, expiry_date, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, entityType, entityId, label || 'Driver Upload', url, expiryDate || null, JSON.stringify(metadata)]
        );
        const inserted = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
        res.json({ success: true, document: normalizeDocumentRow(inserted.rows[0]) });
    } catch (e) {
        console.error('DRIVER_UPLOAD_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/payroll/:id/mark-paid', async (req, res) => {
    try {
        const payrollId = req.params.id;
        const actor = req.admin?.email || req.admin?.id || 'system';
        const ctx = await getPayrollContext(payrollId);
        if (!ctx) return res.status(404).json({ error: 'Payroll record not found' });
        const paidDate = normalizeDateInput(req.body?.paidDate) || new Date().toISOString().slice(0, 10);
        const paymentReference = String(req.body?.paymentReference || req.body?.mpesaRef || `MPESA-${Date.now()}`).slice(0, 60);
        const meta = {
            ...ctx.meta,
            status: 'Paid',
            paidDate,
            mpesaRef: paymentReference,
            paymentReference,
        };
        await db.query(
            `UPDATE payroll
             SET status = 'Paid',
                 payment_date = $2,
                 payment_reference = $3,
                 payment_confirmed_at = NOW(),
                 confirmed_by = $4,
                 payslip_dispatch_allowed = TRUE,
                 metadata = $5::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [payrollId, paidDate, paymentReference, actor, JSON.stringify(meta)]
        );
        const amount = Number(meta.netPay ?? meta.amount ?? ctx.row.amount ?? 0);
        await postPayrollLedgerEntries({
            payrollId,
            amount,
            paidDate,
            actor,
            metadata: { entryKind: 'payroll-disbursement', paymentReference },
        });
        const updated = await db.query('SELECT * FROM payroll WHERE id = $1', [payrollId]);
        res.json({ success: true, row: updated.rows?.[0] || null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/payroll/:id/generate-payslip', async (req, res) => {
    try {
        const payrollId = req.params.id;
        const actor = req.admin?.email || req.admin?.id || 'system';
        const ctx = await getPayrollContext(payrollId);
        if (!ctx) return res.status(404).json({ error: 'Payroll record not found' });
        if (String(ctx.row?.status || '').toLowerCase() !== 'paid') {
            return res.status(400).json({ error: 'Payslip generation is allowed only after payroll is marked as paid' });
        }
        const out = await generatePayslipDocument({ payrollId, actor });
        res.json({ success: true, ...out });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/deduction-templates', async (_req, res) => {
    try {
        const rows = await db.query('SELECT * FROM deduction_templates ORDER BY created_at DESC');
        res.json({ success: true, templates: rows.rows || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/deduction-templates', async (req, res) => {
    try {
        const actor = req.admin?.email || req.admin?.id || 'system';
        const id = String(req.body?.id || randomId('ded'));
        const payload = {
            name: String(req.body?.name || '').trim(),
            defaultAmount: Number(req.body?.defaultAmount || 0),
            defaultType: String(req.body?.defaultType || 'fixed'),
            requiresAuthorization: Boolean(req.body?.requiresAuthorization),
            metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
        };
        if (!payload.name) return res.status(400).json({ error: 'Template name is required' });
        await db.query(
            `INSERT INTO deduction_templates (id, name, default_amount, default_type, requires_authorization, metadata, created_by, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NOW())
             ON CONFLICT (id) DO UPDATE
             SET name = EXCLUDED.name,
                 default_amount = EXCLUDED.default_amount,
                 default_type = EXCLUDED.default_type,
                 requires_authorization = EXCLUDED.requires_authorization,
                 metadata = EXCLUDED.metadata,
                 updated_at = NOW()`,
            [id, payload.name, payload.defaultAmount, payload.defaultType, payload.requiresAuthorization, JSON.stringify(payload.metadata), actor]
        );
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/deduction-templates/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM deduction_templates WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/payroll/:id/queue-dispatch', async (req, res) => {
    try {
        const payrollId = req.params.id;
        const actor = req.admin?.email || req.admin?.id || 'system';
        const ctx = await getPayrollContext(payrollId);
        if (!ctx) return res.status(404).json({ error: 'Payroll record not found' });
        if (String(ctx.row.status || '').toLowerCase() !== 'paid') {
            return res.status(400).json({ error: 'Payslip dispatch allowed only after payment confirmation' });
        }
        const email = String(ctx.employee.personal_email || ctx.employee.email || ctx.meta.personalEmail || ctx.meta.email || '').trim();
        if (!email) return res.status(400).json({ error: 'No recipient email configured for this employee' });
        let payslipUrl = ctx.meta.payslipUrl || '';
        if (!payslipUrl) {
            const generated = await generatePayslipDocument({ payrollId, actor });
            payslipUrl = generated.payslipUrl;
        }
        const queueId = randomId('psq');
        await db.query(
            `INSERT INTO payslip_dispatch_queue (id, payroll_id, recipient_email, status, metadata)
             VALUES ($1,$2,$3,'pending',$4::jsonb)`,
            [queueId, payrollId, email, JSON.stringify({ payslipUrl, queuedBy: actor })]
        );
        res.json({ success: true, queueId, payslipUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

async function processPayslipDispatchQueue(limit = 20) {
    const lim = Math.min(50, Math.max(1, Number(limit || 20)));
    const rows = (await db.query(
            `SELECT * FROM payslip_dispatch_queue
             WHERE status = 'pending'
             ORDER BY scheduled_at ASC
             LIMIT $1`,
            [lim]
        )).rows || [];
    let sent = 0;
    let failed = 0;
    for (const q of rows) {
        try {
            const ctx = await getPayrollContext(q.payroll_id);
            if (!ctx) throw new Error('Payroll record missing');
            const metaQ = parseJsonObj(q.metadata);
            const payslipUrl = metaQ.payslipUrl || ctx.meta.payslipUrl;
            if (!payslipUrl) throw new Error('Missing payslip URL');
            const settings = await getSettings();
            await sendPayslipEmail({
                to: q.recipient_email,
                employeeName: ctx.employee.name || ctx.entityId,
                month: ctx.row.month,
                payrollId: ctx.row.id,
                companyName: settings.companyName || process.env.COMPANY_NAME || 'Segecha Group Ltd',
                netPay: Number(ctx.meta.netPay ?? 0),
                grossPay: Number(ctx.meta.grossPay ?? 0),
                deductions: Number(ctx.meta.totalDeductions ?? ctx.meta.deductions ?? 0),
                payslipUrl,
                settings,
            });
            await db.query(
                `UPDATE payslip_dispatch_queue
                 SET status = 'sent', attempts = attempts + 1, sent_at = NOW(), updated_at = NOW(), last_error = NULL
                 WHERE id = $1`,
                [q.id]
            );
            sent += 1;
        } catch (err) {
            await db.query(
                `UPDATE payslip_dispatch_queue
                 SET status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END,
                     attempts = attempts + 1,
                     last_error = $2,
                     updated_at = NOW()
                 WHERE id = $1`,
                [q.id, String(err.message || 'Dispatch failed').slice(0, 500)]
            );
            failed += 1;
        }
    }
    return { sent, failed, processed: rows.length };
}

app.post('/api/admin/payroll/dispatch/process', async (req, res) => {
    try {
        const result = await processPayslipDispatchQueue(req.body?.limit || 20);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/payroll/dispatch-queue', async (_req, res) => {
    try {
        const rows = (await db.query(
            `SELECT * FROM payslip_dispatch_queue
             ORDER BY created_at DESC
             LIMIT 500`
        )).rows || [];
        res.json({ success: true, rows });
    } catch (e) {
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
// - PayloadTooLarge from express.json/urlencoded → clear 413 (was opaque "unexpected error")
app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        console.error(`[413] ${req.method} ${req.url}: body exceeds JSON_BODY_LIMIT (${JSON_BODY_LIMIT})`);
        return res.status(413).json({
            error: `Request body too large (limit ${JSON_BODY_LIMIT}). Use smaller photos, or raise JSON_BODY_LIMIT / reverse-proxy client_max_body_size.`,
        });
    }
    const isDev = process.env.NODE_ENV !== 'production';
    console.error(`[SERVER_ERROR] ${req.method} ${req.url}:`, err);
    writeErrorLog({
        source: err?.type === 'entity.too.large' || err?.status === 413 ? 'backend' : 'server',
        level: 'error',
        message: `[SERVER_ERROR] ${req.method} ${req.url}: ${err?.message || 'Unhandled error'}`,
        stack: err?.stack || null,
        url: req.url,
        userAgent: req.headers['user-agent'] || null,
        meta: { method: req.method, status: err?.status || 500 },
    });
    const clientMessage = isDev ? err.message : 'An unexpected error occurred. Please try again.';
    res.status(err.status || 500).json({ error: clientMessage });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (JSON body limit: ${JSON_BODY_LIMIT})`);
    const cronEnabled = String(process.env.PAYSLIP_DISPATCH_CRON_ENABLED || 'true').toLowerCase() !== 'false';
    const intervalMs = Math.max(15000, Number(process.env.PAYSLIP_DISPATCH_CRON_MS || 60000));
    if (cronEnabled) {
        setInterval(async () => {
            try {
                const { sent, failed, processed } = await processPayslipDispatchQueue(Number(process.env.PAYSLIP_DISPATCH_BATCH_SIZE || 20));
                await postMonthlyDepreciationLedgerEntries({ actor: 'cron' });
                if (processed > 0) {
                    console.log(`[PAYSLIP_QUEUE_CRON] processed=${processed} sent=${sent} failed=${failed}`);
                }
            } catch (err) {
                console.warn('[PAYSLIP_QUEUE_CRON] failed:', err.message);
            }
        }, intervalMs);
        console.log(`[PAYSLIP_QUEUE_CRON] enabled interval=${intervalMs}ms`);
    } else {
        console.log('[PAYSLIP_QUEUE_CRON] disabled');
    }
});

process.on('unhandledRejection', (reason) => {
    writeErrorLog({
        source: 'backend',
        level: 'error',
        message: `Unhandled promise rejection: ${reason?.message || String(reason)}`,
        stack: reason?.stack || null,
        meta: { kind: 'unhandledRejection' },
    });
});

process.on('uncaughtException', (error) => {
    writeErrorLog({
        source: 'backend',
        level: 'error',
        message: `Uncaught exception: ${error?.message || String(error)}`,
        stack: error?.stack || null,
        meta: { kind: 'uncaughtException' },
    });
});

module.exports = { app, db };


