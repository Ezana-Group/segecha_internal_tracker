-e ---
# SEGECHA — CURSOR SESSION 4 OF 8
# Previous: PROMPT_03_DRIVER_BASE.md
# Next: PROMPT_05_DOCUMENTS.md
# Scope: driver-portal/src/App.jsx + server/ additions
# Rule: Complete every section and run the checklist before closing this session.
---

# Segecha Driver Portal — Addendum & Corrections
# Apply this AFTER CURSOR_DRIVER_PORTAL.md

This file corrects and extends the driver portal based on the full requirements:
- Login: **email + password** (not phone + PIN)
- Uploads: **Cloudinary** (fuel receipts, odometer photos, delivery proof)
- Maintenance: **drivers log new maintenance AND view history**
- Odometer: **both start AND end reading, each verified with a photo**
- Auth replaced: bcrypt PIN → email/password with bcrypt

Apply changes in order. All changes are to the files from CURSOR_DRIVER_PORTAL.md.

---

## CHANGE 1 — Install additional dependencies

```bash
cd server
npm install multer cloudinary streamifier
```

```bash
cd driver-portal
npm install
```

---

## CHANGE 2 — Add Cloudinary config to `server/.env`

```env
# Cloudinary — free account at cloudinary.com
# After signup: Dashboard → copy Cloud Name, API Key, API Secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## CHANGE 3 — Create `server/cloudinary.js`

```js
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a buffer (from multer memory storage) to Cloudinary
function uploadBuffer(buffer, folder, filename) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `segecha/${folder}`,
                public_id: filename,
                resource_type: 'auto',
                transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

module.exports = { uploadBuffer };
```

---

## CHANGE 4 — Replace `server/driver-auth.js` completely

Switch from phone+PIN to email+password:

```js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DB_PATH = path.join(__dirname, 'drivers-auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'segecha-driver-secret-change-in-production';

function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return { drivers: [] }; }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Create or update a driver account (called from main tracker Settings)
async function setDriverAccount(driverId, email, password) {
    const db = readDB();
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = db.drivers.findIndex(d => d.driverId === driverId);
    const record = {
        driverId,
        email: email.toLowerCase().trim(),
        passwordHash,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
    };
    if (existing >= 0) db.drivers[existing] = record;
    else db.drivers.push(record);
    writeDB(db);
    return { success: true };
}

// Login with email + password
async function loginDriver(email, password) {
    const db = readDB();
    const record = db.drivers.find(d => d.email === email.toLowerCase().trim());
    if (!record) return { success: false, error: 'Email address not registered — contact your office' };

    const match = await bcrypt.compare(password, record.passwordHash);
    if (!match) return { success: false, error: 'Incorrect password — contact your office to reset it' };

    const token = jwt.sign(
        { driverId: record.driverId, email: record.email },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
    return { success: true, token, driverId: record.driverId };
}

function verifyToken(token) {
    try { return jwt.verify(token, JWT_SECRET); }
    catch { return null; }
}

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const payload = verifyToken(auth.slice(7));
    if (!payload) return res.status(401).json({ error: 'Session expired — please log in again' });
    req.driver = payload;
    next();
}

module.exports = { setDriverAccount, loginDriver, authMiddleware };
```

---

## CHANGE 5 — Add maintenance logging to `server/driver-data.js`

Find the `addPendingSubmission` function in `server/driver-data.js`. Add a `maintenance` case inside the `if (type === ...)` blocks:

```js
if (type === 'maintenance') {
    if (!data.expenses) data.expenses = [];
    // Maintenance logs as an expense with cat 'Maintenance' + pending approval
    data.expenses.push({
        id: uid(),
        truck: payload.truck,
        date: payload.date || new Date().toISOString().split('T')[0],
        cat: 'Maintenance',
        amount: +payload.cost || 0,
        desc: payload.task + (payload.notes ? ' — ' + payload.notes : ''),
        journey: payload.journey || '',
        _pendingApproval: true,
        _submittedBy: driverId,
        _submittedAt: new Date().toISOString(),
        _maintenanceDetails: {
            task: payload.task,
            workshop: payload.workshop || '',
            cost: +payload.cost || 0,
            odomReading: +payload.odomReading || 0,
            receiptUrl: payload.receiptUrl || '',
            notes: payload.notes || '',
        },
    });
}
```

Also add `getMaintenanceHistory` to the module. Find the `getDriverData` function and add inside it, after `const payslips = ...`:

```js
// Maintenance history for this truck
const maintenanceHistory = (data.expenses || [])
    .filter(e => e.truck === driver.truck && e.cat === 'Maintenance')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
