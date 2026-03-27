const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) console.error('CRITICAL: JWT_SECRET not set in environment.');
const TOKEN_EXPIRY_HOURS = 72;
const OTP_EXPIRY_MINUTES = 30;

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.startsWith('254') && digits.length === 12) return `0${digits.slice(3)}`;
    if (digits.length === 9 && digits.startsWith('7')) return `0${digits}`;
    return digits;
}

function normalizeSegechaEmail(email, fallbackSeed = '', prefix = 'user') {
    const raw = String(email || fallbackSeed || '').trim().toLowerCase();
    const localPart = (raw.includes('@') ? raw.split('@')[0] : raw)
        .replace(/[^a-z0-9._-]/g, '.')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+|\.+$/g, '');
    const domain = process.env.EMAIL_DOMAIN || 'segecha.com';
    return `${localPart || prefix}@${domain}`;
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

function issueSetupTokenData() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hash = hashValue(resetToken);
    const expiry = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3600 * 1000);
    return { resetToken, hash, expiry };
}

module.exports = {
    JWT_SECRET,
    TOKEN_EXPIRY_HOURS,
    OTP_EXPIRY_MINUTES,
    normalizePhone,
    normalizeSegechaEmail,
    hashValue,
    generateOtp,
    generateTempPassword,
    issueSetupTokenData
};
