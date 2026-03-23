# Segecha — Automatic Driver Account Creation & Password Reset
# Cursor AI Prompt — Files: server/ + src/App.jsx + driver-portal/src/App.jsx

## What this builds

When admin saves a new driver in the tracker, the system automatically:
1. Creates the driver's portal account (no password yet)
2. Generates a secure time-limited reset token
3. Sends a branded welcome email with a "Set your password" link
4. Driver clicks the link → lands on a Set Password page → sets password → logs in

Password reset also works for existing drivers (Forgot Password flow).

**Email from:** payments@segecha.com (already configured in SendGrid)
**Token expiry:** 72 hours

---

## PART A — Backend (`server/`)

### A.1 — Install one new dependency

```bash
cd server
npm install crypto
```

`crypto` is a Node.js built-in — this just ensures it is available. No new package needed.

---

### A.2 — Replace `server/driver-auth.js` entirely

```js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'drivers-auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'segecha-driver-secret-change-in-production';
const TOKEN_EXPIRY_HOURS = 72;

function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return { drivers: [] }; }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ── Create or update a driver account (called when admin saves a driver)
// If the driver already has a password, preserve it.
// If new, create account without password and issue a reset token.
async function createDriverAccount(driverId, email) {
    const db = readDB();
    const existing = db.drivers.find(d => d.driverId === driverId);

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3600 * 1000).toISOString();

    if (existing) {
        // Update email + issue fresh reset token, preserve existing password if set
        existing.email = email.toLowerCase().trim();
        existing.resetTokenHash = resetTokenHash;
        existing.resetTokenExpiry = resetTokenExpiry;
        existing.updatedAt = new Date().toISOString();
    } else {
        // Brand new account — no password yet
        db.drivers.push({
            driverId,
            email: email.toLowerCase().trim(),
            passwordHash: null,       // null = password not set yet
            resetTokenHash,
            resetTokenExpiry,
            accountStatus: 'pending', // 'pending' | 'active'
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    writeDB(db);
    return { resetToken }; // raw token — send to driver via email, never store raw
}

// ── Admin manually sets a password (legacy — still supported)
async function setDriverPassword(driverId, email, password) {
    const db = readDB();
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = db.drivers.findIndex(d => d.driverId === driverId);
    const record = {
        driverId,
        email: email.toLowerCase().trim(),
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiry: null,
        accountStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    if (existing >= 0) db.drivers[existing] = { ...db.drivers[existing], ...record };
    else db.drivers.push(record);
    writeDB(db);
    return { success: true };
}

// ── Validate a reset token and set a new password
async function resetPasswordWithToken(token, newPassword) {
    if (!token || !newPassword || newPassword.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
    }
    const db = readDB();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = db.drivers.find(d => d.resetTokenHash === tokenHash);

    if (!record) return { success: false, error: 'Invalid or expired reset link. Request a new one.' };
    if (new Date(record.resetTokenExpiry) < new Date()) {
        return { success: false, error: 'This link has expired. Please request a new password reset.' };
    }

    record.passwordHash = await bcrypt.hash(newPassword, 10);
    record.resetTokenHash = null;
    record.resetTokenExpiry = null;
    record.accountStatus = 'active';
    record.updatedAt = new Date().toISOString();
    writeDB(db);

    // Issue a JWT so driver is logged in immediately after setting password
    const loginToken = jwt.sign(
        { driverId: record.driverId, email: record.email },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
    return { success: true, token: loginToken, driverId: record.driverId };
}

// ── Forgot password — issue a new reset token for an existing account
async function requestPasswordReset(email) {
    const db = readDB();
    const record = db.drivers.find(d => d.email === email.toLowerCase().trim());
    if (!record) {
        // Return success even if not found — don't leak whether email is registered
        return { success: true, message: 'If that email is registered, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    record.resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    record.resetTokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3600 * 1000).toISOString();
    record.updatedAt = new Date().toISOString();
    writeDB(db);

    return { success: true, resetToken, email: record.email, driverId: record.driverId };
}

// ── Login with email + password
async function loginDriver(email, password) {
    const db = readDB();
    const record = db.drivers.find(d => d.email === email.toLowerCase().trim());
    if (!record) return { success: false, error: 'Email address not registered. Contact your office.' };
    if (!record.passwordHash) {
        return { success: false, error: 'Your account is pending. Check your email for a setup link or contact your office.' };
    }
    const match = await bcrypt.compare(password, record.passwordHash);
    if (!match) return { success: false, error: 'Incorrect password. Use Forgot Password if needed.' };

    const token = jwt.sign(
        { driverId: record.driverId, email: record.email },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
    return { success: true, token, driverId: record.driverId };
}

// ── Verify JWT token
function verifyToken(token) {
    try { return jwt.verify(token, JWT_SECRET); }
    catch { return null; }
}

// ── Express middleware
function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const payload = verifyToken(auth.slice(7));
    if (!payload) return res.status(401).json({ error: 'Session expired — please log in again' });
    req.driver = payload;
    next();
}

// ── Get account status for a driver (used by tracker Settings page)
function getDriverAccountStatus(driverId) {
    const db = readDB();
    const record = db.drivers.find(d => d.driverId === driverId);
    if (!record) return { exists: false };
    return {
        exists: true,
        email: record.email,
        accountStatus: record.accountStatus,
        hasPassword: !!record.passwordHash,
        hasPendingReset: !!(record.resetTokenHash && new Date(record.resetTokenExpiry) > new Date()),
    };
}

module.exports = {
    createDriverAccount,
    setDriverPassword,
    resetPasswordWithToken,
    requestPasswordReset,
    loginDriver,
    verifyToken,
    authMiddleware,
    getDriverAccountStatus,
};
```

