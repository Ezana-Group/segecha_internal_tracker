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

function normalizeStaffEmail(email, fallbackSeed = '') {
    return normalizeSegechaEmail(email, fallbackSeed, 'staff');
}

// Helper functions moved to auth-utils.js

async function createStaffAccount(staffId, email, phone = '') {
    const canonicalEmail = normalizeStaffEmail(email);
    const canonicalPhone = normalizePhone(phone);
    const otp = generateOtp();
    const tempPassword = generateTempPassword();
    const tokenData = issueSetupTokenData();

    await db.query(`
        INSERT INTO staff_auth (staff_id, email, phone, temp_password_hash, otp_hash, otp_expiry, reset_token_hash, reset_token_expiry, require_password_change, account_status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'pending', CURRENT_TIMESTAMP)
        ON CONFLICT (staff_id) DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            otp_hash = EXCLUDED.otp_hash,
            otp_expiry = EXCLUDED.otp_expiry,
            temp_password_hash = EXCLUDED.temp_password_hash,
            reset_token_hash = EXCLUDED.reset_token_hash,
            reset_token_expiry = EXCLUDED.reset_token_expiry,
            require_password_change = TRUE,
            updated_at = CURRENT_TIMESTAMP
    `, [staffId, canonicalEmail, canonicalPhone, await bcrypt.hash(tempPassword, 10), hashValue(otp), new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000), tokenData.hash, tokenData.expiry]);

    return { success: true, resetToken: tokenData.resetToken, otp, tempPassword, email: canonicalEmail, phone: canonicalPhone };
}

async function regenerateStaffCredentials(staffId, { email, phone, forcePasswordReset = true } = {}) {
    const res = await db.query('SELECT * FROM staff_auth WHERE staff_id = $1', [staffId]);
    const record = res.rows[0];
    if (!record) return createStaffAccount(staffId, email || staffId, phone || '');

    const canonicalEmail = normalizeStaffEmail(email || record.email);
    const canonicalPhone = normalizePhone(phone || record.phone);
    const otp = generateOtp();
    const tempPassword = generateTempPassword();
    const tokenData = issueSetupTokenData();

    const passwordUpdate = forcePasswordReset ? 'password_hash = NULL,' : '';
    await db.query(`
        UPDATE staff_auth SET 
            email = $1, phone = $2, 
            otp_hash = $3, otp_expiry = $4,
            temp_password_hash = $5,
            require_password_change = TRUE,
            preferred_method = NULL,
            ${passwordUpdate}
            reset_token_hash = $6, reset_token_expiry = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE staff_id = $8
    `, [canonicalEmail, canonicalPhone, hashValue(otp), new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000), await bcrypt.hash(tempPassword, 10), tokenData.hash, tokenData.expiry, staffId]);

    return { success: true, resetToken: tokenData.resetToken, otp, tempPassword, email: canonicalEmail, phone: canonicalPhone };
}

async function resetStaffPasswordWithToken(token, newPassword) {
    if (!token || !newPassword || newPassword.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
    }
    const tokenHash = hashValue(token);
    const res = await db.query('SELECT * FROM staff_auth WHERE reset_token_hash = $1 AND reset_token_expiry > CURRENT_TIMESTAMP', [tokenHash]);
    const record = res.rows[0];
    if (!record) return { success: false, error: 'Invalid or expired reset link.' };

    await db.query(`
        UPDATE staff_auth SET 
            password_hash = $1, 
            reset_token_hash = NULL, 
            reset_token_expiry = NULL,
            temp_password_hash = NULL,
            otp_hash = NULL,
            otp_expiry = NULL,
            require_password_change = FALSE,
            account_status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE staff_id = $2
    `, [await bcrypt.hash(newPassword, 10), record.staff_id]);

    const tokenOut = jwt.sign({ staffId: record.staff_id, email: record.email, role: 'staff' }, JWT_SECRET, { expiresIn: '12h' });
    return { success: true, token: tokenOut, staffId: record.staff_id };
}

