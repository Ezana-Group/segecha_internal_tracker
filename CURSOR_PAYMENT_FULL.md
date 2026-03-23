# Segecha Payment System — Full Cursor AI Prompt

You are building a complete payment system for Segecha Group Ltd, a road transport company in Nairobi, Kenya. This creates three things that work together:

1. A **backend API server** (`server/`) — handles M-Pesa STK Push, email, and SMS securely
2. A **client-facing payment portal** (`payment-portal/`) — hosted at `payment.segecha.com`
3. **Changes to `src/App.jsx`** — adds a Send Payment Request button and modal to the Invoices page

**Non-negotiable rules:**
- Work through each part in order. Do not skip ahead.
- Run the app after each part and confirm it works before moving on.
- All changes to `App.jsx` are additive — nothing existing is removed or restructured.
- Keep all Kenyan localisation intact: KES currency, M-Pesa references, +254 phone format.
- The Daraja API runs in **sandbox mode** by default. No real charges occur during testing.
- After completing all three parts, deploy using the instructions in Part D.

---

## PART A — Backend API Server

### A.1 — Create the server folder and install dependencies

Run these commands from the project root:

```bash
mkdir server
cd server
npm init -y
npm install express cors dotenv axios @sendgrid/mail africastalking
```

---

### A.2 — Create `server/.env`

```env
PORT=3001

# ── M-Pesa Daraja (Safaricom) ──────────────────────────────────────────────
# Sandbox credentials — safe for testing, no real charges
# Switch to production values when Daraja approves your live application
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_sandbox_consumer_key_here
MPESA_CONSUMER_SECRET=your_sandbox_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://your-render-server.onrender.com/api/mpesa/callback

# ── SendGrid Email ─────────────────────────────────────────────────────────
# Free tier at sendgrid.com — authenticate your domain first
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=payments@segecha.com
EMAIL_FROM_NAME=Segecha Group Ltd

# ── Africa's Talking SMS ───────────────────────────────────────────────────
# For sandbox testing: username=sandbox, any API key
AT_USERNAME=sandbox
AT_API_KEY=your_africastalking_api_key_here
AT_SENDER_ID=SEGECHA

# ── URLs ───────────────────────────────────────────────────────────────────
PORTAL_URL=https://payment.segecha.com
TRACKER_URL=http://localhost:5173

# ── Public company details (shown on payment portal) ──────────────────────
COMPANY_NAME=Segecha Group Ltd
MPESA_PAYBILL=your_paybill_number_here
BANK_NAME=Equity Bank
BANK_ACCOUNT=your_account_number_here
BANK_BRANCH=Westlands, Nairobi
```

---

### A.3 — Create `server/mpesa.js`

```js
const axios = require('axios');

const BASE = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

async function getAccessToken() {
    const auth = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');
    const res = await axios.get(
        `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
    );
    return res.data.access_token;
}

function getTimestamp() {
    return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
}

