const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'staff-auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'segecha-driver-secret-change-in-production';
const TOKEN_EXPIRY_HOURS = 72;
const OTP_EXPIRY_MINUTES = 30;

function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return { staff: [] }; }
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
    return `${localPart || 'staff'}@segecha.com`;
}

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.startsWith('254') && digits.length === 12) return `0${digits.slice(3)}`;
    if (digits.length === 9 && digits.startsWith('7')) return `0${digits}`;
    return digits;
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

async function createStaffAccount(staffId, email, phone = '') {
    const db = readDB();
    const existing = db.staff.find(s => s.staffId === staffId);
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
            staffId,
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
        db.staff.push(record);
    }
    writeDB(db);
    return { success: true, resetToken, otp, tempPassword, email: canonicalEmail, phone: canonicalPhone };
}

async function regenerateStaffCredentials(staffId, { email, phone, forcePasswordReset = true } = {}) {
    const db = readDB();
    const record = db.staff.find(s => s.staffId === staffId);
    if (!record) {
        return createStaffAccount(staffId, email || staffId, phone || '');
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
    if (forcePasswordReset) record.passwordHash = null;
    const resetToken = issueSetupToken(record);
    record.updatedAt = new Date().toISOString();
    writeDB(db);
    return { success: true, resetToken, otp, tempPassword, email: canonicalEmail, phone: canonicalPhone };
}

async function resetStaffPasswordWithToken(token, newPassword) {
    if (!token || !newPassword || newPassword.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
    }
    const db = readDB();
    const tokenHash = hashValue(token);
    const record = db.staff.find(s => s.resetTokenHash === tokenHash);
    if (!record) return { success: false, error: 'Invalid or expired reset link. Request a new one.' };
    if (new Date(record.resetTokenExpiry) < new Date()) return { success: false, error: 'This link has expired.' };

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

    const tokenOut = jwt.sign({ staffId: record.staffId, email: record.email, role: 'staff' }, JWT_SECRET, { expiresIn: '12h' });
    return { success: true, token: tokenOut, staffId: record.staffId };
}

async function loginStaff(identifier, secret) {
    const db = readDB();
    const id = String(identifier || '').trim().toLowerCase();
    const phone = normalizePhone(identifier);
    const record = db.staff.find(s => s.email === id || normalizePhone(s.phone) === phone);
    if (!record) return { success: false, error: 'Account not found. Contact your office.' };

    const secretRaw = String(secret || '');
    const now = new Date();

    if (record.requirePasswordChange) {
        const otpValid = !!(record.otpHash && record.otpExpiry && new Date(record.otpExpiry) > now && hashValue(secretRaw) === record.otpHash);
        const tempValid = !!(record.tempPasswordHash && await bcrypt.compare(secretRaw, record.tempPasswordHash));
        if (!otpValid && !tempValid) {
            return { success: false, error: 'Use the temporary password or OTP from the office, then set a new password.' };
        }
        const setupToken = issueSetupToken(record);
        record.updatedAt = new Date().toISOString();
        writeDB(db);
        return { success: true, requirePasswordChange: true, setupToken, staffId: record.staffId, email: record.email };
    }

    if (!record.passwordHash) return { success: false, error: 'Your account is pending setup.' };
    const match = await bcrypt.compare(secretRaw, record.passwordHash);
    if (!match) return { success: false, error: 'Incorrect password.' };

    const token = jwt.sign({ staffId: record.staffId, email: record.email, role: 'staff' }, JWT_SECRET, { expiresIn: '12h' });
    return { success: true, token, staffId: record.staffId };
}

async function requestStaffPasswordReset(identifier) {
    const db = readDB();
    const id = String(identifier || '').trim().toLowerCase();
    const phone = normalizePhone(identifier);
    const record = db.staff.find(s => s.email === id || normalizePhone(s.phone) === phone);
    if (!record) return { success: true, message: 'If that account is registered, a reset link has been sent.' };
    const resetToken = issueSetupToken(record);
    record.updatedAt = new Date().toISOString();
    writeDB(db);
    return { success: true, resetToken, email: record.email, staffId: record.staffId };
}

function getStaffAccountStatus(staffId) {
    const db = readDB();
    const record = db.staff.find(s => s.staffId === staffId);
    if (!record) return { exists: false };
    return {
        exists: true,
        email: record.email,
        phone: record.phone || '',
        accountStatus: record.accountStatus || 'pending',
        hasPassword: !!record.passwordHash,
        requiresPasswordChange: !!record.requirePasswordChange,
        hasOtp: !!(record.otpHash && new Date(record.otpExpiry) > new Date()),
        hasTempPassword: !!record.tempPasswordHash,
        hasPendingReset: !!(record.resetTokenHash && new Date(record.resetTokenExpiry) > new Date()),
    };
}

function exportStaffAccount(staffId) {
    const db = readDB();
    const record = db.staff.find(s => s.staffId === staffId);
    if (!record) return null;
    return {
        staffId: record.staffId,
        email: record.email,
        phone: record.phone || '',
        accountStatus: record.accountStatus || 'pending',
        requirePasswordChange: !!record.requirePasswordChange,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

function deleteStaffAccount(staffId) {
    const db = readDB();
    const before = db.staff.length;
    db.staff = db.staff.filter(s => s.staffId !== staffId);
    if (db.staff.length === before) return false;
    writeDB(db);
    return true;
}

module.exports = {
    normalizeSegechaEmail,
    createStaffAccount,
    regenerateStaffCredentials,
    resetStaffPasswordWithToken,
    requestStaffPasswordReset,
    loginStaff,
    getStaffAccountStatus,
    exportStaffAccount,
    deleteStaffAccount,
};
