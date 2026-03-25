const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'drivers-auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'segecha-driver-secret-change-in-production';
const TOKEN_EXPIRY_HOURS = 72;
const OTP_EXPIRY_MINUTES = 30;

function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return { drivers: [] }; }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function normalizeSegechaEmail(email, fallbackSeed = '') {
    const raw = String(email || fallbackSeed || '').trim().toLowerCase();
    const localPart = (raw.includes('@') ? raw.split('@')[0] : raw)
        .replace(/[^a-z0-9._-]/g, '.')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+|\.+$/g, '');
    return `${localPart || 'driver'}.@segecha.com`.replace('.@', '@');
}

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.startsWith('254') && digits.length === 12) return `0${digits.slice(3)}`;
    if (digits.length === 9 && digits.startsWith('7')) return `0${digits}`;
    return digits;
}

function emailCandidates(identifier) {
    const raw = String(identifier || '').trim().toLowerCase();
    if (!raw) return [];
    const set = new Set([raw, normalizeSegechaEmail(raw, raw)]);
    if (raw.includes('@')) {
        const local = raw.split('@')[0];
        set.add(normalizeSegechaEmail(local, local));
    }
    return Array.from(set).filter(Boolean);
}

function findDriverRecord(db, identifier) {
    const emails = emailCandidates(identifier);
    const phone = normalizePhone(identifier);
    return db.drivers.find((d) => {
        const accountEmail = String(d.email || '').trim().toLowerCase();
        const emailMatch = emails.includes(accountEmail);
        const phoneMatch = !!phone && normalizePhone(d.phone) === phone;
        return emailMatch || phoneMatch;
    });
}

function hashValue(v) {
    return crypto.createHash('sha256').update(String(v)).digest('hex');
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateTempPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let out = 'Sg-';
    for (let i = 0; i < 9; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
}

function issueSetupToken(record) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    record.resetTokenHash = hashValue(resetToken);
    record.resetTokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3600 * 1000).toISOString();
    return resetToken;
}