---

### A.3 — Add welcome + reset email to `server/email.js`

Find the end of `server/email.js` (after `sendInvoiceEmail`). Add:

```js
// ── Driver welcome email (sent when account is first created)
async function sendDriverWelcomeEmail({ to, driverName, resetUrl, companyName }) {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#1B3A6B,#0d2347);padding:36px 40px;text-align:center}
.hdr h1{color:#fff;font-size:24px;font-weight:800;margin:0}
.hdr p{color:#8ab0d8;font-size:14px;margin:8px 0 0}
.body{padding:36px 40px}
.greeting{font-size:16px;color:#333;line-height:1.7;margin-bottom:28px}
.steps{background:#f8fafc;border-radius:10px;padding:20px 24px;margin-bottom:28px}
.step{display:flex;gap:12px;margin-bottom:12px;font-size:14px;color:#374151;align-items:flex-start}
.step:last-child{margin-bottom:0}
.num{background:#1B3A6B;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px}
.cta{text-align:center;margin:28px 0}
.cta-btn{display:inline-block;background:linear-gradient(135deg,#E8501A,#d4400f);color:#fff!important;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:16px;font-weight:800}
.cta-sub{font-size:12px;color:#9ca3af;margin-top:10px}
.info-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;font-size:13px;color:#374151;margin-bottom:20px}
.ftr{background:#1B3A6B;padding:20px 40px;text-align:center}
.ftr p{color:#8ab0d8;font-size:12px;margin:3px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>🚛 ${companyName}</h1>
    <p>Driver Portal — Account Setup</p>
  </div>
  <div class="body">
    <div class="greeting">
      Hi <b>${driverName}</b>,<br><br>
      Your driver account has been created by the ${companyName} office.
      Click the button below to set your password and access the driver portal.
    </div>
    <div class="steps">
      <div style="font-weight:700;color:#1B3A6B;font-size:14px;margin-bottom:14px">How to get started:</div>
      <div class="step"><span class="num">1</span><span>Click the button below</span></div>
      <div class="step"><span class="num">2</span><span>Choose a secure password (at least 8 characters)</span></div>
      <div class="step"><span class="num">3</span><span>Log in to the driver portal with your email and password</span></div>
      <div class="step"><span class="num">4</span><span>View your journeys, submit fuel claims, and check your payslips</span></div>
    </div>
    <div class="cta">
      <a href="${resetUrl}" class="cta-btn">Set My Password →</a>
      <div class="cta-sub">This link expires in 72 hours</div>
    </div>
    <div class="info-box">
      <b>Your login email:</b> ${to}<br>
      <b>Portal address:</b> driver.segecha.com<br><br>
      If you did not expect this email, contact your office manager.
    </div>
  </div>
  <div class="ftr">
    <p><b>${companyName}</b> · Nairobi, Kenya</p>
    <p>Do not share this link with anyone.</p>
  </div>
</div>
</body>
</html>`;

    await sgMail.send({
        to,
        from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME },
        subject: `Set up your ${companyName} driver portal account`,
        html,
        text: `Hi ${driverName},\n\nYour driver account has been created.\nSet your password here: ${resetUrl}\n\nThis link expires in 72 hours.\n\n${companyName}`,
    });
}

