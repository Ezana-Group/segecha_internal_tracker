require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { stkPush } = require('./mpesa');
const { sendInvoiceEmail } = require('./email');
const { sendPaymentSMS } = require('./sms');

const app = express();

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

const CORS_ORIGINS = [
    process.env.TRACKER_URL,
    process.env.PORTAL_URL,
    process.env.DRIVER_PORTAL_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:3000',
    'http://localhost:4173',
].filter((o) => o && o !== 'undefined');

app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : true }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', env: process.env.MPESA_ENV, time: new Date().toISOString() });
});

// ── Public settings (read by payment portal — safe public fields only) ────
app.get('/api/public-settings', (req, res) => {
    res.json({
        companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
        paybillNumber: process.env.MPESA_PAYBILL || '',
        bankName: process.env.BANK_NAME || '',
        bankAccount: process.env.BANK_ACCOUNT || '',
        bankBranch: process.env.BANK_BRANCH || '',
    });
});

// ── M-Pesa STK Push to client ──────────────────────────────────────────────
app.post('/api/mpesa/stk-push', async (req, res) => {
    const { phone, amount, invoiceId, clientName } = req.body;
    if (!phone || !amount || !invoiceId) {
        return res.status(400).json({ error: 'phone, amount, and invoiceId are required' });
    }
    try {
        const result = await stkPush({
            phone,
            amount,
            accountRef: invoiceId,
            description: `Segecha Invoice ${invoiceId}`,
        });
        res.json({
            success: true,
            checkoutRequestId: result.CheckoutRequestID,
            message: result.CustomerMessage || 'Payment prompt sent to phone',
        });
    } catch (err) {
        console.error('STK Push failed:', err.response?.data || err.message);
        res.status(500).json({
            error: err.response?.data?.errorMessage || err.message || 'STK Push failed',
        });
    }
});