function getPassword(timestamp) {
    const raw = `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
    return Buffer.from(raw).toString('base64');
}

async function stkPush({ phone, amount, accountRef, description }) {
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = getPassword(timestamp);

    // Normalise: 0712345678 or +254712345678 → 254712345678
    const normalised = phone.replace(/^\+/, '').replace(/^0/, '254');

    const payload = {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: normalised,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: normalised,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountRef,
        TransactionDesc: description,
    };

    const res = await axios.post(
        `${BASE}/mpesa/stkpush/v1/processrequest`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
}

module.exports = { stkPush };
```

---

### A.4 — Create `server/email.js`

```js
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
      <div class="cta-sub">Secure payment portal · payment.segecha.com</div>
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
    const html = buildHTML({
        invoice, portalUrl,
        companyName: settings.companyName || process.env.COMPANY_NAME,
        paybillNumber: settings.paybillNumber || process.env.MPESA_PAYBILL,
        bankName: settings.bankName || process.env.BANK_NAME,
        bankAccount: settings.bankAccount || process.env.BANK_ACCOUNT,
        bankBranch: settings.bankBranch || process.env.BANK_BRANCH,
    });

    await sgMail.send({
        to,
        from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME },
        subject: `Payment Request — ${invoice.id} — KES ${Number(invoice.amount).toLocaleString('en-KE')}`,
        html,
        text: `Payment request from ${settings.companyName}.\nInvoice: ${invoice.id}\nAmount: KES ${Number(invoice.amount).toLocaleString('en-KE')}\nDue: ${invoice.due}\nPay online: ${portalUrl}`,
    });
}

module.exports = { sendInvoiceEmail };
```

---

### A.5 — Create `server/sms.js`

```js
const AfricasTalking = require('africastalking');

let at;
const getAT = () => {
    if (!at) at = AfricasTalking({ username: process.env.AT_USERNAME, apiKey: process.env.AT_API_KEY });
    return at;
};

async function sendPaymentSMS({ phone, clientName, invoiceId, amount, portalUrl }) {
    // Normalise phone to international format
    const normalised = phone.startsWith('+') ? phone : phone.replace(/^0/, '+254');

    const message = [
        `Hi ${clientName},`,
        `Payment request from Segecha Group Ltd.`,
        `Invoice: ${invoiceId}`,
        `Amount: KES ${Number(amount).toLocaleString('en-KE')}`,
        `Pay here: ${portalUrl}`,
        `M-Pesa, Card & Bank accepted.`,
    ].join('\n');

    await getAT().SMS.send({
        to: [normalised],
        message,
        from: process.env.AT_SENDER_ID || 'SEGECHA',
    });
}

module.exports = { sendPaymentSMS };
```

---

### A.6 — Create `server/index.js`

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { stkPush } = require('./mpesa');
const { sendInvoiceEmail } = require('./email');
const { sendPaymentSMS } = require('./sms');

const app = express();

app.use(cors({
    origin: [
        process.env.TRACKER_URL,
        process.env.PORTAL_URL,
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4173',
    ]
}));
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
app.post('/api/mpesa/callback', (req, res) => {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (callback.ResultCode === 0) {
        const items = callback.CallbackMetadata?.Item || [];
        const get = name => items.find(i => i.Name === name)?.Value;
        // Log confirmed payment — in future this will update invoice status in database
        console.log('✅ M-Pesa payment confirmed:', {
            invoiceId: callback.AccountReference,
            amount: get('Amount'),
            mpesaCode: get('MpesaReceiptNumber'),
            phone: get('PhoneNumber'),
            timestamp: get('TransactionDate'),
        });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n🚛 Segecha payment server running on port ${PORT}`);
    console.log(`   M-Pesa mode: ${process.env.MPESA_ENV || 'sandbox'}`);
    console.log(`   Portal URL:  ${process.env.PORTAL_URL}`);
    console.log(`   Health:      http://localhost:${PORT}/health\n`);
});
```

**To start the server locally for testing:**
```bash
cd server
node index.js
```

Verify it works by visiting `http://localhost:3001/health` — you should see `{"status":"ok"}`.

---

## PART B — Payment Portal

Create a separate React app for the client-facing payment portal.

### B.1 — Create the portal app

Run from the project root (not inside `server/`):

```bash
cd ..
npm create vite@latest payment-portal -- --template react
cd payment-portal
npm install
```

---

### B.2 — Create `payment-portal/.env`

```env
VITE_API_URL=http://localhost:3001
VITE_FLW_PUBLIC_KEY=your_flutterwave_public_key_here
```

---

### B.3 — Replace the entire contents of `payment-portal/src/App.jsx` with:

```jsx
import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const STEPS = {
    SELECT: 'select',
    MPESA_STK: 'mpesa_stk',
    MPESA_MANUAL: 'mpesa_manual',
    BANK: 'bank',
    CARD: 'card',
    PESALINK: 'pesalink',
    CASH: 'cash',
    SUCCESS: 'success',
};

export default function PaymentPortal() {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('inv') || 'INV-UNKNOWN';
    const amount = +params.get('amount') || 0;
    const client = params.get('client') || 'Valued Client';

    const [step, setStep] = useState(STEPS.SELECT);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [stkPending, setStkPending] = useState(false);
    const [settings, setSettings] = useState({ companyName: 'Segecha Group Ltd' });

    useEffect(() => {
        fetch(`${API}/api/public-settings`)
            .then(r => r.json())
            .then(setSettings)
            .catch(() => {});
    }, []);

    const { companyName, paybillNumber, bankName, bankAccount, bankBranch } = settings;

    const triggerSTK = async () => {
        if (!/^(0|254|\+254)7\d{8}$/.test(phone.replace(/\s/g, ''))) {
            setError('Enter a valid Kenyan M-Pesa number — e.g. 0712 345 678');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/api/mpesa/stk-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone.replace(/\s/g, ''), amount, invoiceId, clientName: client }),
            });
            const data = await res.json();
            if (data.success) setStkPending(true);
            else setError(data.error || 'Payment prompt failed — please try again');
        } catch {
            setError('Could not reach payment server. Please try another payment method.');
        }
        setLoading(false);
    };

    const goBack = () => { setStep(STEPS.SELECT); setStkPending(false); setError(''); };

    const S = {
        page: { minHeight: '100vh', background: 'linear-gradient(160deg, #0d1b35 0%, #1B3A6B 60%, #0d2347 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Helvetica Neue', Arial, sans-serif" },
        card: { background: '#fff', borderRadius: 20, padding: 40, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,.35)' },
        logo: { textAlign: 'center', marginBottom: 28 },
        logoIcon: { fontSize: 38, marginBottom: 8 },
        logoName: { fontSize: 22, fontWeight: 800, color: '#1B3A6B', letterSpacing: -0.5 },
        logoSub: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
        invBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', marginBottom: 28 },
        invRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#374151', marginBottom: 6 },
        invTotal: { display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, color: '#E8501A', marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' },
        sectionTitle: { fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
        method: { width: '100%', padding: '14px 18px', borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, textAlign: 'left', transition: 'border-color .15s, background .15s' },
        mIcon: { fontSize: 26, width: 36, textAlign: 'center', flexShrink: 0 },
        mLabel: { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 },
        mSub: { fontSize: 12, color: '#6b7280' },
        mArrow: { marginLeft: 'auto', color: '#d1d5db', fontSize: 20, flexShrink: 0 },
        back: { background: 'none', border: 'none', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '0 0 16px', display: 'block' },
        stepTitle: { fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 18 },
        inp: { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #d1d5db', fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 10 },
        btn: c => ({ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, color: '#fff', background: c === 'green' ? 'linear-gradient(135deg,#059669,#10b981)' : c === 'blue' ? 'linear-gradient(135deg,#1B3A6B,#2563eb)' : c === 'purple' ? 'linear-gradient(135deg,#6b21a8,#9333ea)' : 'linear-gradient(135deg,#E8501A,#d4400f)' }),
        error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 },
        infoBox: (bg, border) => ({ background: bg || '#f0fdf4', border: `1px solid ${border || '#bbf7d0'}`, borderRadius: 12, padding: 20, marginBottom: 16 }),
        infoRow: { fontSize: 14, color: '#374151', marginBottom: 7 },
        pending: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 24, textAlign: 'center' },
        step: i => ({ display: 'flex', gap: 10, marginBottom: 10, fontSize: 14, color: '#374151', alignItems: 'flex-start' }),
        stepNum: { background: '#10b981', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
        success: { textAlign: 'center', padding: '10px 0' },
        footer: { textAlign: 'center', marginTop: 28, paddingTop: 18, borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#9ca3af', lineHeight: 1.8 },
    };

    const METHODS = [
        { id: STEPS.MPESA_STK, icon: '💚', label: 'M-Pesa STK Push', sub: 'We send a payment prompt straight to your phone' },
        { id: STEPS.MPESA_MANUAL, icon: '📱', label: 'M-Pesa Paybill', sub: 'Pay manually — enter Paybill number on your phone' },
        { id: STEPS.BANK, icon: '🏦', label: 'Bank Transfer / EFT', sub: 'Pay directly to our bank account' },
        { id: STEPS.PESALINK, icon: '🔗', label: 'Pesalink', sub: 'Instant interbank transfer via your banking app' },
        { id: STEPS.CARD, icon: '💳', label: 'Credit / Debit Card', sub: 'Visa, Mastercard — secured by Flutterwave' },
        { id: STEPS.CASH, icon: '💵', label: 'Cash Payment', sub: 'Pay in person — confirm your intention here' },
    ];

    return (
        <div style={S.page}>
            <div style={S.card}>

                {/* Header */}
                <div style={S.logo}>
                    <div style={S.logoIcon}>🚛</div>
                    <div style={S.logoName}>{companyName}</div>
                    <div style={S.logoSub}>🔒 Secure Payment Portal</div>
                </div>

                {/* Invoice summary — always visible */}
                <div style={S.invBox}>
                    <div style={S.invRow}><span style={{ color: '#6b7280' }}>Client</span><b>{client}</b></div>
                    <div style={S.invRow}><span style={{ color: '#6b7280' }}>Invoice</span><span style={{ fontFamily: 'monospace', color: '#1B3A6B', fontWeight: 700 }}>{invoiceId}</span></div>
                    <div style={S.invTotal}><span>Amount Due</span><span>{fmt(amount)}</span></div>
                </div>

                {/* ── SELECT METHOD ── */}
                {step === STEPS.SELECT && (
                    <>
                        <div style={S.sectionTitle}>Choose how to pay</div>
                        {METHODS.map(m => (
                            <button key={m.id} style={S.method}
                                onClick={() => { setStep(m.id); setError(''); }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B3A6B'; e.currentTarget.style.background = '#f8faff'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
                            >
                                <span style={S.mIcon}>{m.icon}</span>
                                <span>
                                    <div style={S.mLabel}>{m.label}</div>
                                    <div style={S.mSub}>{m.sub}</div>
                                </span>
                                <span style={S.mArrow}>›</span>
                            </button>
                        ))}
                    </>
                )}

                {/* ── MPESA STK PUSH ── */}
                {step === STEPS.MPESA_STK && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>💚 M-Pesa STK Push</div>
                        {stkPending ? (
                            <div style={S.pending}>
                                <div style={{ fontSize: 48, marginBottom: 14 }}>📲</div>
                                <div style={{ fontWeight: 800, fontSize: 17, color: '#92400e', marginBottom: 10 }}>Check your phone!</div>
                                <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.7 }}>
                                    A payment request of <b>{fmt(amount)}</b> has been sent to <b>{phone}</b>.<br />
                                    Open M-Pesa and enter your PIN to complete the payment.
                                </div>
                                <div style={{ marginTop: 18, fontSize: 13, color: '#a16207' }}>Didn't receive it?</div>
                                <button style={{ ...S.btn('blue'), marginTop: 10, padding: '11px' }} onClick={() => setStkPending(false)}>Resend prompt</button>
                            </div>
                        ) : (
                            <>
                                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 20 }}>
                                    Enter the M-Pesa number registered to your account. We will send a payment prompt instantly — just enter your PIN to pay {fmt(amount)}.
                                </p>
                                {error && <div style={S.error}>{error}</div>}
                                <input style={S.inp} type="tel" placeholder="e.g. 0712 345 678" value={phone}
                                    onChange={e => setPhone(e.target.value)} maxLength={15} />
                                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                                    Amount to be charged: <b style={{ color: '#E8501A' }}>{fmt(amount)}</b>
                                </div>
                                <button style={S.btn()} onClick={triggerSTK} disabled={loading}>
                                    {loading ? '⏳ Sending prompt...' : `Send M-Pesa Request — ${fmt(amount)}`}
                                </button>
                            </>
                        )}
                    </>
                )}

                {/* ── MPESA PAYBILL ── */}
                {step === STEPS.MPESA_MANUAL && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>📱 M-Pesa Paybill</div>
                        <div style={S.infoBox()}>
                            <div style={{ fontWeight: 700, color: '#065f46', fontSize: 14, marginBottom: 14 }}>Steps to pay on your phone:</div>
                            {[
                                'Open M-Pesa on your phone',
                                'Select Lipa na M-Pesa',
                                'Select Pay Bill',
                                `Business No: ${paybillNumber || '—'}`,
                                `Account No: ${invoiceId}`,
                                `Amount: KES ${amount.toLocaleString('en-KE')}`,
                                'Enter your M-Pesa PIN and confirm',
                            ].map((s, i) => (
                                <div key={i} style={S.step(i)}>
                                    <span style={S.stepNum}>{i + 1}</span>
                                    <span style={{ paddingTop: 2 }}>{s}</span>
                                </div>
                            ))}
                        </div>
                        <button style={S.btn('green')} onClick={() => setStep(STEPS.SUCCESS)}>I've completed this payment ✓</button>
                    </>
                )}

                {/* ── BANK TRANSFER ── */}
                {step === STEPS.BANK && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>🏦 Bank Transfer</div>
                        <div style={S.infoBox('#eff6ff', '#bfdbfe')}>
                            <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 14, marginBottom: 14 }}>Bank Account Details</div>
                            {[
                                ['Bank', bankName || '—'],
                                ['Account Name', companyName],
                                ['Account Number', bankAccount || '—'],
                                ['Branch', bankBranch || '—'],
                                ['Reference', invoiceId],
                                ['Amount', fmt(amount)],
                            ].map(([l, v]) => (
                                <div key={l} style={S.infoRow}><span style={{ color: '#6b7280' }}>{l}: </span><b>{v}</b></div>
                            ))}
                        </div>
                        <div style={{ fontSize: 12, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
                            ⚠️ Always use <b>{invoiceId}</b> as the reference so we can match your payment.
                        </div>
                        <button style={S.btn('blue')} onClick={() => setStep(STEPS.SUCCESS)}>I've made the transfer ✓</button>
                    </>
                )}

                {/* ── PESALINK ── */}
                {step === STEPS.PESALINK && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>🔗 Pesalink</div>
                        <div style={S.infoBox('#fdf4ff', '#e9d5ff')}>
                            <div style={{ fontWeight: 700, color: '#6b21a8', fontSize: 14, marginBottom: 14 }}>Pay via Pesalink (Interbank)</div>
                            {[
                                'Open your bank\'s mobile app or internet banking',
                                'Select Send Money or Pesalink',
                                `Bank: ${bankName || '—'}`,
                                `Account: ${bankAccount || '—'}`,
                                `Reference: ${invoiceId}`,
                                `Amount: ${fmt(amount)}`,
                            ].map((s, i) => (
                                <div key={i} style={S.step(i)}>
                                    <span style={{ ...S.stepNum, background: '#9333ea' }}>{i + 1}</span>
                                    <span style={{ paddingTop: 2 }}>{s}</span>
                                </div>
                            ))}
                        </div>
                        <button style={S.btn('purple')} onClick={() => setStep(STEPS.SUCCESS)}>I've completed the transfer ✓</button>
                    </>
                )}

                {/* ── CARD (FLUTTERWAVE) ── */}
                {step === STEPS.CARD && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>💳 Card Payment</div>
                        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 20 }}>
                            Pay securely by card. You'll be taken through Flutterwave's checkout — Visa and Mastercard accepted.
                        </p>
                        <div style={{ ...S.infoBox('#f8fafc', '#e2e8f0'), marginBottom: 20 }}>
                            <div style={S.infoRow}>Invoice: <b>{invoiceId}</b></div>
                            <div style={S.infoRow}>Amount: <b style={{ color: '#E8501A' }}>{fmt(amount)}</b></div>
                        </div>
                        <button style={S.btn()} onClick={() => {
                            const flwKey = import.meta.env.VITE_FLW_PUBLIC_KEY;
                            if (!flwKey) {
                                alert('Card payments are not yet configured. Please use M-Pesa or bank transfer.');
                                return;
                            }
                            window.FlutterwaveCheckout({
                                public_key: flwKey,
                                tx_ref: `${invoiceId}-${Date.now()}`,
                                amount,
                                currency: 'KES',
                                customer: { email: '', name: client },
                                customizations: {
                                    title: companyName,
                                    description: `Payment for invoice ${invoiceId}`,
                                    logo: '',
                                },
                                callback: response => {
                                    if (response.status === 'successful') setStep(STEPS.SUCCESS);
                                },
                                onclose: () => {},
                            });
                        }}>
                            Pay {fmt(amount)} by Card →
                        </button>
                        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>
                            🔒 Secured by Flutterwave · Visa & Mastercard
                        </div>
                        <script src="https://checkout.flutterwave.com/v3.js" />
                    </>
                )}

                {/* ── CASH ── */}
                {step === STEPS.CASH && (
                    <>
                        <button style={S.back} onClick={goBack}>← Back</button>
                        <div style={S.stepTitle}>💵 Cash Payment</div>
                        <div style={S.infoBox('#fffbeb', '#fde68a')}>
                            <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14, marginBottom: 12 }}>Cash payment selected</div>
                            <div style={S.infoRow}>Invoice: <b>{invoiceId}</b></div>
                            <div style={S.infoRow}>Amount: <b style={{ color: '#E8501A' }}>{fmt(amount)}</b></div>
                            <div style={{ marginTop: 12, fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                                Please arrange cash payment directly with <b>{companyName}</b>. 
                                Use <b>{invoiceId}</b> as your reference when making the payment.
                            </div>
                        </div>
                        <button style={S.btn('blue')} onClick={() => setStep(STEPS.SUCCESS)}>Confirm cash payment intention ✓</button>
                    </>
                )}

                {/* ── SUCCESS ── */}
                {step === STEPS.SUCCESS && (
                    <div style={S.success}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#065f46', marginBottom: 12 }}>
                            Payment Submitted!
                        </div>
                        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.8, marginBottom: 24 }}>
                            Thank you, <b>{client}</b>.<br />
                            Your payment of <b style={{ color: '#E8501A' }}>{fmt(amount)}</b> for invoice <b>{invoiceId}</b> has been submitted.<br /><br />
                            <b>{companyName}</b> will confirm receipt and update your invoice shortly.
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>You can safely close this page.</div>
                    </div>
                )}

                {/* Footer */}
                <div style={S.footer}>
                    🔒 Secure · {companyName} · Nairobi, Kenya<br />
                    <span>For payment queries, contact us directly</span>
                </div>
            </div>
        </div>
    );
}
```

---

### B.4 — Replace `payment-portal/src/main.jsx` with:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode><App /></StrictMode>
);
```

---

### B.5 — Replace `payment-portal/index.html` `<title>` tag:

```html
<title>Pay Securely — Segecha Group Ltd</title>
```

---

### B.6 — Test the portal locally

```bash
cd payment-portal
npm run dev
```

Open `http://localhost:5174/?inv=INV-TEST&amount=85000&client=Test+Client` and verify all 6 payment method flows work.

---

## PART C — Changes to App.jsx (Invoices page)

All changes are additive. Do not remove anything existing.

### C.1 — Add two constants at the top of the file

Find the constants block near the top of `App.jsx` (after the `import` statement). Add:

```js
const PAYMENT_API = 'http://localhost:3001'; // Update to deployed server URL after deployment
const PORTAL_URL = 'https://payment.segecha.com'; // Update to deployed portal URL after deployment
```

---

### C.2 — Add payment state variables

Find the `useState` block (around lines 97–109). Add after `const [showImportPanel, setShowImportPanel] = useState(false);`:

```js
const [paymentModal, setPaymentModal] = useState(null);
const [payReqStatus, setPayReqStatus] = useState({});
```

If `showImportPanel` doesn't exist yet, add after `const [dark, setDark] = useState(false);`.

---

### C.3 — Add payment helpers

Find the `driverName` helper function. Directly before it, add:

```js
// ─── Payment Request Helpers ─────────────────────────────────────────────────
const getSettings = () => {
    try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); }
    catch { return {}; }
};

const buildPortalUrl = (inv) => {
    return `${PORTAL_URL}?inv=${encodeURIComponent(inv.id)}&amount=${inv.amount}&client=${encodeURIComponent(inv.client)}`;
};

const buildWhatsAppUrl = (inv) => {
    const s = getSettings();
    const portalUrl = buildPortalUrl(inv);
    const lines = [
        `Hi ${inv.client},`,
        ``,
        `Payment request from *${s.companyName || 'Segecha Group Ltd'}*.`,
        ``,
        `📋 *Invoice:* ${inv.id}`,
        `💰 *Amount Due:* KES ${Number(inv.amount).toLocaleString('en-KE')}`,
        `📅 *Due Date:* ${inv.due}`,
        ``,
        `Pay securely here 👉 ${portalUrl}`,
        ``,
        `_M-Pesa, Card, Bank Transfer & Pesalink accepted._`,
    ];
    const cleanPhone = (inv.phone || '').replace(/\s/g, '').replace(/^0/, '254').replace(/^\+/, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
};

const sendEmailRequest = async (inv, emailAddress) => {
    const s = getSettings();
    setPayReqStatus(st => ({ ...st, email: { loading: true } }));
    try {
        const res = await fetch(`${PAYMENT_API}/api/send/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: emailAddress, invoice: inv, settings: s }),
        });
        const data = await res.json();
        if (data.success) setPayReqStatus(st => ({ ...st, email: { success: true } }));
        else setPayReqStatus(st => ({ ...st, email: { error: data.error || 'Failed to send' } }));
    } catch {
        setPayReqStatus(st => ({ ...st, email: { error: 'Server not reachable — is it running?' } }));
    }
};