```

Then add `maintenanceHistory` to the return object:

```js
return { driver, truck, tyreInfo, activeJourneys, completedJourneys, fuelEntries, payslips, maintenanceHistory };
```

---

## CHANGE 6 — Add odometer journey fields to `server/driver-data.js`

Find `updateJourneyStatus` in `server/driver-data.js`. Replace it entirely:

```js
function updateJourneyStatus(driverId, journeyId, newStatus, extras = {}) {
    const data = readTrackerData();
    const journey = data.journeys.find(j => j.id === journeyId && j.driver === driverId);
    if (!journey) return { success: false, error: 'Journey not found or not assigned to you' };

    const validTransitions = {
        'Loading': ['In Transit'],
        'In Transit': ['Completed'],
    };
    if (!validTransitions[journey.status]?.includes(newStatus)) {
        return { success: false, error: `Cannot change from ${journey.status} to ${newStatus}` };
    }

    journey.status = newStatus;

    // Attach odometer readings and proof URLs from driver
    if (newStatus === 'In Transit') {
        journey.startOdom = extras.startOdom || journey.startOdom;
        journey.startOdomPhotoUrl = extras.startOdomPhotoUrl || '';
        journey.startedAt = new Date().toISOString();
    }

    if (newStatus === 'Completed') {
        journey.endDate = new Date().toISOString().split('T')[0];
        journey.endOdom = extras.endOdom || journey.endOdom;
        journey.endOdomPhotoUrl = extras.endOdomPhotoUrl || '';
        journey.deliveryProofUrl = extras.deliveryProofUrl || '';
        journey.completedAt = new Date().toISOString();

        // Update truck odometer in tracker if end reading provided
        if (extras.endOdom) {
            const truck = data.trucks.find(t => t.id === journey.truck);
            if (truck && +extras.endOdom > truck.odom) {
                truck.odom = +extras.endOdom;
            }
        }
    }

    writeTrackerData(data);
    return { success: true, journey };
}
```

---

## CHANGE 7 — Add new server routes to `server/index.js`

### 7a — Replace the driver account setup route

Find this route in `server/index.js`:
```js
app.post('/api/driver/set-pin', async (req, res) => {
```

Replace the entire route with:

```js
// Set/update driver login credentials (email + password)
app.post('/api/driver/set-account', async (req, res) => {
    const { driverId, email, password, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!driverId || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'driverId, email, and a password of at least 6 characters are required' });
    }
    try {
        const { setDriverAccount } = require('./driver-auth');
        await setDriverAccount(driverId, email, password);
        res.json({ success: true, message: `Account set for driver ${driverId}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

### 7b — Replace the login route

Find:
```js
app.post('/api/driver/login', async (req, res) => {
    const { phone, pin } = req.body;
```

Replace:

```js
app.post('/api/driver/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    try {
        const { loginDriver } = require('./driver-auth');
        const result = await loginDriver(email, password);
        if (result.success) res.json(result);
        else res.status(401).json({ error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

### 7c — Add Cloudinary upload route

Find the line `const PORT = process.env.PORT || 3001;` and before it add:

```js
// ── File upload to Cloudinary ─────────────────────────────────────────────
const multer = require('multer');
const { uploadBuffer } = require('./cloudinary');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/driver/upload', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const { folder = 'misc', filename } = req.body;
    const safeName = `${req.driver.driverId}_${filename || Date.now()}`;
    try {
        const result = await uploadBuffer(req.file.buffer, folder, safeName);
        res.json({ success: true, url: result.secure_url, publicId: result.public_id });
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(500).json({ error: 'Upload failed — ' + err.message });
    }
});
```

### 7d — Add journey status update route with odometer + proof

Find:
```js
app.post('/api/driver/journey/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body;
    const result = updateJourneyStatus(req.driver.driverId, req.params.id, status);
```

Replace:
```js
app.post('/api/driver/journey/:id/status', authMiddleware, (req, res) => {
    const { status, startOdom, startOdomPhotoUrl, endOdom, endOdomPhotoUrl, deliveryProofUrl } = req.body;
    const result = updateJourneyStatus(
        req.driver.driverId,
        req.params.id,
        status,
        { startOdom, startOdomPhotoUrl, endOdom, endOdomPhotoUrl, deliveryProofUrl }
    );
```

### 7e — Add maintenance submission route

After the existing `/api/driver/submit/incident` route, add:

```js
// Submit maintenance log
app.post('/api/driver/submit/maintenance', authMiddleware, (req, res) => {
    const result = addPendingSubmission(req.driver.driverId, 'maintenance', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Maintenance log submitted for office review' });
});
```

---

## CHANGE 8 — Replace the entire `driver-portal/src/App.jsx`

Replace the full file with the version below. Key differences from the previous version:
- Login uses **email + password** fields
- **Upload helper** (`uploadFile`) sends files to `/api/driver/upload` → Cloudinary
- **Journey status update** requires odometer reading + photo before marking In Transit or Completed
- **Delivery proof photo** required when marking Completed
- **Maintenance tab** added — drivers log new maintenance and view history
- **Submit tab** has `fuel`, `expense`, `incident`, and `maintenance` sub-types
- All photo uploads use `<input type="file" accept="image/*" capture="environment">` for camera on mobile

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const OFFICE_WA = import.meta.env.VITE_OFFICE_WHATSAPP || '';
const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const today = () => new Date().toISOString().split('T')[0];

const COLORS = {
    primary: '#1B3A6B', accent: '#E8501A', green: '#10b981',
    yellow: '#f59e0b', red: '#ef4444', blue: '#3b82f6',
    bg: '#f1f5f9', surface: '#ffffff',
    text: '#0f172a', textDim: '#475569', textFaint: '#94a3b8',
    border: '#e2e8f0',
};

const SC = {
    'Loading': '#f59e0b', 'In Transit': '#3b82f6', 'Completed': '#10b981',
    'Cancelled': '#ef4444', 'Paid': '#10b981', 'Pending': '#f59e0b',
    'OK': '#10b981', 'Due Soon': '#f97316', 'Overdue': '#ef4444',
};

const TABS = [
    { id: 'home', icon: '◈', label: 'Home' },
    { id: 'journeys', icon: '◐', label: 'Trips' },
    { id: 'submit', icon: '＋', label: 'Submit' },
    { id: 'maintenance', icon: '🔧', label: 'Maint.' },
    { id: 'payslips', icon: '◑', label: 'Pay' },
];

// ── Upload a file to Cloudinary via server ──────────────────────────────────
async function uploadFile(file, folder, filename, token) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('filename', filename);
    const res = await fetch(`${API}/api/driver/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');
    return data.url;
}

// ── Photo upload field component ───────────────────────────────────────────
function PhotoField({ label, hint, token, folder, filename, onUploaded }) {
    const [status, setStatus] = useState('idle'); // idle | uploading | done | error
    const [preview, setPreview] = useState('');
    const [errMsg, setErrMsg] = useState('');

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setStatus('uploading');
        setErrMsg('');
        try {
            const url = await uploadFile(file, folder, filename + '_' + Date.now(), token);
            setPreview(URL.createObjectURL(file));
            setStatus('done');
            onUploaded(url);
        } catch (err) {
            setStatus('error');
            setErrMsg(err.message);
        }
    };

    const inp = { width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'inherit' };
    const lbl = { fontSize: 11, color: COLORS.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, display: 'block' };

    return (
        <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{label}</label>
            {hint && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 6 }}>{hint}</div>}
            {preview && (
                <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 8, border: `1px solid ${COLORS.border}` }} />
            )}
            {status === 'done' ? (
                <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, marginBottom: 8 }}>✅ Photo uploaded</div>
            ) : (
                <label style={{ display: 'block', background: COLORS.bg, border: `1.5px dashed ${status === 'error' ? COLORS.red : COLORS.border}`, borderRadius: 10, padding: '12px', textAlign: 'center', cursor: 'pointer', fontSize: 13, color: status === 'uploading' ? COLORS.textFaint : COLORS.textDim }}>
                    {status === 'uploading' ? '⏳ Uploading…' : '📷 Tap to take photo or choose file'}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} disabled={status === 'uploading'} />
                </label>
            )}
            {errMsg && <div style={{ fontSize: 11, color: COLORS.red, marginTop: 4 }}>{errMsg}</div>}
        </div>
    );
}

export default function DriverPortal() {
    const [token, setToken] = useState(() => localStorage.getItem('driver_token') || '');
    const [driverData, setDriverData] = useState(null);
    const [tab, setTab] = useState('home');
    const [loading, setLoading] = useState(false);

    // Login fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');

    const fetchDriverData = useCallback(async (tok) => {
        if (!tok) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/driver/me`, { headers: { Authorization: `Bearer ${tok}` } });
            if (res.status === 401) { setToken(''); localStorage.removeItem('driver_token'); setLoading(false); return; }
            setDriverData(await res.json());
        } catch { /* silent — show stale data */ }
        setLoading(false);
    }, []);

    useEffect(() => { if (token) fetchDriverData(token); }, [token, fetchDriverData]);

    const login = async () => {
        if (!email || !password) { setLoginError('Enter your email and password'); return; }
        setLoginLoading(true); setLoginError('');
        try {
            const res = await fetch(`${API}/api/driver/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.token) { localStorage.setItem('driver_token', data.token); setToken(data.token); }
            else setLoginError(data.error || 'Login failed — contact your office');
        } catch { setLoginError('Could not connect to server. Try again.'); }
        setLoginLoading(false);
    };

    const logout = () => { localStorage.removeItem('driver_token'); setToken(''); setDriverData(null); };

    const apiPost = async (url, body) => {
        const res = await fetch(`${API}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        return res.json();
    };

    const notifyOffice = (message) => {
        if (OFFICE_WA) window.open(`https://wa.me/${OFFICE_WA}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const S = {
        page: { minHeight: '100vh', background: COLORS.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", paddingBottom: 80, maxWidth: 480, margin: '0 auto' },
        topbar: { background: COLORS.primary, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 },
        tabBar: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: `1px solid ${COLORS.border}`, display: 'flex', zIndex: 100 },
        tabBtn: a => ({ flex: 1, padding: '10px 4px 8px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: a ? COLORS.accent : COLORS.textFaint, fontWeight: a ? 700 : 400 }),
        content: { padding: '16px' },
        card: (accent) => ({ background: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${accent ? accent + '33' : COLORS.border}`, borderTop: accent ? `3px solid ${accent}` : undefined, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }),
        sectionTitle: { fontSize: 11, fontWeight: 700, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 4 },
        badge: s => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: (SC[s] || '#64748b') + '22', color: SC[s] || '#64748b', border: `1px solid ${(SC[s] || '#64748b')}44` }),
        kpi: { fontSize: 10, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
        kpiVal: c => ({ fontSize: 24, fontWeight: 800, color: c || COLORS.text, letterSpacing: -0.5 }),
        btn: v => ({ padding: v === 'sm' ? '8px 14px' : '13px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: v === 'sm' ? 12 : 14, background: v === 'ghost' ? '#f1f5f9' : v === 'green' ? 'linear-gradient(135deg,#059669,#10b981)' : v === 'blue' ? 'linear-gradient(135deg,#1B3A6B,#2563eb)' : 'linear-gradient(135deg,#E8501A,#d4400f)', color: v === 'ghost' ? COLORS.textDim : '#fff' }),
        inp: { width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'inherit' },
        lbl: { fontSize: 11, color: COLORS.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, display: 'block' },
        infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 },
        alert: c => ({ background: c + '15', border: `1px solid ${c}44`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }),
        success: msg => ({ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#065f46', fontSize: 13, fontWeight: 600, marginBottom: 12 }),
        errBox: msg => ({ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }),
    };

    // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
    if (!token || !driverData) {
        return (
            <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, #0d1b35, ${COLORS.primary} 60%, #0d2347)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ fontSize: 44, marginBottom: 10 }}>🚛</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary, marginBottom: 4 }}>Segecha Group Ltd</div>
                        <div style={{ fontSize: 13, color: COLORS.textFaint }}>Driver Portal · driver.segecha.com</div>
                    </div>
                    {loginError && <div style={S.errBox()}>{loginError}</div>}
                    <label style={S.lbl}>Email Address</label>
                    <input style={S.inp} type="email" placeholder="your@email.com" value={email}
                        onChange={e => setEmail(e.target.value)} autoComplete="email" />
                    <label style={S.lbl}>Password</label>
                    <input style={S.inp} type="password" placeholder="••••••••" value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && login()} />
                    <button style={{ ...S.btn(), width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 4 }}
                        onClick={login} disabled={loginLoading}>
                        {loginLoading ? '⏳ Logging in…' : 'Log In'}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: COLORS.textFaint, lineHeight: 1.7 }}>
                        Contact your office manager if you<br />need your login details reset.
                    </div>
                </div>
            </div>
        );
    }

    const { driver, truck, tyreInfo, activeJourneys, completedJourneys, fuelEntries, payslips, maintenanceHistory } = driverData;

    // ── HOME TAB ──────────────────────────────────────────────────────────────
    const HomeTab = () => (
        <div style={S.content}>
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>Hi, {driver.name.split(' ')[0]} 👋</div>
                <div style={{ fontSize: 13, color: COLORS.textFaint, marginTop: 2 }}>
                    {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>
            {activeJourneys.map(j => (
                <div key={j.id} style={S.alert(j.status === 'In Transit' ? COLORS.blue : COLORS.yellow)}>
                    <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                        {j.status === 'In Transit' ? '🚛 You are on the road' : '📦 Trip ready to start'}
                    </div>
                    <div style={{ fontSize: 14, color: COLORS.textDim }}>{j.origin} → {j.dest}</div>
                    <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 4 }}>{j.cargo} · {j.distance} km</div>
                    <button style={{ ...S.btn('sm'), marginTop: 10 }} onClick={() => setTab('journeys')}>View & Update →</button>
                </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                    { label: 'Active Trips', val: activeJourneys.length, c: COLORS.blue },
                    { label: 'Completed', val: completedJourneys.length, c: COLORS.green },
                    { label: 'Last Pay', val: payslips[0] ? fmt(+payslips[0].baseSalary + +payslips[0].allowance - +payslips[0].deductions) : '—', c: COLORS.yellow },
                    { label: 'Tyre Status', val: tyreInfo?.status || '—', c: SC[tyreInfo?.status] || COLORS.textFaint },
                ].map(k => (
                    <div key={k.label} style={S.card(k.c)}>
                        <div style={S.kpi}>{k.label}</div>
                        <div style={S.kpiVal(k.c)}>{k.val}</div>
                    </div>
                ))}
            </div>
            <div style={S.sectionTitle}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                    { label: '⛽ Log Fuel', go: () => setTab('submit') },
                    { label: '💰 Claim Expense', go: () => setTab('submit') },
                    { label: '🔧 Log Maintenance', go: () => setTab('maintenance') },
                    { label: '🚨 Report Incident', go: () => setTab('submit') },
                    { label: '📋 My Payslips', go: () => setTab('payslips') },
                    { label: '🚛 My Truck', go: () => setTab('journeys') },
                ].map(q => (
                    <button key={q.label}
                        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 13, color: COLORS.text, cursor: 'pointer', textAlign: 'left' }}
                        onClick={q.go}>{q.label}</button>
                ))}
            </div>
        </div>
    );

    // ── JOURNEYS TAB ──────────────────────────────────────────────────────────
    const JourneysTab = () => {
        const [updating, setUpdating] = useState({});
        const [expandedId, setExpandedId] = useState(null);

        // Per-journey form state for odometer + photos
        const [odomForms, setOdomForms] = useState({});
        const setOdom = (jid, key, val) => setOdomForms(f => ({ ...f, [jid]: { ...(f[jid] || {}), [key]: val } }));
        const [msgs, setMsgs] = useState({});

        const updateStatus = async (j, newStatus) => {
            const form = odomForms[j.id] || {};

            // Validate odometer + photos before submitting
            if (newStatus === 'In Transit') {
                if (!form.startOdom) { setMsgs(m => ({ ...m, [j.id]: '❌ Enter your starting odometer reading' })); return; }
                if (!form.startOdomPhotoUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload a photo of the odometer before departing' })); return; }
            }
            if (newStatus === 'Completed') {
                if (!form.endOdom) { setMsgs(m => ({ ...m, [j.id]: '❌ Enter your final odometer reading' })); return; }
                if (!form.endOdomPhotoUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload a photo of the odometer on arrival' })); return; }
                if (!form.deliveryProofUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload delivery proof (signed waybill or receipt photo)' })); return; }
            }

            setUpdating(u => ({ ...u, [j.id]: true }));
            const result = await apiPost(`/api/driver/journey/${j.id}/status`, { status: newStatus, ...form });
            if (result.success) {
                setMsgs(m => ({ ...m, [j.id]: `✅ Status updated to ${newStatus}` }));
                notifyOffice(`📍 Journey update from *${driver.name}*
Trip: ${j.origin} → ${j.dest}
New status: *${newStatus}*
Truck: ${truck?.reg}
Odometer: ${newStatus === 'In Transit' ? form.startOdom : form.endOdom} km`);
                await fetchDriverData(token);
            } else {
                setMsgs(m => ({ ...m, [j.id]: '❌ ' + result.error }));
            }
            setUpdating(u => ({ ...u, [j.id]: false }));
        };

        const JourneyCard = ({ j, allowUpdate }) => {
            const isExpanded = expandedId === j.id;
            const form = odomForms[j.id] || {};
            return (
                <div style={S.card(SC[j.status])}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, cursor: 'pointer' }}
                        onClick={() => setExpandedId(isExpanded ? null : j.id)}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>{j.origin} → {j.dest}</div>
                            <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 3 }}>{j.date} · {j.distance} km</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <span style={S.badge(j.status)}>{j.status}</span>
                            <span style={{ fontSize: 12, color: COLORS.textFaint }}>{isExpanded ? '▲' : '▼'} details</span>
                        </div>
                    </div>

                    {isExpanded && (
                        <>
                            <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>Cargo</span><span>{j.cargo || '—'} {j.weight ? `· ${j.weight}T` : ''}</span></div>
                            <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>Revenue</span><span style={{ color: COLORS.green, fontWeight: 700 }}>{fmt(j.revenue)}</span></div>
                            {j.notes && <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>Notes</span><span style={{ fontSize: 12 }}>{j.notes}</span></div>}
                            {j.startOdom && <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>Start Odom</span><span>{Number(j.startOdom).toLocaleString()} km</span></div>}
                            {j.endOdom && <div style={S.infoRow}><span style={{ color: COLORS.textFaint }}>End Odom</span><span>{Number(j.endOdom).toLocaleString()} km</span></div>}

                            {allowUpdate && j.status === 'Loading' && (
                                <div style={{ marginTop: 14, padding: 14, background: COLORS.bg, borderRadius: 10 }}>
                                    <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13 }}>📍 Before departing — record your start odometer</div>
                                    <label style={S.lbl}>Start Odometer Reading (km)</label>
                                    <input style={S.inp} type="number" placeholder="e.g. 142300"
                                        value={form.startOdom || ''}
                                        onChange={e => setOdom(j.id, 'startOdom', e.target.value)} />
                                    <PhotoField label="📷 Photo of Odometer" hint="Take a clear photo of the dashboard odometer reading"
                                        token={token} folder="odometer" filename={`${j.id}_start`}
                                        onUploaded={url => setOdom(j.id, 'startOdomPhotoUrl', url)} />
                                    {msgs[j.id] && <div style={{ color: msgs[j.id].startsWith('✅') ? COLORS.green : COLORS.red, fontSize: 12, marginBottom: 10 }}>{msgs[j.id]}</div>}
                                    <button style={{ ...S.btn('blue'), width: '100%' }}
                                        disabled={updating[j.id]}
                                        onClick={() => updateStatus(j, 'In Transit')}>
                                        {updating[j.id] ? '⏳ Updating…' : '🚛 Mark In Transit — Trip Started'}
                                    </button>
                                </div>
                            )}

                            {allowUpdate && j.status === 'In Transit' && (
                                <div style={{ marginTop: 14, padding: 14, background: COLORS.bg, borderRadius: 10 }}>
                                    <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13 }}>🏁 On arrival — record your end odometer and upload delivery proof</div>
                                    <label style={S.lbl}>End Odometer Reading (km)</label>
                                    <input style={S.inp} type="number" placeholder="e.g. 142780"
                                        value={form.endOdom || ''}
                                        onChange={e => setOdom(j.id, 'endOdom', e.target.value)} />
                                    <PhotoField label="📷 Photo of Odometer on Arrival" hint="Take a clear photo of the odometer at destination"
                                        token={token} folder="odometer" filename={`${j.id}_end`}
                                        onUploaded={url => setOdom(j.id, 'endOdomPhotoUrl', url)} />
                                    <PhotoField label="📄 Delivery Proof" hint="Photo of signed waybill, delivery note, or receipt from client"
                                        token={token} folder="delivery_proof" filename={`${j.id}_proof`}
                                        onUploaded={url => setOdom(j.id, 'deliveryProofUrl', url)} />
                                    {msgs[j.id] && <div style={{ color: msgs[j.id].startsWith('✅') ? COLORS.green : COLORS.red, fontSize: 12, marginBottom: 10 }}>{msgs[j.id]}</div>}
                                    <button style={{ ...S.btn('green'), width: '100%' }}
                                        disabled={updating[j.id]}
                                        onClick={() => updateStatus(j, 'Completed')}>
                                        {updating[j.id] ? '⏳ Completing…' : '✅ Mark Completed — Trip Done'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            );
        };

        return (
            <div style={S.content}>
                {/* Truck quick info */}
                {truck && (
                    <div style={S.card(COLORS.accent)}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>{truck.reg}</div>
                        <div style={{ fontSize: 12, color: COLORS.textFaint }}>{truck.make} · {truck.year} · {(truck.odom || 0).toLocaleString()} km</div>
                        {tyreInfo && <div style={{ fontSize: 12, color: SC[tyreInfo.status], marginTop: 4, fontWeight: 600 }}>🔵 Tyres: {tyreInfo.status} — {tyreInfo.remaining > 0 ? `${tyreInfo.remaining.toLocaleString()} km remaining` : `${Math.abs(tyreInfo.remaining).toLocaleString()} km overdue`}</div>}
                    </div>
                )}
                {activeJourneys.length > 0 && (
                    <>
                        <div style={S.sectionTitle}>Active Trips</div>
                        {activeJourneys.map(j => <JourneyCard key={j.id} j={j} allowUpdate />)}
                    </>
                )}
                {activeJourneys.length === 0 && (
                    <div style={{ ...S.card(), textAlign: 'center', padding: 28, color: COLORS.textFaint }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                        <div style={{ fontWeight: 700 }}>No active journeys</div>
                    </div>
                )}
                {completedJourneys.length > 0 && (
                    <>
                        <div style={{ ...S.sectionTitle, marginTop: 16 }}>Trip History</div>
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
        const [msg, setMsg] = useState('');
        const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

        const EXPENSE_CATS = ['Maintenance', 'Toll', 'Permit', 'Allowance', 'Other'];
        const INCIDENT_TYPES = ['Breakdown', 'Accident', 'Cargo Damage', 'Theft', 'Road Closure', 'Other'];

        const submit = async () => {
            setSubmitting(true); setMsg('');
            const urls = { fuel: '/api/driver/submit/fuel', expense: '/api/driver/submit/expense', incident: '/api/driver/submit/incident' };
            const payload = { ...form, truck: driver.truck };
            const result = await apiPost(urls[subType], payload);
            if (result.success) {
                setMsg('✅ ' + result.message);
                setForm({});
                if (OFFICE_WA) {
                    const waMsg = subType === 'fuel'
                        ? `⛽ Fuel claim from *${driver.name}*
Truck: ${truck?.reg}
Station: ${form.station}
${form.litres}L @ KES ${form.pricePerL}/L = KES ${Math.round(+form.litres * +form.pricePerL).toLocaleString('en-KE')}
Odometer: ${form.odom || 'not recorded'} km`
                        : subType === 'expense'
                        ? `💰 Expense claim from *${driver.name}*
Truck: ${truck?.reg}
Category: ${form.cat}
Amount: KES ${Number(form.amount).toLocaleString('en-KE')}
${form.desc}`
                        : `🚨 INCIDENT from *${driver.name}*
Truck: ${truck?.reg}
Type: ${form.incidentType}
Location: ${form.location || 'not specified'}
${form.description}`;
                    notifyOffice(waMsg);
                }
            } else {
                setMsg('❌ ' + (result.error || 'Submission failed'));
            }
            setSubmitting(false);
        };

        return (
            <div style={S.content}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                    {[['fuel', '⛽ Fuel'], ['expense', '💰 Expense'], ['incident', '🚨 Incident']].map(([id, lbl]) => (
                        <button key={id} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: `2px solid ${subType === id ? COLORS.accent : COLORS.border}`, background: subType === id ? COLORS.accent + '15' : COLORS.surface, color: subType === id ? COLORS.accent : COLORS.textDim, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            onClick={() => { setSubType(id); setForm({}); setMsg(''); }}>{lbl}</button>
                    ))}
                </div>
                {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}
                <div style={S.card()}>
                    {subType === 'fuel' && (
                        <>
                            <label style={S.lbl}>Date</label>
                            <input style={S.inp} type="date" value={form.date || today()} onChange={e => set('date', e.target.value)} />
                            <label style={S.lbl}>Station Name</label>
                            <input style={S.inp} placeholder="e.g. Total Mlolongo" value={form.station || ''} onChange={e => set('station', e.target.value)} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={S.lbl}>Litres Filled</label>
                                    <input style={S.inp} type="number" placeholder="120" value={form.litres || ''} onChange={e => set('litres', e.target.value)} />
                                </div>
                                <div>
                                    <label style={S.lbl}>Price / Litre (KES)</label>
                                    <input style={S.inp} type="number" placeholder="176" value={form.pricePerL || ''} onChange={e => set('pricePerL', e.target.value)} />
                                </div>
                            </div>
                            {form.litres && form.pricePerL && (
                                <div style={{ ...S.success(), marginBottom: 12 }}>⛽ Cost: {fmt(+form.litres * +form.pricePerL)}</div>
                            )}
                            <label style={S.lbl}>Odometer Reading (km)</label>
                            <input style={S.inp} type="number" placeholder="Current odometer reading" value={form.odom || ''} onChange={e => set('odom', e.target.value)} />
                            <PhotoField label="📷 Fuel Receipt Photo" hint="Photo of the station receipt"
                                token={token} folder="fuel_receipts" filename={`fuel_${Date.now()}`}
                                onUploaded={url => set('receiptUrl', url)} />
                            <PhotoField label="📷 Odometer Photo" hint="Photo showing current odometer reading"
                                token={token} folder="odometer" filename={`odom_${Date.now()}`}
                                onUploaded={url => set('odomPhotoUrl', url)} />
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
                    {subType === 'expense' && (
                        <>
                            <label style={S.lbl}>Date</label>
                            <input style={S.inp} type="date" value={form.date || today()} onChange={e => set('date', e.target.value)} />
                            <label style={S.lbl}>Category</label>
                            <select style={S.inp} value={form.cat || ''} onChange={e => set('cat', e.target.value)}>
                                <option value="">Select…</option>
                                {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <label style={S.lbl}>Amount (KES)</label>
                            <input style={S.inp} type="number" placeholder="e.g. 5000" value={form.amount || ''} onChange={e => set('amount', e.target.value)} />
                            <label style={S.lbl}>Description</label>
                            <textarea style={{ ...S.inp, height: 80, resize: 'vertical' }} placeholder="What was the expense for?" value={form.desc || ''} onChange={e => set('desc', e.target.value)} />
                            <PhotoField label="📷 Receipt / Evidence Photo (optional)" hint="Photo of receipt or evidence of the expense"
                                token={token} folder="expense_receipts" filename={`exp_${Date.now()}`}
                                onUploaded={url => set('receiptUrl', url)} />
                        </>
                    )}
                    {subType === 'incident' && (
                        <>
                            <label style={S.lbl}>Incident Type</label>
                            <select style={S.inp} value={form.incidentType || ''} onChange={e => set('incidentType', e.target.value)}>
                                <option value="">Select…</option>
                                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <label style={S.lbl}>Your Location</label>
                            <input style={S.inp} placeholder="e.g. Mlolongo weighbridge, A109" value={form.location || ''} onChange={e => set('location', e.target.value)} />
                            <label style={S.lbl}>What happened?</label>
                            <textarea style={{ ...S.inp, height: 120, resize: 'vertical' }} placeholder="Describe the incident…" value={form.description || ''} onChange={e => set('description', e.target.value)} />
                            <PhotoField label="📷 Photo of Incident (optional)" hint="Photo of damage, breakdown, or scene"
                                token={token} folder="incidents" filename={`incident_${Date.now()}`}
                                onUploaded={url => set('incidentPhotoUrl', url)} />
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#dc2626' }}>
                                🚨 After submitting, a WhatsApp message will open for you to send to the office.
                            </div>
                        </>
                    )}
                    <button style={{ ...S.btn(), width: '100%', borderRadius: 10 }} onClick={submit} disabled={submitting}>
                        {submitting ? '⏳ Submitting…' : `Submit ${subType === 'fuel' ? 'Fuel Claim' : subType === 'expense' ? 'Expense Claim' : 'Incident Report'}`}
                    </button>
                </div>
            </div>
        );
    };

    // ── MAINTENANCE TAB ───────────────────────────────────────────────────────
    const MaintenanceTab = () => {
        const [form, setForm] = useState({});
        const [submitting, setSubmitting] = useState(false);
        const [msg, setMsg] = useState('');
        const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

        const TASKS = ['Oil Change', 'Tyre Replacement', 'Brake Pad Replacement', 'Brake Disc Inspection', 'Coolant Flush', 'Air Filter', 'Fuel Filter', 'Battery Replacement', 'Windscreen Repair', 'Other'];

        const submit = async () => {
            if (!form.task) { setMsg('❌ Select a task'); return; }
            setSubmitting(true); setMsg('');
            const payload = { ...form, truck: driver.truck };
            const result = await apiPost('/api/driver/submit/maintenance', payload);
            if (result.success) {
                setMsg('✅ Maintenance log submitted for office review');
                setForm({});
                notifyOffice(`🔧 Maintenance log from *${driver.name}*
Truck: ${truck?.reg}
Task: ${form.task}
Workshop: ${form.workshop || 'not specified'}
Cost: KES ${Number(form.cost || 0).toLocaleString('en-KE')}
Odometer: ${form.odomReading || 'not recorded'} km`);
            } else {
                setMsg('❌ ' + (result.error || 'Submission failed'));
            }
            setSubmitting(false);
        };

        return (
            <div style={S.content}>
                {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}

                {/* Log new maintenance */}
                <div style={S.sectionTitle}>Log New Maintenance</div>
                <div style={S.card()}>
                    <label style={S.lbl}>Task Performed</label>
                    <select style={S.inp} value={form.task || ''} onChange={e => set('task', e.target.value)}>
                        <option value="">Select task…</option>
                        {TASKS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <label style={S.lbl}>Date</label>
                    <input style={S.inp} type="date" value={form.date || today()} onChange={e => set('date', e.target.value)} />
                    <label style={S.lbl}>Workshop / Garage Name</label>
                    <input style={S.inp} placeholder="e.g. Nairobi Auto Centre" value={form.workshop || ''} onChange={e => set('workshop', e.target.value)} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={S.lbl}>Cost (KES)</label>
                            <input style={S.inp} type="number" placeholder="e.g. 12000" value={form.cost || ''} onChange={e => set('cost', e.target.value)} />
                        </div>
                        <div>
                            <label style={S.lbl}>Odometer (km)</label>
                            <input style={S.inp} type="number" placeholder="Current reading" value={form.odomReading || ''} onChange={e => set('odomReading', e.target.value)} />
                        </div>
                    </div>
                    <label style={S.lbl}>Notes (optional)</label>
                    <textarea style={{ ...S.inp, height: 72, resize: 'vertical' }} placeholder="Any additional details…" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
                    <PhotoField label="📷 Receipt / Workshop Invoice" hint="Photo of the maintenance receipt or invoice"
                        token={token} folder="maintenance_receipts" filename={`maint_${Date.now()}`}
                        onUploaded={url => set('receiptUrl', url)} />
                    {activeJourneys.length > 0 && (
                        <>
                            <label style={S.lbl}>Linked Journey (optional)</label>
                            <select style={S.inp} value={form.journey || ''} onChange={e => set('journey', e.target.value)}>
                                <option value="">None</option>
                                {activeJourneys.map(j => <option key={j.id} value={j.id}>{j.origin} → {j.dest}</option>)}
                            </select>
                        </>
                    )}
                    <button style={{ ...S.btn(), width: '100%', borderRadius: 10 }} onClick={submit} disabled={submitting}>
                        {submitting ? '⏳ Submitting…' : '🔧 Submit Maintenance Log'}
                    </button>
                </div>

                {/* Maintenance history */}
                {maintenanceHistory?.length > 0 && (
                    <>
                        <div style={{ ...S.sectionTitle, marginTop: 16 }}>History — {truck?.reg}</div>
                        {maintenanceHistory.map(m => (
                            <div key={m.id} style={S.card()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{m._maintenanceDetails?.task || m.desc}</div>
                                    <div style={{ fontWeight: 700, color: COLORS.yellow }}>{fmt(m.amount)}</div>
                                </div>
                                <div style={{ fontSize: 12, color: COLORS.textFaint, lineHeight: 1.7 }}>
                                    <div>📅 {m.date}</div>
                                    {m._maintenanceDetails?.workshop && <div>🏪 {m._maintenanceDetails.workshop}</div>}
                                    {m._maintenanceDetails?.odomReading && <div>🛣️ {Number(m._maintenanceDetails.odomReading).toLocaleString()} km</div>}
                                    {m._pendingApproval && <div style={{ color: COLORS.yellow, fontWeight: 600 }}>⏳ Pending office approval</div>}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        );
    };

    // ── PAYSLIPS TAB ──────────────────────────────────────────────────────────
    const PayslipsTab = () => (
        <div style={S.content}>
            <div style={S.sectionTitle}>Salary & Payslips</div>
            {payslips.length === 0 && (
                <div style={{ ...S.card(), textAlign: 'center', padding: 28, color: COLORS.textFaint }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                    <div>No payslip records yet</div>
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
                        {p.mpesaRef && <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textFaint }}>M-Pesa: <span style={{ fontFamily: 'monospace', color: COLORS.green }}>{p.mpesaRef}</span> · {p.paidDate}</div>}
                        <button style={{ ...S.btn('ghost'), marginTop: 12, fontSize: 12, padding: '8px 14px' }}
                            onClick={() => {
                                const w = window.open('', '_blank');
                                w.document.write(`<html><head><title>Payslip</title><style>body{font-family:Arial;padding:30px;max-width:500px;margin:0 auto}h2{color:#1B3A6B}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.total{font-size:18px;font-weight:800;padding-top:12px}.net{color:#10b981}</style></head><body><h2>🚛 Segecha Group Ltd</h2><p>Driver: <b>${driver.name}</b><br>Month: <b>${new Date(p.month + '-01').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</b><br>M-Pesa: <b>${driver.mpesa}</b></p><br><div class="row"><span>Base Salary</span><span>KES ${Number(p.baseSalary).toLocaleString('en-KE')}</span></div><div class="row"><span>Allowances</span><span>+KES ${Number(p.allowance).toLocaleString('en-KE')}</span></div><div class="row"><span>Deductions</span><span>-KES ${Number(p.deductions).toLocaleString('en-KE')}</span></div><div class="row total"><span>Net Pay</span><span class="net">KES ${net.toLocaleString('en-KE')}</span></div><br><p style="font-size:11px;color:#999">Status: ${p.status}${p.mpesaRef ? ' · Ref: ' + p.mpesaRef : ''}${p.paidDate ? ' · Paid: ' + p.paidDate : ''}</p><script>window.print();<\/script></body></html>`);
                                w.document.close();
                            }}>🖨️ Print Payslip</button>
                    </div>
                );
            })}
        </div>
    );

    const TAB_COMPONENTS = { home: HomeTab, journeys: JourneysTab, submit: SubmitTab, maintenance: MaintenanceTab, payslips: PayslipsTab };
    const ActiveTab = TAB_COMPONENTS[tab] || HomeTab;

    return (
        <div style={S.page}>
            <div style={S.topbar}>
                <div>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>🚛 {driver.name.split(' ')[0]}</div>
                    <div style={{ color: '#8ab0d8', fontSize: 11 }}>{truck?.reg || 'No truck assigned'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ background: 'none', border: '1px solid #ffffff33', borderRadius: 8, color: '#fff', fontSize: 11, padding: '6px 10px', cursor: 'pointer' }} onClick={() => fetchDriverData(token)}>↻</button>
                    <button style={{ background: 'none', border: '1px solid #ffffff33', borderRadius: 8, color: '#8ab0d8', fontSize: 11, padding: '6px 10px', cursor: 'pointer' }} onClick={logout}>Log out</button>
                </div>
            </div>
            {loading && <div style={{ textAlign: 'center', padding: 40, color: COLORS.textFaint }}>⏳ Loading…</div>}
            {!loading && <ActiveTab />}
            <div style={S.tabBar}>
                {TABS.map(t => (
                    <button key={t.id} style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
                        <span style={{ fontSize: 18 }}>{t.icon}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
```

---

## CHANGE 9 — Update Settings page in App.jsx — replace PIN with email/password

Find the `DriverPINRow` component inside the Settings component in `App.jsx` and replace it entirely:

```jsx
const DriverPINRow = ({ driver }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const saveAccount = async () => {
        if (!email || !email.includes('@')) { setStatus('❌ Enter a valid email'); return; }
        if (!password || password.length < 6) { setStatus('❌ Password must be at least 6 characters'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${PAYMENT_API}/api/driver/set-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: driver.id, email, password, adminKey: ADMIN_KEY }),
            });
            const result = await res.json();
            if (result.success) { setStatus('✅ Login credentials set'); setEmail(''); setPassword(''); }
            else setStatus('❌ ' + result.error);
        } catch { setStatus('❌ Server not reachable'); }
        setLoading(false);
    };

    return (
        <div style={{ padding: '14px 0', borderBottom: `1px solid ${T.border2}` }}>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 13, marginBottom: 10 }}>
                {driver.name}
                <span style={{ fontWeight: 400, color: T.textFaint, marginLeft: 10, fontSize: 11 }}>{driver.phone}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input style={{ ...S.inp, flex: 1, minWidth: 160, marginBottom: 0 }} type="email"
                    placeholder="driver@email.com" value={email}
                    onChange={e => setEmail(e.target.value)} />
                <input style={{ ...S.inp, width: 130, marginBottom: 0 }} type="password"
                    placeholder="Password (6+ chars)" value={password}
                    onChange={e => setPassword(e.target.value)} />
                <button style={S.btn('sm')} onClick={saveAccount} disabled={loading}>
                    {loading ? '⏳' : 'Set Login'}
                </button>
            </div>
            {status && <div style={{ fontSize: 11, color: status.startsWith('✅') ? '#10b981' : '#ef4444', marginTop: 6 }}>{status}</div>}
        </div>
    );
};
```

---

## CHANGE 10 — Add Cloudinary config to Render environment variables

In the Render dashboard for your server, add:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get these from [cloudinary.com](https://cloudinary.com) → Dashboard after signing up for a free account.

---

## Updated final checklist

- [ ] `npm install bcryptjs jsonwebtoken multer cloudinary streamifier` ran in `server/`
- [ ] `server/cloudinary.js` created with Cloudinary upload helper
- [ ] `server/driver-auth.js` replaced — now uses email + password
- [ ] `server/driver-data.js` — maintenance case added, odometer fields added to journey update
- [ ] `server/index.js` — new routes added: `/api/driver/set-account`, `/api/driver/upload`, maintenance submit, updated journey status route
- [ ] `driver-portal/src/App.jsx` replaced with full new version
- [ ] Login screen shows email + password fields (not phone + PIN)
- [ ] Journey tab — starting a trip requires odometer reading + photo
- [ ] Journey tab — completing a trip requires end odometer + photo + delivery proof
- [ ] Submit tab — fuel claim has receipt photo + odometer photo uploads
- [ ] Maintenance tab — new log form + history from truck's expense records
- [ ] All photo uploads go to Cloudinary and return a URL stored on the record
- [ ] Settings in App.jsx — DriverPINRow replaced with email/password fields
- [ ] Cloudinary env vars added to Render dashboard
- [ ] After deployment: test full journey flow — start → upload photos → complete → verify photos visible in server data
