# Segecha Internal Tracker - System Architecture and Build Guide

This document is the single technical reference for rebuilding, operating, and extending Segecha Internal Tracker from zero.

---

## 1) What This System Is

Segecha is a multi-portal transport management platform sharing one backend API and one PostgreSQL database:

- Admin tracker (operations, fleet, finance, payroll, reports, settings)
- Driver portal (mobile-first driver workflows)
- Track portal (public shipment tracking)
- Payment portal (customer payment flows)
- Express API backend
- PostgreSQL system-of-record
- Cloudinary + Cloudflare R2 for file storage
- SendGrid / Africa's Talking / M-Pesa integrations

---

## 2) Repository Layout

Workspace root: `segecha_internal_tracker`

- `src/` - Admin tracker React app (Vite)
- `server/` - Express API + DB logic + integrations
- `driver-portal/` - Driver-facing React app
- `track-portal/` - Public tracking React app
- `payment-portal/` - Payment React app
- `server/schema.sql` - Canonical DB schema (authoritative)
- `server/migrations/` - SQL migrations (currently payroll compliance foundation)
- `tests/` - test assets
- `system-architecture.md` - this file
- `.env.example.local` - local environment reference
- `.env.production.example` - production environment reference
- `railway.json` - Railway build/deploy contract
- `Dockerfile`, `docker-compose.yml`, `Procfile` - container/process options

---

## 3) Runtime Architecture

## 3.1 Frontends

- Admin tracker served from root path `/`
- Driver portal served under `/driver` (or `driver.*` host)
- Track portal served under `/track` (or `track.*` host)
- Payment portal served under `/pay` (or `pay.*` / `payment.*` host)

All frontends are static bundles generated with Vite and served by Express static middleware.

## 3.2 Backend

Main entrypoint: `server/index.js`

Core responsibilities:

- Security middleware (Helmet, CORS allowlist, rate limiting, JSON size limits)
- Auth + role/session guards
- Generic collection CRUD and domain endpoints
- Financial reports and KRA exports
- Upload routing (Cloudinary/R2)
- Error ingestion and schema health checks
- Backup/restore/reset operations
- Payroll queue processing and periodic jobs

## 3.3 Database

Primary database: PostgreSQL (Neon-compatible connection string)

- `server/schema.sql` creates all required tables and indexes
- `autoSeed()` in `server/index.js` performs idempotent schema guards for legacy environments

---

## 4) Tech Stack

- Frontend: React 19 + Vite 6 + React Router
- Backend: Express + Node.js
- DB: PostgreSQL (`pg`)
- Auth: JWT + secure cookie support + bcrypt password hashing
- Upload handling: Multer
- Document/image storage: Cloudflare R2, Cloudinary
- Email: SendGrid
- SMS/notification integrations: Africa's Talking
- PDF generation: PDFKit
- Reporting export: CSV + XLSX

---

## 5) Build From Scratch (Local)

## 5.1 Prerequisites

- Node.js `>=20.19`
- npm
- PostgreSQL instance (local or Neon)

Optional integrations for full parity:

- Cloudinary
- Cloudflare R2
- SendGrid
- M-Pesa credentials
- Africa's Talking

## 5.2 Install

```bash
git clone https://github.com/Ezana-Group/segecha_internal_tracker.git
cd segecha_internal_tracker

npm install
cd server && npm install && cd ..
cd driver-portal && npm install && cd ..
cd track-portal && npm install && cd ..
cd payment-portal && npm install && cd ..
```

## 5.3 Environment Setup

Use `.env.example.local` as source of truth. Create:

- `./.env` (admin app env)
- `./server/.env`
- `./driver-portal/.env`
- `./track-portal/.env`
- `./payment-portal/.env`

Use `.env.production.example` for production baseline values/hardening.

## 5.4 Database Bootstrap

1. Create an empty PostgreSQL database
2. Execute `server/schema.sql`
3. Start backend
4. Validate `GET /health`
5. Validate `GET /api/admin/schema-health` after admin auth

## 5.5 Run Services

```bash
# Terminal 1 - backend
cd server
npm start

# Terminal 2 - admin
cd ..
npm run dev

# Terminal 3 - driver
cd driver-portal
npm run dev

# Terminal 4 - track
cd ../track-portal
npm run dev

# Terminal 5 - payment
cd ../payment-portal
npm run dev
```

## 5.6 Production Build Validation

```bash
npm run build
```

This builds:

- admin bundle
- driver portal bundle
- track portal bundle
- payment portal bundle

---

## 6) Environment Variable Matrix

## 6.1 Critical Server Variables

- `DATABASE_URL`
- `ADMIN_KEY`
- `JWT_SECRET`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD` (or fallback to `ADMIN_KEY` during bootstrap)
- `NODE_ENV`
- `PORT` (in production this is usually platform-injected)

## 6.2 URLs / CORS

- `TRACKER_URL`
- `PORTAL_URL`
- `DRIVER_PORTAL_URL`
- `ADMIN_PORTAL_URL`
- `TRACK_PORTAL_URL` or `TRACK_URL`
- `PAYMENT_PORTAL_URL`

## 6.3 Storage

- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- R2: `CF_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

## 6.4 Communications

- `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`
- `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`
- M-Pesa set (`MPESA_*`)

## 6.5 Payroll Worker

- `PAYSLIP_DISPATCH_CRON_ENABLED`
- `PAYSLIP_DISPATCH_CRON_MS`
- `PAYSLIP_DISPATCH_BATCH_SIZE`

