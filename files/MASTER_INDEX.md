# SEGECHA GROUP LTD — MASTER CURSOR AI PROMPT
# Complete System Build Instructions

## READ THIS FIRST — How to use these files

This is the master index for building the complete Segecha Fleet Management System.
The full system is split into **8 numbered prompt files**. Give Cursor **one file per session**,
in order, completing each before starting the next.

**Why split?** Each file is 300–500 lines. Cursor works best with focused, scoped instructions.
One massive file causes context loss and incomplete implementations.

---

## The 8 files — in order

| # | File | What it builds | Est. time |
|---|---|---|---|
| 1 | `PROMPT_01_TRACKER.md` | Main tracker — all refinements, Settings page, import, persistence | 45 min |
| 2 | `PROMPT_02_PAYMENT.md` | Payment portal at payment.segecha.com — M-Pesa STK Push, email, SMS, WhatsApp | 60 min |
| 3 | `PROMPT_03_DRIVER_BASE.md` | Driver portal base at driver.segecha.com — login, tabs, journey view | 45 min |
| 4 | `PROMPT_04_DRIVER_UPLOADS.md` | Email login, Cloudinary photos, maintenance tab, odometer verification | 45 min |
| 5 | `PROMPT_05_DOCUMENTS.md` | Cloudflare R2 document store — insurance, permits, licences, expiry alerts | 45 min |
| 6 | `PROMPT_06_VERIFICATION.md` | Journey completion verification workflow — admin approves/rejects trips | 30 min |
| 7 | `PROMPT_07_FUEL_TURNBOY.md` | Mandatory fuel photos, turnboy management, mileage allowance | 45 min |
| 8 | `PROMPT_08_ROUTE_RATES.md` | Route-specific mileage rates — different KES/km per route | 20 min |

---

## System architecture overview

```
segecha-project/
├── src/
│   └── App.jsx                    ← Main tracker (Prompt 1, 6, 7, 8)
├── server/                        ← Backend API (Prompts 2, 3, 4, 5, 6)
│   ├── index.js
│   ├── mpesa.js
│   ├── email.js
│   ├── sms.js
│   ├── r2.js
│   ├── cloudinary.js
│   ├── driver-auth.js
│   ├── driver-data.js
│   ├── documents.js
│   ├── drivers-auth.json
│   ├── documents.json
│   └── tracker-data.json
├── payment-portal/                ← payment.segecha.com (Prompt 2)
│   └── src/App.jsx
└── driver-portal/                 ← driver.segecha.com (Prompts 3, 4, 6, 7)
    └── src/App.jsx
```

---

## Deployments

| App | URL | Host | Prompt |
|---|---|---|---|
| Main tracker | Internal / localhost | Vite dev server | — |
| Payment portal | payment.segecha.com | Vercel (free) | 2 |
| Driver portal | driver.segecha.com | Vercel (free) | 3 |
| Backend API | segecha-payments.onrender.com | Render (free) | 2 |

---

## Credentials you need before starting

Gather these before giving Cursor the prompts. Each prompt tells you exactly where to put them.

### M-Pesa Daraja (Safaricom)
- Register at: developer.safaricom.co.ke
- Sandbox credentials (test) — get immediately after signup
- Live credentials — apply after testing, approval takes 1–5 days
- Fields needed: Consumer Key, Consumer Secret, Shortcode, Passkey

### Cloudinary (operational photo storage)
- Register free at: cloudinary.com
- Dashboard → copy: Cloud Name, API Key, API Secret
- Free tier: 25GB storage, 25GB bandwidth/month

### Cloudflare R2 (permanent document storage)
- Register free at: dash.cloudflare.com → R2
- Create bucket: `segecha-documents`
- Enable R2.dev public subdomain
- Fields needed: Account ID, Access Key ID, Secret Access Key, Public URL

### SendGrid (email)
- Register free at: sendgrid.com (100 emails/day free)
- Authenticate your domain (settings → Sender Authentication)
- Create API key with Mail Send permission
- Fields needed: API Key, From email address

### Africa's Talking (SMS)
- Register at: africastalking.com
- Sandbox: username=`sandbox`, any API key
- Production: register Sender ID `SEGECHA` (1–3 business days)
- Fields needed: Username, API Key

### Flutterwave (card payments — optional)
- Register at: flutterwave.com
- Fields needed: Public Key (for payment portal frontend)

---

## After all 8 prompts are complete — what you have

### Main tracker (App.jsx)
- ✅ localStorage persistence — data survives refresh
- ✅ Full Settings page — company info, M-Pesa config, bank details, alert thresholds, mileage rates, route overrides, turnboy management, dropdown customisation, backup/restore
- ✅ 20 UX improvements — filters, totals, live calculations, smart forms, alerts
- ✅ Import from CSV/Excel with row-by-row error reporting
- ✅ Journey completion verification workflow — admin approves/rejects
- ✅ Mandatory fuel photos (pump + receipt + odometer)
- ✅ Turnboy management — salaried and casual
- ✅ Mileage allowance — auto-calculated per trip, auto-created as expenses, route-specific rates
- ✅ Document library — per truck and per driver
- ✅ Payment request sending — WhatsApp, email, SMS, STK Push per invoice

### Payment portal (payment.segecha.com)
- ✅ 6 payment methods — M-Pesa STK Push, M-Pesa Paybill, Bank Transfer, Pesalink, Card, Cash
- ✅ Branded with Segecha logo and company details
- ✅ Reads company/bank details live from the server

### Driver portal (driver.segecha.com)
- ✅ Email + password login
- ✅ 5 tabs: Home, Trips, Submit, Maintenance, Pay
- ✅ Journey status updates — Loading → In Transit (with start odometer + photo)
- ✅ Trip completion — submits for office verification (not self-completed)
- ✅ Fuel submissions — all 3 photos mandatory
- ✅ Expense claims and incident reports
- ✅ Maintenance logging
- ✅ Payslip view + print
- ✅ Own document upload (PSV licence, medical)
- ✅ Mileage allowance visible per trip

### Backend server (server/)
- ✅ M-Pesa STK Push — Safaricom Daraja API
- ✅ M-Pesa callback handler
- ✅ SendGrid email with branded HTML template
- ✅ Africa's Talking SMS
- ✅ Cloudinary operational photo uploads
- ✅ Cloudflare R2 permanent document storage
- ✅ Driver authentication — JWT tokens, 12hr sessions
- ✅ Journey verification endpoints — approve/reject
- ✅ Data sync — tracker → server for driver portal

---

## Start with Prompt 1

Open `PROMPT_01_TRACKER.md` and give it to Cursor now.