async function loginStaff(identifier, secret, method) {
    const id = String(identifier || '').trim().toLowerCase();
    const phone = normalizePhone(identifier);
    const res = await db.query('SELECT * FROM staff_auth WHERE email = $1 OR (phone IS NOT NULL AND phone = $2) LIMIT 1', [id, phone]);
    const record = res.rows[0];
    if (!record) return { success: false, error: 'Account not found.' };

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
                await db.query(`UPDATE staff_auth SET failed_attempts = $1${lockClause} WHERE staff_id = $2`, [attempts, record.staff_id]);
                return { success: false, error: 'Incorrect temporary password.' };
            }
        } else if (method === 'phone') {
            const valid = !!(record.otp_hash && record.otp_expiry && new Date(record.otp_expiry) > now && hashValue(secretRaw) === record.otp_hash);
            if (!valid) {
                const attempts = (record.failed_attempts || 0) + 1;
                const lockClause = attempts >= 10 ? `, locked_until = NOW() + INTERVAL '15 minutes'` : '';
                await db.query(`UPDATE staff_auth SET failed_attempts = $1${lockClause} WHERE staff_id = $2`, [attempts, record.staff_id]);
                return { success: false, error: 'Invalid or expired OTP.' };
            }
        }

        if (method) await db.query('UPDATE staff_auth SET preferred_method = $1 WHERE staff_id = $2', [method, record.staff_id]);
        const tokenData = issueSetupTokenData();
        await db.query('UPDATE staff_auth SET reset_token_hash = $1, reset_token_expiry = $2, failed_attempts = 0, locked_until = NULL WHERE staff_id = $3', [tokenData.hash, tokenData.expiry, record.staff_id]);
        return { success: true, requirePasswordChange: true, setupToken: tokenData.resetToken, staffId: record.staff_id, email: record.email };
    }

    if (!record.password_hash) return { success: false, error: 'Pending setup.' };
    const match = await bcrypt.compare(secretRaw, record.password_hash);
    if (!match) {
        // Increment failed attempts; lock after 10 failures for 15 minutes
        const attempts = (record.failed_attempts || 0) + 1;
        const lockClause = attempts >= 10 ? `, locked_until = NOW() + INTERVAL '15 minutes'` : '';
        await db.query(`UPDATE staff_auth SET failed_attempts = $1${lockClause} WHERE staff_id = $2`, [attempts, record.staff_id]);
        return { success: false, error: 'Incorrect password.' };
    }

    // Success: reset lockout counters
    await db.query('UPDATE staff_auth SET failed_attempts = 0, locked_until = NULL WHERE staff_id = $1', [record.staff_id]);
    const token = jwt.sign({ staffId: record.staff_id, email: record.email, role: 'staff' }, JWT_SECRET, { expiresIn: '12h' });
    return { success: true, token, staffId: record.staff_id };
}

async function requestStaffPasswordReset(identifier) {
    const id = String(identifier || '').trim().toLowerCase();
    const phone = normalizePhone(identifier);
    const res = await db.query('SELECT * FROM staff_auth WHERE email = $1 OR (phone IS NOT NULL AND phone = $2) LIMIT 1', [id, phone]);
    const record = res.rows[0];
    if (!record) return { success: true, message: 'If account exists, link sent.' };
    
    const tokenData = issueSetupTokenData();
    await db.query('UPDATE staff_auth SET reset_token_hash = $1, reset_token_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE staff_id = $3', [tokenData.hash, tokenData.expiry, record.staff_id]);
    return { success: true, resetToken: tokenData.resetToken, email: record.email, staffId: record.staff_id };
}

async function getStaffAccountStatus(staffId) {
    const res = await db.query('SELECT * FROM staff_auth WHERE staff_id = $1', [staffId]);
    const record = res.rows[0];
    if (!record) return { exists: false };
    return {
        exists: true,
        email: record.email,
        phone: record.phone || '',
        accountStatus: record.account_status || 'pending',
        hasPassword: !!record.password_hash,
        requiresPasswordChange: !!record.require_password_change,
        hasOtp: !!(record.otp_hash && new Date(record.otp_expiry) > new Date()),
        hasTempPassword: !!record.temp_password_hash,
        hasPendingReset: !!(record.reset_token_hash && new Date(record.reset_token_expiry) > new Date()),
    };
}

async function exportStaffAccount(staffId) {
    const res = await db.query('SELECT * FROM staff_auth WHERE staff_id = $1', [staffId]);
    return res.rows[0] || null;
}

async function deleteStaffAccount(staffId) {
    const res = await db.query('DELETE FROM staff_auth WHERE staff_id = $1', [staffId]);
    return res.rowCount > 0;
}

module.exports = {
    normalizeStaffEmail, createStaffAccount, regenerateStaffCredentials,
    resetStaffPasswordWithToken, requestStaffPasswordReset, loginStaff,
    getStaffAccountStatus, exportStaffAccount, deleteStaffAccount,
};
