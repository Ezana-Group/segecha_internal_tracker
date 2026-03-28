const path = require('path');
const { existsSync, writeFileSync } = require('fs');
const AdmZip = require('adm-zip');

// Load environment variables from both root and local (robust for multiple root-folder setups)
const originalPort = process.env.PORT;
const envPaths = [path.join(__dirname, '..', '.env'), path.join(__dirname, '.env')];
envPaths.forEach(p => { if (existsSync(p)) require('dotenv').config({ path: p, override: true }); });

// Restore system port if it existed (don't let .env override the host-provided PORT)
if (originalPort) process.env.PORT = originalPort;

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { uploadBuffer } = require('./cloudinary');
const { uploadToR2 } = require('./r2');
const upload = multer();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', true);



async function saveSystemSetting(key, value, changedBy = 'System') {
    const currentRes = await db.query('SELECT value FROM system_settings WHERE key = $1', [key]);
    const oldValue = currentRes.rows.length > 0 ? currentRes.rows[0].value : null;
    const newValue = typeof value === 'object' ? JSON.stringify(value) : value;

    await db.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [key, newValue]);

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        await db.query(`
            INSERT INTO system_settings_audit (setting_key, old_value, new_value, changed_by)
            VALUES ($1, $2, $3, $4)
        `, [key, oldValue, newValue, changedBy]);
    }
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


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const APP_VERSION = '2.1.0';

// Public version endpoint (no auth required for handshake)
app.get('/api/version', (req, res) => {
    res.json({ version: APP_VERSION });
});

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
    '/admin/login', '/api/admin/login',
    '/driver/login', '/api/driver/login',
    '/driver/forgot-password', '/api/driver/forgot-password',
    '/driver/set-password', '/api/driver/set-password',
    '/staff/login', '/api/staff/login',
    '/staff/forgot-password', '/api/staff/forgot-password',
    '/staff/set-password', '/api/staff/set-password',
    '/health', '/api/health'
];

const adminAuth = async (req, res, next) => {
    if (req.method === 'OPTIONS') return next();

    const path = req.path.replace(/\/$/, '');
    if (PUBLIC_ROUTES.includes(path)) return next();

    const adminKey = req.headers['x-admin-key'] || req.body?.adminKey || req.query?.adminKey;
    const authHeader = req.headers.authorization;

    // 1. LEGACY ADMIN KEY (Non-production or internal sync)
    // In production, we strictly require JWT for user-initiated actions.
    if (adminKey && adminKey.trim() === ADMIN_KEY && ADMIN_KEY !== '') {
        if (process.env.NODE_ENV === 'production' && !path.startsWith('/tracker/data')) {
             // Allow x-admin-key only for internal data sync even in production
             console.warn(`[AUTH] Legacy x-admin-key used in Production for ${path}`);
        }
        req.user = { role: 'superadmin', id: 'system-key', name: 'System API' };
        return next();
    }

    // 2. JWT TOKEN AUTH
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Validate session version for admins
            if (decoded.role === 'superadmin' || decoded.role === 'admin') {
                const dbRes = await db.query('SELECT session_version FROM admins WHERE id = $1', [decoded.id]);
                if (dbRes.rows.length > 0) {
                    const currentVersion = dbRes.rows[0].session_version || 1;
                    if ((decoded.version || 1) < currentVersion) {
                        return res.status(401).json({ error: 'Session expired. Please log in again.' });
                    }
                }
            }

            // Normalise user object
            req.user = {
                id: decoded.id || decoded.driverId || decoded.staffId,
                role: decoded.role || (decoded.driverId ? 'driver' : 'staff'),
                name: decoded.name || decoded.display_name || 'User',
                version: decoded.version
            };

            return next();
        } catch (e) {
            return res.status(401).json({ error: 'Session expired or invalid' });
        }
    }

    console.warn(`[AUTH] Unauthorized access attempt: path=${path}, hasKey=${!!adminKey}, hasAuth=${!!authHeader}`);
    return res.status(403).json({ error: 'Unauthorized access' });
};