---

## 7) Data Model (Core Tables)

From `server/schema.sql`:

## 7.1 Auth / Identity

- `superadmins`
- `admins`
- `driver_auth`
- `staff_auth`

## 7.2 Fleet / People

- `trucks`
- `trailers`
- `drivers`
- `staff`
- `customers`

## 7.3 Operations

- `journeys`
- `maintenance_logs`
- `tyre_logs`
- `incidents`

## 7.4 Financials

- `fuel_logs`
- `expenses`
- `invoices`
- `payroll`
- `assets`
- `ledger_entries`
- `mpesa_transactions` (managed in runtime seed/index logic)

## 7.5 Payroll Compliance

- `payroll_statutory_configs`
- `payroll_statutory_change_log`
- `deduction_templates`
- `employee_deductions`
- `payslip_dispatch_queue`

## 7.6 Documents / Settings / Observability

- `documents`
- `system_settings`
- `error_logs`

---

## 8) API Surface (High-Level)

Representative endpoint groups in `server/index.js`:

- Auth: `/api/admin/login`, `/api/admin/logout`, `/api/driver/login`, `/api/staff/login`, password reset endpoints
- Health and diagnostics: `/health`, `/api/admin/schema-health`, `/api/admin/error-logs`, `/api/client-error`
- Data snapshot/sync: `/api/tracker/data-full`, `/api/tracker/snapshot`
- Generic admin CRUD: `/api/admin/collection/:col` (+ update/delete routes)
- Documents/uploads: `/api/documents/*`, `/api/admin/upload`, `/api/driver/upload`
- Driver portal data/actions: `/api/driver/*`
- Payroll workflow: mark paid, generate payslip, queue/process dispatch, dispatch queue
- Finance/reporting: tax summary, receivables/payables, ledger reports, KRA exports
- Backup/restore/reset: backup list/create/download/upload/restore, hard reset

---

## 9) Auth and Access Control

## 9.1 Middleware Strategy

- `app.use('/api', adminAuth)` is globally applied to API routes after public/static sections
- Public route allowlist exists for login/reset/health/client-error
- Driver and staff API prefixes bypass admin auth and are protected by their own middleware:
  - `driverAuth.authMiddleware`
  - `staffAuth.authMiddleware`

## 9.2 Admin Credentials

Admin requests accepted by:

- `x-admin-key` header matching `ADMIN_KEY`, or
- valid JWT (`Authorization: Bearer ...` or `admin_token` cookie)

Session invalidation uses `session_version` comparison for forced logout after password changes.

---

## 10) Upload and File Storage

Upload flow:

1. File accepted through multer memory upload
2. MIME checks enforce allowed file types (images/pdf)
3. `persistUploadedFile()` routes storage:
   - Images -> Cloudinary (if configured)
   - Documents/PDF/non-image -> R2
4. Indexed into `documents` table
5. Accessed in module pages and central Documents page

Safety:

- Data URL fallback is guarded by environment toggle to avoid accidental base64 persistence in production

---

## 11) Financial and Payroll Flows

## 11.1 Ledger Posting

Server-side posting exists for key events:

- Invoice payments
- Expense entries
- Payroll paid flows
- Monthly depreciation posting

Ledger table: `ledger_entries`

## 11.2 Payroll Lifecycle

1. Create/update payroll item
2. Compute statutorys (DB-backed configs with settings API)
3. Mark paid
4. Generate payslip PDF
5. Queue dispatch
6. Process queue (manual endpoint + cron worker)

---

## 12) Backup / Restore / Reset

Runtime backup helpers support:

- backup listing and download
- manual backup trigger
- backup upload
- restore
- hard reset with admin reseed

Backups can be mirrored to R2 when configured.

---

## 13) Deployment (Railway Reference)

From `railway.json`:

- Build: `npm install && npm run build:all`
- Start: `node server/index.js`
- Healthcheck: `/health`

Deployment order:

1. Set production env vars
2. Ensure DB and storage credentials are valid
3. Deploy
4. Run smoke tests:
   - admin login
   - data snapshot load
   - upload + open document/image
   - payroll paid -> payslip -> dispatch
   - finance reports and exports

---

## 14) Operations Runbook

## 14.1 Quick Health Checks

- `GET /health` -> API + DB liveness
- `GET /api/admin/schema-health` -> schema integrity
- `GET /api/admin/error-logs` -> recent portal/backend error ingestion

## 14.2 Common Failure Points

- Missing env secrets (`ADMIN_KEY`, `JWT_SECRET`, storage keys)
- Lockfile drift causing `npm ci` failure in deployment
- Legacy DB columns missing until migration/seed guard runs
- Stale frontend assets after deployment (handled with fallback logic)

---

## 15) Security Baseline Checklist

- Use long random `ADMIN_KEY` and `JWT_SECRET`
- Do not expose server secrets to Vite client envs
- Restrict CORS origins to known production domains
- Keep `helmet` active with CSP
- Keep auth/password-reset rate limits enabled
- Keep secure cookie settings in production
- Rotate integration secrets regularly
- Review `npm audit` output and patch vulnerable dependencies

---

## 16) Change Management Rule

Update this file whenever any of the following changes:

- New table, migration, or major schema contract
- New endpoint group or auth rule
- New external integration or environment variable
- Significant changes to report/ledger/payroll flows
- Deployment process changes

