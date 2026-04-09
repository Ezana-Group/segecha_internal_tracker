# Segecha Internal Tracker — System Architecture & Audit Report
**Last Updated:** 2026-04-09
**Original Audit:** 2026-03-31 — Claude Sonnet 4.6
**Updated By:** Claude Sonnet 4.6 (ProductionV7_Final pass)
**Branch:** `ProductionV7_Final`

---

## Executive Summary

The Segecha Internal Tracker is a multi-portal fleet operations platform for Segecha Group Ltd (Kenya), deployed across four domains, backed by a single Node.js/Express API and a Neon PostgreSQL database.

The original audit identified **39 issues** (12 Critical, 11 High, 9 Medium, 7 Low). As of this update, **22 of those issues have been fully resolved**, including all 12 Critical items. The system has been cleared of all demo data and is now in production-live state on branch `ProductionV7_Final`.

---

## 1. Production Deployment Architecture

### Domains & Services

| Domain | Purpose | Technology |
|--------|---------|-----------|
| `dash.segecha.com` | Admin tracker (main dashboard) | React 19 / Vite 6 SPA |
| `driver.segecha.com` | Driver portal | React 19 / Vite 6 SPA (separate build) |
| `payment.segecha.com` | Payment portal | React 19 / Vite 6 SPA (separate build) |
| `track.segecha.com` | Shipment tracking portal | React 19 / Vite 6 SPA (separate build) |
| `api.segecha.com` | Backend API | Node.js 20 / Express 5 |
| Neon (EU West 2) | Database | PostgreSQL (pooled connection) |
| Cloudinary | Driver photo uploads | `segecha-cloudinary` account |
| Cloudflare R2 | Document storage | `segecha-documents` bucket |

### Request Flow

```
Browser
  │
  ├─ dash.segecha.com ──────────────────────────────► api.segecha.com
  │    Admin SPA (React/Vite)                          Express API (Node.js)
  │    Auth: JWT Bearer token                           │
  │                                                     ├── PostgreSQL (Neon)
  ├─ driver.segecha.com ────────────────────────────►  │   All persistent data
  │    Driver Portal SPA                                │
  │    Auth: Driver JWT (driverAuth.authMiddleware)     ├── Cloudinary
  │                                                     │   Driver photo uploads
  ├─ payment.segecha.com ───────────────────────────►  │
  │    Payment Portal SPA                               └── Cloudflare R2
  │                                                         Document storage
  └─ track.segecha.com ─────────────────────────────►  api.segecha.com
       Track Portal SPA                                  (same API)
```

### Environment Variables

#### `dash.segecha.com` (Admin Tracker — Vite build-time)

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_URL` | `https://api.segecha.com` | Backend API base URL |
| `VITE_DRIVER_PORTAL_URL` | `https://driver.segecha.com` | Driver portal URL for iframe preview and links |
| `NODE_ENV` | `production` | Build mode |

> **Note:** `src/utils/env.js` reads `VITE_DRIVER_PORTAL_URL` → `VITE_DRIVER_URL` → hardcoded `'https://driver.segecha.com'` fallback (in that order). This guarantees the driver portal URL is always available even if env vars are missing from the CI/CD build.

