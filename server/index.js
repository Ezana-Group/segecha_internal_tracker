import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Allow all origins and methods for production stability
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

// Express json parser
app.use(express.json());

// JSON File paths
const DATA_DIR = __dirname;
const JOURNEYS_FILE = path.join(DATA_DIR, 'tracker-data.json');
const DRIVERS_AUTH_FILE = path.join(DATA_DIR, 'drivers-auth.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'cached-settings.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

// Helper to read/write data
const getData = (file, defaultVal = { journeys: [], history: [] }) => {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return defaultVal; }
};
const saveData = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2));

// --- ADMIN ROUTES ---

// Login
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@segecha.com' && password === 'segecha2025') {
        res.json({ token: 'mock-token', user: { email, displayName: 'Administrator', role: 'admin' } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Pending verification (Used by Admin Panel)
app.get(['/api/admin/journeys/pending', '/api/admin/journeys/pending-verification'], (req, res) => {
    try {
        const data = getData(JOURNEYS_FILE);
        const pending = data.journeys.filter(j => j.status === 'pending-verification');
        res.json({ success: true, journeys: pending });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
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

// Upload (Placeholder for odometer photos)
app.post('/api/admin/upload', (req, res) => {
    res.json({ success: true, url: 'https://cdn.segecha.com/uploads/fallback.png' });
});

// Generic update for collections
app.put('/api/admin/:col/:id', (req, res) => {
    res.json({ success: true });
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
