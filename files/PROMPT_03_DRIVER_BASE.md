-e ---
# SEGECHA — CURSOR SESSION 3 OF 8
# Previous: PROMPT_02_PAYMENT.md
# Next: PROMPT_04_DRIVER_UPLOADS.md
# Scope: driver-portal/ + server/ additions
# Rule: Complete every section and run the checklist before closing this session.
---

# Segecha Driver Portal — Full Cursor AI Prompt
# driver.segecha.com

You are building a driver-facing web portal for Segecha Group Ltd. Drivers access this at `driver.segecha.com` on their phones. It is a **separate React app** from the main tracker and payment portal. It connects to the same backend API server (`server/`) already built in the payment system prompt.

**What drivers can do:**
- Log in with their phone number + a 4-digit PIN
- See their active and upcoming journeys
- See their full journey history
- Update journey status (mark In Transit, Completed)
- Submit fuel fill-up claims for office approval
- Submit expense claims for office approval
- Report a breakdown or incident
- Message / notify the office
- View their payslips and salary history
- View their assigned truck details and tyre health
- Download their payslip as a printable page

**Data isolation:** Each driver sees only their own data — no other driver's records are ever exposed.

**Submissions flow:** When a driver submits a fuel claim, expense, or incident report, it appears in the main tracker as a pending record AND sends a WhatsApp notification to the office.

**Login method:** Phone number (07XXXXXXXX) + 4-digit PIN.

**Architecture:** The driver portal reads data from and writes data to the same `server/` Express API. Driver accounts are stored in `server/drivers-auth.json` (simple file-based auth — no database needed yet). The main tracker in `App.jsx` is where admins manage driver credentials.

---

## PART A — Extend the backend server

These changes add driver auth and driver-facing API endpoints to the existing `server/index.js`.

### A.1 — Install one new dependency

```bash
cd server
npm install bcryptjs jsonwebtoken
```

---

### A.2 — Create `server/drivers-auth.json`

This file stores driver login credentials. Admins set PINs from the main tracker (added in Part C).

```json
{
  "drivers": []
}
```

Each entry will look like:
```json
{
  "driverId": "D001",
  "phone": "0712345678",
  "pinHash": "<bcrypt hash of 4-digit PIN>",
  "createdAt": "2025-03-01"
}
```

---

### A.3 — Create `server/driver-auth.js`

```js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DB_PATH = path.join(__dirname, 'drivers-auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'segecha-driver-secret-change-in-production';

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return { drivers: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

async function setDriverPIN(driverId, phone, pin) {
    const db = readDB();
    const pinHash = await bcrypt.hash(String(pin), 10);
    const existing = db.drivers.findIndex(d => d.driverId === driverId);
    const record = {
        driverId,
        phone: phone.replace(/\s/g, ''),
        pinHash,
        createdAt: new Date().toISOString().split('T')[0],
    };
    if (existing >= 0) db.drivers[existing] = record;
    else db.drivers.push(record);
    writeDB(db);
    return { success: true };
}

async function loginDriver(phone, pin) {
    const db = readDB();
    const cleanPhone = phone.replace(/\s/g, '').replace(/^254/, '0').replace(/^\+254/, '0');
    const record = db.drivers.find(d =>
        d.phone.replace(/\s/g, '').replace(/^254/, '0').replace(/^\+254/, '0') === cleanPhone
    );
    if (!record) return { success: false, error: 'Phone number not registered' };

    const match = await bcrypt.compare(String(pin), record.pinHash);
    if (!match) return { success: false, error: 'Incorrect PIN' };

    const token = jwt.sign(
        { driverId: record.driverId, phone: record.phone },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
    return { success: true, token, driverId: record.driverId };
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const payload = verifyToken(auth.slice(7));
    if (!payload) return res.status(401).json({ error: 'Invalid or expired session — please log in again' });
    req.driver = payload;
    next();
}

module.exports = { setDriverPIN, loginDriver, authMiddleware };
```

---

### A.4 — Create `server/driver-data.js`

This file reads the tracker's data to serve driver-specific records. It reads from `localStorage` export — in production this would be a database, but for now it reads from a shared data file that the tracker exports.