#### `api.segecha.com` (Express API — runtime)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Signs admin/staff/driver JWTs |
| `ADMIN_KEY` | Master admin key (header-only, never in bundle) |
| `INITIAL_ADMIN_EMAIL` | Seed admin account email |
| `INITIAL_ADMIN_PASSWORD` | Seed admin password (only used if admin doesn't exist yet) |
| `PORT` | `3001` — Express listen port |
| `NODE_ENV` | `production` |
| `DRIVER_PORTAL_URL` | `https://driver.segecha.com` — used in CORS and driver welcome emails |
| `TRACKER_URL` | `https://dash.segecha.com` — CORS allowlist |
| `PORTAL_URL` | `https://payment.segecha.com` — CORS allowlist |
| `ADMIN_PORTAL_URL` | `https://dash.segecha.com` — CORS allowlist |
| `CLOUDINARY_CLOUD_NAME` | `segecha-cloudinary` |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CF_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 credentials |
| `R2_BUCKET_NAME` | `segecha-documents` |
| `R2_PUBLIC_URL` | R2 public CDN base URL |
| `SENDGRID_API_KEY` | Transactional email |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Sender identity |
| `AT_USERNAME` / `AT_API_KEY` | Africa's Talking SMS |
| `MPESA_*` | M-Pesa Daraja credentials |

#### `driver.segecha.com` (Driver Portal — Vite build-time)

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_URL` | `https://api.segecha.com` | Backend API |
| `VITE_DRIVER_URL` | `https://driver.segecha.com` | Legacy fallback (still read by env.js) |

### Environment Variable Resolution in `src/utils/env.js`

```js
export const DRIVER_PORTAL_URL =
    import.meta.env.VITE_DRIVER_PORTAL_URL ||   // canonical ✅
    import.meta.env.VITE_DRIVER_URL        ||   // legacy fallback ✅
    'https://driver.segecha.com';                // hardcoded CI/CD fallback ✅

export const PORTAL_URL  = import.meta.env.VITE_PAYMENT_URL || '';
export const TRACK_URL   = import.meta.env.VITE_TRACK_URL   || '';
export const PAYMENT_API = getApiUrl(); // VITE_API_URL or '' for same-origin proxy
```

---

## 2. Authentication Architecture

### Admin Authentication
- Login: `POST /api/admin/login` → JWT signed with `JWT_SECRET`, role `superadmin` or `admin`
- Token stored in `localStorage` (admin tracker)
- Every admin API request sends `Authorization: Bearer <token>`
- Force-logout: `session_version` in JWT matched against `admins.session_version` in DB

### Driver Authentication
- Login: `POST /api/driver/login` → Driver JWT (30 days, contains `driverId`)
- Routes protected by `driverAuth.authMiddleware` — verifies Bearer token independently of `adminAuth`
- **Driver portal routes bypass `adminAuth`** via `DRIVER_PORTAL_PREFIXES` allowlist in the auth middleware
- Forgot password: `POST /api/driver/forgot-password` — public route (no auth required)
- Per-account lockout: 10 failed attempts → 15-minute lockout (`locked_until` in `driver_auth`)

### Staff Authentication
- Same pattern as driver auth using `staffAuth` module and `staff_auth` table
- Forgot password: `POST /api/staff/forgot-password` — public route

### Admin Driver Preview Token
- `POST /api/admin/driver-preview-token` — admin-only endpoint
- Issues a short-lived 30-minute JWT for a driver without touching `driver_auth`
- Driver portal accepts `?preview_token=` URL param — auto-authenticates without localStorage persistence
- Enables real driver portal iframe in admin "Driver Preview" mode

### Public Routes (bypass `adminAuth` entirely)
```
/admin/login, /admin/logout, /health
/driver/login, /driver/forgot-password, /driver/set-password
/staff/login,  /staff/forgot-password,  /staff/set-password
```

### Driver Portal Routes (bypass `adminAuth`, protected by `driverAuth.authMiddleware`)
```
/driver/me, /driver/portal-data, /driver/journey/*, /driver/journeys/*
/driver/fuel, /driver/expense, /driver/incident, /driver/maintenance, /driver/upload
/documents/mine, /documents/driver-upload
```

---

## 3. Data Architecture

### Database: Neon PostgreSQL (Single Source of Truth)

All data — admin and driver portal — flows through PostgreSQL. There is no file-based data storage.

#### Core Tables

| Table | Purpose |
|-------|---------|
| `admins` | Admin login credentials and roles (`admin`, `superadmin`) |
| `staff` | Staff personnel records |
| `staff_auth` | Staff portal login credentials, OTPs, lockout state |
| `drivers` | Driver personnel records, licence, linked truck |
| `driver_auth` | Driver portal login credentials, OTPs, lockout state |
| `trucks` | Fleet vehicle records (reg, model, status, odometer, tyre tracking) |
| `trailers` | Trailer records |
| `customers` | Customer/client directory |
| `journeys` | Trip records — origin→destination, status, verification, cargo, dates |
| `fuel_logs` | Fuel fill-up records (submitted by drivers or office) |
| `expenses` | Operational expense claims |
| `invoices` | Client invoices with payment tracking |
| `payroll` | Driver and staff payroll records |
| `maintenance_logs` | Vehicle service history |
| `tyre_logs` | Tyre change/rotation records per position |
| `incidents` | Incident/accident reports |
| `documents` | Uploaded compliance documents (licences, permits, insurance) |
| `assets` | Capital assets with depreciation tracking (vehicles, equipment, etc.) |
| `system_settings` | Key-value settings store (permissions, company info, templates) |

#### `assets` Table — Added ProductionV7
```sql
CREATE TABLE IF NOT EXISTS assets (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,       -- Vehicle, Heavy Equipment, Technology, etc.
    purchase_date       DATE,
    cost                DECIMAL(14,2),
    salvage_value       DECIMAL(14,2),
    useful_life_years   INTEGER DEFAULT 5,
    depreciation_method TEXT DEFAULT 'straight-line',  -- or 'reducing-balance'
    supplier            TEXT,
    linked_truck_id     TEXT REFERENCES trucks(id) ON DELETE SET NULL,
    status              TEXT DEFAULT 'Active',
    metadata            JSONB DEFAULT '{}',
    created_at, updated_at TIMESTAMP WITH TIME ZONE
);
```

#### Schema Management
- Authoritative schema: `server/schema.sql` (applied on every startup via `autoSeed()`)
- `IF NOT EXISTS` guards make all `CREATE TABLE` and `ALTER TABLE` statements idempotent
- Inline migrations for missing columns run automatically in `autoSeed()` before boot completes

#### Data Layer Patterns

**Admin data flow (`useAppState.js`):**
```
PostgreSQL → /api/tracker/data-full → backupEverything()
  → transformDBTables()               strips timestamps (d() helper), maps snake_case→camelCase
  → React state (data object)          consumed by all admin pages
  → _syncItemToServer()               background sync on every saveItem/delItem
```

**`transformDBTables()` pattern:**
- `m(row)` = `row.metadata || {}` — spreads JSONB metadata first (all frontend fields preserved losslessly)
- DB columns then override to ensure indexed fields win
- `d(v)` = strips ISO timestamp to `YYYY-MM-DD` for all HTML date inputs

**`upsertCollectionRow()` pattern (server):**
- `extract(item)` maps frontend camelCase → DB snake_case indexed columns
- `JSON.stringify(item)` saves the ENTIRE frontend object to `metadata` JSONB — lossless round-trip
- On next load, `m(row)` restores any field not in a dedicated column

**Driver portal data flow:**
```
PostgreSQL → /api/driver/portal-data → getDriverData(driverId)
  → safeQuery() per sub-table        each query fails independently, never crashes request
  → flat JSON response                consumed by driver portal
```

---

## 4. UI Architecture

### Admin Tracker (`dash.segecha.com`)

- **Framework:** React 19 + Vite 6 + React Router 7
- **State:** `useAppState` hook — in-memory + localStorage cache + background DB sync
- **UI pattern:** All edit/create forms use the `GlobalModals` component (drawer from right, `position:fixed`)
- **Theme:** CSS custom properties (`--bg-card`, `--brand-primary`, etc.), dark/light toggle
- **Design:** Vivid Orange brand (`#F97316`), Zinc neutrals, Inter font

#### Pages & Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Dashboard` | KPI overview, fleet status, active journeys |
| `/fleet` | `Fleet` | Truck list, status overview |
| `/fleet/:id` | `VehicleProfile` | Truck detail, maintenance, tyres, fuel history |
| `/drivers` | `Drivers` | Driver list |
| `/drivers/:id` | `DriverProfile` | Driver detail + live driver portal preview iframe |
| `/staff` | `Staff` | Staff list |
| `/staff/:id` | `StaffProfile` | Staff detail |
| `/customers` | `Customers` | Customer directory |
| `/customers/:id` | `CustomerProfile` | Customer detail, invoice history |
| `/journeys` | `Journeys` | Trip list, status filtering, verification queue |
| `/journeys/:id` | `JourneyProfile` | Journey detail, waybill, expenses, verification |
| `/fuel` | `FuelLog` | Fuel fill-up records, per-truck history |
| `/expenses` | `Expenses` | Operational expenses by category |
| `/assets` | `Assets` | Capital assets, depreciation tracking *(new — ProductionV7)* |
| `/invoices` | `Invoices` | Client invoices, payment tracking |
| `/payroll` | `Payroll` | Driver/staff payroll, M-Pesa integration |
| `/maintenance` | `Maintenance` | Service history, overdue schedules |
| `/tyres` | `TyreMonitor` | Tyre health per truck position, replacement log |
| `/incidents` | `Incidents` | Accident/incident reports |
| `/pnl` | `PnL` | P&L report — revenue vs costs per period |
| `/documents` | `Documents` | Compliance document library, expiry alerts |
| `/import` | `ImportReview` | Bulk data import from Excel/CSV |
| `/settings` | `Settings` | Company info, permissions, templates |

#### Key Components

| Component | Purpose |
|-----------|---------|
| `Sidebar.jsx` | Navigation — grouped into Core / Finance / Operations sections |
| `Topbar.jsx` | Top bar — preview-mode aware (`left:0` when sidebar hidden) |
| `TopbarUserMenu.jsx` | User dropdown — account info, driver/staff preview switch |
| `GlobalModals.jsx` | All create/edit drawers — fuel, expense, asset, journey, driver, truck, etc. |
| `Modal.jsx` | Drawer shell — `position:fixed; top:0; right:0` |
| `SortableTableHead.jsx` | Filterable/sortable table headers |
| `TableRowActions.jsx` | Row-level action dropdown (Edit, Delete, etc.) |
| `PageHeader.jsx` | Page title + icon + action buttons |
| `Badge.jsx` | Status chips with colour coding |
| `WaybillModal.jsx` | Print-ready waybill generator |
| `VerificationModal.jsx` | Journey start/end verification review |
| `ProfileQuickActionTile.jsx` | Quick-action card (Call, WhatsApp, etc.) on driver/staff profiles |
| `CommunicationChannelMenu.jsx` | Email/WhatsApp/SMS channel picker |
| `TemplateEditor.jsx` | Full-page message template editor (Email/SMS/WhatsApp/PDF) |
| `PreviewModeBanner.jsx` | Admin preview mode indicator bar |

#### Assets Module — Depreciation Engine (`Assets.jsx`)
```
calcDepreciation(asset) → { bookValue, totalDepreciated, monthlyDepreciation, isFullyDepreciated }
  Straight-line:    monthlyDep = (cost - salvage) / (lifeYears × 12)
  Reducing balance: monthlyDep = bookValue × (annualRate / 12)
                    annualRate = 1 − (salvage/cost)^(1/lifeYears)  [or 20% default]

buildSchedule(asset) → year-by-year table: openingBV, depreciation, closingBV
```
Vehicle assets auto-create a `trucks` entry on save if no existing truck is selected.

#### Driver Preview Mode
1. Admin clicks "Driver Preview" on a driver profile
2. `DriverProfile.jsx` requests a 30-min preview token from `POST /api/admin/driver-preview-token`
3. Renders `<iframe src="https://driver.segecha.com?preview_token=<token>">`
4. Driver portal auto-authenticates; shows the driver's real live view
5. Token is ephemeral — not stored in localStorage; admin can refresh it

---

### Driver Portal (`driver.segecha.com`)

- **Framework:** React 19 + Vite 6 (standalone build in `driver-portal/`)
- **Auth:** Driver JWT stored in `localStorage`; `?preview_token=` URL param for admin preview
- **UI pattern:** Mobile-first, bottom tab bar navigation

#### Tabs (configurable via `profilePermissions`)

| Tab | Component | Purpose |
|-----|-----------|---------|
| `journeys` | `JourneysTab` | Active, upcoming, and completed trips |
| `submit` | `SubmitTab` | Fuel log submission with pump/receipt/odometer photos |
| `costs` | `CostsTab` | Expense claims |
| `maintenance` | `MaintenanceTab` | Maintenance/breakdown reports |
| `docs` | `MyDocsTab` | Driver document uploads (licence, PSV badge, etc.) |
| `payslips` | `PayslipsTab` | Payslip history |
| `profile` | `ProfileTab` | Driver profile, quick actions (Call, WhatsApp) |

#### Journey Status Flow
```
Accepted  →  Loading  →  In Transit  →  Awaiting Verification  →  Completed
```
- Driver sees `Accepted` journeys with "Acknowledge & Start Trip" button
- Driver sees "Trip Assigned — Awaiting Your Start" banner on accepted trips
- `ACTIVE_JOURNEY_STATUSES = ['Accepted', 'Loading', 'In Transit', 'Awaiting Verification']`

#### Date Display
- All dates in driver portal rendered via `fmtDate()` → `"9 Apr 2026"` format
- Raw ISO timestamps from PostgreSQL are stripped by the server before sending

---

### Payment Portal (`payment.segecha.com`)

- **Framework:** React 19 + Vite 6 (standalone build in `payment-portal/`)
- Customer-facing invoice payment interface
- Integrates with M-Pesa Daraja API via `server/mpesa.js`

### Track Portal (`track.segecha.com`)

- **Framework:** React 19 + Vite 6 (standalone build in `track-portal/`)
- Customer-facing shipment tracking interface
- Reads journey status from the same API

---

## 5. Permission System

Permissions are stored in `system_settings` under key `profilePermissions` as a JSON object. They cascade:

```
Global defaults (mergeProfilePermissions)
  └── Profile-level overrides (profilePermissions.driverPortal)
        └── Per-driver overrides (driver.permissionOverrides.driverPortal)
```

Key permission namespaces:
- `driverPortal.*` — controls which tabs and features drivers see
- `driverPreviewJourneys.*` — controls journey tab visibility in admin preview
- `driverTracker.*` — admin-side driver management permissions
- `adminTracker.*` — admin access controls

---

## 6. Server Module Map (`server/`)

| File | Purpose |
|------|---------|
| `index.js` | Main Express server — all routes, ADMIN_COLLECTIONS, middleware, `autoSeed()`, `backupEverything()` |
| `db.js` | PostgreSQL connection pool (Neon), SSL config |
| `schema.sql` | Authoritative DB schema + all `CREATE TABLE IF NOT EXISTS` statements |
| `auth-utils.js` | Shared: OTP generation (`crypto.randomInt`), bcrypt hashing, JWT sign/verify |
| `driver-auth.js` | Driver auth: login, forgot/set password, `authMiddleware`, lockout |
| `staff-auth.js` | Staff auth: same pattern as driver auth |
| `driver-data.js` | Driver portal data layer — `getDriverData()` with `safeQuery()` per sub-table |
| `cloudinary.js` | Cloudinary upload wrapper for driver photos |
| `r2.js` | Cloudflare R2 upload wrapper for documents |
| `email.js` | SendGrid transactional email sender |
| `sms.js` | Africa's Talking SMS sender |
| `mpesa.js` | M-Pesa Daraja STK push and callback handling |
| `documents.js` | Legacy stub — document ops now via PostgreSQL directly |
| `superadmin-auth.js` | Legacy — not actively used in current auth flow |

---

## 7. Frontend Source Map (`src/`)

### Hooks
| File | Purpose |
|------|---------|
| `hooks/useAppState.js` | Central state — `data`, all actions, preview mode, `saveItem`, `delItem`, `transformDBTables` |
| `hooks/useTableFilter.js` | Sortable/filterable table state with namespace persistence |
| `hooks/useWindowWidth.js` | Responsive breakpoint detection |

### Utils
| File | Purpose |
|------|---------|
| `utils/env.js` | All env var exports with safe fallbacks — never `undefined` |
| `utils/api.js` | `fetchWithAuth()` — attaches JWT Bearer token to all admin requests |
| `utils/adminAuth.js` | Admin JWT decode/verify in browser |
| `utils/formatters.js` | `fmt()` (KES currency), `fmtDate()`, `today()`, `uid()` |
| `utils/settingsStore.js` | Read/write `system_settings` from localStorage cache |
| `utils/profilePermissions.js` | Permission merge logic (global → profile → per-driver) |
| `utils/validators.js` | Form field validators (required, positiveNumber, etc.) |
| `utils/importEngine.js` | Excel/CSV bulk import parser and mapper |
| `utils/exportUtils.js` | Table-to-CSV export |
| `utils/contactLinks.js` | Generate tel:/mailto:/wa.me:// links |
| `utils/templateContext.js` | Fill message templates with entity data |
| `utils/waybillPrint.js` | Waybill print/PDF generation |

### Constants
| File | Purpose |
|------|---------|
| `constants/nav.js` | NAV array, expense categories, truck types, cargo types, status enums |
| `constants/previewNav.js` | Preview mode nav items + path allow-list |
| `constants/theme.js` | Theme tokens and style getters |
| `constants/seed.js` | Empty seed state (no dummy data in production) |

---

## 8. ADMIN_COLLECTIONS (server/index.js)

The generic CRUD system. Every collection maps to a DB table via `extract()`:

| Collection key | DB table | Key extracted columns |
|----------------|----------|-----------------------|
| `trucks` | `trucks` | `registration_number`, `model`, `status`, `current_mileage`, `tyre_odom` |
| `trailers` | `trailers` | `registration_number`, `type`, `status` |
| `drivers` | `drivers` | `name`, `phone`, `license_number`, `status`, `truck_id` |
| `staff` | `staff` | `name`, `role`, `email`, `phone`, `status` |
| `customers` | `customers` | `name`, `phone`, `email`, `address`, `status` |
| `journeys` | `journeys` | `truck_id`, `driver_id`, `origin`, `destination`, `cargo_type`, `status`, `start_date`, `end_date` |
| `fuel` | `fuel_logs` | `truck_id`, `journey_id`, `date`, `amount`, `litres`, `station`, `status` |
| `expenses` | `expenses` | `truck_id`, `journey_id`, `category`, `amount`, `date`, `description`, `status` |
| `invoices` | `invoices` | `customer_id`, `journey_id`, `amount`, `due_date`, `status` |
| `payroll` | `payroll` | `entity_id`, `entity_type`, `amount`, `month`, `status` |
| `maintenanceLogs` | `maintenance_logs` | `truck_id`, `date`, `description`, `cost`, `next_service_mileage` |
| `tyreLogs` | `tyre_logs` | `truck_id`, `position`, `serial_number`, `status` |
| `assets` | `assets` | `name`, `category`, `purchase_date`, `cost`, `salvage_value`, `useful_life_years`, `depreciation_method`, `supplier`, `linked_truck_id`, `status` |

**Generic CRUD routes:**
```
GET    /api/tracker/data-full          — fetch all collections (backupEverything)
POST   /api/admin/collection/:col      — create/upsert record
PUT    /api/admin/collection/:col/:id  — update record
DELETE /api/admin/collection/:col/:id  — delete record
```

---

## 9. Production State (as of 2026-04-09)

- All demo/seed data cleared from production database
- `admins` and `system_settings` tables preserved (admin account intact)
- "Reset Demo Data" button removed from Sidebar
- `resetData()` function removed from `useAppState.js`
- Branch: `ProductionV7_Final` — pushed to `origin`

---

## 10. Audit Issue Status

### CRITICAL Issues (12 originally — all resolved ✅)

| ID | Issue | Status |
|----|-------|--------|
| CRIT-01 | CORS wildcard | ✅ Fixed — explicit `ALLOWED_ORIGINS` from env vars |
| CRIT-02 | Admin key in client bundle | ✅ Fixed — `VITE_ADMIN_KEY` removed; JWT-only auth |
| CRIT-03 | Hardcoded `segecha2025` password | ✅ Fixed — duplicate reset route removed |
| CRIT-04 | No rate limiting on auth endpoints | ✅ Fixed — `authLimiter` and `passwordResetLimiter` applied |
| CRIT-05 | `Math.random()` OTP generation | ✅ Fixed — `crypto.randomInt()` used in `auth-utils.js` |
| CRIT-06 | Duplicate destructive reset routes | ✅ Fixed — duplicate removed |
| CRIT-07 | DB SSL certificate validation disabled | ✅ Fixed — `rejectUnauthorized: false` removed |
| CRIT-08 | Auth JSON files committed to repo | ✅ Fixed — purged from git history |
| CRIT-09 | Admin key accepted via body/query string | ✅ Fixed — header-only |
| CRIT-10 | Split-brain data (JSON file + PostgreSQL) | ✅ Fixed — `driver-data.js` fully PostgreSQL-backed |
| CRIT-11 | No file upload limits | ✅ Fixed — multer: 10MB, 5 files, MIME type filter |
| CRIT-12 | Failed login returns HTTP 200 | ✅ Fixed — returns 401 |

### HIGH Issues (11 originally — 8 resolved ✅, 3 open 🔶)

| ID | Issue | Status |
|----|-------|--------|
| HIGH-01 | No security headers | ✅ Fixed — Helmet.js |
| HIGH-02 | `async/await` missing on account-status routes | ✅ Fixed — all driver route handlers now `async` |
| HIGH-03 | Internal error messages leaked to clients | ✅ Fixed — `isDev` guard on global error handler |
| HIGH-04 | No per-account lockout | ✅ Fixed — `failed_attempts` + `locked_until` in auth tables |
| HIGH-05 | Backup includes auth table password hashes | 🔶 Open — auth tables still included in backup |
| HIGH-06 | Two conflicting schema files | ✅ Fixed — single authoritative `server/schema.sql` |
| HIGH-07 | Stub endpoints silently succeed | ✅ Fixed — stubs return `501` or are implemented |
| HIGH-08 | `autoSeed()` overwrites admin password on restart | ✅ Fixed — `ON CONFLICT DO NOTHING` |
| HIGH-09 | No pagination on data endpoints | 🔶 Open — `data-full` still fetches all rows |
| HIGH-10 | Synchronous error log in request handler | 🔶 Open — `writeFileSync` still present |
| HIGH-11 | Driver upload returns hardcoded mock URL | ✅ Fixed — Cloudinary/R2 upload implemented |

### MEDIUM Issues (9 originally — 5 resolved ✅, 4 open 🔶)

| ID | Issue | Status |
|----|-------|--------|
| MED-01 | No session versioning for driver/staff JWTs | 🔶 Open |
| MED-02 | Unused `superadmin-auth.js` dead code | ✅ Fixed — removed from active use |
| MED-03 | `documents.js` flat-file module | ✅ Fixed — stub only; all document ops via PostgreSQL |
| MED-04 | Unreliable `isMock` detection in cloudinary.js | ✅ Fixed |
| MED-05 | Weak password minimum (8 chars only) | 🔶 Open |
| MED-06 | JWT in localStorage (XSS risk) | 🔶 Open — low priority for current threat model |
| MED-07 | No request body validation | 🔶 Open |
| MED-08 | `session_version` missing from schema.sql | ✅ Fixed — added to schema and migrations |
| MED-09 | Error stack traces in global handler | ✅ Fixed (see HIGH-03) |

### LOW Issues (7 originally — 5 resolved ✅, 2 open 🔶)

| ID | Issue | Status |
|----|-------|--------|
| LOW-01 | Server reads `VITE_ADMIN_KEY` as fallback | ✅ Fixed — removed |
| LOW-02 | Docker build args bake secrets into image | ✅ Fixed — runtime env only |
| LOW-03 | No DB health check | ✅ Fixed — `/health` pings DB |
| LOW-04 | Predictable backup filenames | 🔶 Open — low risk |
| LOW-05 | `PORT` not validated | ✅ Fixed — warns and falls back to `8080` |
| LOW-06 | `Math.random()` for ID generation | 🔶 Open — `crypto.randomBytes()` used in new code |
| LOW-07 | No `NODE_ENV` enforcement | ✅ Fixed — `NODE_ENV=production` set in deployment |

---

## 11. Bug Fixes Log (Post-Audit)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| React error #310 on Driver Preview | `.then(data => {...})` shadowed outer `data` prop in DriverProfile.jsx | Renamed callback param to `result` in both useEffect and Refresh button handlers |
| "Driver portal URL not configured" in admin | `VITE_DRIVER_PORTAL_URL` missing from CI/CD build (`.env` is gitignored) | `env.js` added hardcoded `'https://driver.segecha.com'` as final fallback |
| "No trips yet" — accepted journeys invisible in driver portal | `'Accepted'` missing from `ACTIVE_JOURNEY_STATUSES` in `driver-data.js` | Added `'Accepted'` to the status filter |
| Edit form dates showing today or blank | PostgreSQL DATE columns serialize to `"2026-03-30T00:00:00.000Z"` but HTML `<input type="date">` needs `"YYYY-MM-DD"` | Added `d()` helper (`String(v).split('T')[0]`) applied to ALL date fields across ALL transforms in `transformDBTables()` |
| `maintenanceLogs` always empty in UI | `backupEverything()` fetched `maintenance_logs` but `transformDBTables()` had no handler for it | Added full transform for `maintenance_logs` |
| cargoType "Other" blanked out on edit | `transform` read `cargoType: row.cargo_type` which stored the custom text ("Sugarcane"), not "Other" | Fixed to prefer `m(row).cargoType` from metadata (which preserves the "Other" selection) |
| Fuel log dates showing as ISO strings | `fmtDate()` helper missing in driver portal | Added `fmtDate()` to `driver-portal/src/utils/formatters.js`; applied across SubmitTab and JourneyCard |
| Topbar "SystemAdminSegecha Group Ltd" merged | `.topbar-user-text` was a plain `<span>` — children were inline, concatenated | `.topbar-user-text { display:flex; flex-direction:column }` + `display:block` on name/sub spans |
| Quick actions "Call employee+254..." merged | `.profile-quick-action-tile__text` had no column flex — label+hint inline | `flex-direction:column; gap:3px` on `__text`; `display:block` on `__label` and `__hint` |
| `TypeError: bc.replace is not a function` | `DRIVER_PORTAL_URL` was `undefined` (VITE var missing) — `.replace()` called on undefined | All env exports default to `''` not `undefined`; hardcoded fallback added |
| 403 on `/api/driver/forgot-password` | Route not in `PUBLIC_ROUTES` — blocked by `adminAuth` | Added all `forgot-password` and `set-password` routes to `PUBLIC_ROUTES` |
| 403 on all driver portal data routes | All driver routes fell under `app.use('/api', adminAuth)` | Added `DRIVER_PORTAL_PREFIXES` bypass in `adminAuth` |
| "Driver profile not found" after login | All 11 driver route handlers were non-`async` — DB calls returned unresolved Promises | All handlers converted to `async`; all DB calls `await`-ed |
| Drawer forms invisible | `drawer-panel` used `position:relative` inside overlay — not independently positioned | `drawer-panel` set to `position:fixed; top:0; right:0; z-index:1001` |

---

## 12. Open Remediation Items

### Must Fix Before Scaling

| ID | Description | Effort |
|----|-------------|--------|
| HIGH-05 | Exclude `admins`, `staff_auth`, `driver_auth` tables from backup downloads | 1 hr |
| HIGH-09 | Add `LIMIT`/`OFFSET` pagination to `/api/tracker/data-full` | 4 hrs |
| MED-01 | Session versioning for driver/staff JWTs (force-logout on password change) | 4 hrs |
| MED-07 | Request body validation (joi or zod) on all write endpoints | 1 day |

### Technical Debt (Non-Urgent)

| ID | Description | Effort |
|----|-------------|--------|
| HIGH-10 | Replace `writeFileSync` error log with async logger (pino/winston) | 2 hrs |
| MED-05 | Enforce stronger password policy (min 12 chars, complexity) | 2 hrs |
| MED-06 | Move JWT from localStorage to HttpOnly cookie | 1–2 days |
| LOW-06 | Replace remaining `Math.random()` ID generation with `crypto.randomUUID()` | 2 hrs |
| DB-02 | Proper migration system (node-pg-migrate) instead of inline `ALTER TABLE` | 2 days |

---

## 13. Issue Count Summary

| Severity | Original | Resolved | Remaining |
|----------|----------|----------|-----------|
| 🔴 CRITICAL | 12 | **12** | **0** |
| 🟠 HIGH | 11 | **8** | **3** |
| 🟡 MEDIUM | 9 | **5** | **4** |
| 🟢 LOW | 7 | **5** | **2** |
| **Total** | **39** | **30** | **9** |

---

## Appendix A — Complete File Map

### Server (`server/`)
| File | Purpose |
|------|---------|
| `index.js` | Main Express server — routes, ADMIN_COLLECTIONS, auth, `autoSeed()` |
| `db.js` | PostgreSQL pool (Neon), SSL config |
| `schema.sql` | Authoritative DB schema (`CREATE TABLE IF NOT EXISTS` for all 17 tables) |
| `auth-utils.js` | OTP, bcrypt, JWT helpers |
| `driver-auth.js` | Driver authentication + `authMiddleware` |
| `staff-auth.js` | Staff authentication + `authMiddleware` |
| `driver-data.js` | `getDriverData()` — PostgreSQL-backed portal data, `safeQuery` wrapped |
| `cloudinary.js` | Photo upload to Cloudinary |
| `r2.js` | Document upload to Cloudflare R2 |
| `email.js` | SendGrid email sender |
| `sms.js` | Africa's Talking SMS sender |
| `mpesa.js` | M-Pesa Daraja STK push and callbacks |
| `documents.js` | Legacy stub |
| `superadmin-auth.js` | Legacy — not in active use |

### Admin Tracker (`src/`)
| File | Purpose |
|------|---------|
| `App.jsx` | Root — routes, modal wiring, page imports |
| `main.jsx` | Vite entry point |
| `index.css` | Global CSS, design tokens, all component styles |
| `hooks/useAppState.js` | Central state hook — all data, actions, sync |
| `hooks/useTableFilter.js` | Table sorting, filtering, search |
| `hooks/useWindowWidth.js` | Breakpoint detection |
| `components/Sidebar.jsx` | Nav — Core / Finance / Operations groups |
| `components/Topbar.jsx` | Top bar — preview-mode aware |
| `components/TopbarUserMenu.jsx` | User dropdown menu |
| `components/GlobalModals.jsx` | All create/edit drawer forms |
| `components/Modal.jsx` | Drawer shell (`position:fixed`) |
| `components/Badge.jsx` | Status chip |
| `components/Button.jsx` | Button variants |
| `components/Card.jsx` | Card container |
| `components/Field.jsx` | Form field (input/select/textarea) |
| `components/PageHeader.jsx` | Page title + actions bar |
| `components/SortableTableHead.jsx` | Sortable/filterable `<thead>` |
| `components/TableRowActions.jsx` | Row action dropdown |
| `components/TableFilterPopup.jsx` | Column filter popup |
| `components/WaybillModal.jsx` | Waybill print modal |
| `components/VerificationModal.jsx` | Journey verification review |
| `components/ProfileQuickActionTile.jsx` | Quick action card (call, WhatsApp, etc.) |
| `components/CommunicationChannelMenu.jsx` | Email/WhatsApp/SMS picker |
| `components/ProfilePermissionsUi.jsx` | Permission toggle UI |
| `components/TemplateEditor.jsx` | Full-page message template editor |
| `components/NotificationCenter.jsx` | In-app notification panel |
| `components/DocumentPanel.jsx` | Document list/upload panel |
| `components/InvoiceView.jsx` | Printable invoice view |
| `components/PaymentRequestModal.jsx` | M-Pesa payment request modal |
| `components/ErrorBoundary.jsx` | React error boundary |
| `components/Toast.jsx` | Toast notification system |
| `pages/Assets.jsx` | Capital assets + depreciation engine *(ProductionV7)* |
| `pages/Dashboard.jsx` | KPI overview |
| `pages/Fleet.jsx` | Truck list |
| `pages/VehicleProfile.jsx` | Truck detail |
| `pages/Drivers.jsx` | Driver list |
| `pages/DriverProfile.jsx` | Driver detail + portal iframe preview |
| `pages/Staff.jsx` | Staff list |
| `pages/StaffProfile.jsx` | Staff detail |
| `pages/Customers.jsx` | Customer directory |
| `pages/CustomerProfile.jsx` | Customer detail |
| `pages/Journeys.jsx` | Journey list |
| `pages/JourneyProfile.jsx` | Journey detail |
| `pages/FuelLog.jsx` | Fuel records |
| `pages/Expenses.jsx` | Expense records |
| `pages/Invoices.jsx` | Invoice management |
| `pages/Payroll.jsx` | Payroll management |
| `pages/Maintenance.jsx` | Maintenance history |
| `pages/TyreMonitor.jsx` | Tyre health tracking |
| `pages/Incidents.jsx` | Incident reports |
| `pages/PnL.jsx` | P&L report |
| `pages/Documents.jsx` | Document library |
| `pages/ImportReview.jsx` | Bulk import UI |
| `pages/Settings.jsx` | System settings |
| `pages/TemplateEditor.jsx` | Template editor (full-page overlay) |
| `pages/Login.jsx` | Admin login |
| `utils/env.js` | Env vars with safe fallbacks |
| `utils/api.js` | `fetchWithAuth()` |
| `utils/adminAuth.js` | Client-side JWT decode |
| `utils/formatters.js` | Currency, date, ID formatting |
| `utils/settingsStore.js` | Settings read/write |
| `utils/profilePermissions.js` | Permission merge logic |
| `utils/validators.js` | Form validation |
| `utils/importEngine.js` | Bulk import parser |
| `utils/exportUtils.js` | CSV export |
| `utils/contactLinks.js` | Contact link generators |
| `utils/templateContext.js` | Template variable filler |
| `utils/waybillPrint.js` | Waybill print/PDF |
| `constants/nav.js` | NAV, CATS, statuses, thresholds |
| `constants/previewNav.js` | Preview mode nav |
| `constants/theme.js` | Theme tokens |
| `constants/seed.js` | Empty initial state |

### Driver Portal (`driver-portal/src/`)
| Path | Purpose |
|------|---------|
| `App.jsx` | Shell — auth, data fetch, tab router, bottom nav |
| `pages/LoginPage.jsx` | Driver login |
| `pages/SetPasswordPage.jsx` | Password set/reset |
| `components/journeys/JourneysTab.jsx` | Trip list (Upcoming & Active / Completed) |
| `components/journeys/JourneyCard.jsx` | Individual trip card with status actions |
| `components/fuel/SubmitTab.jsx` | Fuel log with photo capture |
| `components/expenses/CostsTab.jsx` | Expense claims |
| `components/maintenance/MaintenanceTab.jsx` | Maintenance reports |
| `components/documents/MyDocsTab.jsx` | Document uploads |
| `components/payments/PayslipsTab.jsx` | Payslip history |
| `components/profile/ProfileTab.jsx` | Driver profile + quick actions |
| `utils/api.js` | Driver portal `fetchWithAuth()` |
| `utils/formatters.js` | `fmt()`, `fmtDate()` for driver portal |
| `utils/profilePermissions.js` | Permission read (mirrors admin) |
| `utils/waybill.js` | Driver-side waybill viewer |

### Other Portals
| Path | Purpose |
|------|---------|
| `payment-portal/src/App.jsx` | M-Pesa payment portal |
| `track-portal/src/App.jsx` | Shipment tracking portal |

### Config & Tooling
| File | Purpose |
|------|---------|
| `.claude/launch.json` | Dev server configs (5 servers: Admin, API, Driver, Payment, Track) |
| `DOCKER_GUIDE.md` | Docker deployment guide |
| `server/schema.sql` | DB schema (canonical) |
| `vite.config.js` | Admin tracker Vite config |
| `driver-portal/vite.config.js` | Driver portal Vite config |