const sendSMSRequest = async (inv) => {
    setPayReqStatus(st => ({ ...st, sms: { loading: true } }));
    try {
        const res = await fetch(`${PAYMENT_API}/api/send/sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: inv.phone, clientName: inv.client, invoiceId: inv.id, amount: inv.amount }),
        });
        const data = await res.json();
        if (data.success) setPayReqStatus(st => ({ ...st, sms: { success: true } }));
        else setPayReqStatus(st => ({ ...st, sms: { error: data.error || 'Failed to send' } }));
    } catch {
        setPayReqStatus(st => ({ ...st, sms: { error: 'Server not reachable — is it running?' } }));
    }
};

const sendSTKPushToClient = async (inv, clientPhone) => {
    setPayReqStatus(st => ({ ...st, stk: { loading: true } }));
    try {
        const res = await fetch(`${PAYMENT_API}/api/mpesa/stk-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: clientPhone, amount: inv.amount, invoiceId: inv.id, clientName: inv.client }),
        });
        const data = await res.json();
        if (data.success) setPayReqStatus(st => ({ ...st, stk: { success: true } }));
        else setPayReqStatus(st => ({ ...st, stk: { error: data.error || 'STK Push failed' } }));
    } catch {
        setPayReqStatus(st => ({ ...st, stk: { error: 'Server not reachable — is it running?' } }));
    }
};
```

---

### C.4 — Add the PaymentRequestModal component

Find the `Modal` component (around line 225). After its closing `);`, add the entire `PaymentRequestModal` component:

```jsx
const PaymentRequestModal = ({ inv }) => {
    const s = getSettings();
    const portalUrl = buildPortalUrl(inv);
    const [clientEmail, setClientEmail] = useState(inv.email || '');
    const [stkPhone, setStkPhone] = useState(inv.phone || '');
    const [copied, setCopied] = useState(false);

    const copyLink = () => {
        navigator.clipboard.writeText(portalUrl)
            .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); })
            .catch(() => { prompt('Copy this payment link:', portalUrl); });
    };

    const statusTag = (key) => {
        const st = payReqStatus[key] || {};
        if (st.loading) return <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>⏳ Sending…</span>;
        if (st.success) return <span style={{ color: '#10b981', fontSize: 11, fontWeight: 600 }}>✅ Sent!</span>;
        if (st.error) return <span style={{ color: '#ef4444', fontSize: 11 }}>❌ {st.error}</span>;
        return null;
    };

    const channelBox = (children, accent) => ({
        padding: 16,
        borderRadius: 10,
        border: `1px solid ${accent || T.border}`,
        background: dark ? '#10141f' : '#fafafa',
        marginBottom: 12,
    });

    return (
        <div style={S.ovl} onClick={() => { setPaymentModal(null); setPayReqStatus({}); }}>
            <div style={{ ...S.mbox, width: 'min(560px,95vw)', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}>

                <div style={S.mtitle}>📤 Send Payment Request</div>

                {/* Invoice summary */}
                <div style={{ background: dark ? '#0c0e14' : '#f8fafc', borderRadius: 10, padding: '14px 18px', marginBottom: 22, border: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ color: T.textFaint }}>Client</span>
                        <b style={{ color: T.text }}>{inv.client}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ color: T.textFaint }}>Invoice</span>
                        <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>{inv.id}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                        <span style={{ color: T.text }}>Amount Due</span>
                        <span style={{ color: '#E8501A' }}>{fmt(inv.amount)}</span>
                    </div>
                </div>

                {/* Payment link */}
                <div style={{ marginBottom: 18 }}>
                    <label style={S.lbl}>Payment Portal Link</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input style={{ ...S.inp, flex: 1, fontSize: 11, fontFamily: 'monospace', color: '#38bdf8' }}
                            value={portalUrl} readOnly onClick={e => e.target.select()} />
                        <button style={{ ...S.btn('ghost'), padding: '8px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
                            onClick={copyLink}>
                            {copied ? '✅ Copied!' : '📋 Copy'}
                        </button>
                    </div>
                </div>

                {/* WhatsApp */}
                <div style={channelBox(null, '#25d36633')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>💬 WhatsApp</span>
                        <span style={{ fontSize: 11, color: T.textFaint }}>Pre-written message + link</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 10 }}>
                        To: {inv.phone || <span style={{ color: '#f59e0b' }}>No phone on invoice — edit to add</span>}
                    </div>
                    <a href={buildWhatsAppUrl(inv)} target="_blank" rel="noreferrer"
                        style={{ ...S.btn('ghost'), display: 'inline-block', textDecoration: 'none', fontSize: 12, padding: '8px 16px', background: '#25d36618', color: '#25d366', border: '1px solid #25d36644', borderRadius: 8 }}>
                        Open WhatsApp →
                    </a>
                </div>

                {/* Email */}
                <div style={channelBox(null, '#3b82f633')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>📧 Email</span>
                        {statusTag('email')}
                    </div>
                    <input style={{ ...S.inp, marginBottom: 8 }} type="email"
                        placeholder="client@company.com" value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)} />
                    <button style={{ ...S.btn('ghost'), fontSize: 12, padding: '8px 16px' }}
                        disabled={payReqStatus.email?.loading}
                        onClick={() => {
                            if (!clientEmail) { alert('Enter client email address'); return; }
                            sendEmailRequest({ ...inv, email: clientEmail }, clientEmail);
                        }}>
                        Send Invoice + Payment Link
                    </button>
                </div>

                {/* SMS */}
                <div style={channelBox(null, '#a78bfa33')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>📱 SMS</span>
                        {statusTag('sms')}
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 10 }}>
                        To: {inv.phone || <span style={{ color: '#f59e0b' }}>No phone on invoice</span>}
                    </div>
                    <button style={{ ...S.btn('ghost'), fontSize: 12, padding: '8px 16px' }}
                        disabled={payReqStatus.sms?.loading}
                        onClick={() => {
                            if (!inv.phone) { alert('No phone number on invoice. Edit the invoice to add one.'); return; }
                            sendSMSRequest(inv);
                        }}>
                        Send Payment Link via SMS
                    </button>
                </div>

                {/* M-Pesa STK Push to client */}
                <div style={channelBox(dark ? '#10b98108' : '#f0fdf4', '#10b98144')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: '#10b981', fontSize: 13 }}>💚 M-Pesa STK Push to Client</span>
                        {statusTag('stk')}
                    </div>
                    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 10 }}>
                        Sends a payment prompt of <b style={{ color: '#10b981' }}>{fmt(inv.amount)}</b> to the client's phone.
                        The client opens M-Pesa, sees the request, and enters their PIN to pay.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input style={{ ...S.inp, marginBottom: 0, flex: 1 }} type="tel"
                            placeholder="Client M-Pesa: 07XXXXXXXX"
                            value={stkPhone} onChange={e => setStkPhone(e.target.value)} />
                        <button
                            style={{ background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, padding: '0 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            disabled={payReqStatus.stk?.loading}
                            onClick={() => {
                                if (!stkPhone) { alert('Enter the client\'s M-Pesa number'); return; }
                                sendSTKPushToClient(inv, stkPhone);
                            }}>
                            {payReqStatus.stk?.loading ? '⏳' : '💚 Send'}
                        </button>
                    </div>
                    {!s.paybillNumber && (
                        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
                            ⚠️ Set your Paybill number in Settings → M-Pesa for this to work.
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 6 }}>
                        🧪 Sandbox mode — no real charge during testing
                    </div>
                </div>

                <div style={{ marginTop: 4 }}>
                    <button style={S.btn('ghost')} onClick={() => { setPaymentModal(null); setPayReqStatus({}); }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
```

---

### C.5 — Add email field to invoice form

Find inside the invoice modal form:
```jsx
<F label="Client Name" k="client" full /><F label="Client Phone" k="phone" />
```

Replace with:
```jsx
<F label="Client Name" k="client" full />
<F label="Client Phone" k="phone" placeholder="+254 7XX XXX XXX" />
<F label="Client Email" k="email" full placeholder="client@company.com" />
```

---

### C.6 — Add the Send button to the Invoices table

Find in the `Invoices` component, the actions `<td>` inside the invoice table row:
```jsx
<button style={S.btn("sm")} onClick={() => setInvoicePreview(inv)}>View</button>
{inv.status !== "Paid" && <button style={S.btn("green")} onClick={() => markInvoicePaid(inv.id)} >✓ Paid</button>}
```

Replace with:
```jsx
<button style={S.btn("sm")} onClick={() => setInvoicePreview(inv)}>View</button>
{inv.status !== "Paid" && (
    <button
        style={{ ...S.btn("ghost"), border: '1px solid #10b98155', color: '#10b981', fontSize: 11, padding: '5px 10px' }}
        onClick={() => { setPaymentModal(inv); setPayReqStatus({}); }}>
        📤 Send
    </button>
)}
{inv.status !== "Paid" && <button style={S.btn("green")} onClick={() => markInvoicePaid(inv.id)}>✓ Paid</button>}
```

---

### C.7 — Render the PaymentRequestModal

Find the invoicePreview modal block:
```jsx
{invoicePreview && (
    <div style={S.ovl} onClick={() => setInvoicePreview(null)}>
```

After its entire closing `)}`, add:
```jsx
{paymentModal && <PaymentRequestModal inv={paymentModal} />}
```

---

## PART D — Deployment

### D.1 — Push everything to GitHub

```bash
# From the project root
git add .
git commit -m "Add payment portal and multi-channel payment requests"
git push
```

---

### D.2 — Deploy the backend server (Render — free)

1. Go to [render.com](https://render.com) → sign up free
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set **Root Directory** to `server`
5. Build command: `npm install`
6. Start command: `node index.js`
7. Add every key from `server/.env` as environment variables in Render dashboard
8. Click **Deploy** — Render gives you a URL like `https://segecha-payments.onrender.com`
9. Go back to Render env vars and update `MPESA_CALLBACK_URL` to `https://segecha-payments.onrender.com/api/mpesa/callback`
10. Redeploy after updating the callback URL
11. Verify: visit `https://segecha-payments.onrender.com/health` — should return `{"status":"ok"}`

---

### D.3 — Deploy the payment portal (Vercel — free)

1. Go to [vercel.com](https://vercel.com) → sign up free
2. Click **Add New → Project**
3. Import your GitHub repo
4. Set **Root Directory** to `payment-portal`
5. Add environment variable: `VITE_API_URL` = `https://segecha-payments.onrender.com`
6. Click **Deploy** — Vercel gives you a URL like `segecha-portal.vercel.app`
7. In Vercel project → **Settings → Domains** → Add `payment.segecha.com`
8. In your domain DNS settings, add:
   - Type: `CNAME`
   - Name: `payment`
   - Value: `cname.vercel-dns.com`
9. Wait 5–30 minutes for DNS propagation
10. Verify: visit `https://payment.segecha.com?inv=TEST&amount=1000&client=Test` — portal should load

---

### D.4 — Update App.jsx constants to use live URLs

Once both are deployed, update these two lines in `src/App.jsx`:

```js
const PAYMENT_API = 'https://segecha-payments.onrender.com';
const PORTAL_URL = 'https://payment.segecha.com';
```

Commit and push — the tracker will now use the live server for all payment requests.

---

### D.5 — Switch M-Pesa from sandbox to production

After Safaricom approves your Daraja application ([developer.safaricom.co.ke](https://developer.safaricom.co.ke)):

Update these in Render environment variables:
```env
MPESA_ENV=production
MPESA_CONSUMER_KEY=your_live_consumer_key
MPESA_CONSUMER_SECRET=your_live_consumer_secret
MPESA_SHORTCODE=your_live_paybill_or_till
MPESA_PASSKEY=your_live_passkey
```

Redeploy the server. STK Push will now trigger real charges.

---

### D.6 — Set up SendGrid for real email sending

1. [sendgrid.com](https://sendgrid.com) → free account (100 emails/day free)
2. **Settings → Sender Authentication** → authenticate `segecha.com` domain
3. **Settings → API Keys** → Create key → Mail Send permission only
4. Add to Render: `SENDGRID_API_KEY=your_key`
5. Add to Render: `EMAIL_FROM=payments@segecha.com`
6. Redeploy server

---

### D.7 — Set up Africa's Talking for real SMS

1. [africastalking.com](https://africastalking.com) → create account
2. For sandbox testing: username = `sandbox`, any value for API key
3. For production: register Sender ID `SEGECHA` (takes 1–3 business days)
4. Add to Render: `AT_USERNAME=your_username`, `AT_API_KEY=your_key`
5. Redeploy server

---

## Final checklist

After completing all parts, verify:

- [ ] `http://localhost:3001/health` returns `{"status":"ok","env":"sandbox"}`
- [ ] `http://localhost:5174/?inv=INV-001&amount=85000&client=Test` shows the payment portal
- [ ] All 6 payment method flows on the portal complete without errors
- [ ] The `📤 Send` button appears on unpaid invoices in `App.jsx`
- [ ] Clicking Send opens the PaymentRequestModal with the correct invoice details
- [ ] Copy link copies the portal URL to clipboard
- [ ] WhatsApp link opens with pre-written message
- [ ] Email sends (check inbox — also check spam)
- [ ] SMS sends (check Africa's Talking sandbox log)
- [ ] STK Push returns success from Daraja sandbox (check Render logs)
- [ ] After deployment: live portal URL resolves and shows Segecha branding
- [ ] After Daraja approval: real STK Push prompts appear on test phone