```js
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'tracker-data.json');

function readTrackerData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch {
        // Return empty structure if no data file yet
        return { trucks: [], drivers: [], journeys: [], fuel: [], expenses: [], invoices: [], payroll: [] };
    }
}

function writeTrackerData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getDriverData(driverId) {
    const data = readTrackerData();

    const driver = data.drivers.find(d => d.id === driverId);
    if (!driver) return null;

    const truck = driver.truck ? data.trucks.find(t => t.id === driver.truck) : null;

    const journeys = data.journeys
        .filter(j => j.driver === driverId)
        .sort((a, b) => b.date.localeCompare(a.date));

    const activeJourneys = journeys.filter(j => ['Loading', 'In Transit'].includes(j.status));
    const completedJourneys = journeys.filter(j => j.status === 'Completed');

    const fuelEntries = data.fuel
        .filter(f => f.truck === driver.truck)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20);

    const payslips = data.payroll
        .filter(p => p.driver === driverId)
        .sort((a, b) => b.month.localeCompare(a.month));

    // Tyre status calculation
    let tyreInfo = null;
    if (truck) {
        const kmSince = truck.odom - truck.tyreOdom;
        const remaining = truck.tyreLimit - kmSince;
        const pct = Math.min(100, (kmSince / truck.tyreLimit) * 100);
        tyreInfo = {
            kmSinceChange: kmSince,
            remaining,
            pct: pct.toFixed(1),
            status: remaining <= 0 ? 'Overdue' : remaining <= 5000 ? 'Due Soon' : 'OK',
        };
    }

    return { driver, truck, tyreInfo, activeJourneys, completedJourneys, fuelEntries, payslips };
}

function updateJourneyStatus(driverId, journeyId, newStatus) {
    const data = readTrackerData();
    const journey = data.journeys.find(j => j.id === journeyId && j.driver === driverId);
    if (!journey) return { success: false, error: 'Journey not found or not assigned to you' };

    const validTransitions = {
        'Loading': ['In Transit'],
        'In Transit': ['Completed'],
    };
    if (!validTransitions[journey.status]?.includes(newStatus)) {
        return { success: false, error: `Cannot change status from ${journey.status} to ${newStatus}` };
    }

    journey.status = newStatus;
    if (newStatus === 'Completed') journey.endDate = new Date().toISOString().split('T')[0];
    writeTrackerData(data);
    return { success: true, journey };
}

function addPendingSubmission(driverId, type, payload) {
    const data = readTrackerData();
    const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();

    if (type === 'fuel') {
        const entry = {
            id: uid(),
            truck: payload.truck,
            date: payload.date || new Date().toISOString().split('T')[0],
            litres: +payload.litres,
            pricePerL: +payload.pricePerL,
            station: payload.station,
            odom: +payload.odom || 0,
            journey: payload.journey || '',
            _pendingApproval: true,
            _submittedBy: driverId,
            _submittedAt: new Date().toISOString(),
        };
        data.fuel.push(entry);
    }

    if (type === 'expense') {
        const entry = {
            id: uid(),
            truck: payload.truck,
            date: payload.date || new Date().toISOString().split('T')[0],
            cat: payload.cat,
            amount: +payload.amount,
            desc: payload.desc,
            journey: payload.journey || '',
            _pendingApproval: true,
            _submittedBy: driverId,
            _submittedAt: new Date().toISOString(),
        };
        data.expenses.push(entry);
    }

    if (type === 'incident') {
        if (!data.incidents) data.incidents = [];
        data.incidents.push({
            id: uid(),
            driverId,
            truck: payload.truck,
            journey: payload.journey || '',
            type: payload.incidentType,
            description: payload.description,
            location: payload.location || '',
            date: new Date().toISOString().split('T')[0],
            status: 'Open',
            _submittedAt: new Date().toISOString(),
        });
    }

    writeTrackerData(data);
    return { success: true };
}

module.exports = { readTrackerData, writeTrackerData, getDriverData, updateJourneyStatus, addPendingSubmission };
```

---

### A.5 — Add new routes to `server/index.js`

Find the line `const PORT = process.env.PORT || 3001;` at the bottom of `server/index.js`. Before it, add all of these routes:

```js
// ── Driver auth routes ────────────────────────────────────────────────────
const { setDriverPIN, loginDriver, authMiddleware } = require('./driver-auth');
const { getDriverData, updateJourneyStatus, addPendingSubmission, readTrackerData, writeTrackerData } = require('./driver-data');

// Driver login
app.post('/api/driver/login', async (req, res) => {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ error: 'Phone and PIN are required' });
    try {
        const result = await loginDriver(phone, pin);
        if (result.success) res.json(result);
        else res.status(401).json({ error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set/update a driver PIN (called from main tracker admin UI)
app.post('/api/driver/set-pin', async (req, res) => {
    const { driverId, phone, pin, adminKey } = req.body;
    // Simple admin key check — set ADMIN_KEY in server .env
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!driverId || !phone || !pin || String(pin).length !== 4) {
        return res.status(400).json({ error: 'driverId, phone, and a 4-digit PIN are required' });
    }
    try {
        await setDriverPIN(driverId, phone, pin);
        res.json({ success: true, message: `PIN set for driver ${driverId}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get driver's own data (authenticated)
app.get('/api/driver/me', authMiddleware, (req, res) => {
    const result = getDriverData(req.driver.driverId);
    if (!result) return res.status(404).json({ error: 'Driver record not found in tracker data' });
    res.json(result);
});

// Update journey status (driver marks trip In Transit or Completed)
app.post('/api/driver/journey/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body;
    const result = updateJourneyStatus(req.driver.driverId, req.params.id, status);
    if (!result.success) return res.status(400).json({ error: result.error });

    // Notify office via WhatsApp link (logged to console — driver sends from their phone)
    console.log(`📍 Journey ${req.params.id} updated to ${status} by driver ${req.driver.driverId}`);
    res.json(result);
});