/**
 * Middleware to restrict access to specific roles.
 * Must be used AFTER adminAuth.
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        
        // superadmin always has access
        if (req.user.role === 'superadmin') return next();
        
        if (!roles.includes(req.user.role)) {
            console.warn(`[AUTH] Access denied for user ${req.user.id} (role: ${req.user.role}) to ${req.method} ${req.path}. Required: ${roles.join(', ')}`);
            return res.status(403).json({ error: 'You do not have permission to perform this action' });
        }
        next();
    };
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


// --- PUBLIC TRACKING ENDPOINT ---
const trackRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many tracking requests. Please try again later.' }
});

app.get('/api/track/:ref', trackRateLimit, async (req, res) => {
    const { ref } = req.params;
    try {
        const query = `
            SELECT j.*, t.registration_number as truck_reg
            FROM journeys j
            LEFT JOIN trucks t ON j.truck_id = t.id
            WHERE j.tracking_id = $1 OR j.booking_no = $1 OR j.id = $1
        `;
        const result = await db.query(query, [ref.trim().toUpperCase()]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Shipment not found' });
        }

        const j = result.rows[0];
        res.json({
            success: true,
            waybillNo: j.tracking_id || j.booking_no || j.id,
            status: j.status,
            origin: j.origin,
            dest: j.destination,
            cargo: j.cargo_type,
            updatedAt: j.created_at
        });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Tracking service error' });
    }
});

// --- AUTHENTICATED API ROUTES ---
// Apply AUTH to all /api routes except public ones
app.use('/api', adminAuth);





async function autoSeed() {
    try {
        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@segecha.com';
        const initialAdminPhone = process.env.INITIAL_ADMIN_PHONE || '+254700000000';
        const staffId = 'staff-admin-init';
        const initialHash = bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD || 'SierraGolf26', 10);

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
                -- Payroll column (Finalized flag for locking)
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='finalized') THEN
                    ALTER TABLE payroll ADD COLUMN finalized BOOLEAN DEFAULT FALSE;
                END IF;
                -- Fuel Logs column for Fuel Type
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_logs' AND column_name='fuel_type') THEN
                    ALTER TABLE fuel_logs ADD COLUMN fuel_type TEXT;
                END IF;
                -- Journeys column for Return Trip
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journeys' AND column_name='is_return') THEN
                    ALTER TABLE journeys ADD COLUMN is_return BOOLEAN DEFAULT FALSE;
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

        console.log(`[SEED] SUCCESS: Superadmin created (${initialAdminEmail}). Password is set from INITIAL_ADMIN_PASSWORD.`);
    } catch (e) {
        console.warn('[SEED] Skipping auto-seed (likely DB not ready):', e.message);
    }
}
autoSeed(); // Re-enabled to ensure at least one admin exists

// --- AUTHENTICATED ENDPOINTS ---

// Change Own Password
app.post('/api/admin/change-password', adminAuth, async (req, res) => {
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
app.post('/api/admin/reset', adminAuth, restrictTo('superadmin'), async (req, res) => {
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
app.get('/api/tracker/data', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
    try {
        const settings = await getSettings();
        const data = {};
        for (const table of DB_TABLES) {
            const resData = await db.query(`SELECT * FROM ${table}`);
            data[table] = resData.rows.map(r => normalizeRow(table, r, settings));
        }
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
    'admins', 'trucks', 'trailers', 'drivers',
    'staff', 'customers', 'journeys', 'fuel_logs', 'expenses',
    'invoices', 'payroll', 'maintenance_logs', 'tyre_logs',
    'incidents', 'documents', 'system_settings', 'staff_auth', 'driver_auth'
];

// Helper to get all data for a specific entity (replaces getData for JSON)
// Helper to get all data for a specific entity (replaces getData for JSON)
async function getEntityData(table) {
    const res = await db.query(`SELECT * FROM ${table}`);
    return res.rows;
}

const DEFAULT_PREFIXES = {
    trucks: 'TRK-',
    trailers: 'TBY-', // Image mapping: Trailers often use TBY or same as trucks? Wait, Image 5 says Trailers prefix setting is usually separate. I'll use TRK- for trucks, TBY for Turnboy etc.
    drivers: 'DRV-',
    staff: 'EMP-',
    customers: 'CLT-',
    journeys: 'MSN-',
    fuel_logs: 'FL-',
    expenses: 'EXP-',
    incidents: 'INC-',
    documents: 'DOC-'
};

function getPrefix(table, settings) {
    const s = settings?.segecha_settings?.idPrefixes || {};
    if (table === 'trucks') return s.vehiclePrefix || DEFAULT_PREFIXES.trucks;
    if (table === 'drivers') return s.driverPrefix || DEFAULT_PREFIXES.drivers;
    if (table === 'staff') return s.staffPrefix || DEFAULT_PREFIXES.staff;
    if (table === 'customers') return s.clientPrefix || DEFAULT_PREFIXES.customers;
    if (table === 'journeys') return s.missionPrefix || DEFAULT_PREFIXES.journeys;
    if (table === 'fuel_logs') return s.fuelLogPrefix || DEFAULT_PREFIXES.fuel_logs;
    if (table === 'expenses') return s.expensePrefix || DEFAULT_PREFIXES.expenses;
    return DEFAULT_PREFIXES[table] || "";
}

const fmtISO = (d) => {
    if (!d) return "";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return "";
        return date.toISOString().split('T')[0];
    } catch (e) { return ""; }
};

const fmtDDMMYYYY = (d) => {
    if (!d) return "";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return "";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${date.getFullYear()}`;
    } catch (e) { return ""; }
};

// Normalize DB rows back to frontend field names
function normalizeTruck(t, settings) {
    const prefix = getPrefix('trucks', settings);
    const uId = t.id.startsWith(prefix) ? t.id : `${prefix}${t.id}`;
    return { ...t, uId, reg: t.registration_number, odom: t.current_mileage, ...t.metadata };
}
function normalizeTrailer(t, settings) {
    const prefix = getPrefix('trailers', settings);
    const uId = t.id.startsWith(prefix) ? t.id : `${prefix}${t.id}`;
    return { ...t, uId, reg: t.registration_number, ...t.metadata };
}
function normalizeDriver(d, settings) {
    const prefix = getPrefix('drivers', settings);
    const uId = d.id.startsWith(prefix) ? d.id : `${prefix}${d.id}`;
    let licenseClass = d.license_class;
    try {
        if (typeof licenseClass === 'string' && licenseClass.startsWith('[')) {
            licenseClass = JSON.parse(licenseClass);
        }
    } catch (e) {
        console.warn(`Failed to parse license_class for driver ${d.id}:`, e.message);
    }
    return { 
        ...d, 
        uId,
        license: d.license_number, 
        class: licenseClass || d.metadata?.class || [],
        truck: d.truck || d.metadata?.truck || "",
        ...d.metadata 
    };
}
function normalizeStaff(s, settings) {
    const prefix = getPrefix('staff', settings);
    const uId = s.id.startsWith(prefix) ? s.id : `${prefix}${s.id}`;
    return { ...s, uId, ...s.metadata };
}
function normalizeJourney(j) {
    return { 
        ...j, 
        truck: j.truck_id, 
        driver: j.driver_id, 
        date: fmtISO(j.start_date), 
        endDate: fmtISO(j.end_date), 
        date_fmt: fmtDDMMYYYY(j.start_date),
        endDate_fmt: fmtDDMMYYYY(j.end_date),
        dest: j.destination, 
        cargo: j.cargo_type, 
        customerId: j.customer_id, 
        isReturn: !!j.is_return,
        ...j.metadata 
    };
}
function normalizeFuel(f) {
    return { 
        ...f, 
        truck: f.truck_id, 
        journey: f.journey_id, 
        pricePerL: f.amount,
        date: fmtISO(f.date), 
        date_fmt: fmtDDMMYYYY(f.date), 
        ...f.metadata 
    };
}
function normalizeExpense(e) {
    return { ...e, journey: e.journey_id, cat: e.category, desc: e.description, date: fmtISO(e.date), date_fmt: fmtDDMMYYYY(e.date), ...e.metadata };
}
function normalizeInvoice(i) {
    return { ...i, journey: i.journey_id, date: fmtISO(i.date), dueDate: fmtISO(i.due_date), date_fmt: fmtDDMMYYYY(i.date), dueDate_fmt: fmtDDMMYYYY(i.due_date), customerId: i.customer_id, ...i.metadata };
}
function normalizeMaintenance(m) {
    return { ...m, truck: m.truck_id, desc: m.description, date: fmtISO(m.date), date_fmt: fmtDDMMYYYY(m.date), ...m.metadata };
}
function normalizePayroll(p) {
    return { ...p, driver: p.entity_id, paidDate: fmtISO(p.paid_date), paidDate_fmt: fmtDDMMYYYY(p.paid_date), ...p.metadata };
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
function normalizeRow(table, row, settings) {
    if (table === 'trucks') return normalizeTruck(row, settings);
    if (table === 'trailers') return normalizeTrailer(row, settings);
    if (table === 'drivers') return normalizeDriver(row, settings);
    if (table === 'staff') return normalizeStaff(row, settings);
    // Add prefixing to other entities as well
    const prefix = getPrefix(table, settings);
    const uId = row.id?.startsWith(prefix) ? row.id : `${prefix}${row.id}`;

    let normalized = row;
    if (table === 'journeys') normalized = normalizeJourney(row);
    else if (table === 'fuel_logs') normalized = normalizeFuel(row);
    else if (table === 'expenses') normalized = normalizeExpense(row);
    else if (table === 'invoices') normalized = normalizeInvoice(row);
    else if (table === 'maintenance_logs') normalized = normalizeMaintenance(row);
    else if (table === 'payroll') normalized = normalizePayroll(row);
    else if (table === 'documents') normalized = normalizeDocument(row);
    
    return { ...normalized, uId };
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
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!require('fs').existsSync(BACKUPS_DIR)) {
    require('fs').mkdirSync(BACKUPS_DIR, { recursive: true });
}
if (!require('fs').existsSync(UPLOADS_DIR)) {
    require('fs').mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function backupEverything() {
    const settings = await getSettings();
    const backupData = {
        version: '6.0',
        timestamp: new Date().toISOString(),
        tables: {}
    };
    for (const table of DB_TABLES) {
        const res = await db.query(`SELECT * FROM ${table}`);
        backupData.tables[table] = res.rows.map(r => normalizeRow(table, r, settings));
    }

    const zip = new AdmZip();
    zip.addFile("data.json", Buffer.from(JSON.stringify(backupData, null, 2), "utf8"));
    
    if (existsSync(UPLOADS_DIR)) {
        zip.addLocalFolder(UPLOADS_DIR, "uploads");
    }
    
    return zip;
}

// Master Restore Helper
// Master Restore Helper (Handles ZIP or Legacy JSON)
async function restoreEverything(backupSource, isZip = false) {
    let backupData;
    if (isZip) {
        const zip = new AdmZip(backupSource);
        const dataJson = zip.readAsText("data.json");
        backupData = JSON.parse(dataJson);
        
        // Restore uploads folder
        if (existsSync(UPLOADS_DIR)) {
            // Option A: Extract and merge. Option B: Clean and replace. 
            // The user said "recover information across database, backend and frontend", 
            // implying a full state recovery. I'll replace.
            zip.extractEntryTo("uploads/", path.join(__dirname), true, true);
        }
    } else {
        backupData = backupSource;
    }

    if (!backupData || !backupData.tables) return;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        for (const [table, rows] of Object.entries(backupData.tables)) {
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
app.get(['/api/admin/journeys/pending', '/api/admin/journeys/pending-verification'], adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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
app.get(['/api/admin/history', '/api/admin/import-history'], adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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
app.get('/api/admin/stats', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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


// Admin upload (Unified Cloudflare R2)
app.post('/api/admin/upload', adminAuth, restrictTo('admin', 'superadmin'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const folder = req.body.folder || 'admin_uploads';
        const key = `${folder}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        return res.json({ success: true, url });
    } catch (e) {
        console.error('UPLOAD_ERROR:', e);
        res.status(500).json({ error: 'File upload failed' });
    }
});


// Generic update for collections
app.put('/api/admin/:col/:id', (req, res) => {
    res.status(501).json({ error: 'PUT not directly supported for generic collections yet. Please use POST to upsert.' });
});

// Generic Admin Entity Delete
app.delete('/api/admin/:table/:id', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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
        
        // Custom cleanup for linked fuel expenses
        if (table === 'fuel_logs') {
            await db.query(`DELETE FROM expenses WHERE id = $1`, [`fuel-exp-${id}`]);
        }
        
        res.json({ success: true, message: `Deleted ${id} from ${table}` });
    } catch (e) {
        console.error(`DELETE_ERROR (${table}):`, e);
        res.status(500).json({ error: e.message });
    }
});


// Admin verification for journeys (start or completion)
app.post('/api/admin/journey/:id/verify', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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
app.post('/api/admin/submission/verify', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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
        
        // Also sync the linked expense if it exists
        if (type === 'fuel') {
            const expId = `fuel-exp-${id}`;
            await db.query(`
                UPDATE expenses SET 
                    metadata = metadata || $1
                WHERE id = $2
            `, [JSON.stringify({ 
                _pendingApproval: false, 
                _isRejected: !approved, 
                _rejectionReason: reason || '' 
            }), expId]);
        }

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
app.get('/api/admin/settings', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await db.query("SELECT key, value FROM system_settings");
        const settings = {};
        result.rows.forEach(r => {
            if (r.key === 'segecha_settings') {
                const val = (typeof r.value === 'string') ? JSON.parse(r.value) : r.value;
                Object.assign(settings, val);
            } else {
                settings[r.key] = r.value;
            }
        });
        res.json({ success: true, settings });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.get('/api/admin/settings/audit', adminAuth, restrictTo('superadmin'), async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM system_settings_audit ORDER BY changed_at DESC LIMIT 100");
        res.json({ success: true, audit: result.rows });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

// Update system settings (Unified segecha_settings blob)
app.post('/api/admin/settings', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
    const { settings } = req.body;
    const changedBy = req.admin ? (req.admin.email || req.admin.id) : 'Admin';
    try {
        await saveSystemSetting('segecha_settings', settings, changedBy);
        res.json({ success: true, message: 'Settings saved to database' });
    } catch (e) {
        console.error('SETTINGS_SAVE_ERROR:', e);
        res.status(500).json({ error: 'Failed to save settings: ' + e.message });
    }
});

app.post('/api/tracker/data', adminAuth, restrictTo('superadmin'), async (req, res) => {
    // Handle both { data: {...} } and {...} direct payloads
    const syncData = req.body.data || req.body;
    try {
        if (!syncData || Object.keys(syncData).length === 0) {
            return res.status(400).json({ error: 'No data provided' });
        }
        await syncFullData(syncData);
        res.json({ success: true, message: 'Live data synchronized to PostgreSQL' });
    } catch (e) {
        console.error('SYNC_ERROR_STACK:', e.stack || e);
        res.status(500).json({ error: 'Sync failed: ' + e.message });
    }
});

// List Backups
app.get('/api/tracker/backups', (req, res) => {
    const { readdirSync, statSync } = require('fs');
    try {
        const files = readdirSync(BACKUPS_DIR)
            .filter(f => f.endsWith('.json') || f.endsWith('.zip'))
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

let lastManualBackupTime = 0;
const BACKUP_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Create Manual Backup (Unified)
app.post('/api/tracker/backup-now', adminAuth, restrictTo('superadmin'), async (req, res) => {
    try {
        const now = Date.now();
        if (now - lastManualBackupTime < BACKUP_COOLDOWN_MS) {
            const minutesLeft = Math.ceil((BACKUP_COOLDOWN_MS - (now - lastManualBackupTime)) / 60000);
            return res.status(429).json({ error: `Manual backups are rate-limited. Please try again in ${minutesLeft} minutes.` });
        }

        const adminContext = req.admin ? (req.admin.email || req.admin.name || req.admin.id) : 'Unknown Admin';
        console.log(`[AUDIT] Manual backup triggered by: ${adminContext} at ${new Date().toISOString()}`);

        lastManualBackupTime = now;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_master_${timestamp}.zip`;
        const zip = await backupEverything();

        writeFileSync(path.join(BACKUPS_DIR, filename), zip.toBuffer());
        res.json({ success: true, message: 'Master backup created: ' + filename });
    } catch (e) {
        console.error('BACKUP_ERROR:', e);
        lastManualBackupTime = 0; // Reset on failure
        res.status(500).json({ error: 'Backup failed: ' + e.message });
    }
});

// Restore from Backup (Unified)
// MASTER RESET logic moved to top for middleware reachability

app.post('/api/tracker/restore', adminAuth, restrictTo('superadmin'), async (req, res) => {
    const { filename } = req.body;
    try {
        const backupPath = path.join(BACKUPS_DIR, filename);
        if (!existsSync(backupPath)) return res.status(404).json({ error: 'Backup file not found' });

        if (filename.endsWith('.zip')) {
            await restoreEverything(backupPath, true);
        } else if (filename.endsWith('.json')) {
            const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
            if (backup.version === '5.0' || backup.version === '4.0') {
                await restoreEverything(backup, false);
            } else {
                return res.status(400).json({ error: 'Legacy JSON backup format no longer supported. Please use a version 4.0+ master backup or a .zip backup.' });
            }
        } else {
            return res.status(400).json({ error: 'Unsupported backup format' });
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


const backupUpload = multer({ dest: '/tmp/' });

app.post('/api/tracker/upload-backup', adminAuth, restrictTo('superadmin'), backupUpload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const filename = req.body.filename || req.file.originalname;
        const safeName = path.basename(filename);
        if (!safeName.endsWith('.json') && !safeName.endsWith('.zip')) {
            return res.status(400).json({ error: 'Only JSON or ZIP backup files are allowed' });
        }

        const backupPath = path.join(BACKUPS_DIR, safeName);
        const buffer = readFileSync(req.file.path);
        writeFileSync(backupPath, buffer);
        
        // Clean up temp file
        require('fs').unlinkSync(req.file.path);

        res.json({ success: true, message: 'Backup uploaded successfully: ' + safeName });
    } catch (e) {
        res.status(500).json({ error: 'Failed to upload backup: ' + e.message });
    }
});

// --- SECURE PAYMENT WEBHOOKS ---

app.post('/api/webhooks/mpesa', async (req, res) => {
    try {
        // Assume Safaricom sends signature in headers if configured, or validate payload 
        // using shared secret (based on Safaricom's specific HMAC setup, often just ip whitelisting, 
        // but here we implement standard HMAC if a secret is provided).
        // Since standard STK push callbacks don't use HMAC but rather strict IP whitelisting + body validation,
        // we'll implement a basic validation here. If a secret is provided, we check HMAC.
        const secret = process.env.MPESA_WEBHOOK_SECRET;
        if (secret) {
            const signature = req.headers['x-mpesa-signature'] || req.headers['x-signature'];
            if (!signature) {
                console.warn('[WEBHOOK] Rejected M-Pesa webhook: Missing signature');
                return res.status(401).send('Missing signature');
            }
            const hash = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
            // Allow matching direct hex or base64 equivalent
            if (hash !== signature && crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('base64') !== signature) {
                console.warn('[WEBHOOK] Rejected M-Pesa webhook: Invalid signature');
                return res.status(401).send('Invalid signature');
            }
        }
        
        console.log('[WEBHOOK] M-Pesa payload received:', req.body);
        // Process M-Pesa payment here (e.g. marking invoice paid)
        res.status(200).send('OK');
    } catch (e) {
        console.error('[WEBHOOK ERROR]', e);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/webhooks/flutterwave', async (req, res) => {
    try {
        const secretHash = process.env.FLW_SECRET_HASH;
        const signature = req.headers['verif-hash'];
        if (!signature || signature !== secretHash) {
            console.warn('[WEBHOOK] Rejected Flutterwave webhook: Invalid signature');
            return res.status(401).send('Invalid signature');
        }
        console.log('[WEBHOOK] Flutterwave payload received:', req.body);
        // Process Flutterwave payment here (e.g. marking invoice paid)
        res.status(200).send('OK');
    } catch (e) {
        console.error('[WEBHOOK ERROR]', e);
        res.status(500).send('Internal Server Error');
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

app.post('/api/driver/create-account', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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


app.post('/api/driver/account/regenerate-credentials', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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

app.delete('/api/driver/account/:id', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
    try {
        const success = await driverAuth.deleteDriverAccount(req.params.id);
        res.json({ success });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- STAFF ACCOUNT MANAGEMENT (ADMIN) ---

app.post('/api/staff/save', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
    try {
        await upsertEntity('staff', req.body);
        res.json({ success: true });
    } catch (e) {
        console.error('STAFF_SAVE_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/driver/save', adminAuth, restrictTo('admin', 'superadmin'), async (req, res) => {
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
    let { table } = req.params;

    // Map frontend collection names to DB table names
    const tableMap = {
        'fuel': 'fuel_logs',
        'maintenance': 'maintenance_logs'
    };
    if (tableMap[table]) table = tableMap[table];

    // Validate table name against allowed list
    const allowed = ['trucks', 'drivers', 'staff', 'journeys', 'fuel_logs', 'expenses', 'incidents', 'customers', 'trailers', 'payroll', 'invoices', 'payments', 'maintenance_logs', 'tyre_logs', 'documents'];
    if (!allowed.includes(table)) {
        return res.status(400).json({ error: 'Invalid entity type: ' + req.params.table });
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

        const folder = req.body.folder || `drivers/${req.driver.driverId}`;

        // General driver upload - unified to R2
        const key = `${folder}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        res.json({ success: true, url });
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