// ── M-Pesa callback (Safaricom calls this after payment completes) ─────────
app.post('/api/mpesa/callback', async (req, res) => {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (callback.ResultCode === 0) {
        const items = callback.CallbackMetadata?.Item || [];
        const get = name => items.find(i => i.Name === name)?.Value;

        const invoiceId = callback.AccountReference;
        const amount    = get('Amount');
        const mpesaCode = get('MpesaReceiptNumber');
        const phone     = get('PhoneNumber');
        const timestamp = get('TransactionDate');

        console.log('✅ M-Pesa payment confirmed:', { invoiceId, amount, mpesaCode, phone });

        // Auto-record payment on the invoice in tracker-data.json
        try {
            const { readTrackerData, writeTrackerData } = require('./driver-data');
            const data = readTrackerData();
            const invoice = (data.invoices || []).find(inv =>
                inv.id === invoiceId || inv.id?.toLowerCase() === invoiceId?.toLowerCase()
            );

            if (invoice) {
                const payment = {
                    id: Date.now().toString(36).toUpperCase(),
                    amount: +amount,
                    method: 'M-Pesa',
                    mpesaCode: mpesaCode || '',
                    date: new Date().toISOString().split('T')[0],
                    note: `Auto-recorded via M-Pesa STK Push · ${phone}`,
                    autoVerified: true,
                };

                if (!invoice.payments) invoice.payments = [];
                invoice.payments.push(payment);

                const totalPaid = invoice.payments.reduce((s, p) => s + +p.amount, 0);
                if (totalPaid >= +invoice.amount) {
                    invoice.status = 'Paid';
                    invoice.paidDate = new Date().toISOString().split('T')[0];
                } else {
                    invoice.status = 'Partial';
                }

                writeTrackerData(data);
                console.log(`📋 Invoice ${invoiceId} updated: ${invoice.status} · total paid KES ${totalPaid}`);

                // Send payment receipt to client if email is on invoice
                if (invoice.email) {
                    try {
                        const { sendPaymentReceiptEmail } = require('./email');
                        const settings = JSON.parse(process.env.CACHED_SETTINGS || '{}');
                        await sendPaymentReceiptEmail({
                            to: invoice.email,
                            clientName: invoice.client,
                            invoice,
                            payment,
                            companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
                        });
                        console.log(`📧 Payment receipt sent to ${invoice.email}`);
                    } catch (emailErr) {
                        console.warn('Receipt email failed:', emailErr.message);
                    }
                }
            }
        } catch (err) {
            console.warn('Could not auto-update invoice:', err.message);
        }
    } else {
        console.log('❌ M-Pesa payment failed:', callback.ResultCode, callback.ResultDesc);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// ── Send email payment request ─────────────────────────────────────────────
app.post('/api/send/email', async (req, res) => {
    const { to, invoice, settings } = req.body;
    if (!to || !invoice?.id) {
        return res.status(400).json({ error: 'to email address and invoice are required' });
    }
    try {
        const portalUrl = `${process.env.PORTAL_URL}?inv=${encodeURIComponent(invoice.id)}&amount=${invoice.amount}&client=${encodeURIComponent(invoice.client)}`;
        await sendInvoiceEmail({ to, invoice, portalUrl, settings: settings || {} });
        res.json({ success: true, message: `Email sent to ${to}` });
    } catch (err) {
        console.error('Email failed:', err.response?.body || err.message);
        res.status(500).json({ error: err.message || 'Email sending failed' });
    }
});

// ── Admin-triggered SMS (driver welcome, etc.) — local-first tracker calls this ──
app.post('/api/notifications/send', async (req, res) => {
    const { adminKey, phone, message, type } = req.body || {};
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message is required' });

    let sent = false;
    if (phone && process.env.AT_API_KEY && process.env.AT_USERNAME) {
        try {
            const { sendRawSMS } = require('./sms');
            await sendRawSMS({ phone, message });
            sent = true;
        } catch (err) {
            console.error('Notification SMS failed:', err.message);
            return res.status(500).json({ error: err.message || 'SMS failed' });
        }
    } else {
        console.log(`[notify:${type || 'generic'}] (no SMS — missing phone or Africa's Talking env)`, {
            phone: phone || '—',
            preview: message.slice(0, 120),
        });
    }

    res.json({ success: true, sent });
});

// ── Send SMS payment request ───────────────────────────────────────────────
app.post('/api/send/sms', async (req, res) => {
    const { phone, clientName, invoiceId, amount } = req.body;
    if (!phone || !invoiceId) {
        return res.status(400).json({ error: 'phone and invoiceId are required' });
    }
    try {
        const portalUrl = `${process.env.PORTAL_URL}?inv=${encodeURIComponent(invoiceId)}&amount=${amount}&client=${encodeURIComponent(clientName || '')}`;
        await sendPaymentSMS({ phone, clientName, invoiceId, amount, portalUrl });
        res.json({ success: true, message: `SMS sent to ${phone}` });
    } catch (err) {
        console.error('SMS failed:', err.message);
        res.status(500).json({ error: err.message || 'SMS sending failed' });
    }
});

// ── Driver auth routes ────────────────────────────────────────────────────
const { 
    createDriverAccount, 
    setDriverPassword, 
    resetPasswordWithToken, 
    requestPasswordReset, 
    regenerateDriverCredentials,
    loginDriver, 
    authMiddleware, 
    getDriverAccountStatus,
    exportDriverAccount,
    deleteDriverAccount,
    normalizeSegechaEmail,
} = require('./driver-auth');
const {
    createStaffAccount,
    regenerateStaffCredentials,
    resetStaffPasswordWithToken,
    requestStaffPasswordReset,
    loginStaff,
    getStaffAccountStatus,
    exportStaffAccount,
    deleteStaffAccount,
    normalizeSegechaEmail: normalizeStaffEmail,
} = require('./staff-auth');
const { getDriverData, updateJourneyStatus, addPendingSubmission, readTrackerData, writeTrackerData } = require('./driver-data');
const { initSuperAdminTable, createSuperAdmin, loginSuperAdmin } = require('./superadmin-auth');

// Initialize DB table on startup
initSuperAdminTable();

// ── Auto-create driver account + send welcome email (called when admin saves a driver)
app.post('/api/driver/create-account', async (req, res) => {
    const { driverId, email, phone, driverName, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!driverId || !driverName) return res.status(400).json({ error: 'driverId and driverName are required' });
    try {
        const { sendDriverWelcomeEmail } = require('./email');
        const canonicalEmail = normalizeSegechaEmail(email || driverName);
        const { resetToken, otp, tempPassword } = await createDriverAccount(driverId, canonicalEmail, phone || '');
        const resetUrl = `${process.env.DRIVER_PORTAL_URL || 'https://driver.segecha.com'}/set-password?token=${resetToken}`;
        const companyName = process.env.COMPANY_NAME || 'Segecha Group Ltd';

        await sendDriverWelcomeEmail({ to: canonicalEmail, driverName, resetUrl, companyName });

        res.json({
            success: true,
            email: canonicalEmail,
            otp,
            tempPassword,
            message: `Account created for ${canonicalEmail}`,
        });
    } catch (err) {
        console.error('Create account error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to create account' });
    }
});

// ── Resend welcome email / new setup link (admin action from Settings)
app.post('/api/driver/resend-setup', async (req, res) => {
    const { driverId, email, phone, driverName, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { sendDriverWelcomeEmail } = require('./email');
        const canonicalEmail = normalizeSegechaEmail(email || driverName);
        const { resetToken, otp, tempPassword } = await createDriverAccount(driverId, canonicalEmail, phone || '');
        const resetUrl = `${process.env.DRIVER_PORTAL_URL || 'https://driver.segecha.com'}/set-password?token=${resetToken}`;

        await sendDriverWelcomeEmail({
            to: canonicalEmail,
            driverName,
            resetUrl,
            companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
        });

        res.json({ success: true, email: canonicalEmail, otp, tempPassword, message: `New setup link sent to ${canonicalEmail}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Forgot password (driver requests reset from portal login page)
app.post('/api/driver/forgot-password', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Phone or email is required' });
    try {
        const { sendPasswordResetEmail } = require('./email');
        const { readTrackerData } = require('./driver-data');

        const result = await requestPasswordReset(identifier);

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
        const result = await resetPasswordWithToken(token, password);
        if (result.success) {
            const data = readTrackerData();
            const exists = (data.drivers || []).some((d) => d.id === result.driverId);
            if (!exists) {
                return res.status(409).json({
                    error: 'Account exists but no matching driver profile was found. Ask admin to create/sync your driver profile first.',
                });
            }
            res.json(result);
        } else res.status(400).json({ error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get driver account status (for Settings page display)
app.get('/api/driver/account-status/:driverId', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        res.json(getDriverAccountStatus(req.params.driverId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/driver/account/regenerate-credentials', async (req, res) => {
    const { driverId, email, phone, forcePasswordReset = true, adminKey } = req.body || {};
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!driverId) return res.status(400).json({ error: 'driverId is required' });
    try {
        const result = await regenerateDriverCredentials(driverId, { email, phone, forcePasswordReset: !!forcePasswordReset });
        if (!result.success) return res.status(404).json({ error: result.error });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/driver/account-export/:driverId', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const driverId = req.params.driverId;
        const auth = exportDriverAccount(driverId);
        if (!auth) return res.status(404).json({ error: 'Account not found' });
        const tracker = readTrackerData();
        const { getDocuments } = require('./documents');
        const payload = {
            exportedAt: new Date().toISOString(),
            driver: tracker.drivers.find((d) => d.id === driverId) || null,
            auth,
            journeys: (tracker.journeys || []).filter((j) => j.driver === driverId),
            fuel: (tracker.fuel || []).filter((f) => f.driver === driverId || f._submittedBy === driverId),
            expenses: (tracker.expenses || []).filter((e) => e.driver === driverId || e._submittedBy === driverId),
            payroll: (tracker.payroll || []).filter((p) => p.driver === driverId),
            documents: getDocuments('driver', driverId),
        };
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/driver/account/:driverId', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const driverId = req.params.driverId;
        const removedAuth = deleteDriverAccount(driverId);
        const tracker = readTrackerData();
        const hadDriver = (tracker.drivers || []).some((d) => d.id === driverId);
        tracker.drivers = (tracker.drivers || []).filter((d) => d.id !== driverId);
        tracker.journeys = (tracker.journeys || []).filter((j) => j.driver !== driverId);
        tracker.fuel = (tracker.fuel || []).filter((f) => f.driver !== driverId && f._submittedBy !== driverId);
        tracker.expenses = (tracker.expenses || []).filter((e) => e.driver !== driverId && e._submittedBy !== driverId);
        tracker.payroll = (tracker.payroll || []).filter((p) => p.driver !== driverId);
        writeTrackerData(tracker);
        res.json({ success: true, removedAuth, removedTracker: hadDriver });
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
        await setDriverPassword(driverId, email, password);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ── Superadmin Auth ───────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await loginSuperAdmin(email, password);
        if (!result) return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/setup', async (req, res) => {
    const { email, password, displayName, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const user = await createSuperAdmin(email, password, displayName);
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Driver login
app.post('/api/driver/login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Phone/email and password are required' });
    try {
        const result = await loginDriver(identifier, password);
        if (result.success) {
            const driverId = result.driverId;
            if (driverId) {
                const data = readTrackerData();
                const exists = (data.drivers || []).some((d) => d.id === driverId);
                if (!exists) {
                    return res.status(409).json({
                        error: 'Account found but no driver profile is linked yet. Ask admin to create/sync your driver profile.',
                    });
                }
            }
            res.json(result);
        } else res.status(401).json({ error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Staff auth routes ──────────────────────────────────────────────────────
app.post('/api/staff/create-account', async (req, res) => {
    const { staffId, email, phone, staffName, adminKey } = req.body || {};
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!staffId || !staffName) return res.status(400).json({ error: 'staffId and staffName are required' });
    try {
        const canonicalEmail = normalizeStaffEmail(email || staffName);
        const result = await createStaffAccount(staffId, canonicalEmail, phone || '');
        res.json({ success: true, ...result, message: `Staff account created for ${canonicalEmail}` });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to create staff account' });
    }
});

app.get('/api/staff/account-status/:staffId', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        res.json(getStaffAccountStatus(req.params.staffId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/staff/account/regenerate-credentials', async (req, res) => {
    const { staffId, email, phone, forcePasswordReset = true, adminKey } = req.body || {};
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!staffId) return res.status(400).json({ error: 'staffId is required' });
    try {
        const result = await regenerateStaffCredentials(staffId, { email, phone, forcePasswordReset: !!forcePasswordReset });
        if (!result.success) return res.status(404).json({ error: result.error });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/staff/account-export/:staffId', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const staffId = req.params.staffId;
        const auth = exportStaffAccount(staffId);
        if (!auth) return res.status(404).json({ error: 'Account not found' });
        const tracker = readTrackerData();
        const { getDocuments } = require('./documents');
        const payload = {
            exportedAt: new Date().toISOString(),
            staff: (tracker.staff || []).find((s) => s.id === staffId) || null,
            auth,
            payroll: (tracker.payroll || []).filter((p) => p.driver === staffId),
            documents: getDocuments('staff', staffId),
        };
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/staff/account/:staffId', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const staffId = req.params.staffId;
        const removedAuth = deleteStaffAccount(staffId);
        const tracker = readTrackerData();
        const hadStaff = (tracker.staff || []).some((s) => s.id === staffId);
        tracker.staff = (tracker.staff || []).filter((s) => s.id !== staffId);
        tracker.payroll = (tracker.payroll || []).filter((p) => p.driver !== staffId);
        writeTrackerData(tracker);
        res.json({ success: true, removedAuth, removedTracker: hadStaff });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/staff/login', async (req, res) => {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) return res.status(400).json({ error: 'Phone/email and password are required' });
    try {
        const result = await loginStaff(identifier, password);
        if (result.success) res.json(result);
        else res.status(401).json({ error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/staff/forgot-password', async (req, res) => {
    const { identifier } = req.body || {};
    if (!identifier) return res.status(400).json({ error: 'Phone or email is required' });
    try {
        const result = await requestStaffPasswordReset(identifier);
        res.json({ success: true, message: result.message || 'If that account is registered, a reset link has been sent.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/staff/set-password', async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    try {
        const result = await resetStaffPasswordWithToken(token, password);
        if (result.success) res.json(result);
        else res.status(400).json({ error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get driver's own data (authenticated)
app.get('/api/driver/me', authMiddleware, (req, res) => {
    let settings = {};
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        }
    } catch (e) { console.error('Error reading settings:', e); }

    const result = getDriverData(req.driver.driverId, settings);
    if (!result) return res.status(404).json({ error: 'Driver record not found in tracker data' });
    res.json(result);
});

// Driver updates limited profile fields (phone, licence)
app.post('/api/driver/profile', authMiddleware, (req, res) => {
    try {
        const { readTrackerData, writeTrackerData } = require('./driver-data');
        const { phone, license } = req.body || {};
        const data = readTrackerData();
        const d = data.drivers.find((x) => x.id === req.driver.driverId);
        if (!d) return res.status(404).json({ error: 'Driver not found' });
        if (phone !== undefined) d.phone = String(phone).trim();
        if (license !== undefined) d.license = String(license).trim();
        writeTrackerData(data);
        res.json({
            success: true,
            driver: {
                id: d.id,
                uId: d.uId,
                name: d.name,
                phone: d.phone,
                license: d.license,
                email: d.email,
                mpesa: d.mpesa,
                truck: d.truck,
                lockVehicleAssignment: !!d.lockVehicleAssignment,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Driver sets billing + delivery customers before starting (status Loading only)
app.post('/api/driver/journey/:id/customers', authMiddleware, (req, res) => {
    try {
        const { updateJourneyPartyCustomers } = require('./driver-data');
        const result = updateJourneyPartyCustomers(req.driver.driverId, req.params.id, req.body || {});
        if (!result.success) return res.status(400).json({ error: result.error });
        res.json({ success: true, journey: result.journey });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Driver can create a new trip start request (office approval gate)
app.post('/api/driver/journeys/start-request', authMiddleware, (req, res) => {
    try {
        const { createJourneyStartRequest } = require('./driver-data');
        const result = createJourneyStartRequest(req.driver.driverId, req.body || {});
        if (!result.success) return res.status(400).json({ error: result.error });
        res.json({ success: true, journey: result.journey || result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Driver can create a new trip request in `Loading` state (fills required start details next)
app.post('/api/driver/journeys/start-placeholder', authMiddleware, (req, res) => {
    try {
        const { createJourneyStartPlaceholder } = require('./driver-data');
        const result = createJourneyStartPlaceholder(req.driver.driverId, req.body || {});
        if (!result.success) return res.status(400).json({ error: result.error });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update journey status (driver marks trip In Transit or Completed)
app.post('/api/driver/journey/:id/status', authMiddleware, (req, res) => {
    const { 
        status, 
        startOdom, startOdomPhotoUrl, 
        endOdom, endOdomPhotoUrl, deliveryProofUrl,
        origin, dest, cargo, weight, notes
    } = req.body;
    const result = updateJourneyStatus(
        req.driver.driverId,
        req.params.id,
        status,
        { 
            startOdom, startOdomPhotoUrl, 
            endOdom, endOdomPhotoUrl, deliveryProofUrl,
            origin, dest, cargo, weight, notes
        }
    );
    if (!result.success) return res.status(400).json({ error: result.error });

    // Notify office via WhatsApp link (logged to console — driver sends from their phone)
    console.log(`📍 Journey ${req.params.id} updated to ${status} by driver ${req.driver.driverId}`);
    res.json(result);
});

// Admin: verify or reject a journey completion
app.post('/api/admin/journey/:id/verify', async (req, res) => {
    const { adminKey, approved, rejectionReason } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const { verifyJourneyCompletion } = require('./driver-data');
        const { rejectedFields } = req.body;
        const result = verifyJourneyCompletion(req.params.id, approved === true, rejectionReason, rejectedFields);
        if (!result.success) return res.status(400).json({ error: result.error });

        // If rejected, notify via WhatsApp link (logged — admin sends manually)
        if (!approved && rejectionReason) {
            console.log(`❌ Journey ${req.params.id} verification rejected. Reason: ${rejectionReason}`);
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Generic submission verification (fuel, expenses, etc.)
app.post('/api/admin/submission/verify', (req, res) => {
    const { adminKey, id, type, approved, reason, rejectedFields } = req.body || {};
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });

    const { readTrackerData, writeTrackerData } = require('./driver-data');
    const data = readTrackerData();

    if (!['fuel', 'expenses'].includes(type)) {
        return res.status(400).json({ error: 'Invalid submission type' });
    }

    const arr = data[type] || [];
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Submission not found' });

    if (approved) {
        arr[idx]._pendingApproval = false;
        arr[idx]._approvedAt = new Date().toISOString();
        arr[idx]._approvedBy = 'admin';
        arr[idx]._rejectionReason = null;
        arr[idx]._rejectedFields = null;
        arr[idx]._isRejected = false;
    } else {
        // If rejected, we might want to mark it as rejected or just remove it.
        // For now, let's keep it but mark as rejected so it's not in pending list.
        arr[idx]._pendingApproval = false;
        arr[idx]._rejectedAt = new Date().toISOString();
        arr[idx]._rejectedBy = 'admin';
        arr[idx]._isRejected = true;
        arr[idx]._rejectionReason = reason;
        arr[idx]._rejectedFields = rejectedFields || [];
    }

    writeTrackerData(data);
    res.json({ success: true, item: arr[idx] });
});

// Admin: get all journeys awaiting verification
app.get('/api/admin/journeys/pending-verification', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const { readTrackerData, enrichJourneyForPortal } = require('./driver-data');
    const data = readTrackerData();
    const journeys = (data.journeys || []).filter(
        j => j.status === 'Awaiting Verification' || j.status === 'Awaiting Start Verification'
    ).map(j => enrichJourneyForPortal(j, data));

    const fuel = (data.fuel || []).filter(f => f._pendingApproval === true);
    const expenses = (data.expenses || []).filter(e => e._pendingApproval === true);

    const { getDocuments } = require('./documents');
    const documents = getDocuments();

    res.json({ 
        journeys, 
        fuel,
        expenses,
        documents,
        customers: data.customers || [],
        count: journeys.length + fuel.length + expenses.length 
    });
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

const HISTORY_PATH = path.join(__dirname, 'import-history.json');

// Get import history
app.get('/api/admin/import-history', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        if (!fs.existsSync(HISTORY_PATH)) return res.json([]);
        const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record new import history
app.post('/api/admin/import-history', (req, res) => {
    const { adminKey, record } = req.body || {};
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!record) return res.status(400).json({ error: 'Record is required' });
    try {
        let history = [];
        if (fs.existsSync(HISTORY_PATH)) {
            history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
        }
        history.unshift({ ...record, timestamp: new Date().toISOString() });
        // Keep only last 50 imports
        if (history.length > 50) history = history.slice(0, 50);
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit maintenance log
app.post('/api/driver/submit/maintenance', authMiddleware, (req, res) => {
    const result = addPendingSubmission(req.driver.driverId, 'maintenance', req.body);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, message: 'Maintenance log submitted for office review' });
});

// Sync tracker data from App.jsx (called when admin exports data)
app.post('/api/tracker/sync', (req, res) => {
    const { data, adminKey, profilePermissions, settings } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!data?.trucks) return res.status(400).json({ error: 'Invalid data format' });
    try {
        const prev = readTrackerData();
        const merged = { ...data };
        if (profilePermissions && typeof profilePermissions === 'object') {
            merged.profilePermissions = profilePermissions;
        } else if (prev.profilePermissions) {
            merged.profilePermissions = prev.profilePermissions;
        }
        writeTrackerData(merged);
        // Persist admin-configurable settings for server-side email sending.
        if (settings && typeof settings === 'object') {
            fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
        }
        res.json({ success: true, message: 'Tracker data synced successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generic deletion endpoint to keep tracker-data.json in sync with local deletes
app.delete('/api/admin/:collection/:id', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    
    const { collection, id } = req.params;
    try {
        const { readTrackerData, writeTrackerData } = require('./driver-data');
        const data = readTrackerData();
        
        if (!data[collection] || !Array.isArray(data[collection])) {
            return res.status(400).json({ error: `Collection "${collection}" not found or not an array` });
        }
        
        const originalLength = data[collection].length;
        data[collection] = data[collection].filter(x => x.id !== id);
        
        if (data[collection].length === originalLength) {
            return res.status(404).json({ error: `Record with id "${id}" not found in "${collection}"` });
        }
        
        writeTrackerData(data);
        console.log(`🗑️ Record ${id} deleted from ${collection} via admin sync`);
        res.json({ success: true, message: `Record ${id} removed from ${collection}` });
    } catch (err) {
        console.error(`Delete failed for ${collection}/${id}:`, err.message);
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

// Admin / tracker UI: image upload (odometer photos, etc.) — no driver JWT
app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
    const adminKey = req.body?.adminKey || req.query?.adminKey;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const folder = req.body?.folder || 'admin_misc';
    const filename = req.body?.filename || `img_${Date.now()}`;
    const safeName = String(filename).replace(/[^\w.-]/g, '_').slice(0, 80) + '_' + Date.now();
    try {
        const result = await uploadBuffer(req.file.buffer, folder, safeName);
        res.json({ success: true, url: result.secure_url, publicId: result.public_id });
    } catch (err) {
        console.error('Admin upload error:', err.message);
        res.status(500).json({ error: 'Upload failed — ' + err.message });
    }
});
// ── Document management routes ────────────────────────────────────────────
const multerDoc = require('multer');
const { uploadToR2, deleteFromR2, buildKey } = require('./r2');
const { addDocument, getDocuments, getAllExpiringDocuments, deleteDocument } = require('./documents');

const uploadDoc = multerDoc({
    storage: multerDoc.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max per document
    fileFilter: (req, file, cb) => {
        // Allow PDF, images, and common document formats
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF, JPG, PNG, and Word documents are allowed'));
    },
});

// Upload a document (admin only)
app.post('/api/documents/upload', uploadDoc.single('file'), async (req, res) => {
    const { adminKey, entityType, entityId, docType, label, expiryDate, uploadedBy, driverId } = req.body;
    if (adminKey !== process.env.ADMIN_KEY && uploadedBy !== driverId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    if (!entityType || !entityId || !docType) {
        return res.status(400).json({ error: 'entityType, entityId, and docType are required' });
    }
    try {
        const key = buildKey(entityType, entityId, docType, req.file.originalname);
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        const doc = addDocument({
            entityType, entityId, docType, label: label || req.file.originalname,
            filename: req.file.originalname, url, r2Key: key,
            uploadedBy: uploadedBy || 'admin',
            expiryDate: expiryDate || null,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
        });
        res.json({ success: true, document: doc });
    } catch (err) {
        console.error('R2 upload error:', err.message);
        res.status(500).json({ error: 'Document upload failed: ' + err.message });
    }
});

// Driver uploads their own document (PSV licence, medical)
app.post('/api/documents/driver-upload', authMiddleware, uploadDoc.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const { docType, label, expiryDate } = req.body;
    const allowedDriverDocs = ['psv_licence', 'medical_certificate', 'id_card'];
    if (!allowedDriverDocs.includes(docType)) {
        return res.status(400).json({ error: `Drivers can only upload: ${allowedDriverDocs.join(', ')}` });
    }
    try {
        const key = buildKey('driver', req.driver.driverId, docType, req.file.originalname);
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        const doc = addDocument({
            entityType: 'driver', entityId: req.driver.driverId,
            docType, label: label || req.file.originalname,
            filename: req.file.originalname, url, r2Key: key,
            uploadedBy: req.driver.driverId,
            expiryDate: expiryDate || null,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
        });
        res.json({ success: true, document: doc });
    } catch (err) {
        res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
});

// Get documents for an entity
app.get('/api/documents', (req, res) => {
    const { entityType, entityId, adminKey } = req.query;
    // Admin gets all
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const docs = getDocuments(entityType || null, entityId || null);
    res.json({ documents: docs });
});

// Get driver's own documents + docs for their assigned truck (office uploads)
app.get('/api/documents/mine', authMiddleware, (req, res) => {
    try {
        const { readTrackerData } = require('./driver-data');
        const data = readTrackerData();
        const drv = data.drivers.find((d) => d.id === req.driver.driverId);
        const personal = getDocuments('driver', req.driver.driverId);
        const vehicle = drv?.truck ? getDocuments('truck', drv.truck) : [];
        res.json({ documents: [...personal, ...vehicle] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all expiring documents (for dashboard alerts)
app.get('/api/documents/expiring', (req, res) => {
    const { adminKey, days } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    res.json({ documents: getAllExpiringDocuments(+days || 30) });
});

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const doc = deleteDocument(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        await deleteFromR2(doc.r2Key);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Send payment receipt email
app.post('/api/invoices/send-receipt', async (req, res) => {
    const { invoiceId, payment, adminKey, settings } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { readTrackerData } = require('./driver-data');
        const { sendPaymentReceiptEmail } = require('./email');
        const data = readTrackerData();
        const invoice = (data.invoices || []).find(inv => inv.id === invoiceId);
        if (!invoice || !invoice.email) return res.status(404).json({ error: 'Invoice not found or no email' });
        await sendPaymentReceiptEmail({
            to: invoice.email,
            clientName: invoice.client,
            invoice,
            payment,
            companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
            settings: settings || {},
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Public Tracking Endpoint (track.segecha.com) ──────────────────────────
app.get('/api/track/:ref', (req, res) => {
    try {
        const { readTrackerData } = require('./driver-data');
        const data = readTrackerData();
        const ref = String(req.params.ref || '').toUpperCase();
        
        // Find journey by ID or Waybill Number
        const journey = (data.journeys || []).find(j => 
            j.id?.toUpperCase() === ref || 
            j.waybillNo?.toUpperCase() === ref ||
            (j.waybillData?.waybillNo && String(j.waybillData.waybillNo).toUpperCase() === ref)
        );

        if (!journey) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Return only non-sensitive "tracking" fields
        res.json({
            success: true,
            id: journey.id,
            waybillNo: journey.waybillNo || journey.waybillData?.waybillNo || 'PENDING',
            origin: journey.origin,
            dest: journey.dest,
            status: journey.status,
            cargo: journey.cargo,
            updatedAt: journey._updatedAt || journey.date,
        });
    } catch (err) {
        res.status(500).json({ error: 'Tracking service error' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`
🚛 Segecha payment server running on port ${PORT}`);
    console.log(`   M-Pesa mode: ${process.env.MPESA_ENV || 'sandbox'}`);
    console.log(`   Portal URL:  ${process.env.PORTAL_URL}`);
    console.log(`   Health:      http://localhost:${PORT}/health
`);
});
