const express = require('express');
const cors = require('cors');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Health Check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

// CORS configuration - Allow all origins and methods for production stability
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

app.use(express.json());

// JSON File paths
const JOURNEYS_FILE = path.join(__dirname, 'tracker-data.json');
const DRIVERS_AUTH_FILE = path.join(__dirname, 'drivers-auth.json');
const SETTINGS_FILE = path.join(__dirname, 'cached-settings.json');
const DOCUMENTS_FILE = path.join(__dirname, 'documents.json');

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

const db = require('./db');
const bcrypt = require('bcryptjs');

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

        res.json({ 
            token: 'mock-token-' + admin.id, 
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
app.get(['/api/admin/journeys/pending', '/api/admin/journeys/pending-verification'], (req, res) => {
    try {
        const data = getData(JOURNEYS_FILE);
        const journeys = Array.isArray(data.journeys) ? data.journeys : [];
        const pending = journeys.filter(j => j.status === 'Awaiting Start Verification' || j.status === 'Awaiting Verification');
        
        // Also include other sections the admin needs for sync
        const fuel = (data.fuel || []).filter(f => f._pendingApproval);
        const expenses = (data.expenses || []).filter(e => e._pendingApproval);
        const docsData = getData(DOCUMENTS_FILE, { documents: [] });
        const docs = Array.isArray(docsData.documents) ? docsData.documents : [];
        const customers = data.customers || [];
        const incidents = (data.incidents || []).filter(i => i.status === 'Open');

        res.json({ 
            success: true, 
            journeys: pending,
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

// Import history
app.get(['/api/admin/history', '/api/admin/import-history'], (req, res) => {
    try {
        const data = getData(JOURNEYS_FILE);
        res.json({ success: true, history: data.history || [] });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Stats
app.get('/api/admin/stats', (req, res) => {
    try {
        const data = getData(JOURNEYS_FILE);
        res.json({ success: true, stats: data.stats || {} });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- DOCUMENTS MANAGEMENT ---

app.get('/api/documents', (req, res) => {
    try {
        const { entityType, entityId, adminKey } = req.query;
        const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
        if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

        const data = getData(DOCUMENTS_FILE, { documents: [] });
        let docs = Array.isArray(data.documents) ? data.documents : [];

        // Apply filters if provided
        if (entityType) docs = docs.filter(d => d.entityType === entityType);
        if (entityId) docs = docs.filter(d => d.entityId === entityId || d.driverId === entityId);

        res.json({ success: true, documents: docs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/documents/expiring', (req, res) => {
    try {
        const { adminKey, days = 30 } = req.query;
        const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
        if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

        const data = getData(DOCUMENTS_FILE, { documents: [] });
        const docs = Array.isArray(data.documents) ? data.documents : [];
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + parseInt(days));

        const expiring = docs.filter(d => {
            if (!d.expiryDate) return false;
            return new Date(d.expiryDate) <= threshold;
        });

        res.json({ success: true, documents: expiring });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/documents/upload', upload.any(), (req, res) => {
    try {
        const body = req.body || {};
        const { adminKey } = body;
        const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
        if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

        const doc = {
            id: Date.now().toString(),
            url: body.url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
            ...body,
            uploadedAt: new Date().toISOString()
        };
        delete doc.adminKey;

        const data = getData(DOCUMENTS_FILE, { documents: [] });
        const docs = Array.isArray(data.documents) ? data.documents : [];
        docs.push(doc);
        saveData(DOCUMENTS_FILE, { documents: docs });

        res.json({ success: true, document: doc });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/documents/:id', (req, res) => {
    try {
        const { adminKey } = req.body;
        const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
        if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

        const data = getData(DOCUMENTS_FILE, { documents: [] });
        const docs = Array.isArray(data.documents) ? data.documents : [];
        const filtered = docs.filter(d => d.id !== req.params.id);
        
        saveData(DOCUMENTS_FILE, { documents: filtered });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin upload placeholder (deprecated, use /api/documents/upload)
app.post('/api/admin/upload', (req, res) => {
    res.json({ success: true, url: 'https://cdn.segecha.com/uploads/fallback.png' });
});

// Generic update for collections
app.put('/api/admin/:col/:id', (req, res) => {
    res.json({ success: true });
});

// Admin verification for journeys (start or completion)
app.post('/api/admin/journey/:id/verify', (req, res) => {
    const { adminKey, approved, rejectionReason, rejectedFields } = req.body;
    const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const data = getData(JOURNEYS_FILE);
        const j = data.journeys.find(x => x.id === req.params.id);
        if (!j) return res.status(404).json({ error: 'Journey not found' });

        const isStart = j.status === 'Awaiting Start Verification';
        const now = new Date();
        const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (approved) {
            j.status = isStart ? 'Approved' : 'Verified';
            j._isRejected = false;
            j.notes = (j.notes || '') + (j.notes ? '\n' : '') + `[APPROVED @ ${ts}]`;
        } else {
            j.status = isStart ? 'Loading' : 'In Transit';
            j._rejectionReason = rejectionReason;
            j._rejectedFields = rejectedFields || [];
            j._isRejected = true;
            j.notes = (j.notes || '') + (j.notes ? '\n' : '') + `[REJECTED @ ${ts}]: ${rejectionReason}`;
        }
        
        saveData(JOURNEYS_FILE, data);
        res.json({ success: true, action: isStart ? 'start' : 'completion', journey: j });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin verification for fuel/expenses
app.post('/api/admin/submission/verify', (req, res) => {
    const { adminKey, id, type, approved, reason, rejectedFields } = req.body;
    const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const data = getData(JOURNEYS_FILE);
        let item;
        let col;

        if (type === 'fuel') {
            col = 'fuel';
            item = data.fuel.find(x => x.id === id);
        } else if (type === 'expense') {
            col = 'expenses';
            item = data.expenses.find(x => x.id === id);
        } else if (type === 'incident') {
            col = 'incidents';
            item = data.incidents.find(x => x.id === id);
        }

        if (!item) return res.status(404).json({ error: 'Submission not found' });

        if (approved) {
            item._pendingApproval = false;
            item._isRejected = false;
            if (type === 'incident') item.status = 'Resolved';
        } else {
            item._isRejected = true;
            item._rejectionReason = reason;
            item._rejectedFields = rejectedFields || [];
            if (type === 'incident') item.status = 'Rejected';
        }

        saveData(JOURNEYS_FILE, data);
        res.json({ success: true, item });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Deep Reset - Wipes all server data
app.post('/api/admin/reset', (req, res) => {
    const key = req.headers['x-admin-key'];
    // In prod, this key is managed via environment variables on Railway.
    // We expect it to match the VITE_ADMIN_KEY sent by the frontend.
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    
    if (key !== expectedKey) {
        return res.status(403).json({ error: 'Unauthorized reset request' });
    }

    try {
        // Truncate the file or reset to seed structure
        const seedData = { 
            trucks: [], 
            trailers: [],
            drivers: [],
            journeys: [], 
            fuel: [],
            expenses: [],
            customers: [],
            payroll: [],
            staff: [],
            history: [], 
            stats: {} 
        };
        saveData(JOURNEYS_FILE, seedData);
        
        // Also clear driver auth if needed? (Maybe just journeys for now as requested)
        // saveData(DRIVERS_AUTH_FILE, { drivers: [] });

        res.json({ success: true, message: 'Server data factory-reset successful' });
    } catch (e) {
        res.status(500).json({ error: 'Reset failed: ' + e.message });
    }
});

// --- TRACKER SYNC & BACKUP ---

// Sync Snapshot (Local -> Server)
app.post('/api/tracker/sync', (req, res) => {
    const { data, settings, adminKey } = req.body;
    const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    
    if (adminKey !== expectedKey) {
        return res.status(403).json({ error: 'Unauthorized sync request' });
    }

    try {
        if (data) saveData(JOURNEYS_FILE, data);
        if (settings) saveData(SETTINGS_FILE, settings);
        
        // After sync, check if we need to update the scheduler (frequency might have changed)
        const frequency = settings?.backupFrequency || 'Disabled';
        updateBackupScheduler(frequency);

        res.json({ success: true, message: 'Server snapshot updated' });
    } catch (e) {
        res.status(500).json({ error: 'Sync failed: ' + e.message });
    }
});

// Auto-sync from admin (lightweight — accepts x-admin-key header for browser fetch)
app.post('/api/tracker/data', (req, res) => {
    const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
    const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });
    try {
        if (req.body && Object.keys(req.body).length) {
            saveData(JOURNEYS_FILE, req.body);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
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

// Create Manual Backup
app.post('/api/tracker/backup-now', (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${timestamp}.json`;
        const currentData = getData(JOURNEYS_FILE, null);
        const currentSettings = getData(SETTINGS_FILE, null);
        
        if (!currentData) throw new Error("No data to backup");
        
        saveData(path.join(BACKUPS_DIR, filename), { data: currentData, settings: currentSettings });
        res.json({ success: true, message: 'Backup created: ' + filename });
    } catch (e) {
        res.status(500).json({ error: 'Backup failed: ' + e.message });
    }
});

// Restore from Backup
app.post('/api/tracker/restore', (req, res) => {
    const { filename, adminKey } = req.body;
    const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    
    if (adminKey !== expectedKey) {
        return res.status(403).json({ error: 'Unauthorized restore request' });
    }

    try {
        const backupPath = path.join(BACKUPS_DIR, filename);
        if (!existsSync(backupPath)) return res.status(404).json({ error: 'Backup file not found' });
        
        const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
        if (backup.data) saveData(JOURNEYS_FILE, backup.data);
        if (backup.settings) saveData(SETTINGS_FILE, backup.settings);
        
        res.json({ success: true, message: 'System restored from ' + filename });
    } catch (e) {
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

function performAutoBackup() {
    console.log(`[${new Date().toISOString()}] Running automated backup...`);
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `auto_backup_${timestamp}.json`;
        const currentData = getData(JOURNEYS_FILE, null);
        const currentSettings = getData(SETTINGS_FILE, null);
        if (currentData) {
            saveData(path.join(BACKUPS_DIR, filename), { data: currentData, settings: currentSettings });
            console.log(`Automated backup saved: ${filename}`);
        }
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
try {
    const initialSettings = getData(SETTINGS_FILE, null);
    if (initialSettings?.backupFrequency) {
        updateBackupScheduler(initialSettings.backupFrequency);
    }
} catch (e) {
    console.warn('Could not start initial backup scheduler:', e.message);
}

const driverAuth = require('./driver-auth');
const staffAuth = require('./staff-auth');
const driverData = require('./driver-data');

// --- DRIVER ACCOUNT MANAGEMENT (ADMIN) ---

app.post('/api/driver/create-account', async (req, res) => {
    const { driverId, email, phone, adminKey } = req.body;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const result = await driverAuth.createDriverAccount(driverId, email, phone);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/driver/account-status/:id', (req, res) => {
    const { adminKey } = req.query;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    const status = driverAuth.getDriverAccountStatus(req.params.id);
    res.json(status);
});

app.post('/api/driver/account/regenerate-credentials', async (req, res) => {
    const { driverId, email, phone, forcePasswordReset, adminKey } = req.body;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const result = await driverAuth.regenerateDriverCredentials(driverId, { email, phone, forcePasswordReset });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/driver/account-export/:id', (req, res) => {
    const { adminKey } = req.query;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    const exportData = driverAuth.exportDriverAccount(req.params.id);
    if (!exportData) return res.status(404).json({ error: 'Account not found' });
    res.json(exportData);
});

app.delete('/api/driver/account/:id', (req, res) => {
    const { adminKey } = req.query;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    const success = driverAuth.deleteDriverAccount(req.params.id);
    res.json({ success });
});

// --- STAFF ACCOUNT MANAGEMENT (ADMIN) ---

app.post('/api/staff/create-account', async (req, res) => {
    const { staffId, email, phone, adminKey } = req.body;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const result = await staffAuth.createStaffAccount(staffId, email, phone);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/staff/account-status/:id', (req, res) => {
    const { adminKey } = req.query;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    const status = staffAuth.getStaffAccountStatus(req.params.id);
    res.json(status);
});

app.post('/api/staff/account/regenerate-credentials', async (req, res) => {
    const { staffId, email, phone, forcePasswordReset, adminKey } = req.body;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const result = await staffAuth.regenerateStaffCredentials(staffId, { email, phone, forcePasswordReset });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/staff/account-export/:id', (req, res) => {
    const { adminKey } = req.query;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    const exportData = staffAuth.exportStaffAccount(req.params.id);
    if (!exportData) return res.status(404).json({ error: 'Account not found' });
    res.json(exportData);
});

app.delete('/api/staff/account/:id', (req, res) => {
    const { adminKey } = req.query;
    const expectedKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
    if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

    const success = staffAuth.deleteStaffAccount(req.params.id);
    res.json({ success });
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

app.get('/api/documents/mine', driverAuth.authMiddleware, (req, res) => {
    try {
        const data = getData(DOCUMENTS_FILE, { documents: [] });
        const docs = Array.isArray(data.documents) ? data.documents : [];
        const mine = docs.filter(d => (d.driverId || d.entityId) === req.driver.driverId);
        res.json({ success: true, documents: mine });
    } catch (e) {
        console.error('DOCUMENTS_MINE_ERROR:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/documents/driver-upload', driverAuth.authMiddleware, upload.any(), (req, res) => {
    try {
        const body = req.body || {};
        const doc = { 
            id: Date.now().toString(), 
            driverId: req.driver.driverId,
            entityType: 'driver',
            entityId: req.driver.driverId,
            url: body.url || 'https://res.cloudinary.com/demo/image/upload/sample.jpg', 
            ...body, 
            uploadedAt: new Date().toISOString() 
        };
        const data = getData(DOCUMENTS_FILE, { documents: [] });
        const docs = Array.isArray(data.documents) ? data.documents : [];
        docs.push(doc);
        saveData(DOCUMENTS_FILE, { documents: docs });
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

// Serve static assets from the frontend build
app.use(express.static(path.join(__dirname, '../dist')));

// Handle React routing, return all requests to React app
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '../dist/index.html'));
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
