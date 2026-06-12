const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const {
    JWT_SECRET,
    normalizePhone,
    normalizeSegechaEmail,
    hashValue,
    generateOtp,
    generateTempPassword,
    issueSetupTokenData,
    OTP_EXPIRY_MINUTES
} = require('./auth-utils');

function normalizeDriverEmail(email, fallbackSeed = '') {
    return normalizeSegechaEmail(email, fallbackSeed, 'driver');
}

function emailCandidates(identifier) {
    const raw = String(identifier || '').trim().toLowerCase();
    if (!raw) return [];
    const set = new Set([raw, normalizeDriverEmail(raw, raw)]);
    if (raw.includes('@')) {
        const local = raw.split('@')[0];
        set.add(normalizeDriverEmail(local, local));
    }
    return Array.from(set).filter(Boolean);
}

async function findDriverRecord(identifier) {
    const emails = emailCandidates(identifier);
    const phone = normalizePhone(identifier);
    
    // Find by any of the email candidates or phone
    const query = `
        SELECT * FROM driver_auth 
        WHERE email = ANY($1) 
        OR (phone IS NOT NULL AND phone = $2)
        LIMIT 1
    `;
    const res = await db.query(query, [emails, phone]);
    return res.rows[0];
}

// Helper functions moved to auth-utils.js

async function createDriverAccount(driverId, email, phone = '') {
    const canonicalEmail = normalizeDriverEmail(email);
    const canonicalPhone = normalizePhone(phone);
    const otp = generateOtp();
    const tempPassword = generateTempPassword();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    const tokenData = issueSetupTokenData();

    await db.query(`
        INSERT INTO driver_auth (driver_id, email, phone, temp_password_hash, otp_hash, otp_expiry, reset_token_hash, reset_token_expiry, require_password_change, account_status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'pending', CURRENT_TIMESTAMP)
        ON CONFLICT (driver_id) DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            otp_hash = EXCLUDED.otp_hash,
            otp_expiry = EXCLUDED.otp_expiry,
            temp_password_hash = EXCLUDED.temp_password_hash,
            reset_token_hash = EXCLUDED.reset_token_hash,
            reset_token_expiry = EXCLUDED.reset_token_expiry,
            require_password_change = TRUE,
            updated_at = CURRENT_TIMESTAMP
    `, [driverId, canonicalEmail, canonicalPhone, tempPasswordHash, hashValue(otp), otpExpiry, tokenData.hash, tokenData.expiry]);

    return { success: true, resetToken: tokenData.resetToken, otp, tempPassword, email: canonicalEmail, phone: canonicalPhone };
}

async function setDriverPassword(driverId, email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(`
        INSERT INTO driver_auth (driver_id, email, password_hash, require_password_change, account_status, updated_at)
        VALUES ($1, $2, $3, FALSE, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (driver_id) DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            require_password_change = FALSE,
            account_status = 'active',
            updated_at = CURRENT_TIMESTAMP
    `, [driverId, normalizeDriverEmail(email), passwordHash]);
    return { success: true };
}

