const express = require('express');
const cors = require('cors');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Ensure data directory exists
if (!existsSync(__dirname)) mkdirSync(__dirname);

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
        const pending = journeys.filter(j => j.status === 'pending-verification');
        res.json({ success: true, journeys: pending });
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

// Upload
app.post('/api/admin/upload', (req, res) => {
    res.json({ success: true, url: 'https://cdn.segecha.com/uploads/fallback.png' });
});

// Generic update for collections
app.put('/api/admin/:col/:id', (req, res) => {
    res.json({ success: true });
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
        const seedData = { journeys: [], history: [], stats: {} };
        saveData(JOURNEYS_FILE, seedData);
        
        // Also clear driver auth if needed? (Maybe just journeys for now as requested)
        // saveData(DRIVERS_AUTH_FILE, { drivers: [] });

        res.json({ success: true, message: 'Server data factory-reset successful' });
    } catch (e) {
        res.status(500).json({ error: 'Reset failed: ' + e.message });
    }
});

// --- DRIVER ROUTES ---
app.post('/api/driver/login', (req, res) => {
    res.json({ success: true, token: 'driver-token', driver: { name: 'Demo Driver' } });
});

// Catch-all 404 with CORS
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