// Submit fuel claim
app.post('/api/driver/submit/fuel', authMiddleware, (req, res) => {
    const result = addPendingSubmission(req.driver.driverId, 'fuel', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Fuel claim submitted — pending office approval' });
});

// Submit expense claim
app.post('/api/driver/submit/expense', authMiddleware, (req, res) => {
    const result = addPendingSubmission(req.driver.driverId, 'expense', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Expense claim submitted — pending office approval' });
});

// Submit incident / breakdown report
app.post('/api/driver/submit/incident', authMiddleware, (req, res) => {
    const result = addPendingSubmission(req.driver.driverId, 'incident', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Incident reported — office has been notified' });
});

// Sync tracker data from App.jsx (called when admin exports data)
app.post('/api/tracker/sync', (req, res) => {
    const { data, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!data?.trucks) return res.status(400).json({ error: 'Invalid data format' });
    try {
        writeTrackerData(data);
        res.json({ success: true, message: 'Tracker data synced successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get pending submissions for admin review in tracker
app.get('/api/tracker/pending', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const data = readTrackerData();
    res.json({
        pendingFuel: (data.fuel || []).filter(f => f._pendingApproval),
        pendingExpenses: (data.expenses || []).filter(e => e._pendingApproval),
        incidents: data.incidents || [],
    });
});
```

Also add to `server/.env`:
```env
JWT_SECRET=segecha-jwt-secret-change-this-to-something-random-in-production
ADMIN_KEY=segecha-admin-key-change-this
OFFICE_WHATSAPP=254700000000
```

---

## PART B — Driver Portal App

Create a new standalone React app for drivers.

### B.1 — Create the driver portal

Run from the project root:

```bash
cd ..
npm create vite@latest driver-portal -- --template react
cd driver-portal
npm install
```

---

### B.2 — Create `driver-portal/.env`

```env
VITE_API_URL=http://localhost:3001
```

---

### B.3 — Replace entire `driver-portal/src/App.jsx` with:

```jsx
import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const today = () => new Date().toISOString().split('T')[0];

const COLORS = {
    primary: '#1B3A6B',
    accent: '#E8501A',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    bg: '#f1f5f9',
    surface: '#ffffff',
    text: '#0f172a',
    textDim: '#475569',
    textFaint: '#94a3b8',
    border: '#e2e8f0',
};

const SC = {
    'Loading': '#f59e0b',
    'In Transit': '#3b82f6',
    'Completed': '#10b981',
    'Cancelled': '#ef4444',
    'Paid': '#10b981',
    'Pending': '#f59e0b',
    'OK': '#10b981',
    'Due Soon': '#f97316',
    'Overdue': '#ef4444',
};

const TABS = [
    { id: 'home', icon: '◈', label: 'Home' },
    { id: 'journeys', icon: '◐', label: 'Journeys' },
    { id: 'submit', icon: '＋', label: 'Submit' },
    { id: 'payslips', icon: '◑', label: 'Pay' },
    { id: 'truck', icon: '◉', label: 'Truck' },
];

export default function DriverPortal() {
    const [token, setToken] = useState(() => localStorage.getItem('driver_token') || '');
    const [driverData, setDriverData] = useState(null);
    const [tab, setTab] = useState('home');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Auth state
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    const fetchDriverData = useCallback(async (tok) => {
        if (!tok) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/driver/me`, {
                headers: { Authorization: `Bearer ${tok}` }
            });
            if (res.status === 401) { setToken(''); localStorage.removeItem('driver_token'); return; }
            const data = await res.json();
            setDriverData(data);
        } catch {
            setError('Could not load your data. Check your connection.');
        }
        setLoading(false);
    }, []);

    useEffect(() => { if (token) fetchDriverData(token); }, [token, fetchDriverData]);

    const login = async () => {
        if (!phone || pin.length !== 4) { setLoginError('Enter your phone number and 4-digit PIN'); return; }
        setLoginLoading(true);
        setLoginError('');
        try {
            const res = await fetch(`${API}/api/driver/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, pin }),
            });
            const data = await res.json();
            if (data.token) {
                localStorage.setItem('driver_token', data.token);
                setToken(data.token);
            } else {
                setLoginError(data.error || 'Login failed — contact your office');
            }
        } catch {
            setLoginError('Could not connect to server. Try again.');
        }
        setLoginLoading(false);
    };

    const logout = () => {
        localStorage.removeItem('driver_token');
        setToken('');
        setDriverData(null);
        setTab('home');
    };

    const apiPost = async (url, body) => {
        const res = await fetch(`${API}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        return res.json();
    };

    const S = {
        page: { minHeight: '100vh', background: COLORS.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", paddingBottom: 80, maxWidth: 480, margin: '0 auto' },
        topbar: { background: COLORS.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 },
        topbarTitle: { color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 },
        topbarSub: { color: '#8ab0d8', fontSize: 12 },
        tabBar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: `1px solid ${COLORS.border}`, display: 'flex', zIndex: 100 },
        tabBtn: (active) => ({ flex: 1, padding: '10px 4px 8px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: active ? COLORS.accent : COLORS.textFaint, fontWeight: active ? 700 : 400 }),
        tabIcon: { fontSize: 20 },
        tabLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
        content: { padding: '20px 16px' },
        card: (accent) => ({ background: COLORS.surface, borderRadius: 14, padding: 18, marginBottom: 14, border: `1px solid ${accent ? accent + '33' : COLORS.border}`, borderTop: accent ? `3px solid ${accent}` : undefined, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }),
        sectionTitle: { fontSize: 11, fontWeight: 700, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
        badge: (status) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: (SC[status] || '#64748b') + '22', color: SC[status] || '#64748b', border: `1px solid ${(SC[status] || '#64748b')}44` }),
        kpi: { fontSize: 11, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
        kpiVal: (c) => ({ fontSize: 26, fontWeight: 800, color: c || COLORS.text, letterSpacing: -0.5 }),
        btn: (v) => ({ padding: v === 'sm' ? '8px 14px' : '13px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: v === 'sm' ? 12 : 14, background: v === 'del' ? '#ef444415' : v === 'ghost' ? '#f1f5f9' : v === 'green' ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#E8501A,#d4400f)', color: v === 'del' ? '#ef4444' : v === 'ghost' ? COLORS.textDim : '#fff', width: v === 'full' ? '100%' : undefined }),
        inp: { width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'inherit' },
        lbl: { fontSize: 11, color: COLORS.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, display: 'block' },
        divider: { height: 1, background: COLORS.border, margin: '14px 0' },
        infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 },
        alert: (c) => ({ background: c + '15', border: `1px solid ${c}44`, borderRadius: 10, padding: '12px 16px', marginBottom: 12 }),
    };

    // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
    if (!token || !driverData) {
        return (
            <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, #0d1b35 0%, ${COLORS.primary} 60%, #0d2347 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ fontSize: 44, marginBottom: 10 }}>🚛</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary, marginBottom: 4 }}>Segecha Group Ltd</div>
                        <div style={{ fontSize: 13, color: COLORS.textFaint }}>Driver Portal · driver.segecha.com</div>
                    </div>

                    {loginError && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
                            {loginError}
                        </div>
                    )}

                    <label style={S.lbl}>Your Phone Number</label>
                    <input style={S.inp} type="tel" placeholder="07XX XXX XXX" value={phone}
                        onChange={e => setPhone(e.target.value)} maxLength={13} />

                    <label style={S.lbl}>4-Digit PIN</label>
                    <input style={{ ...S.inp, letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                        type="password" inputMode="numeric" placeholder="••••"
                        value={pin} maxLength={4}
                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        onKeyDown={e => e.key === 'Enter' && login()} />

                    <button style={{ ...S.btn('full'), padding: '14px', fontSize: 16, width: '100%', borderRadius: 12 }}
                        onClick={login} disabled={loginLoading}>
                        {loginLoading ? '⏳ Logging in…' : 'Log In'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: COLORS.textFaint, lineHeight: 1.7 }}>
                        Contact your office manager to<br />get your PIN or reset it.
                    </div>
                </div>
            </div>
        );
    }

    const { driver, truck, tyreInfo, activeJourneys, completedJourneys, fuelEntries, payslips } = driverData;

    // ── HOME TAB ──────────────────────────────────────────────────────────────
    const HomeTab = () => (
        <div style={S.content}>
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>
                    Hi, {driver.name.split(' ')[0]} 👋
                </div>
                <div style={{ fontSize: 13, color: COLORS.textFaint, marginTop: 3 }}>
                    {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>

            {/* Active journey alert */}
            {activeJourneys.length > 0 && activeJourneys.map(j => (
                <div key={j.id} style={S.alert(j.status === 'In Transit' ? COLORS.blue : COLORS.yellow)}>
                    <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                        {j.status === 'In Transit' ? '🚛 You are on the road' : '📦 Journey ready to start'}
                    </div>
                    <div style={{ fontSize: 14, color: COLORS.textDim }}>
                        {j.origin} → {j.dest}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 4 }}>
                        {j.cargo} · {j.distance} km · Departed {j.date}
                    </div>
                    <button style={{ ...S.btn('sm'), marginTop: 10 }} onClick={() => setTab('journeys')}>
                        View & Update →
                    </button>
                </div>
            ))}

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={S.card(COLORS.blue)}>
                    <div style={S.kpi}>Active Trips</div>
                    <div style={S.kpiVal(COLORS.blue)}>{activeJourneys.length}</div>
                </div>
                <div style={S.card(COLORS.green)}>
                    <div style={S.kpi}>Completed</div>
                    <div style={S.kpiVal(COLORS.green)}>{completedJourneys.length}</div>
                </div>
                <div style={S.card(COLORS.yellow)}>
                    <div style={S.kpi}>Last Pay</div>
                    <div style={S.kpiVal(COLORS.yellow)} >
                        {payslips[0] ? fmt(+payslips[0].baseSalary + +payslips[0].allowance - +payslips[0].deductions) : '—'}
                    </div>
                </div>
                <div style={S.card(tyreInfo?.status === 'OK' ? COLORS.green : COLORS.red)}>
                    <div style={S.kpi}>Tyre Status</div>
                    <div style={S.kpiVal(tyreInfo?.status === 'OK' ? COLORS.green : COLORS.red)}>
                        {tyreInfo?.status || '—'}
                    </div>
                </div>
            </div>

            {/* Quick actions */}
            <div style={S.sectionTitle}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                    { label: '⛽ Log Fuel', action: () => { setTab('submit'); } },
                    { label: '💰 Claim Expense', action: () => { setTab('submit'); } },
                    { label: '🚨 Report Issue', action: () => { setTab('submit'); } },
                    { label: '📋 My Payslips', action: () => setTab('payslips') },
                ].map(q => (
                    <button key={q.label} style={{ ...S.card(), display: 'block', textAlign: 'left', cursor: 'pointer', border: `1px solid ${COLORS.border}`, background: COLORS.surface, borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 13, color: COLORS.text }}
                        onClick={q.action}>
                        {q.label}
                    </button>
                ))}
            </div>
        </div>
    );

    // ── JOURNEYS TAB ──────────────────────────────────────────────────────────
    const JourneysTab = () => {
        const [updating, setUpdating] = useState({});
        const [updateMsg, setUpdateMsg] = useState({});

        const updateStatus = async (journeyId, newStatus) => {
            setUpdating(u => ({ ...u, [journeyId]: true }));
            const result = await apiPost(`/api/driver/journey/${journeyId}/status`, { status: newStatus });
            if (result.success) {
                setUpdateMsg(m => ({ ...m, [journeyId]: `✅ Status updated to ${newStatus}` }));
                await fetchDriverData(token);
            } else {
                setUpdateMsg(m => ({ ...m, [journeyId]: `❌ ${result.error}` }));
            }
            setUpdating(u => ({ ...u, [journeyId]: false }));
        };

        const JourneyCard = ({ j, allowUpdate }) => (
            <div style={S.card(SC[j.status])}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>
                        {j.origin} → {j.dest}
                    </div>
                    <span style={S.badge(j.status)}>{j.status}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textFaint, lineHeight: 1.8 }}>
                    <div>📦 {j.cargo || 'No cargo specified'} {j.weight ? `· ${j.weight}T` : ''}</div>
                    <div>🛣️ {j.distance} km · 💰 {fmt(j.revenue)}</div>
                    <div>📅 Departed: {j.date} {j.endDate ? `· Arrived: ${j.endDate}` : ''}</div>
                    {j.notes && <div>📝 {j.notes}</div>}
                </div>

                {allowUpdate && (
                    <div style={{ marginTop: 12 }}>
                        {j.status === 'Loading' && (
                            <button style={{ ...S.btn('sm'), background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', marginRight: 8 }}
                                disabled={updating[j.id]}
                                onClick={() => updateStatus(j.id, 'In Transit')}>
                                {updating[j.id] ? '⏳' : '🚛 Mark In Transit'}
                            </button>
                        )}
                        {j.status === 'In Transit' && (
                            <button style={{ ...S.btn('sm'), background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff' }}
                                disabled={updating[j.id]}
                                onClick={() => updateStatus(j.id, 'Completed')}>
                                {updating[j.id] ? '⏳' : '✅ Mark Completed'}
                            </button>
                        )}
                        {updateMsg[j.id] && (
                            <div style={{ marginTop: 8, fontSize: 12, color: updateMsg[j.id].startsWith('✅') ? COLORS.green : COLORS.red }}>
                                {updateMsg[j.id]}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );

        return (
            <div style={S.content}>
                {activeJourneys.length > 0 && (
                    <>
                        <div style={S.sectionTitle}>Active Journeys</div>
                        {activeJourneys.map(j => <JourneyCard key={j.id} j={j} allowUpdate />)}
                    </>
                )}
                {activeJourneys.length === 0 && (
                    <div style={{ ...S.card(), textAlign: 'center', padding: 32, color: COLORS.textFaint }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>No active journeys</div>
                        <div style={{ fontSize: 13 }}>You have no trips currently Loading or In Transit.</div>
                    </div>
                )}
                {completedJourneys.length > 0 && (
                    <>
                        <div style={{ ...S.sectionTitle, marginTop: 20 }}>Recent History</div>
                        {completedJourneys.slice(0, 10).map(j => <JourneyCard key={j.id} j={j} allowUpdate={false} />)}
                    </>
                )}
            </div>
        );
    };

    // ── SUBMIT TAB ────────────────────────────────────────────────────────────
    const SubmitTab = () => {
        const [subType, setSubType] = useState('fuel');
        const [form, setForm] = useState({});
        const [submitting, setSubmitting] = useState(false);
        const [submitMsg, setSubmitMsg] = useState('');

        const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

        const submit = async () => {
            setSubmitting(true);
            setSubmitMsg('');
            let url = '/api/driver/submit/fuel';
            if (subType === 'expense') url = '/api/driver/submit/expense';
            if (subType === 'incident') url = '/api/driver/submit/incident';

            const payload = { ...form, truck: driver.truck };
            const result = await apiPost(url, payload);
            if (result.success) {
                setSubmitMsg('✅ ' + result.message);
                setForm({});

                // Build WhatsApp notification to office
                const s = { companyName: 'Segecha Group Ltd' };
                const officePhone = import.meta.env.VITE_OFFICE_WHATSAPP || '';
                if (officePhone) {
                    const msg = subType === 'fuel'
                        ? `📋 Fuel claim from *${driver.name}*
Truck: ${truck?.reg}
Station: ${form.station}
Litres: ${form.litres}L @ KES ${form.pricePerL}/L
Cost: KES ${Math.round(+form.litres * +form.pricePerL).toLocaleString('en-KE')}
Date: ${form.date || today()}`
                        : subType === 'expense'
                        ? `💰 Expense claim from *${driver.name}*
Truck: ${truck?.reg}
Category: ${form.cat}
Amount: KES ${Number(form.amount).toLocaleString('en-KE')}
Desc: ${form.desc}`
                        : `🚨 INCIDENT REPORT from *${driver.name}*
Truck: ${truck?.reg}
Type: ${form.incidentType}
Location: ${form.location}
${form.description}`;

                    window.open(`https://wa.me/${officePhone}?text=${encodeURIComponent(msg)}`, '_blank');
                }
            } else {
                setSubmitMsg('❌ ' + (result.error || 'Submission failed'));
            }
            setSubmitting(false);
        };

        const EXPENSE_CATS = ['Maintenance', 'Toll', 'Permit', 'Allowance', 'Other'];
        const INCIDENT_TYPES = ['Breakdown', 'Accident', 'Cargo Damage', 'Theft', 'Road Closure', 'Other'];

        return (
            <div style={S.content}>
                <div style={{ ...S.sectionTitle, marginBottom: 16 }}>Submit a Claim or Report</div>

                {/* Type selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {[['fuel', '⛽ Fuel'], ['expense', '💰 Expense'], ['incident', '🚨 Incident']].map(([id, label]) => (
                        <button key={id} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: `2px solid ${subType === id ? COLORS.accent : COLORS.border}`, background: subType === id ? COLORS.accent + '15' : COLORS.surface, color: subType === id ? COLORS.accent : COLORS.textDim, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            onClick={() => { setSubType(id); setForm({}); setSubmitMsg(''); }}>
                            {label}
                        </button>
                    ))}
                </div>

                {submitMsg && (
                    <div style={{ background: submitMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${submitMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '10px 14px', color: submitMsg.startsWith('✅') ? '#065f46' : '#dc2626', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                        {submitMsg}
                    </div>
                )}

                <div style={S.card()}>
                    {/* FUEL FORM */}
                    {subType === 'fuel' && (
                        <>
                            <label style={S.lbl}>Date</label>
                            <input style={S.inp} type="date" value={form.date || today()} onChange={e => set('date', e.target.value)} />
                            <label style={S.lbl}>Station Name</label>
                            <input style={S.inp} placeholder="e.g. Total Mlolongo" value={form.station || ''} onChange={e => set('station', e.target.value)} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={S.lbl}>Litres Filled</label>
                                    <input style={S.inp} type="number" placeholder="e.g. 120" value={form.litres || ''} onChange={e => set('litres', e.target.value)} />
                                </div>
                                <div>
                                    <label style={S.lbl}>Price per Litre</label>
                                    <input style={S.inp} type="number" placeholder="e.g. 176" value={form.pricePerL || ''} onChange={e => set('pricePerL', e.target.value)} />
                                </div>
                            </div>
                            {form.litres && form.pricePerL && (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: COLORS.green }}>
                                    ⛽ Total Cost: {fmt(+form.litres * +form.pricePerL)}
                                </div>
                            )}
                            <label style={S.lbl}>Odometer Reading (km)</label>
                            <input style={S.inp} type="number" placeholder="Current odometer" value={form.odom || ''} onChange={e => set('odom', e.target.value)} />
                            {activeJourneys.length > 0 && (
                                <>
                                    <label style={S.lbl}>Linked Journey (optional)</label>
                                    <select style={S.inp} value={form.journey || ''} onChange={e => set('journey', e.target.value)}>
                                        <option value="">None</option>
                                        {activeJourneys.map(j => <option key={j.id} value={j.id}>{j.origin} → {j.dest} ({j.date})</option>)}
                                    </select>
                                </>
                            )}
                        </>
                    )}

                    {/* EXPENSE FORM */}
                    {subType === 'expense' && (
                        <>
                            <label style={S.lbl}>Date</label>
                            <input style={S.inp} type="date" value={form.date || today()} onChange={e => set('date', e.target.value)} />
                            <label style={S.lbl}>Category</label>
                            <select style={S.inp} value={form.cat || ''} onChange={e => set('cat', e.target.value)}>
                                <option value="">Select category…</option>
                                {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <label style={S.lbl}>Amount (KES)</label>
                            <input style={S.inp} type="number" placeholder="e.g. 5000" value={form.amount || ''} onChange={e => set('amount', e.target.value)} />
                            <label style={S.lbl}>Description</label>
                            <textarea style={{ ...S.inp, height: 80, resize: 'vertical' }} placeholder="Describe the expense…" value={form.desc || ''} onChange={e => set('desc', e.target.value)} />
                            {activeJourneys.length > 0 && (
                                <>
                                    <label style={S.lbl}>Linked Journey (optional)</label>
                                    <select style={S.inp} value={form.journey || ''} onChange={e => set('journey', e.target.value)}>
                                        <option value="">None</option>
                                        {activeJourneys.map(j => <option key={j.id} value={j.id}>{j.origin} → {j.dest}</option>)}
                                    </select>
                                </>
                            )}
                        </>
                    )}

                    {/* INCIDENT FORM */}
                    {subType === 'incident' && (
                        <>
                            <label style={S.lbl}>Incident Type</label>
                            <select style={S.inp} value={form.incidentType || ''} onChange={e => set('incidentType', e.target.value)}>
                                <option value="">Select type…</option>
                                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <label style={S.lbl}>Your Location</label>
                            <input style={S.inp} placeholder="e.g. Mlolongo weighbridge, A109" value={form.location || ''} onChange={e => set('location', e.target.value)} />
                            <label style={S.lbl}>What happened?</label>
                            <textarea style={{ ...S.inp, height: 120, resize: 'vertical' }} placeholder="Describe the incident in detail…" value={form.description || ''} onChange={e => set('description', e.target.value)} />
                            {activeJourneys.length > 0 && (
                                <>
                                    <label style={S.lbl}>Linked Journey</label>
                                    <select style={S.inp} value={form.journey || ''} onChange={e => set('journey', e.target.value)}>
                                        <option value="">None</option>
                                        {activeJourneys.map(j => <option key={j.id} value={j.id}>{j.origin} → {j.dest}</option>)}
                                    </select>
                                </>
                            )}
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#dc2626' }}>
                                🚨 After submitting, a WhatsApp message will be prepared for you to send to the office.
                            </div>
                        </>
                    )}

                    <button style={{ ...S.btn('full'), width: '100%', padding: '13px', borderRadius: 10, marginTop: 4 }}
                        onClick={submit} disabled={submitting}>
                        {submitting ? '⏳ Submitting…' : `Submit ${subType === 'fuel' ? 'Fuel Claim' : subType === 'expense' ? 'Expense Claim' : 'Incident Report'}`}
                    </button>
                </div>
            </div>
        );
    };

    // ── PAYSLIPS TAB ──────────────────────────────────────────────────────────
    const PayslipsTab = () => (
        <div style={S.content}>
            <div style={S.sectionTitle}>Salary & Payslips</div>
            {payslips.length === 0 && (
                <div style={{ ...S.card(), textAlign: 'center', padding: 32, color: COLORS.textFaint }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div>No payslip records yet.</div>
                </div>
            )}
            {payslips.map(p => {
                const net = +p.baseSalary + +p.allowance - +p.deductions;
                return (
                    <div key={p.id} style={S.card(p.status === 'Paid' ? COLORS.green : COLORS.yellow)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>
                                {new Date(p.month + '-01').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
                            </div>
                            <span style={S.badge(p.status)}>{p.status}</span>
                        </div>
                        <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>Base Salary</span><span>{fmt(p.baseSalary)}</span></div>
                        <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>Allowances</span><span style={{ color: COLORS.green }}>+{fmt(p.allowance)}</span></div>
                        <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>Deductions</span><span style={{ color: COLORS.red }}>-{fmt(p.deductions)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, fontWeight: 800, fontSize: 16 }}>
                            <span style={{ color: COLORS.text }}>Net Pay</span>
                            <span style={{ color: COLORS.green }}>{fmt(net)}</span>
                        </div>
                        {p.status === 'Paid' && p.mpesaRef && (
                            <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textFaint }}>
                                M-Pesa Ref: <span style={{ fontFamily: 'monospace', color: COLORS.green }}>{p.mpesaRef}</span> · {p.paidDate}
                            </div>
                        )}
                        <button style={{ ...S.btn('ghost'), marginTop: 12, fontSize: 12, padding: '8px 14px' }}
                            onClick={() => {
                                const w = window.open('', '_blank');
                                w.document.write(`<html><head><title>Payslip - ${driver.name}</title><style>body{font-family:Arial,sans-serif;padding:30px;max-width:500px;margin:0 auto}h2{color:#1B3A6B}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.total{font-size:18px;font-weight:800;padding-top:12px}.net{color:#10b981}</style></head><body><h2>🚛 Segecha Group Ltd</h2><p>Driver: <b>${driver.name}</b><br>Month: <b>${new Date(p.month + '-01').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</b><br>M-Pesa: <b>${driver.mpesa}</b></p><br><div class="row"><span>Base Salary</span><span>KES ${Number(p.baseSalary).toLocaleString('en-KE')}</span></div><div class="row"><span>Allowances</span><span>+KES ${Number(p.allowance).toLocaleString('en-KE')}</span></div><div class="row"><span>Deductions</span><span>-KES ${Number(p.deductions).toLocaleString('en-KE')}</span></div><div class="row total"><span>Net Pay</span><span class="net">KES ${net.toLocaleString('en-KE')}</span></div><br><p style="font-size:12px;color:#999">Status: ${p.status} ${p.mpesaRef ? '· Ref: ' + p.mpesaRef : ''} ${p.paidDate ? '· Paid: ' + p.paidDate : ''}</p><script>window.print();</script></body></html>`);
                                w.document.close();
                            }}>
                            🖨️ Print Payslip
                        </button>
                    </div>
                );
            })}
        </div>
    );

    // ── TRUCK TAB ─────────────────────────────────────────────────────────────
    const TruckTab = () => (
        <div style={S.content}>
            {!truck && (
                <div style={{ ...S.card(), textAlign: 'center', padding: 32, color: COLORS.textFaint }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🚛</div>
                    <div>No truck assigned to you yet. Contact your office.</div>
                </div>
            )}
            {truck && (
                <>
                    <div style={S.card(COLORS.accent)}>
                        <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text, marginBottom: 4 }}>{truck.reg}</div>
                        <div style={{ fontSize: 13, color: COLORS.textFaint }}>{truck.make} · {truck.year} · {truck.type}</div>
                        <div style={{ fontSize: 13, color: COLORS.textFaint, marginTop: 4 }}>⚖️ {truck.capacity}T capacity · 🛣️ {(truck.odom || 0).toLocaleString()} km odometer</div>
                        <span style={{ ...S.badge(truck.status), marginTop: 10, display: 'inline-block' }}>{truck.status}</span>
                    </div>

                    {tyreInfo && (
                        <div style={S.card(SC[tyreInfo.status])}>
                            <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>🔵 Tyre Health</div>
                            <div style={{ height: 12, borderRadius: 6, background: COLORS.border, overflow: 'hidden', marginBottom: 10 }}>
                                <div style={{ height: '100%', width: `${Math.min(100, tyreInfo.pct)}%`, background: SC[tyreInfo.status], borderRadius: 6, transition: 'width .6s ease' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {[
                                    ['Since Change', `${(tyreInfo.kmSinceChange || 0).toLocaleString()} km`],
                                    ['Remaining', tyreInfo.remaining <= 0 ? `${Math.abs(tyreInfo.remaining).toLocaleString()} km over!` : `${tyreInfo.remaining.toLocaleString()} km`],
                                    ['Worn', `${tyreInfo.pct}%`],
                                    ['Status', tyreInfo.status],
                                ].map(([l, v]) => (
                                    <div key={l} style={{ background: COLORS.bg, borderRadius: 8, padding: 10, border: `1px solid ${COLORS.border}` }}>
                                        <div style={{ fontSize: 9, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{l}</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: SC[tyreInfo.status] }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                            {tyreInfo.status !== 'OK' && (
                                <div style={{ background: SC[tyreInfo.status] + '20', border: `1px solid ${SC[tyreInfo.status]}55`, borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, color: SC[tyreInfo.status], fontWeight: 600 }}>
                                    {tyreInfo.status === 'Overdue' ? '⛔ Tyres must be changed immediately — notify office.' : '⚠️ Tyres due soon — notify your fleet manager.'}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={S.sectionTitle}>Recent Fuel Entries</div>
                    {fuelEntries.length === 0 && <div style={{ ...S.card(), color: COLORS.textFaint, fontSize: 13 }}>No fuel entries recorded yet.</div>}
                    {fuelEntries.slice(0, 5).map(f => (
                        <div key={f.id} style={S.card()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ fontWeight: 700, color: COLORS.text }}>{f.station}</div>
                                <div style={{ fontWeight: 700, color: COLORS.accent }}>{fmt(f.litres * f.pricePerL)}</div>
                            </div>
                            <div style={{ fontSize: 12, color: COLORS.textFaint }}>
                                {f.litres}L @ KES {f.pricePerL}/L · {f.date}
                                {f._pendingApproval && <span style={{ color: COLORS.yellow, marginLeft: 8 }}>⏳ Pending approval</span>}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );

    const TAB_COMPONENTS = { home: HomeTab, journeys: JourneysTab, submit: SubmitTab, payslips: PayslipsTab, truck: TruckTab };
    const ActiveTab = TAB_COMPONENTS[tab] || HomeTab;

    return (
        <div style={S.page}>
            {/* Topbar */}
            <div style={S.topbar}>
                <div>
                    <div style={S.topbarTitle}>🚛 {driver.name.split(' ')[0]}</div>
                    <div style={S.topbarSub}>{truck?.reg || 'No truck assigned'}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button style={{ background: 'none', border: '1px solid #ffffff33', borderRadius: 8, color: '#fff', fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}
                        onClick={() => fetchDriverData(token)}>↻ Refresh</button>
                    <button style={{ background: 'none', border: '1px solid #ffffff33', borderRadius: 8, color: '#8ab0d8', fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}
                        onClick={logout}>Log out</button>
                </div>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: COLORS.textFaint }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
                    <div>Loading your data…</div>
                </div>
            )}

            {!loading && <ActiveTab />}

            {/* Bottom tab bar */}
            <div style={S.tabBar}>
                {TABS.map(t => (
                    <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
                        <span style={S.tabIcon}>{t.icon}</span>
                        <span style={S.tabLabel}>{t.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
```

---

### B.4 — Replace `driver-portal/index.html` title:

```html
<title>Driver Portal — Segecha Group Ltd</title>
```

---

### B.5 — Add office WhatsApp to `driver-portal/.env`:

```env
VITE_API_URL=http://localhost:3001
VITE_OFFICE_WHATSAPP=254700000000
```

Replace `254700000000` with the actual office WhatsApp number in international format (no `+`).

---

### B.6 — Test the driver portal locally:

```bash
cd driver-portal
npm run dev
```

Open `http://localhost:5175`. It will show the login screen.

To test login, you first need to set a PIN for a driver (see Part C).

---

## PART C — Changes to App.jsx (Main Tracker)

These changes let admins manage driver portal access and sync data to the server.

### C.1 — Add admin key constant

Find the constants at the top of `App.jsx` (near where `PAYMENT_API` was added). Add:

```js
const ADMIN_KEY = 'segecha-admin-key-change-this'; // Must match server/.env ADMIN_KEY
```

---

### C.2 — Add driver portal management to the Settings page

Find the Settings component in `App.jsx`. Inside the settings grid, after the "Danger Zone" card and before the final save button, add:

```jsx
{/* ── Driver Portal Access ── */}
<div style={{ ...S.card(), gridColumn: isMobile ? '1' : '1 / -1' }}>
    {sectionTitle('🚛 Driver Portal Access (driver.segecha.com)')}
    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
        Set a 4-digit PIN for each driver so they can log in to the driver portal.
        Drivers use their registered phone number + this PIN.
    </div>
    {data.drivers.map(d => <DriverPINRow key={d.id} driver={d} />)}

    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
        {sectionTitle('📤 Sync Tracker Data to Driver Portal')}
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>
            Drivers see your tracker data (journeys, payroll, truck info) in real time.
            Click Sync to push the latest data to the server so drivers can see it.
        </div>
        <SyncDataButton />
    </div>
</div>
```

---

### C.3 — Add the DriverPINRow and SyncDataButton components

Find the `Settings` component in `App.jsx`. Inside it, before the `return (` statement, add:

```jsx
const DriverPINRow = ({ driver }) => {
    const [pin, setPin] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const savePin = async () => {
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            setStatus('❌ PIN must be exactly 4 digits');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${PAYMENT_API}/api/driver/set-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: driver.id, phone: driver.phone, pin, adminKey: ADMIN_KEY }),
            });
            const result = await res.json();
            if (result.success) { setStatus('✅ PIN set'); setPin(''); }
            else setStatus('❌ ' + result.error);
        } catch { setStatus('❌ Server not reachable'); }
        setLoading(false);
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${T.border2}` }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>{driver.name}</div>
                <div style={{ fontSize: 11, color: T.textFaint }}>{driver.phone}</div>
            </div>
            <input
                style={{ ...S.inp, width: 90, marginBottom: 0, textAlign: 'center', letterSpacing: 6, fontFamily: 'monospace' }}
                type="password" inputMode="numeric" placeholder="••••"
                maxLength={4} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <button style={S.btn('sm')} onClick={savePin} disabled={loading}>
                {loading ? '⏳' : 'Set PIN'}
            </button>
            {status && <span style={{ fontSize: 11, color: status.startsWith('✅') ? '#10b981' : '#ef4444' }}>{status}</span>}
        </div>
    );
};

const SyncDataButton = () => {
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');

    const syncData = async () => {
        setSyncing(true);
        setSyncStatus('');
        try {
            const res = await fetch(`${PAYMENT_API}/api/tracker/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data, adminKey: ADMIN_KEY }),
            });
            const result = await res.json();
            if (result.success) setSyncStatus('✅ Data synced — drivers will see the latest data');
            else setSyncStatus('❌ ' + result.error);
        } catch { setSyncStatus('❌ Server not reachable — is it running?'); }
        setSyncing(false);
    };

    return (
        <div>
            <button style={S.btn('green')} onClick={syncData} disabled={syncing}>
                {syncing ? '⏳ Syncing…' : '📤 Sync Data to Driver Portal'}
            </button>
            {syncStatus && (
                <div style={{ marginTop: 10, fontSize: 12, color: syncStatus.startsWith('✅') ? '#10b981' : '#ef4444' }}>
                    {syncStatus}
                </div>
            )}
        </div>
    );
};
```

---

## PART D — Deployment

### D.1 — Add the driver portal to your GitHub repo and deploy on Vercel

```bash
git add .
git commit -m "Add driver portal"
git push
```

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Import your repo, set **Root Directory** to `driver-portal`
4. Add environment variables:
   - `VITE_API_URL` = `https://segecha-payments.onrender.com`
   - `VITE_OFFICE_WHATSAPP` = your office WhatsApp in international format e.g. `254712345678`
5. Deploy
6. Go to **Settings → Domains** → add `driver.segecha.com`
7. In DNS, add CNAME: `driver` → `cname.vercel-dns.com`

---

### D.2 — Add ADMIN_KEY and JWT_SECRET to your Render server

In the Render dashboard for your `server/` service, add these environment variables:

```
JWT_SECRET=a-long-random-string-change-this-now
ADMIN_KEY=segecha-admin-key-change-this
OFFICE_WHATSAPP=254700000000
```

Redeploy the server after adding them.

---

### D.3 — Update App.jsx constant to use the deployed admin key

```js
const ADMIN_KEY = 'segecha-admin-key-change-this'; // Must match Render ADMIN_KEY env var exactly
```

---

### D.4 — Go-live workflow

1. In the main tracker → Settings → Driver Portal Access → set a PIN for each driver
2. Click **Sync Data to Driver Portal** — this sends all tracker data to the server
3. Give each driver the URL `driver.segecha.com` and their PIN
4. Each driver logs in with their phone number + PIN
5. When drivers submit fuel/expense claims, they appear in the server's pending queue
6. Admins review pending submissions at: `https://segecha-payments.onrender.com/api/tracker/pending?adminKey=your_admin_key`
7. Approve by accepting the data in the tracker (manually for now — automatic approval UI can be added later)

---

## Final checklist

- [ ] `server/` runs with `node index.js` — `/health` returns OK
- [ ] `driver-portal/` runs with `npm run dev` — login screen shows
- [ ] Set a PIN for a test driver via Settings in `App.jsx`
- [ ] Sync data via the Sync button in Settings
- [ ] Log in to driver portal with that driver's phone + PIN
- [ ] Home tab shows active journeys and KPI cards
- [ ] Journey tab shows trips — status update buttons work
- [ ] Submit tab — fuel claim submits and sends WhatsApp to office
- [ ] Submit tab — expense claim submits successfully
- [ ] Submit tab — incident report submits and opens WhatsApp
- [ ] Payslips tab shows salary history with Print button
- [ ] Truck tab shows truck details and tyre health
- [ ] After deployment: `driver.segecha.com` resolves and shows Segecha branding
- [ ] Log out and log back in — session is preserved for 12 hours