// ── Create or update a driver account (called when admin saves a driver)
// If the driver already has a password, preserve it.
// If new, create account without password and issue a reset token.
async function createDriverAccount(driverId, email, phone = '') {
    const db = readDB();
    const existing = db.drivers.find(d => d.driverId === driverId);
    const canonicalEmail = normalizeSegechaEmail(email);
    const canonicalPhone = normalizePhone(phone);
    const otp = generateOtp();
    const tempPassword = generateTempPassword();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

    let resetToken = '';
    if (existing) {
        existing.email = canonicalEmail;
        existing.phone = canonicalPhone || existing.phone || '';
        existing.otpHash = hashValue(otp);
        existing.otpExpiry = otpExpiry;
        existing.tempPasswordHash = tempPasswordHash;
        existing.requirePasswordChange = true;
        resetToken = issueSetupToken(existing);
        existing.updatedAt = new Date().toISOString();
    } else {
        const record = {
            driverId,
            email: canonicalEmail,
            phone: canonicalPhone,
            passwordHash: null,
            tempPasswordHash,
            otpHash: hashValue(otp),
            otpExpiry,
            requirePasswordChange: true,
            accountStatus: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        resetToken = issueSetupToken(record);
        db.drivers.push(record);
    }

    writeDB(db);
    return { success: true, resetToken, otp, tempPassword, email: canonicalEmail, phone: canonicalPhone };
}

// ── Admin manually sets a password (legacy — still supported)
async function setDriverPassword(driverId, email, password) {
    const db = readDB();
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = db.drivers.findIndex(d => d.driverId === driverId);
    const record = {
        driverId,
        email: normalizeSegechaEmail(email),
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiry: null,
        otpHash: null,
        otpExpiry: null,
        tempPasswordHash: null,
        requirePasswordChange: false,
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
    record.tempPasswordHash = null;
    record.otpHash = null;
    record.otpExpiry = null;
    record.requirePasswordChange = false;
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
async function requestPasswordReset(identifier) {
    const db = readDB();
    const record = findDriverRecord(db, identifier);
    if (!record) {
        return { success: true, message: 'If that email is registered, a reset link has been sent.' };
    }
    const resetToken = issueSetupToken(record);
    record.updatedAt = new Date().toISOString();
    writeDB(db);

    return { success: true, resetToken, email: record.email, driverId: record.driverId };
}

async function regenerateDriverCredentials(driverId, { email, phone, forcePasswordReset = true } = {}) {
    const db = readDB();
    const record = db.drivers.find(d => d.driverId === driverId);
    if (!record) {
        return createDriverAccount(driverId, email || driverId, phone || '');
    }
    const canonicalEmail = normalizeSegechaEmail(email || record.email);
    const canonicalPhone = normalizePhone(phone || record.phone);
    const otp = generateOtp();
    const tempPassword = generateTempPassword();

    record.email = canonicalEmail;
    record.phone = canonicalPhone;
    record.otpHash = hashValue(otp);
    record.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    record.tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    record.requirePasswordChange = true;
    record.preferredMethod = null; // Reset preference on credential regeneration
    if (forcePasswordReset) record.passwordHash = null;
    const resetToken = issueSetupToken(record);
    record.updatedAt = new Date().toISOString();
    writeDB(db);

    return { success: true, otp, tempPassword, resetToken, email: canonicalEmail, phone: canonicalPhone };
}

// ── Login with phone/email + password/otp/temp password
// method: 'email' | 'phone'
async function loginDriver(identifier, secret, method) {
    const db = readDB();
    const record = findDriverRecord(db, identifier);
    if (!record) return { success: false, error: 'Account not found. Contact your office.' };

    const secretRaw = String(secret || '');
    const now = new Date();

    // Check preferred method lock
    if (record.preferredMethod && method && record.preferredMethod !== method) {
        return {
            success: false,
            error: `Your account is set up for login via ${record.preferredMethod}. Please use the ${record.preferredMethod} tab.`,
        };
    }

    if (record.requirePasswordChange) {
        // Enforce specific secrets per tab during first login
        if (method === 'email') {
            const tempValid = !!(record.tempPasswordHash && await bcrypt.compare(secretRaw, record.tempPasswordHash));
            if (!tempValid) return { success: false, error: 'Incorrect temporary password. Use the one provided by the office for Email login.' };
        } else if (method === 'phone') {
            const otpValid = !!(record.otpHash && record.otpExpiry && new Date(record.otpExpiry) > now && hashValue(secretRaw) === record.otpHash);
            if (!otpValid) return { success: false, error: 'Invalid or expired OTP. Use the latest one sent to your phone or from the office.' };
        } else {
            // Fallback for older clients or mixed logic
            const otpValid = !!(record.otpHash && record.otpExpiry && new Date(record.otpExpiry) > now && hashValue(secretRaw) === record.otpHash);
            const tempValid = !!(record.tempPasswordHash && await bcrypt.compare(secretRaw, record.tempPasswordHash));
            if (!otpValid && !tempValid) {
                return {
                    success: false,
                    error: 'Use the latest OTP or temporary password from the office. Older credentials expire after regeneration.',
                };
            }
        }

        // Lock the preferred method on first success
        if (method) record.preferredMethod = method;

        const setupToken = issueSetupToken(record);
        record.updatedAt = new Date().toISOString();
        writeDB(db);
        return {
            success: true,
            requirePasswordChange: true,
            setupToken,
            driverId: record.driverId,
            email: record.email,
        };
    }

    if (!record.passwordHash) {
        return { success: false, error: 'Your account is pending setup. Contact your office for OTP / temporary password.' };
    }
    const match = await bcrypt.compare(secretRaw, record.passwordHash);
    if (!match) return { success: false, error: 'Incorrect password. If this is your first login, ask admin for the latest OTP/temp password.' };

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
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
        const payload = verifyToken(auth.slice(7));
        if (!payload) return res.status(401).json({ error: 'Session expired — please log in again' });
        req.driver = payload;
        next();
    } catch (e) {
        console.error('AUTH_MIDDLEWARE_ERROR:', e);
        next(e); // Pass to global error handler
    }
}

// ── Get account status for a driver (used by tracker Settings page)
function getDriverAccountStatus(driverId) {
    const db = readDB();
    const record = db.drivers.find(d => d.driverId === driverId);
    if (!record) return { exists: false };
    return {
        exists: true,
        email: record.email,
        phone: record.phone || '',
        accountStatus: record.accountStatus,
        hasPassword: !!record.passwordHash,
        requiresPasswordChange: !!record.requirePasswordChange,
        hasOtp: !!(record.otpHash && new Date(record.otpExpiry) > new Date()),
        hasTempPassword: !!record.tempPasswordHash,
        hasPendingReset: !!(record.resetTokenHash && new Date(record.resetTokenExpiry) > new Date()),
    };
}

function exportDriverAccount(driverId) {
    const db = readDB();
    const record = db.drivers.find(d => d.driverId === driverId);
    if (!record) return null;
    return {
        driverId: record.driverId,
        email: record.email,
        phone: record.phone || '',
        accountStatus: record.accountStatus || 'pending',
        requirePasswordChange: !!record.requirePasswordChange,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

function deleteDriverAccount(driverId) {
    const db = readDB();
    const before = db.drivers.length;
    db.drivers = db.drivers.filter(d => d.driverId !== driverId);
    if (db.drivers.length === before) return false;
    writeDB(db);
    return true;
}

module.exports = {
    normalizeSegechaEmail,
    normalizePhone,
    createDriverAccount,
    setDriverPassword,
    resetPasswordWithToken,
    requestPasswordReset,
    regenerateDriverCredentials,
    loginDriver,
    verifyToken,
    authMiddleware,
    getDriverAccountStatus,
    exportDriverAccount,
    deleteDriverAccount,
};
