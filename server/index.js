const express = require('express');
const cors = require('cors');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
const PORT = process.env.PORT;
if (!PORT) console.warn('WARNING: PORT not set, some environments may fail to bind.');

// Core Dependencies (Must be before autoSeed)
const db = require('./db');
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

const PUBLIC_ROUTES = ['/admin/login', '/driver/login', '/staff/login', '/health'];

const adminAuth = (req, res, next) => {
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
            if (decoded.role === 'superadmin' || decoded.role === 'admin') {
                req.admin = decoded;
                return next();
            }
        } catch (e) {
            console.warn(`[AUTH] JWT Verification failed for ${req.path}: ${e.message}`);
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
// 1. Specific Portals first (more specific routes)
app.use('/driver', express.static(DRIVER_DIST));
app.use('/track', express.static(TRACK_DIST));
app.use('/pay', express.static(PAY_DIST));

// 2. Root Admin Panel
app.use(express.static(ADMIN_DIST));

// Handle React routing (SPA) - Protected by React internal logic, but publicly reachable
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();

    // Prevent sending index.html for missing assets (avoids MIME type errors)
    const isAsset = req.path.includes('/assets/') || req.path.match(/\.(css|js|png|jpg|jpeg|svg|ico|json|txt|woff2?|ttf|eot|webp)$/i);
    if (isAsset) {
        console.warn(`[SERVER] Asset not found: ${req.path}`);
        return res.status(404).set('Content-Type', 'text/plain').send('Asset not found');
    }
    
    if (req.path.startsWith('/driver')) {
        return res.sendFile(path.join(DRIVER_DIST, 'index.html'));
    }
    if (req.path.startsWith('/track')) {
        return res.sendFile(path.join(TRACK_DIST, 'index.html'));
    }
    if (req.path.startsWith('/pay')) {
        return res.sendFile(path.join(PAY_DIST, 'index.html'));
    }
    
    // Default Admin Panel
    res.sendFile(path.join(ADMIN_DIST, 'index.html'));
});

// --- AUTHENTICATED API ROUTES ---
// Apply AUTH to all /api routes except public ones
app.use('/api', adminAuth);





async function autoSeed() {
    try {
        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
        const initialAdminPhone = process.env.INITIAL_ADMIN_PHONE || '+254700000000';
        const staffId = 'staff-admin-init';
        const initialHash = bcrypt.hashSync(process.env.ADMIN_KEY, 10);

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
    const { oldPassword, newPassword } = req.body;
    const adminId = req.admin.id;
    const email = req.admin.email;

    try {
        // Find in admins table
        const result = await db.query('SELECT * FROM admins WHERE id = $1', [adminId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
        
        const admin = result.rows[0];
        const valid = bcrypt.compareSync(oldPassword, admin.password_hash);
        if (!valid) return res.status(401).json({ error: 'Incorrect current password' });

        const newHash = bcrypt.hashSync(newPassword, 10);
        await db.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, adminId]);
        
        // Also update staff_auth if exists for same user
        await db.query('UPDATE staff_auth SET password_hash = $1 WHERE staff_id = $2', [newHash, adminId]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (e) {
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
            { id: admin.id, email: admin.email, displayName: admin.display_name, role: admin.role },
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

// Admin upload placeholder (deprecated, use /api/documents/upload)
app.post('/api/admin/upload', (req, res) => {
    res.json({ success: true, url: 'https://cdn.example.com/uploads/fallback.png' });
});

// Generic update for collections
app.put('/api/admin/:col/:id', (req, res) => {
    res.json({ success: true });
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

app.get('/api/driver/account-status/:id', (req, res) => {
    const status = driverAuth.getDriverAccountStatus(req.params.id);
    res.json(status);
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

app.get('/api/driver/account-export/:id', (req, res) => {
    const exportData = driverAuth.exportDriverAccount(req.params.id);
    if (!exportData) return res.status(404).json({ error: 'Account not found' });
    res.json(exportData);
});

app.delete('/api/driver/account/:id', (req, res) => {
    const success = driverAuth.deleteDriverAccount(req.params.id);
    res.json({ success });
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


