const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

const DEFAULT_EMAIL_IDENTITIES = {
    client: {
        fromEmail: process.env.EMAIL_FROM,
        fromName: process.env.COMPANY_NAME,
        replyToEmail: process.env.EMAIL_FROM,
        replyToName: process.env.COMPANY_NAME,
        fromFallbackEmails: [],
    },
    driverPortal: {
        fromEmail: process.env.DRIVER_EMAIL_FROM || process.env.EMAIL_FROM,
        fromName: process.env.DRIVER_EMAIL_FROM_NAME || process.env.COMPANY_NAME,
        replyToEmail: process.env.DRIVER_EMAIL_FROM || process.env.EMAIL_FROM,
        replyToName: process.env.DRIVER_EMAIL_FROM_NAME || process.env.COMPANY_NAME,
        fromFallbackEmails: [process.env.EMAIL_FROM],
    },
};

function safeJsonParse(text) {
    if (!text || typeof text !== 'string') return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function loadServerSettings() {
    const fromEnv = safeJsonParse(process.env.CACHED_SETTINGS) || {};
    try {
        if (!fs.existsSync(SETTINGS_PATH)) return fromEnv;
        const fromFile = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8') || '{}');
        // file overrides env, but keep env keys if missing
        return { ...fromEnv, ...fromFile };
    } catch {
        return fromEnv;
    }
}

function parseEmailList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
    if (typeof value === 'string') {
        return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

function uniqLower(list) {
    const seen = new Set();
    const out = [];
    for (const v of list || []) {
        const s = String(v || '').trim().toLowerCase();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function isLikelyUnverifiedSenderError(err) {
    const msgParts = [
        err?.message,
        err?.code,
        err?.response?.body?.errors?.[0]?.message,
        err?.response?.body?.errors?.[0]?.field,
        err?.response?.body?.errors?.[0]?.help,
    ].filter(Boolean);
    const msg = msgParts.join(' ').toLowerCase();
    // SendGrid commonly phrases this as "is not a verified sender" / "sender is not verified".
    return /not verified|unverified|verified sender|sender is not|from address/i.test(msg);
}

async function sendWithFromCandidates({ to, subject, html, text, fromCandidates, replyTo }) {
    let lastErr = null;
    for (const candidate of fromCandidates) {
        try {
            const payload = {
                to,
                from: { email: candidate.fromEmail, name: candidate.fromName },
                subject,
                html,
                text,
            };
            if (replyTo?.email) payload.replyTo = { email: replyTo.email, name: replyTo.name || '' };
            await sgMail.send(payload);
            return;
        } catch (err) {
            lastErr = err;
            if (!isLikelyUnverifiedSenderError(err)) break;
        }
    }
    throw lastErr || new Error('Email sending failed');
}

function resolveClientEmailIdentity(rootSettings) {
    const emailIdentities = rootSettings?.emailIdentities || {};
    const client = emailIdentities?.client || {};

    const fromEmail =
        String(client.fromEmail || '').trim().toLowerCase();
    const fromName =
        String(client.fromName || '').trim() ||
        process.env.COMPANY_NAME ||
        process.env.EMAIL_FROM_NAME;
    const replyToEmail =
        String(client.replyToEmail || '').trim().toLowerCase() ||
        fromEmail;
    const replyToName =
        String(client.replyToName || '').trim() ||
        fromName;

    const fallbackEmails = uniqLower(parseEmailList(client.fromFallbackEmails));

    const fromCandidates = uniqLower([fromEmail, ...fallbackEmails]).map((e) => ({
        fromEmail: e,
        fromName,
    }));

    return { fromCandidates, replyTo: { email: replyToEmail, name: replyToName } };
}

function resolveDriverPortalEmailIdentity(rootSettings) {
    const emailIdentities = rootSettings?.emailIdentities || {};
    const driverPortal = emailIdentities?.driverPortal || {};

    const paymentsIdentity = resolveClientEmailIdentity(rootSettings);

    const fromEmail =
        String(driverPortal.fromEmail || '').trim().toLowerCase();
    const fromName =
        String(driverPortal.fromName || '').trim() ||
        process.env.DRIVER_EMAIL_FROM_NAME ||
        process.env.EMAIL_FROM_NAME;

    const replyToEmail =
        String(driverPortal.replyToEmail || '').trim().toLowerCase() ||
        DEFAULT_EMAIL_IDENTITIES.driverPortal.replyToEmail;
    const replyToName =
        String(driverPortal.replyToName || '').trim() ||
        DEFAULT_EMAIL_IDENTITIES.driverPortal.replyToName;

    const fallbackEmails = uniqLower([
        ...parseEmailList(driverPortal.fromFallbackEmails),
        // Critical requirement: until SendGrid verifies welcome@, fall back to payments@.
        ...(paymentsIdentity?.fromCandidates?.map((c) => c.fromEmail) || []),
    ]);

    const fromCandidates = uniqLower([fromEmail, ...fallbackEmails]).map((e) => ({
        fromEmail: e,
        fromName,
    }));

    return { fromCandidates, replyTo: { email: replyToEmail, name: replyToName } };
}

function buildHTML({ invoice, portalUrl, companyName, paybillNumber, bankName, bankAccount, bankBranch }) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#1B3A6B,#0d2347);padding:36px 40px;text-align:center}
  .hdr h1{color:#fff;font-size:26px;font-weight:800;letter-spacing:-.5px;margin:0}
  .hdr p{color:#8ab0d8;font-size:14px;margin:8px 0 0}
  .badge{display:inline-block;background:#E8501A;color:#fff;padding:6px 18px;border-radius:20px;font-size:13px;font-weight:700;margin-top:16px}
  .body{padding:40px}
  .greeting{font-size:16px;color:#333;line-height:1.6;margin-bottom:24px}
  .inv-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:24px;margin-bottom:28px}
  .inv-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e9ecef;font-size:14px}
  .inv-row:last-child{border-bottom:none;padding-top:14px;font-weight:800;font-size:16px}
  .lbl{color:#6b7280}.val{color:#111827;font-weight:600}.total{color:#E8501A}
  .cta{text-align:center;margin:32px 0}
  .cta-btn{display:inline-block;background:linear-gradient(135deg,#E8501A,#d4400f);color:#fff!important;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:16px;font-weight:800}
  .cta-sub{font-size:12px;color:#9ca3af;margin-top:12px}
  .pills{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}
  .pill{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:20px;padding:5px 12px;font-size:12px;color:#374151;font-weight:600}
  .alt{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-top:24px}
  .alt h3{color:#065f46;font-size:14px;margin:0 0 12px}
  .alt-r{font-size:13px;color:#374151;margin-bottom:6px}
  .bank{background:#eff6ff;border-color:#bfdbfe}
  .bank h3{color:#1e40af}
  .ftr{background:#1B3A6B;padding:24px 40px;text-align:center}
  .ftr p{color:#8ab0d8;font-size:12px;margin:4px 0}
  .ftr a{color:#60a5fa;text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>🚛 ${companyName}</h1>
    <p>Nairobi, Kenya · Freight &amp; Logistics</p>
    <div class="badge">Payment Request</div>
  </div>
  <div class="body">
    <div class="greeting">Dear <b>${invoice.client}</b>,<br><br>
      Please find your payment request for freight services provided by ${companyName}.
      Click the button below to pay securely online.
    </div>
    <div class="inv-box">
      <div class="inv-row"><span class="lbl">Invoice</span><span class="val">${invoice.id}</span></div>
      <div class="inv-row"><span class="lbl">Issued</span><span class="val">${invoice.issued}</span></div>
      <div class="inv-row"><span class="lbl">Due Date</span><span class="val">${invoice.due}</span></div>
      <div class="inv-row"><span class="lbl">Service</span><span class="val">Freight Services</span></div>
      <div class="inv-row"><span class="lbl">Amount Due</span><span class="val total">KES ${Number(invoice.amount).toLocaleString('en-KE')}</span></div>
    </div>
    <div class="cta">
      <a href="${portalUrl}" class="cta-btn">Pay Now — KES ${Number(invoice.amount).toLocaleString('en-KE')}</a>
      <div class="cta-sub">Secure payment portal · payment.example.com</div>
      <div class="pills">
        <span class="pill">💚 M-Pesa</span>
        <span class="pill">🏦 Bank Transfer</span>
        <span class="pill">💳 Card</span>
        <span class="pill">🔗 Pesalink</span>
      </div>
    </div>
    ${paybillNumber ? `<div class="alt">
      <h3>💚 Pay via M-Pesa Paybill</h3>
      <div class="alt-r">Go to M-Pesa → Lipa na M-Pesa → Pay Bill</div>
      <div class="alt-r">Business No: <b>${paybillNumber}</b></div>
      <div class="alt-r">Account No: <b>${invoice.id}</b></div>
      <div class="alt-r">Amount: <b>KES ${Number(invoice.amount).toLocaleString('en-KE')}</b></div>
    </div>` : ''}
    ${bankName ? `<div class="alt bank" style="margin-top:12px">
      <h3>🏦 Bank Transfer</h3>
      <div class="alt-r">Bank: <b>${bankName}</b></div>
      <div class="alt-r">Account: <b>${bankAccount}</b></div>
      ${bankBranch ? `<div class="alt-r">Branch: <b>${bankBranch}</b></div>` : ''}
      <div class="alt-r">Reference: <b>${invoice.id}</b></div>
    </div>` : ''}
  </div>
  <div class="ftr">
    <p><b>${companyName}</b> · Nairobi, Kenya</p>
    <p>Automated payment request · Reply to this email for queries</p>
    <p><a href="${portalUrl}">Open payment portal</a></p>
  </div>
</div>
</body>
</html>`;
}

async function sendInvoiceEmail({ to, invoice, portalUrl, settings }) {
    const rootSettings = { ...loadServerSettings(), ...(settings || {}) };
    const companyName =
        settings?.companyName || rootSettings?.companyName || process.env.COMPANY_NAME;

    const html = buildHTML({
        invoice,
        portalUrl,
        companyName,
        paybillNumber: settings?.paybillNumber || rootSettings?.paybillNumber || process.env.MPESA_PAYBILL,
        bankName: settings?.bankName || rootSettings?.bankName || process.env.BANK_NAME,
        bankAccount: settings?.bankAccount || rootSettings?.bankAccount || process.env.BANK_ACCOUNT,
        bankBranch: settings?.bankBranch || rootSettings?.bankBranch || process.env.BANK_BRANCH,
    });

    const identity = resolveClientEmailIdentity(rootSettings);
    const subject = `Payment Request — ${invoice.id} — KES ${Number(invoice.amount).toLocaleString('en-KE')}`;
    const text = `Payment request from ${companyName}.
Invoice: ${invoice.id}
Amount: KES ${Number(invoice.amount).toLocaleString('en-KE')}
Due: ${invoice.due}
Pay online: ${portalUrl}`;

    await sendWithFromCandidates({
        to,
        subject,
        html,
        text,
        fromCandidates: identity.fromCandidates,
        replyTo: identity.replyTo,
    });
}

// ── Driver welcome email (sent when account is first created)
async function sendDriverWelcomeEmail({ to, driverName, resetUrl, companyName, settings }) {
    const rootSettings = { ...loadServerSettings(), ...(settings || {}) };
    const identity = resolveDriverPortalEmailIdentity(rootSettings);
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
      <b>Portal address:</b> driver.example.com<br><br>
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

    await sendWithFromCandidates({
        to,
        subject: `Set up your ${companyName} driver portal account`,
        html,
        text: `Hi ${driverName},\n\nYour driver account has been created.\nSet your password here: ${resetUrl}\n\nThis link expires in 72 hours.\n\n${companyName}`,
        fromCandidates: identity.fromCandidates,
        replyTo: identity.replyTo,
    });
}

// ── Password reset email (forgot password flow)
async function sendPasswordResetEmail({ to, driverName, resetUrl, companyName, settings }) {
    const rootSettings = { ...loadServerSettings(), ...(settings || {}) };
    const identity = resolveDriverPortalEmailIdentity(rootSettings);
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

    await sendWithFromCandidates({
        to,
        subject: `Reset your ${companyName} driver portal password`,
        html,
        text: `Hi ${driverName},\n\nReset your password here: ${resetUrl}\n\nThis link expires in 72 hours.\nIf you didn't request this, ignore this email.\n\n${companyName}`,
        fromCandidates: identity.fromCandidates,
        replyTo: identity.replyTo,
    });
}

// ── Payment receipt email (sent after a payment is recorded — M-Pesa or manual)
async function sendPaymentReceiptEmail({ to, clientName, invoice, payment, companyName, settings }) {
    const rootSettings = { ...loadServerSettings(), ...(settings || {}) };
    const identity = resolveClientEmailIdentity(rootSettings);
    const totalPaid = (invoice.payments || []).reduce((s, p) => s + +p.amount, 0);
    const outstanding = Math.max(0, +invoice.amount - totalPaid);
    const isFullyPaid = outstanding === 0;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,${isFullyPaid ? '#059669,#10b981' : '#1B3A6B,#0d2347'});padding:32px 40px;text-align:center}
.hdr h1{color:#fff;font-size:22px;font-weight:800;margin:0}
.hdr p{color:${isFullyPaid ? '#a7f3d0' : '#8ab0d8'};font-size:14px;margin:8px 0 0}
.body{padding:32px 40px}
.box{background:#f8fafc;border-radius:10px;padding:18px 22px;margin-bottom:20px}
.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e9ecef;font-size:14px}
.row:last-child{border-bottom:none;font-weight:800;font-size:16px;padding-top:12px}
.lbl{color:#6b7280}.val{color:#111827;font-weight:600}
.green{color:#059669}.amber{color:#d97706}.red{color:#dc2626}
.code-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;text-align:center;margin-bottom:20px}
.code{font-family:monospace;font-size:20px;font-weight:800;color:#059669;letter-spacing:3px}
.ftr{background:#1B3A6B;padding:18px 40px;text-align:center}
.ftr p{color:#8ab0d8;font-size:12px;margin:3px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>${isFullyPaid ? '✅ Payment Received' : '💚 Partial Payment Received'}</h1>
    <p>${companyName} · Nairobi, Kenya</p>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#374151;margin-bottom:20px;line-height:1.6">
      Dear <b>${clientName}</b>,<br><br>
      Thank you — we have received your payment${isFullyPaid ? '. Your invoice is now fully settled.' : '. A balance remains outstanding.'}
    </p>

    ${payment.mpesaCode ? `
    <div class="code-box">
      <div style="font-size:12px;color:#6b7280;margin-bottom:6px">M-Pesa confirmation code</div>
      <div class="code">${payment.mpesaCode}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:6px">Keep this for your records</div>
    </div>` : ''}

    <div class="box">
      <div class="row"><span class="lbl">Invoice</span><span class="val">${invoice.id}</span></div>
      <div class="row"><span class="lbl">Client</span><span class="val">${invoice.client}</span></div>
      <div class="row"><span class="lbl">Invoice total</span><span class="val">KES ${Number(invoice.amount).toLocaleString('en-KE')}</span></div>
      <div class="row"><span class="lbl">This payment</span><span class="val green">KES ${Number(payment.amount).toLocaleString('en-KE')}</span></div>
      <div class="row"><span class="lbl">Payment method</span><span class="val">${payment.method}</span></div>
      <div class="row"><span class="lbl">Payment date</span><span class="val">${payment.date}</span></div>
      <div class="row">
        <span class="lbl">Balance outstanding</span>
        <span class="val ${isFullyPaid ? 'green' : 'amber'}">${isFullyPaid ? 'KES 0 — Fully paid ✅' : `KES ${outstanding.toLocaleString('en-KE')}`}</span>
      </div>
    </div>

    ${!isFullyPaid ? `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;margin-bottom:20px">
      ⚠️ Outstanding balance: <b>KES ${outstanding.toLocaleString('en-KE')}</b>.
      Please settle by <b>${invoice.due || 'the due date'}</b>.
    </div>` : ''}
  </div>
  <div class="ftr">
    <p><b>${companyName}</b> · Nairobi, Kenya</p>
    <p>This is an automated payment receipt. Reply for any queries.</p>
  </div>
</div>
</body>
</html>`;

    const subject = isFullyPaid
        ? `Payment received — ${invoice.id} · KES ${Number(payment.amount).toLocaleString('en-KE')} — ${companyName}`
        : `Partial payment received — ${invoice.id} · KES ${outstanding.toLocaleString('en-KE')} outstanding`;

    const text = `Hi ${clientName},\n\nPayment received: KES ${Number(payment.amount).toLocaleString('en-KE')}\nInvoice: ${invoice.id}\nM-Pesa code: ${payment.mpesaCode || 'N/A'}\nOutstanding: KES ${outstanding.toLocaleString('en-KE')}\n\n${companyName}`;

    await sendWithFromCandidates({
        to,
        subject,
        html,
        text,
        fromCandidates: identity.fromCandidates,
        replyTo: identity.replyTo,
    });
}

module.exports = { sendInvoiceEmail, sendDriverWelcomeEmail, sendPasswordResetEmail, sendPaymentReceiptEmail };