// ── Password reset email (forgot password flow)
async function sendPasswordResetEmail({ to, driverName, resetUrl, companyName }) {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#1B3A6B,#0d2347);padding:32px 40px;text-align:center}
.hdr h1{color:#fff;font-size:22px;font-weight:800;margin:0}
.body{padding:32px 40px}
.text{font-size:15px;color:#374151;line-height:1.7;margin-bottom:24px}
.cta{text-align:center;margin:24px 0}
.cta-btn{display:inline-block;background:linear-gradient(135deg,#E8501A,#d4400f);color:#fff!important;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:800}
.sub{font-size:12px;color:#9ca3af;text-align:center;margin-top:10px}
.warn{background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin-top:20px}
.ftr{background:#1B3A6B;padding:18px 40px;text-align:center}
.ftr p{color:#8ab0d8;font-size:12px;margin:3px 0}
</style></head>
<body>
<div class="wrap">
  <div class="hdr"><h1>🔐 Password Reset</h1></div>
  <div class="body">
    <div class="text">Hi <b>${driverName}</b>,<br><br>We received a request to reset your password for the ${companyName} driver portal. Click the button below to choose a new password.</div>
    <div class="cta">
      <a href="${resetUrl}" class="cta-btn">Reset My Password →</a>
    </div>
    <div class="sub">This link expires in 72 hours</div>
    <div class="warn">⚠️ If you didn't request a password reset, ignore this email. Your account is safe.</div>
  </div>
  <div class="ftr">
    <p><b>${companyName}</b> · Nairobi, Kenya</p>
    <p>Do not share this link with anyone.</p>
  </div>
</div>
</body>
</html>`;

    await sgMail.send({
        to,
        from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME },
        subject: `Reset your ${companyName} driver portal password`,
        html,
        text: `Hi ${driverName},\n\nReset your password here: ${resetUrl}\n\nThis link expires in 72 hours.\nIf you didn't request this, ignore this email.\n\n${companyName}`,
    });
}

module.exports = { sendInvoiceEmail, sendDriverWelcomeEmail, sendPasswordResetEmail };
```

---

### A.4 — Add new routes to `server/index.js`

Find the driver auth routes section. **Replace** the existing `POST /api/driver/set-account` route and **add** three new routes:

```js
// ── Auto-create driver account + send welcome email (called when admin saves a driver)
app.post('/api/driver/create-account', async (req, res) => {
    const { driverId, email, driverName, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!driverId || !email || !driverName) return res.status(400).json({ error: 'driverId, email, and driverName are required' });
    try {
        const { createDriverAccount } = require('./driver-auth');
        const { sendDriverWelcomeEmail } = require('./email');

        const { resetToken } = await createDriverAccount(driverId, email);
        const resetUrl = `${process.env.DRIVER_PORTAL_URL || 'https://driver.segecha.com'}/set-password?token=${resetToken}`;
        const companyName = process.env.COMPANY_NAME || 'Segecha Group Ltd';

        await sendDriverWelcomeEmail({ to: email, driverName, resetUrl, companyName });

        res.json({
            success: true,
            message: `Account created and welcome email sent to ${email}`,
        });
    } catch (err) {
        console.error('Create account error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to create account' });
    }
});

// ── Resend welcome email / new setup link (admin action from Settings)
app.post('/api/driver/resend-setup', async (req, res) => {
    const { driverId, email, driverName, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { createDriverAccount } = require('./driver-auth');
        const { sendDriverWelcomeEmail } = require('./email');

        const { resetToken } = await createDriverAccount(driverId, email);
        const resetUrl = `${process.env.DRIVER_PORTAL_URL || 'https://driver.segecha.com'}/set-password?token=${resetToken}`;

        await sendDriverWelcomeEmail({
            to: email,
            driverName,
            resetUrl,
            companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
        });

        res.json({ success: true, message: `New setup link sent to ${email}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Forgot password (driver requests reset from portal login page)
app.post('/api/driver/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    try {
        const { requestPasswordReset } = require('./driver-auth');
        const { sendPasswordResetEmail } = require('./email');
        const { readTrackerData } = require('./driver-data');

        const result = await requestPasswordReset(email);

        // If account found, send the reset email
        if (result.resetToken) {
            const trackerData = readTrackerData();
            const driver = trackerData.drivers?.find(d => d.id === result.driverId);
            const driverName = driver?.name || 'Driver';
            const resetUrl = `${process.env.DRIVER_PORTAL_URL || 'https://driver.segecha.com'}/set-password?token=${result.resetToken}`;

            await sendPasswordResetEmail({
                to: result.email,
                driverName,
                resetUrl,
                companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
            });
        }

        // Always return success — don't reveal whether email is registered
        res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Set / reset password using token (driver lands on set-password page)
app.post('/api/driver/set-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    try {
        const { resetPasswordWithToken } = require('./driver-auth');
        const result = await resetPasswordWithToken(token, password);
        if (result.success) res.json(result);
        else res.status(400).json({ error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get driver account status (for Settings page display)
app.get('/api/driver/account-status/:driverId', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { getDriverAccountStatus } = require('./driver-auth');
        res.json(getDriverAccountStatus(req.params.driverId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin manually sets password (keep for backward compatibility)
app.post('/api/driver/set-account', async (req, res) => {
    const { driverId, email, password, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!driverId || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'driverId, email, and password (6+ chars) required' });
    }
    try {
        const { setDriverPassword } = require('./driver-auth');
        await setDriverPassword(driverId, email, password);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

Also add to `server/.env`:
```env
DRIVER_PORTAL_URL=https://driver.segecha.com
```

---

### A.5 — Add `driver-auth.json` initial schema update

The `drivers-auth.json` file now stores extra fields. It stays backward-compatible — existing records without `accountStatus` are treated as `active`.

No migration needed. New fields are added on first write.

---

## PART B — Main Tracker (`src/App.jsx`)

### B.1 — Auto-create account when saving a new driver

Find the `saveItem` call inside the Add Driver modal's save handler. In your existing code, when saving a driver it calls something like:

```jsx
onSave={() => saveItem("drivers", form)}
```

Replace with:

```jsx
onSave={async () => {
    const isNew = !form.id;
    saveItem("drivers", form);

    // Auto-create portal account for new drivers who have an email
    if (isNew && form.email && form.email.includes('@')) {
        try {
            const res = await fetch(`${PAYMENT_API}/api/driver/create-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driverId: form.id || uid(), // uid() is already used in saveItem
                    email: form.email,
                    driverName: form.name,
                    adminKey: ADMIN_KEY,
                }),
            });
            const result = await res.json();
            if (result.success) {
                // Show a non-blocking toast or console note
                console.log(`✅ Portal account created — welcome email sent to ${form.email}`);
            }
        } catch (err) {
            console.warn('Portal account creation failed (server may not be running):', err.message);
        }
    }
}}
```

**Important:** The account creation is fire-and-forget — it does not block the save. If the server is offline, the driver record is still saved locally. The admin can resend the email from the Driver Access tab in Settings.

---

### B.2 — Add email field to the Driver form

Find the Driver modal form. Add an email field. Find:

```jsx
<F label="Phone" k="phone" />
```

After it, add:

```jsx
<F label="Email Address" k="email" type="email" placeholder="driver@email.com" />
```

This email is used for portal login. If blank, no account is auto-created.

---

### B.3 — Update the Driver Access section in Settings

Find the `drivers` panel inside the Settings component (`id === 'drivers'`). Replace the entire Driver Login Credentials card with this improved version that shows account status and a Resend button:

```jsx
{card(<>
    {cardTitle('Driver portal credentials')}
    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14, lineHeight: 1.6 }}>
        Portal accounts are <b>created automatically</b> when you add a driver with an email address.
        The driver receives a setup email with a link to set their password.
        Use Resend below if a driver didn't receive their email.
    </div>
    <div style={{ overflowX: 'auto' }}>
        <table style={{ ...S.tbl, minWidth: 540 }}>
            <thead>
                <tr>{['Driver', 'Email', 'Account status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
                {data.drivers.map(d => (
                    <DriverAccountRow key={d.id} driver={d} />
                ))}
            </tbody>
        </table>
    </div>
</>)}
```

Add the `DriverAccountRow` component inside the Settings component (before the `return`):

```jsx
const DriverAccountRow = ({ driver }) => {
    const [status, setStatus] = useState(null); // null = not loaded yet
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState('');

    useEffect(() => {
        if (!driver.email) return;
        fetch(`${PAYMENT_API}/api/driver/account-status/${driver.id}?adminKey=${ADMIN_KEY}`)
            .then(r => r.json())
            .then(setStatus)
            .catch(() => setStatus({ exists: false }));
    }, [driver.id]);

    const resend = async () => {
        if (!driver.email) { setResendMsg('❌ No email on this driver record'); return; }
        setResending(true); setResendMsg('');
        try {
            const res = await fetch(`${PAYMENT_API}/api/driver/resend-setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: driver.id, email: driver.email, driverName: driver.name, adminKey: ADMIN_KEY }),
            });
            const result = await res.json();
            setResendMsg(result.success ? '✅ Email sent' : '❌ ' + result.error);
            if (result.success) setStatus(s => ({ ...s, exists: true, hasPendingReset: true }));
        } catch { setResendMsg('❌ Server not reachable'); }
        setResending(false);
    };

    const statusBadge = () => {
        if (!driver.email) return <span style={{ fontSize: 11, color: T.textFaint }}>No email set</span>;
        if (!status) return <span style={{ fontSize: 11, color: T.textFaint }}>⏳ Checking…</span>;
        if (!status.exists) return <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>⚠ No account</span>;
        if (!status.hasPassword) return <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⏳ Pending setup</span>;
        return <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✅ Active</span>;
    };

    return (
        <tr>
            <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{driver.name}</td>
            <td style={{ ...S.td, fontSize: 12, color: T.textDim, fontFamily: 'monospace' }}>
                {driver.email || <span style={{ color: T.textFaint, fontStyle: 'italic' }}>not set — edit driver to add</span>}
            </td>
            <td style={S.td}>{statusBadge()}</td>
            <td style={S.td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={S.btn('sm')} onClick={resend} disabled={resending || !driver.email}>
                        {resending ? '⏳' : status?.hasPassword ? '🔄 Resend reset' : '📧 Resend setup'}
                    </button>
                    {resendMsg && <span style={{ fontSize: 11, color: resendMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{resendMsg}</span>}
                </div>
            </td>
        </tr>
    );
};
```

---

## PART C — Driver Portal (`driver-portal/src/App.jsx`)

### C.1 — Add Set Password page

The driver portal needs to handle the `/set-password?token=XXX` URL. This page is shown when the driver clicks the link in their welcome or reset email.

Find the top of `driver-portal/src/App.jsx`, after the `uploadFile` function. Add this component:

```jsx
// ── Set Password page (handles welcome link + forgot password link)
const SetPasswordPage = ({ token, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const submit = async () => {
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        if (password !== confirm) { setError('Passwords do not match'); return; }
        setLoading(true); setError('');
        try {
            const res = await fetch(`${API}/api/driver/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (data.token) {
                localStorage.setItem('driver_token', data.token);
                setDone(true);
                setTimeout(() => onSuccess(data.token), 1500);
            } else {
                setError(data.error || 'Failed to set password. The link may have expired — contact your office.');
            }
        } catch { setError('Could not connect to server. Try again.'); }
        setLoading(false);
    };

    const strength = password.length === 0 ? null : password.length < 8 ? 'weak' : password.length < 12 ? 'good' : 'strong';
    const strengthColor = { weak: '#ef4444', good: '#f97316', strong: '#10b981' };
    const strengthLabel = { weak: 'Too short', good: 'Good', strong: 'Strong' };

    return (
        <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, #0d1b35, ${COLORS.primary} 60%, #0d2347)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>🔐</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.primary, marginBottom: 4 }}>
                        {done ? 'Password set!' : 'Set your password'}
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.textFaint }}>
                        {done ? 'Logging you in…' : 'Choose a secure password for your driver portal account'}
                    </div>
                </div>

                {done ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#10b981', fontWeight: 700, fontSize: 15 }}>
                        ✅ Taking you to your dashboard…
                    </div>
                ) : (
                    <>
                        {error && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
                                {error}
                            </div>
                        )}

                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>New password</label>
                        <input style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 6, fontFamily: 'inherit' }}
                            type="password" placeholder="At least 8 characters" value={password}
                            onChange={e => setPassword(e.target.value)} />

                        {/* Strength indicator */}
                        {strength && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: strength === 'weak' ? '33%' : strength === 'good' ? '66%' : '100%', background: strengthColor[strength], borderRadius: 2, transition: 'width .3s' }} />
                                </div>
                                <span style={{ fontSize: 11, color: strengthColor[strength], fontWeight: 600 }}>{strengthLabel[strength]}</span>
                            </div>
                        )}

                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Confirm password</label>
                        <input style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${confirm && confirm !== password ? '#ef4444' : COLORS.border}`, fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 4, fontFamily: 'inherit' }}
                            type="password" placeholder="Repeat your password" value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && submit()} />
                        {confirm && confirm !== password && (
                            <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>Passwords do not match</div>
                        )}

                        <button style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#E8501A,#d4400f)', color: '#fff', marginTop: 12 }}
                            onClick={submit} disabled={loading}>
                            {loading ? '⏳ Setting password…' : 'Set Password & Log In'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
```

### C.2 — Add Forgot Password section to the login screen

Find the login screen in `driver-portal/src/App.jsx`. After the Log In button, add:

```jsx
<div style={{ textAlign: 'center', marginTop: 16 }}>
    <ForgotPassword />
</div>
```

Add the `ForgotPassword` component just before the `export default`:

```jsx
const ForgotPassword = () => {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const submit = async () => {
        if (!email.includes('@')) { setMsg('Enter a valid email address'); return; }
        setLoading(true); setMsg('');
        try {
            const res = await fetch(`${API}/api/driver/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            setMsg('✅ ' + (data.message || 'If that email is registered, a reset link has been sent.'));
        } catch { setMsg('❌ Could not connect. Try again.'); }
        setLoading(false);
    };

    if (!open) {
        return (
            <button style={{ background: 'none', border: 'none', color: COLORS.textFaint, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setOpen(true)}>
                Forgot password?
            </button>
        );
    }

    return (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginTop: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Reset your password</div>
            {msg ? (
                <div style={{ fontSize: 13, color: msg.startsWith('✅') ? '#10b981' : '#ef4444', fontWeight: 600, marginBottom: 8 }}>{msg}</div>
            ) : null}
            {!msg?.startsWith('✅') && (
                <>
                    <input style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${COLORS.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit' }}
                        type="email" placeholder="your@email.com" value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submit()} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: 'linear-gradient(135deg,#E8501A,#d4400f)', color: '#fff' }}
                            onClick={submit} disabled={loading}>
                            {loading ? '⏳ Sending…' : 'Send reset link'}
                        </button>
                        <button style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontSize: 13, background: 'none', color: COLORS.textFaint }}
                            onClick={() => { setOpen(false); setMsg(''); }}>
                            Cancel
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
```

### C.3 — Wire the Set Password page into the app router

Find the top-level render in `driver-portal/src/App.jsx`, where it checks `if (!token || !driverData)` to show the login screen. **Before** that check, add:

```jsx
// Check if the URL contains a password reset/setup token
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('token');
const isSetPasswordPage = window.location.pathname === '/set-password' && resetToken;

if (isSetPasswordPage) {
    return (
        <SetPasswordPage
            token={resetToken}
            onSuccess={(newToken) => {
                setToken(newToken);
                // Remove token from URL without reloading
                window.history.replaceState({}, '', '/');
            }}
        />
    );
}
```

---

## PART D — Deployment: add `DRIVER_PORTAL_URL` to Render

In your Render dashboard, add this environment variable to the server service:

```
DRIVER_PORTAL_URL=https://driver.segecha.com
```

---

## Full flow summary

### New driver created by admin

```
Admin adds driver with email →
  saveItem("drivers", form) runs (saves locally) →
  POST /api/driver/create-account called →
    account created (no password) →
    reset token generated (72h expiry) →
    welcome email sent →
      driver receives "Set your password" email →
        clicks link (driver.segecha.com/set-password?token=XXX) →
          SetPasswordPage renders →
            driver enters password (strength meter shown) →
              POST /api/driver/set-password →
                password hashed and stored →
                JWT issued →
                  driver logged in immediately → dashboard
```

### Forgot password

```
Driver on login page →
  clicks "Forgot password?" →
    enters email →
      POST /api/driver/forgot-password →
        new reset token generated →
        reset email sent →
          driver clicks link →
            SetPasswordPage renders (same page, same flow)
```

### Admin resends setup email

```
Settings → Driver Access →
  driver row shows "⏳ Pending setup" status →
  admin clicks "Resend setup" →
    POST /api/driver/resend-setup →
      new token generated (old one invalidated) →
      fresh welcome email sent
```

---

## Checklist after implementing

- [ ] Add driver form has an Email field
- [ ] Saving a new driver with an email → welcome email arrives in inbox
- [ ] Welcome email has the driver's name, Segecha branding, 4-step instructions, and the Set Password button
- [ ] Clicking the button in the email opens `driver.segecha.com/set-password?token=XXX`
- [ ] Set Password page shows password strength indicator
- [ ] Passwords under 8 chars are blocked with a clear error
- [ ] Mismatched passwords show inline error before submit
- [ ] After setting password, driver is logged in automatically (no second login step)
- [ ] Token from URL is removed from the address bar after login
- [ ] Expired token (>72h) shows a clear "link expired" message with advice to contact office
- [ ] Invalid token shows "invalid or expired" message
- [ ] Login screen has "Forgot password?" link
- [ ] Forgot password flow sends a reset email
- [ ] Reset email arrives with the Segecha branding and a reset link
- [ ] Settings → Driver Access shows three account statuses: No account / Pending setup / Active
- [ ] "Resend setup" button sends a fresh email and updates status to "Pending setup"
- [ ] Saving a driver without an email skips account creation silently (no error)
- [ ] Server being offline does not block the driver save (fire-and-forget)
- [ ] `DRIVER_PORTAL_URL` is set in Render env vars so reset links point to the right domain