async function resetPasswordWithToken(token, newPassword) {
    if (!token || !newPassword || newPassword.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
    }
    const tokenHash = hashValue(token);
    const res = await db.query('SELECT * FROM driver_auth WHERE reset_token_hash = $1 AND reset_token_expiry > CURRENT_TIMESTAMP', [tokenHash]);
    const record = res.rows[0];

    if (!record) return { success: false, error: 'Invalid or expired reset link. Request a new one.' };

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(`
        UPDATE driver_auth SET 
            password_hash = $1, 
            reset_token_hash = NULL, 
            reset_token_expiry = NULL,
            temp_password_hash = NULL,
            otp_hash = NULL,
            otp_expiry = NULL,
            require_password_change = FALSE,
            account_status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE driver_id = $2
    `, [passwordHash, record.driver_id]);

    const loginToken = jwt.sign(
        { driverId: record.driver_id, email: record.email },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
    return { success: true, token: loginToken, driverId: record.driver_id };
}

async function requestPasswordReset(identifier) {
    const record = await findDriverRecord(identifier);
    if (!record) {
        return { success: true, message: 'If that email is registered, a reset link has been sent.' };
    }
    const tokenData = issueSetupTokenData();
    await db.query('UPDATE driver_auth SET reset_token_hash = $1, reset_token_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE driver_id = $3', [tokenData.hash, tokenData.expiry, record.driver_id]);

    return { success: true, resetToken: tokenData.resetToken, email: record.email, driverId: record.driver_id };
}

async function regenerateDriverCredentials(driverId, { email, phone, forcePasswordReset = true } = {}) {
    const res = await db.query('SELECT * FROM driver_auth WHERE driver_id = $1', [driverId]);
    const record = res.rows[0];
    if (!record) return createDriverAccount(driverId, email || driverId, phone || '');

    const canonicalEmail = normalizeDriverEmail(email || record.email);
    const canonicalPhone = normalizePhone(phone || record.phone);
    const otp = generateOtp();
    const tempPassword = generateTempPassword();
    const tokenData = issueSetupTokenData();

    const passwordUpdate = forcePasswordReset ? 'password_hash = NULL,' : '';
    await db.query(`
        UPDATE driver_auth SET 
            email = $1, phone = $2, 
            otp_hash = $3, otp_expiry = $4,
            temp_password_hash = $5,
            require_password_change = TRUE,
            preferred_method = NULL,
            ${passwordUpdate}
            reset_token_hash = $6, reset_token_expiry = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE driver_id = $8
    `, [canonicalEmail, canonicalPhone, hashValue(otp), new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(), await bcrypt.hash(tempPassword, 10), tokenData.hash, tokenData.expiry, driverId]);

    return { success: true, otp, tempPassword, resetToken: tokenData.resetToken, email: canonicalEmail, phone: canonicalPhone };
}

async function loginDriver(identifier, secret, method) {
    const record = await findDriverRecord(identifier);
    if (!record) return { success: false, error: 'Account not found. Contact your office.' };

    // Per-account lockout (HIGH-04): block if locked
    if (record.locked_until && new Date(record.locked_until) > new Date()) {
        return { success: false, error: 'Account temporarily locked due to too many failed attempts. Try again later.' };
    }

    const secretRaw = String(secret || '');
    const now = new Date();

    if (record.preferred_method && method && record.preferred_method !== method) {
        return { success: false, error: `Account set up for ${record.preferred_method} login.` };
    }

    if (record.require_password_change) {
        if (method === 'email') {
            const valid = !!(record.temp_password_hash && await bcrypt.compare(secretRaw, record.temp_password_hash));
            if (!valid) {
                const attempts = (record.failed_attempts || 0) + 1;
                const lockClause = attempts >= 10 ? `, locked_until = NOW() + INTERVAL '15 minutes'` : '';
                await db.query(`UPDATE driver_auth SET failed_attempts = $1${lockClause} WHERE driver_id = $2`, [attempts, record.driver_id]);
                return { success: false, error: 'Incorrect temporary password.' };
            }
        } else if (method === 'phone') {
            const valid = !!(record.otp_hash && record.otp_expiry && new Date(record.otp_expiry) > now && hashValue(secretRaw) === record.otp_hash);
            if (!valid) {
                const attempts = (record.failed_attempts || 0) + 1;
                const lockClause = attempts >= 10 ? `, locked_until = NOW() + INTERVAL '15 minutes'` : '';
                await db.query(`UPDATE driver_auth SET failed_attempts = $1${lockClause} WHERE driver_id = $2`, [attempts, record.driver_id]);
                return { success: false, error: 'Invalid or expired OTP.' };
            }
        }

        if (method) await db.query('UPDATE driver_auth SET preferred_method = $1 WHERE driver_id = $2', [method, record.driver_id]);
        const tokenData = issueSetupTokenData();
        await db.query('UPDATE driver_auth SET reset_token_hash = $1, reset_token_expiry = $2, failed_attempts = 0, locked_until = NULL WHERE driver_id = $3', [tokenData.hash, tokenData.expiry, record.driver_id]);

        return { success: true, requirePasswordChange: true, setupToken: tokenData.resetToken, driverId: record.driver_id, email: record.email };
    }

    if (!record.password_hash) return { success: false, error: 'Pending setup. Use OTP/Temp password.' };
    const match = await bcrypt.compare(secretRaw, record.password_hash);
    if (!match) {
        // Increment failed attempts; lock after 10 failures for 15 minutes
        const attempts = (record.failed_attempts || 0) + 1;
        const lockClause = attempts >= 10 ? `, locked_until = NOW() + INTERVAL '15 minutes'` : '';
        await db.query(`UPDATE driver_auth SET failed_attempts = $1${lockClause} WHERE driver_id = $2`, [attempts, record.driver_id]);
        return { success: false, error: 'Incorrect password.' };
    }

    // Success: reset lockout counters
    await db.query('UPDATE driver_auth SET failed_attempts = 0, locked_until = NULL WHERE driver_id = $1', [record.driver_id]);
    const token = jwt.sign({ driverId: record.driver_id, email: record.email }, JWT_SECRET, { expiresIn: '30d' });
    return { success: true, token, driverId: record.driver_id };
}

function verifyToken(token) {
    try { return jwt.verify(token, JWT_SECRET); }
    catch { return null; }
}

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const payload = verifyToken(auth.slice(7));
    if (!payload) return res.status(401).json({ error: 'Session expired' });
    req.driver = payload;
    next();
}

async function getDriverAccountStatus(driverId) {
    const res = await db.query('SELECT * FROM driver_auth WHERE driver_id = $1', [driverId]);
    const record = res.rows[0];
    if (!record) return { exists: false };
    return {
        exists: true,
        email: record.email,
        phone: record.phone || '',
        accountStatus: record.account_status,
        hasPassword: !!record.password_hash,
        requiresPasswordChange: !!record.require_password_change,
        hasOtp: !!(record.otp_hash && new Date(record.otp_expiry) > new Date()),
        hasTempPassword: !!record.temp_password_hash,
        hasPendingReset: !!(record.reset_token_hash && new Date(record.reset_token_expiry) > new Date()),
    };
}

async function exportDriverAccount(driverId) {
    const res = await db.query('SELECT * FROM driver_auth WHERE driver_id = $1', [driverId]);
    const record = res.rows[0];
    if (!record) return null;
    return record;
}

async function deleteDriverAccount(driverId) {
    const res = await db.query('DELETE FROM driver_auth WHERE driver_id = $1', [driverId]);
    return res.rowCount > 0;
}

module.exports = {
    normalizeDriverEmail, normalizePhone, createDriverAccount, setDriverPassword,
    resetPasswordWithToken, requestPasswordReset, regenerateDriverCredentials,
    loginDriver, verifyToken, authMiddleware, getDriverAccountStatus,
    exportDriverAccount, deleteDriverAccount,
};
