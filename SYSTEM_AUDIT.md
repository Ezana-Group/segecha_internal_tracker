# Segecha Internal Tracker — Full System Audit Report
**Date:** 2026-03-31
**Auditor:** Claude Sonnet 4.6 (Automated Security & Quality Audit)
**Scope:** Full codebase — backend, frontend, database schema, authentication, infrastructure
**Branch:** `claude/sleepy-tesla`

---

## Executive Summary

The application is a multi-portal trucking operations tracker consisting of:
- **Admin Portal** (React/Vite SPA)
- **Driver Portal** (separate React/Vite SPA)
- **Payment Portal** (separate React/Vite SPA)
- **Track Portal** (separate React/Vite SPA)
- **Backend API** (Node.js / Express 5)
- **Database:** Neon PostgreSQL (cloud-hosted)
- **File Storage:** Cloudinary + Cloudflare R2

The audit identified **12 Critical**, **11 High**, **9 Medium**, and **7 Low** severity issues spanning security vulnerabilities, broken functionality, database misalignment, and production readiness gaps. Several issues would result in immediate data breaches or complete authentication bypass if deployed to production without remediation.

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| 🔴 CRITICAL | Exploitable with no authentication, causes data loss, breach, or full system compromise |
| 🟠 HIGH | Exploitable with partial access, significant security weakening, or broken core functionality |
| 🟡 MEDIUM | Degraded security posture, potential data integrity issues, non-trivial bugs |
| 🟢 LOW | Code quality, minor misconfigurations, technical debt |

---

## 1. CRITICAL SECURITY VULNERABILITIES

---

### CRIT-01 — CORS Wildcard: Any Origin Can Make Credentialed Requests
**File:** `server/index.js:36`
**Severity:** 🔴 CRITICAL

```js
app.use(cors({
    origin: true, // Reflects the request origin — allows ALL origins
    credentials: true,
    ...
}));
```

`origin: true` reflects the `Origin` header back unconditionally. Combined with `credentials: true`, this means **any website on the internet can make authenticated cross-origin requests to your API**. An attacker can build a page that silently calls `/api/tracker/data-full` while a logged-in admin visits it, harvesting the entire database.

**Fix:** Whitelist explicit origins:
```js
const ALLOWED_ORIGINS = [process.env.TRACKER_URL, process.env.DRIVER_PORTAL_URL, process.env.PORTAL_URL].filter(Boolean);
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
```

---

### CRIT-02 — Admin Key Baked Into Client-Side Bundle & Sent in URL Query Params
**Files:** `src/utils/env.js:18`, `src/utils/api.js:27-33`, `Dockerfile:9`
**Severity:** 🔴 CRITICAL

The `VITE_ADMIN_KEY` is a Vite environment variable, meaning it is **compiled into the JavaScript bundle that is served to every browser**. Anyone who opens DevTools → Sources can read it. Additionally, `api.js` appends it as a URL query parameter on every GET request:

```js
urlObj.searchParams.set('adminKey', ADMIN_KEY);
```

Query parameters appear in: browser history, server access logs, CDN/proxy logs, third-party analytics scripts, Referer headers. The key is now permanently compromised across all those systems.

Furthermore, the server falls back to this same key:
```js
// server/index.js:68
const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY || '').trim();
```

A key designed for the browser is also accepted as a server-side master key.

**Fix:** Remove `VITE_ADMIN_KEY` entirely from the frontend. Admin access must be authenticated exclusively via JWT obtained from `/api/admin/login`. Remove `x-admin-key` from all frontend requests. Remove `adminKey` from query parameters entirely.

---

### CRIT-03 — Hardcoded Default Password in Reset Endpoint
**File:** `server/index.js:755`
**Severity:** 🔴 CRITICAL

```js
const defaultPass = 'segecha2025';
```

There is a second (duplicate) `/api/admin/reset` route at line 745 that seeds the admin account with the hardcoded password `segecha2025`. Even though Express will use the first registered route (line 343), this dead code represents a real danger: if the route order is ever changed, re-arranged, or the first route errors before responding, the second route fires and the admin password becomes a publicly known string.

**Fix:** Remove the duplicate reset route entirely (lines 745–769). Use only one reset endpoint that always reads from `process.env.INITIAL_ADMIN_PASSWORD`.

---

### CRIT-04 — No Rate Limiting on Authentication Endpoints
**File:** `server/index.js` — all `/api/*/login` routes
**Severity:** 🔴 CRITICAL

There is zero rate limiting on:
- `POST /api/admin/login`
- `POST /api/driver/login`
- `POST /api/staff/login`

An attacker can send unlimited login attempts with no delay, lockout, or CAPTCHA. A simple script can brute-force any account in seconds, especially if the password is short.

**Fix:** Install `express-rate-limit` and apply a strict limiter (e.g., 5 attempts per 15 minutes per IP) to all login and password reset endpoints.

---

### CRIT-05 — Cryptographically Insecure OTP Generation
**File:** `server/auth-utils.js:32`
**Severity:** 🔴 CRITICAL

```js
function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
```

`Math.random()` is not a cryptographically secure random number generator. Its internal state can potentially be predicted by an attacker who has observed enough outputs from the same process. OTPs must use `crypto.randomInt()`:

```js
import { randomInt } from 'crypto';
function generateOtp() {
    return String(randomInt(100000, 1000000));
}
```

---

### CRIT-06 — Duplicate Destructive Reset Routes
**File:** `server/index.js:343` and `server/index.js:745`
**Severity:** 🔴 CRITICAL

`POST /api/admin/reset` is registered **twice** in the same Express app. Express uses the first match, so currently the second route is dead code. However:
1. The second route uses the hardcoded `segecha2025` password (CRIT-03).
2. The second route does NOT recreate the `staff_auth` record, so after a reset via the second route, the admin cannot log into the Staff portal.
3. If a refactor moves middleware or reorganizes routes, the second route could become active without anyone noticing.

**Fix:** Delete the duplicate reset route block (lines 745–769).

---

### CRIT-07 — Database SSL Certificate Validation Disabled
**File:** `server/db.js:8`
**Severity:** 🔴 CRITICAL

```js
ssl: { rejectUnauthorized: false }
```

This disables SSL certificate validation on the PostgreSQL connection. An attacker positioned between the application server and Neon's database (e.g., on the same hosting network) can perform a Man-in-the-Middle attack and intercept or modify all database traffic, including queries containing passwords, personal data, and financial records.

**Fix:** Remove `rejectUnauthorized: false`. Neon provides a valid certificate. If a custom CA is needed, provide it via `ssl: { ca: fs.readFileSync('path/to/ca.pem') }`.

---

### CRIT-08 — Sensitive Auth Data Files Committed to Repository
**File:** `archive/server/staff-auth.json`, `archive/server/drivers-auth.json`
**Severity:** 🔴 CRITICAL

These files appear to contain actual authentication records (including potentially real email addresses, OTP hashes, and password hashes) committed to the repository. Even hashed data in version control is a serious breach — the hashes can be cracked offline with rainbow tables or GPU-accelerated attacks, especially if bcrypt rounds are low.

**Fix:**
1. Immediately audit these files for real vs. dummy data.
2. If they contain real data, rotate ALL credentials for every account referenced.
3. Remove the files from git history using `git filter-repo` or BFG Repo Cleaner.
4. Add `archive/server/*.json` to `.gitignore`.

---

### CRIT-09 — Admin Key Also Accepted via Request Body and Query String
**File:** `server/index.js:91`
**Severity:** 🔴 CRITICAL

```js
const adminKey = req.headers['x-admin-key'] || req.body?.adminKey || req.query?.adminKey;
```

The admin key is accepted from three places: headers, body, and query string. Query string parameters are logged by web servers, CDNs, load balancers, and third-party monitoring tools. Any logged request URL containing `adminKey=...` is a permanent record of the master key in plaintext.

**Fix:** Accept the key only from the `x-admin-key` header (but ultimately, phase out the static key entirely in favour of JWT-only auth).

---

### CRIT-10 — Split-Brain Data Architecture: PostgreSQL + JSON Files Simultaneously Active
**Files:** `server/driver-data.js`, `server/documents.js`
**Severity:** 🔴 CRITICAL

The application has **two separate data stores operating simultaneously**:
- `server/driver-data.js` reads/writes `tracker-data.json` (flat file)
- `server/documents.js` reads/writes `documents.json` (flat file)
- `server/index.js` routes for the admin panel use PostgreSQL

Driver portal API endpoints (`/api/driver/portal-data`, `/api/driver/journeys/*`, `/api/driver/fuel`, etc.) all use the JSON file. Admin portal endpoints use the database. This means:
1. Driver submissions do NOT appear in the admin PostgreSQL database.
2. Admin changes to journeys do NOT reflect in the driver's view.
3. Data from `tracker-data.json` is not included in the database backup.
4. In a Docker/cloud deployment, `tracker-data.json` will be reset on every container restart unless a persistent volume is mounted.

**Fix:** Migrate all driver-data functions to query PostgreSQL directly, removing `driver-data.js`'s dependency on `tracker-data.json`.

---

### CRIT-11 — No File Upload Size or Type Limits
**File:** `server/index.js:6`
**Severity:** 🔴 CRITICAL

```js
const upload = multer(); // No limits whatsoever
```

Multer is configured with no file size limit, no file count limit, and no file type filtering. This allows:
- Denial of Service via uploading multi-gigabyte files that exhaust memory/disk.
- Upload of executable files (`.php`, `.sh`, `.js`, `.exe`) if the storage backend doesn't sanitize.

**Fix:**
```js
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB per file, max 5 files
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    }
});
```

---

### CRIT-12 — Failed Login Returns HTTP 200 Instead of 401
**File:** `server/index.js:1180, 1204`
**Severity:** 🔴 CRITICAL (Security + Functionality)

```js
if (!result.success) return res.status(200).json(result);
```

Failed authentication attempts return `200 OK` with `{ success: false }` in the body. This:
1. Bypasses any WAF or SIEM rule that triggers on HTTP 4xx responses to `/login`.
2. Confuses monitoring and alerting systems that track failed logins.
3. Is misleading — HTTP 401 Unauthorized is the correct status code.

**Fix:** Return `res.status(401).json(result)` for failed login attempts.

---

## 2. HIGH SEVERITY ISSUES

---

### HIGH-01 — Missing Security Headers (No Helmet.js)
**File:** `server/index.js`
**Severity:** 🟠 HIGH

The Express server has no security headers configured. Missing headers include:
- `X-Frame-Options` / `frame-ancestors` CSP directive — enables clickjacking
- `X-Content-Type-Options: nosniff` — enables MIME sniffing attacks
- `Strict-Transport-Security` — no HTTPS enforcement
- `Content-Security-Policy` — no XSS mitigation
- `X-XSS-Protection`
- `Referrer-Policy`
- `Permissions-Policy`

**Fix:** `npm install helmet` and add `app.use(helmet())` before all routes.

---

### HIGH-02 — Async Function Called Without `await` — Auth Status Always Returns Promise
**File:** `server/index.js:954-957`
**Severity:** 🟠 HIGH (Broken Functionality)

```js
app.get('/api/driver/account-status/:id', (req, res) => {
    const status = driverAuth.getDriverAccountStatus(req.params.id); // async!
    res.json(status); // sends {} (Promise object), not the actual status
});
```

`getDriverAccountStatus` is an `async` function but the route handler is not `async` and doesn't `await` the result. The response will be an empty object `{}` — the Promise itself serialized. This affects the admin UI's ability to check driver account status.

Same bug exists on:
- `app.delete('/api/driver/account/:id', ...)` line 975 — `deleteDriverAccount` is async
- `app.get('/api/driver/account-export/:id', ...)` line 969 — `exportDriverAccount` is async

---

### HIGH-03 — Internal Error Messages Leaked to Clients in Production
**Files:** `server/index.js` — multiple route handlers
**Severity:** 🟠 HIGH

Many error handlers expose raw Node.js error messages:
```js
res.status(500).json({ error: e.message });
```

Stack traces, SQL query details, file paths, and internal variable names can appear in error responses. This aids attackers in mapping the server internals.

**Fix:** Use a generic message in production:
```js
const isDev = process.env.NODE_ENV !== 'production';
res.status(500).json({ error: isDev ? e.message : 'An unexpected error occurred' });
```

---

### HIGH-04 — No Account Lockout or Progressive Delay After Failed Logins
**Files:** `server/staff-auth.js`, `server/driver-auth.js`
**Severity:** 🟠 HIGH

Beyond the missing rate limiter (CRIT-04), there's no per-account lockout mechanism. Even with IP rate limiting, an attacker using a distributed botnet can perform credential stuffing across many IPs. There's no `failed_attempts` counter, no `locked_until` timestamp, and no alerting on repeated failures.

**Fix:** Add `failed_attempts` and `locked_until` columns to `staff_auth` and `driver_auth`. Lock accounts for 15 minutes after 10 failed attempts.

---

### HIGH-05 — Backup Files Include Full Auth Tables (Password Hashes Stored on Disk)
**Files:** `server/index.js:446-457`, `server/index.js:859-869`
**Severity:** 🟠 HIGH

`backupEverything()` dumps ALL tables including `admins`, `staff_auth`, and `driver_auth`. These backups are:
1. Written to `server/backups/` on disk.
2. Downloadable via `/api/tracker/backups/download/:filename` by any authenticated admin.
3. Listed via `/api/tracker/backups` with filenames and sizes.

If the backup directory is accessible (e.g., mounted as a volume with broad permissions), or if the backup download endpoint has an auth bypass, all password hashes are exposed at once.

**Fix:**
1. Exclude `admins`, `staff_auth`, `driver_auth` tables from backup content.
2. Enforce that backup downloads require a separate elevated permission.
3. Encrypt backup files at rest.

---

### HIGH-06 — Two Conflicting Database Schemas
**Files:** `server/schema.sql` vs `deployment/schema.sql`
**Severity:** 🟠 HIGH (Data Integrity + Deployment Risk)

There are two completely different SQL schema files:

| Feature | `server/schema.sql` | `deployment/schema.sql` |
|---------|---------------------|------------------------|
| Trucks columns | `registration_number`, `model` | `reg`, `make`, `year`, `type`, `capacity` |
| Drivers columns | `name`, `phone`, `license_number` | `name`, `phone`, `license`, `classes`, `salary`, `mpesa` |
| Fuel table name | `fuel_logs` | `fuel_entries` |
| Expenses table name | `expenses` | `expense_entries` |
| Payroll table name | `payroll` | `payroll_entries` |
| `session_version` on admins | No | No (added by runtime migration) |
| Indexes | None | Yes |
| `superadmins` table | Yes | No |

The server code queries `fuel_logs`, `expenses`, `payroll` (matching `server/schema.sql`) while the deployment schema calls them `fuel_entries`, `expense_entries`, `payroll_entries`. **Deploying from the wrong schema will cause all queries against those tables to fail with "table not found" errors.**

**Fix:** Consolidate into a single authoritative schema file with a proper migration system (e.g., `node-pg-migrate` or `flyway`). Remove the conflicting `deployment/schema.sql` or clearly mark one as deprecated.

---

### HIGH-07 — Admin Stub Endpoints Return Fake Success
**File:** `server/index.js:665-672`
**Severity:** 🟠 HIGH (Broken Functionality)

```js
// Admin upload placeholder (deprecated, use /api/documents/upload)
app.post('/api/admin/upload', (req, res) => {
    res.json({ success: true, url: 'https://cdn.example.com/uploads/fallback.png' });
});

// Generic update for collections
app.put('/api/admin/:col/:id', (req, res) => {
    res.json({ success: true }); // Does nothing
});
```

These endpoints silently succeed without performing any action. If any frontend code calls `PUT /api/admin/trucks/T001` to update a truck, it gets `{ success: true }` back but the database is never updated. This can lead to data loss that appears to succeed.

**Fix:** Either implement these endpoints properly or return `501 Not Implemented` so callers know to use the correct endpoint.

---

### HIGH-08 — `autoSeed()` Overwrites Admin Password on Every Server Start
**File:** `server/index.js:234-292`
**Severity:** 🟠 HIGH

```js
const initialHash = bcrypt.hashSync(process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_KEY, 10);
// ...
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
```

Every time the server starts, `autoSeed()` runs and resets the admin password to `INITIAL_ADMIN_PASSWORD || ADMIN_KEY`. This means:
1. If an admin changes their password, it will be **overwritten on the next server restart**.
2. In a cloud environment where deployments trigger restarts, every deploy resets the password.
3. If `INITIAL_ADMIN_PASSWORD` is not set, the password becomes the `ADMIN_KEY` — the same key that is baked into the frontend bundle (see CRIT-02).

**Fix:** Add a `seeded` flag check — only seed if the admin record does not already exist. Use `ON CONFLICT DO NOTHING` instead of `DO UPDATE`.

---

### HIGH-09 — No Pagination on Data Endpoints
**File:** `server/index.js:415-417`
**Severity:** 🟠 HIGH (DoS / Performance)

```js
async function getEntityData(table) {
    const res = await db.query(`SELECT * FROM ${table}`); // No LIMIT
    return res.rows;
}
```

Fetching entire tables without pagination means that as data grows, these endpoints will:
1. Time out under load.
2. Use excessive memory (entire result set in RAM).
3. Slow down or crash the process.

The same applies to `/api/tracker/data-full` which fetches all 19 tables in their entirety.

**Fix:** Add pagination (`LIMIT`/`OFFSET` or cursor-based) to all data endpoints.

---

### HIGH-10 — Error Log Written Synchronously to Disk in Request Handler
**File:** `server/index.js:1225`
**Severity:** 🟠 HIGH

```js
writeFileSync(path.join(__dirname, 'error.log'), `${...}`, { flag: 'a' });
```

`writeFileSync` in the global error handler blocks the Node.js event loop on every unhandled server error. Under high load, this can:
1. Cause request timeouts.
2. If the disk is full, throw an unhandled exception that crashes the server.

**Fix:** Use a proper logger (e.g., `pino`, `winston`) with async writes and log rotation. Never use `writeFileSync` in request handlers.

---

### HIGH-11 — Driver Portal Upload Endpoint Returns Hardcoded Mock URL
**File:** `server/index.js:1132-1134`
**Severity:** 🟠 HIGH (Broken Functionality)

```js
app.post('/api/driver/upload', driverAuth.authMiddleware, (req, res) => {
    res.json({ success: true, url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' });
});
```

The driver upload endpoint returns a hardcoded Cloudinary demo URL for every upload. Drivers uploading odometer photos, delivery proof photos, and incident photos are told the upload succeeded, but **their actual image is never stored**. The hardcoded demo image URL is then saved to the database as their proof. This defeats the entire document verification workflow.

**Fix:** Implement actual file upload to Cloudinary or R2 using the existing `cloudinary.js` / `r2.js` modules.

---

## 3. MEDIUM SEVERITY ISSUES

---

### MED-01 — JWT Tokens for Staff and Driver Have No Session Versioning
**Files:** `server/staff-auth.js:98`, `server/driver-auth.js:193`
**Severity:** 🟡 MEDIUM

Admin JWTs carry a `version` claim checked against `admins.session_version`, allowing forced logout when a password changes. **Staff and driver JWTs have no equivalent mechanism.** If a staff or driver password is reset, existing tokens remain valid until they expire (12 hours). An attacker who steals a token has a full 12-hour window even after the password is changed.

**Fix:** Add `session_version` to `staff_auth` and `driver_auth` tables. Validate it in the auth middleware for both portal types.

---

### MED-02 — `superadmin-auth.js` Creates a Separate `superadmins` Table But Is Never Used
**File:** `server/superadmin-auth.js`
**Severity:** 🟡 MEDIUM

The `superadmin-auth.js` module defines `loginSuperAdmin()` which queries the `superadmins` table. However:
1. No login route in `index.js` uses `loginSuperAdmin`.
2. The admin login route (line 508) queries the `admins` table, not `superadmins`.
3. `initSuperAdminTable()` is never called from `index.js`.

This dead code creates confusion about which table actually controls superadmin access.

**Fix:** Either integrate `superadmin-auth.js` into the admin login flow or delete it and consolidate superadmin into the `admins` table (which already has a `role` column).

---

### MED-03 — `documents.js` Still Uses Flat JSON File (Inconsistent with PostgreSQL)
**File:** `server/documents.js`
**Severity:** 🟡 MEDIUM

`server/documents.js` reads and writes `server/documents.json`. Meanwhile, `server/index.js` has its own database-backed document endpoints (`/api/documents`, `/api/documents/upload`, `/api/documents/expiring`). Two independent document stores exist simultaneously. Documents stored via `documents.js` will not appear in the admin panel's document queries.

**Fix:** Remove `server/documents.js` and its `documents.json` dependency. Route all document operations through the PostgreSQL queries already in `index.js`.

---

### MED-04 — `isMock` Detection in cloudinary.js Is Unreliable
**File:** `server/cloudinary.js:4`
**Severity:** 🟡 MEDIUM

```js
const isMock = process.env.CLOUDINARY_API_KEY === 'your_api_key';
```

This only detects one specific placeholder value. If `CLOUDINARY_API_KEY` is:
- `undefined` → `isMock` is `false` → real upload attempted → fails with auth error thrown as unhandled exception
- Empty string `''` → `isMock` is `false` → same failure
- Any other placeholder → `isMock` is `false` → same failure

**Fix:**
```js
const isMock = !process.env.CLOUDINARY_API_KEY ||
               process.env.CLOUDINARY_API_KEY.startsWith('your_');
```

---

### MED-05 — Weak Password Minimum (8 Characters Only)
**Files:** `server/staff-auth.js:77`, `server/driver-auth.js:91`
**Severity:** 🟡 MEDIUM

Password reset only validates `newPassword.length < 8`. There is no check for:
- Character complexity (uppercase, number, symbol)
- Common passwords (e.g., `password`, `12345678`)
- Maximum length (bcrypt silently truncates at 72 bytes — a hash collision is possible with long passwords)

**Fix:** Enforce a minimum of 12 characters with at least one digit and one non-alphanumeric character. Add a maximum of 128 characters. Consider integrating `zxcvbn` for password strength estimation.

---

### MED-06 — Token Stored in localStorage (XSS Risk)
**File:** `src/utils/adminAuth.js:5-23`
**Severity:** 🟡 MEDIUM

JWT tokens are stored in `localStorage`. Any XSS vulnerability (even from a third-party script) can exfiltrate the token, allowing full session hijacking. The driver portal uses the same pattern.

**Fix:** Move tokens to `HttpOnly; Secure; SameSite=Strict` cookies, which are inaccessible to JavaScript. This requires changing the server to issue and read cookies instead of Authorization headers.

---

### MED-07 — No Input Validation on Most API Endpoints
**Files:** `server/index.js` — numerous routes
**Severity:** 🟡 MEDIUM

Most route handlers destructure request body properties directly with no validation:
```js
const { driverId, email, phone } = req.body;
// No check that driverId is a string, non-empty, within length limits, etc.
```

This can lead to:
- SQL injection (mitigated by parameterized queries, but still risky for dynamic query building)
- Unexpected `NULL` values stored in the database
- Server crashes from calling `.toLowerCase()` on `undefined`

**Fix:** Use a validation library like `joi`, `zod`, or `express-validator` to validate all incoming request bodies.

---

### MED-08 — `admins` Table Missing `session_version` in Schema File
**File:** `server/schema.sql`
**Severity:** 🟡 MEDIUM

The `admins` table definition in `server/schema.sql` does not include `session_version`:
```sql
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- session_version MISSING
);
```

The column is added at runtime by `autoSeed()` via an `ALTER TABLE` migration. If the schema is applied to a fresh database and `autoSeed()` runs but fails (e.g., the DB user lacks `ALTER` privileges), the admin force-logout feature silently fails.

**Fix:** Add `session_version INTEGER DEFAULT 1` to the `admins` table definition in `server/schema.sql`.

---

### MED-09 — Error Stack Traces Written to Client via Global Error Handler
**File:** `server/index.js:1222-1227`
**Severity:** 🟡 MEDIUM

```js
app.use((err, req, res, next) => {
    console.error('SERVER_ERROR:', err);
    writeFileSync(...error.log...);
    res.status(500).json({ error: err.message }); // Stack trace included in err.message sometimes
});
```

Depending on the error type, `err.message` can include file paths, variable names, and SQL query fragments. In production, this should be sanitized.

---

## 4. LOW SEVERITY ISSUES

---

### LOW-01 — `VITE_ADMIN_KEY` Falls Back to `ADMIN_KEY` on Server Side
**File:** `server/index.js:68`
**Severity:** 🟢 LOW (amplifies CRIT-02)

```js
const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY || '').trim();
```

The server tries `VITE_ADMIN_KEY` as a fallback. The `VITE_` prefix is conventionally frontend-only. If someone sets only `VITE_ADMIN_KEY` thinking it's purely for the build, the server quietly uses it as its master key.

---

### LOW-02 — Docker Build Args Bake `VITE_ADMIN_KEY` Into Image Layer
**File:** `Dockerfile:9-17`
**Severity:** 🟢 LOW

Build args set as `ENV` become part of the image layer history. Even if the final stage doesn't `EXPOSE` them, `docker inspect <image>` or `docker history <image>` reveals all `ENV` values from all stages. Images pushed to Docker Hub or a registry leak the admin key.

**Fix:** Pass secrets at runtime via `.env` files or Docker secrets, not as build args.

---

### LOW-03 — No Health Check for Database Connectivity
**File:** `server/index.js:45-52`
**Severity:** 🟢 LOW

The `/health` endpoint returns `{ status: 'ok' }` without verifying database connectivity. Load balancers and orchestrators (Kubernetes, Railway) use the health check to route traffic. A healthy process with a broken DB connection will continue receiving traffic.

**Fix:** Add a DB ping to the health check:
```js
app.get('/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
});
```

---

### LOW-04 — Backup Filenames Are Predictable (Path Traversal Risk Mitigated but Could Be Better)
**File:** `server/index.js:863`
**Severity:** 🟢 LOW

`path.basename(file)` prevents directory traversal (e.g., `../../etc/passwd`). However, backup filenames are predictable timestamps, making them enumerable if the listing endpoint is somehow bypassed.

---

### LOW-05 — `PORT` Not Validated — Server Starts Without It
**File:** `server/index.js:24`
**Severity:** 🟢 LOW

```js
const PORT = process.env.PORT;
if (!PORT) console.warn('WARNING: PORT not set...');
// app.listen(PORT, ...) called with undefined → listens on random port
```

If `PORT` is not set, the server starts on an OS-assigned random port and logs only a warning. This could cause silent deployment failures where the server starts but is unreachable on the expected port.

**Fix:** `if (!PORT) throw new Error('FATAL: PORT not set');`

---

### LOW-06 — `Math.random()` Used for ID Generation Throughout
**Files:** `server/driver-data.js:259`, `server/driver-data.js:320`, multiple locations
**Severity:** 🟢 LOW

IDs like `Date.now().toString(36) + Math.random().toString(36)` are used across the codebase. While not security-critical for resource IDs, they are not guaranteed unique under high concurrency and are not cryptographically random. Use `crypto.randomUUID()` for all ID generation.

---

### LOW-07 — No `NODE_ENV=production` Enforcement Check
**File:** `server/index.js`
**Severity:** 🟢 LOW

The server has no check that `NODE_ENV` is set to `production` in a production environment. Express has some behaviours (e.g., error detail suppression, caching) that only activate in production mode. Without explicitly setting and verifying this, the server may behave as a development server in production.

---

## 5. DATABASE AUDIT

---

### DB-01 — Schema Mismatch Between `server/schema.sql` and `deployment/schema.sql`
**Severity:** 🟠 HIGH (covered in HIGH-06)

See HIGH-06. The two schemas use entirely different table and column names for the same data.

---

### DB-02 — No Database Migration System
**Severity:** 🟡 MEDIUM

Schema changes are handled by ad-hoc `ALTER TABLE` statements in `autoSeed()`. This is fragile:
- Migrations cannot be rolled back.
- There's no record of what schema version is deployed.
- Multiple `autoSeed()` runs can fail silently.
- The `session_version` column migration is the only example, but future changes will accumulate more inline DDL.

**Fix:** Adopt a proper migration tool (`node-pg-migrate`, `flyway`, `knex migrations`).

---

### DB-03 — Foreign Key Constraint Missing: `payroll.entity_id`
**File:** `server/schema.sql:126-134`
**Severity:** 🟡 MEDIUM

```sql
CREATE TABLE IF NOT EXISTS payroll (
    entity_id TEXT, -- Can be driver_id or staff_id
    entity_type TEXT, -- 'driver' or 'staff'
```

`entity_id` has no foreign key constraint. This allows payroll records to reference non-existent drivers or staff, causing silent data integrity issues and orphaned records.

**Fix:** Use a check constraint or separate tables (`driver_payroll`, `staff_payroll`) with proper foreign keys.

---

### DB-04 — `system_settings` Table Has No Index on `key`
**File:** `server/schema.sql:215-219`
**Severity:** 🟢 LOW

`system_settings.key` is defined as `TEXT PRIMARY KEY`, so it does have an implicit index. However, the `getSettings()` function fetches all rows: `SELECT * FROM system_settings`. As settings grow, add a covering index or ensure settings are accessed by specific key.

---

### DB-05 — Driver Data Not in Database: `tracker-data.json` Is the Source of Truth for Driver API
**Severity:** 🔴 CRITICAL (covered in CRIT-10)

---

### DB-06 — No `updated_at` Trigger for Core Tables
**File:** `server/schema.sql`
**Severity:** 🟢 LOW

Tables like `trucks`, `drivers`, `journeys` have `created_at` but no `updated_at`. Without knowing when a record was last modified, implementing change detection, audit logs, or incremental sync is impossible.

---

## 6. FRONTEND / API ALIGNMENT AUDIT

---

### FE-01 — Frontend Sends `x-admin-key` on Every Request (Including Driver Portal)
**File:** `src/utils/api.js:15-17`
**Severity:** 🟠 HIGH (amplifies CRIT-02)

The main admin panel's `fetchWithAuth` always sends `x-admin-key` regardless of whether the endpoint needs it. This means the admin key is sent to every API endpoint, including ones that should only require a user JWT.

---

### FE-02 — Driver Portal API (`driver-portal/src/utils/api.js`) Needs Review
**File:** `driver-portal/src/utils/api.js`
The driver portal has its own API utility. Verify it does not also send a static admin key.

---

### FE-03 — `useAppState.js` Stores Entire Database in `localStorage`
**File:** `src/hooks/useAppState.js:91`
**Severity:** 🟡 MEDIUM

```js
localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
```

The entire tracker state (all trucks, drivers, journeys, customers, payroll, invoices) is serialized to `localStorage` on every data change. `localStorage` has a 5–10 MB limit per origin. As data grows, this will fail silently, potentially corrupting the saved state or causing `QuotaExceededError` crashes.

Additionally, sensitive financial data (invoices, payroll amounts, customer details) is stored in browser storage unencrypted.

---

### FE-04 — Admin Key Sent as URL Query Parameter Visible in Browser History
**File:** `src/utils/api.js:27-33`
**Severity:** 🔴 CRITICAL (covered in CRIT-02)

---

### FE-05 — Payment Portal Has No Authentication UI
**File:** `payment-portal/src/App.jsx`
**Severity:** 🟡 MEDIUM

The payment portal `App.jsx` file appears to be mostly a placeholder/stub. Before launch, verify that payment flows are properly guarded and do not allow manipulation of invoice amounts or payment status without proper verification.

---

### FE-06 — Track Portal Is a Stub
**File:** `track-portal/src/App.jsx`
**Severity:** 🟡 MEDIUM

The track portal appears to be an incomplete stub. Verify no sensitive data endpoints are served to unauthenticated track portal users.

---

## 7. INFRASTRUCTURE & DEPLOYMENT AUDIT

---

### INF-01 — Secrets Baked Into Docker Build
**Severity:** 🟢 LOW (covered in LOW-02)

---

### INF-02 — Single Container Serves All Four Portals on Same Port
**File:** `Dockerfile`, `server/index.js:177-223`
**Severity:** 🟡 MEDIUM

All four portals (admin, driver, payment, track) are served from the same Express process. A crash in one portal's logic or a resource exhaustion attack on one affects all portals. Consider isolating at least the public-facing driver/payment portals from the admin backend.

---

### INF-03 — No HTTPS Redirect Enforcement
**Severity:** 🟡 MEDIUM

The server does not redirect HTTP to HTTPS nor set `Strict-Transport-Security`. While Railway/hosting may handle this, it should be enforced at the application layer as a defence-in-depth measure.

---

### INF-04 — `nixpacks.toml.bak` Left in Repository Root
**File:** `nixpacks.toml.bak`
**Severity:** 🟢 LOW

Leftover backup configuration files should not be in the repository. They can confuse deployment pipelines and clutter the repo.

---

### INF-05 — No `.gitignore` Coverage for Sensitive Files
Verify that `.gitignore` excludes:
- `server/backups/`
- `server/tracker-data.json`
- `server/documents.json`
- `server/error.log`
- `archive/server/*.json`
- `**/.env` (confirm this is already excluded)

---

## 8. PRIORITIZED REMEDIATION ROADMAP

### Phase 1 — Fix Before Any Production Deployment (Blockers)

| ID | Issue | Effort |
|----|-------|--------|
| CRIT-01 | Fix CORS to whitelist specific origins | 30 min |
| CRIT-02 | Remove `VITE_ADMIN_KEY` from frontend; JWT-only auth | 4–8 hrs |
| CRIT-03 | Delete duplicate reset route with hardcoded password | 15 min |
| CRIT-04 | Add rate limiting to all auth endpoints | 1 hr |
| CRIT-05 | Replace `Math.random()` in OTP with `crypto.randomInt()` | 15 min |
| CRIT-06 | Remove duplicate `/api/admin/reset` route | 15 min |
| CRIT-07 | Remove `rejectUnauthorized: false` from DB SSL config | 15 min |
| CRIT-08 | Audit and purge `archive/server/*.json` from git history | 2 hrs |
| CRIT-09 | Remove `adminKey` from query params and body | 30 min |
| CRIT-10 | Migrate `driver-data.js` to PostgreSQL | 1–2 days |
| CRIT-11 | Add multer file size and type limits | 30 min |
| CRIT-12 | Return HTTP 401 for failed logins | 15 min |
| HIGH-01 | Add Helmet.js security headers | 30 min |
| HIGH-02 | Fix `async/await` in account-status routes | 30 min |
| HIGH-07 | Remove stub endpoints that silently succeed | 1 hr |
| HIGH-08 | Fix `autoSeed` to not overwrite existing admin passwords | 30 min |
| HIGH-11 | Implement real driver photo uploads | 2–4 hrs |

### Phase 2 — Fix Within First Sprint Post-Launch

| ID | Issue | Effort |
|----|-------|--------|
| HIGH-03 | Sanitize error messages in production | 2 hrs |
| HIGH-04 | Add per-account lockout mechanism | 4 hrs |
| HIGH-05 | Exclude auth tables from backups | 1 hr |
| HIGH-06 | Consolidate schema files; add migration system | 1 day |
| HIGH-09 | Add pagination to all data endpoints | 4 hrs |
| HIGH-10 | Replace sync error log with async logger | 2 hrs |
| MED-01 | Add session versioning for staff and driver JWTs | 4 hrs |
| MED-03 | Remove `documents.js` flat-file module | 2 hrs |
| MED-07 | Add request body validation (joi/zod) | 1 day |
| DB-02 | Implement proper migration system | 1–2 days |

### Phase 3 — Ongoing Hardening

| ID | Issue | Effort |
|----|-------|--------|
| MED-06 | Move tokens from localStorage to HttpOnly cookies | 1–2 days |
| HIGH-04 | Rate limiting + CAPTCHA for auth endpoints | 4 hrs |
| LOW-06 | Replace `Math.random()` IDs with `crypto.randomUUID()` | 2 hrs |
| LOW-03 | Add DB health check to `/health` endpoint | 30 min |
| INF-02 | Separate admin backend from public portal serving | 1–2 days |

---

## 9. SUMMARY COUNTS

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 12 |
| 🟠 HIGH | 11 |
| 🟡 MEDIUM | 9 |
| 🟢 LOW | 7 |
| **Total** | **39** |

---

## Appendix A — Files Audited

| File | Purpose |
|------|---------|
| `server/index.js` | Main Express server — all API routes |
| `server/db.js` | PostgreSQL connection pool |
| `server/auth-utils.js` | Shared auth helpers (OTP, tokens, hashing) |
| `server/staff-auth.js` | Staff authentication logic |
| `server/driver-auth.js` | Driver authentication logic |
| `server/superadmin-auth.js` | Superadmin auth (unused) |
| `server/driver-data.js` | Driver data layer (JSON-file based) |
| `server/documents.js` | Documents module (JSON-file based) |
| `server/cloudinary.js` | Cloudinary upload wrapper |
| `server/r2.js` | Cloudflare R2 upload wrapper |
| `server/mpesa.js` | M-Pesa STK Push integration |
| `server/email.js` | SendGrid email templates |
| `server/sms.js` | Africa's Talking SMS |
| `server/schema.sql` | Production database schema |
| `deployment/schema.sql` | Deployment database schema (conflicts) |
| `src/utils/api.js` | Frontend API fetch utility |
| `src/utils/adminAuth.js` | Frontend session management |
| `src/utils/env.js` | Frontend environment constants |
| `src/hooks/useAppState.js` | Frontend state (localStorage + API sync) |
| `.env.example.local` | Local dev environment template |
| `.env.production.example` | Production environment template |
| `Dockerfile` | Container build definition |
| `docker-compose.yml` | Container orchestration |
| `server/package.json` | Backend dependencies |
| `archive/server/staff-auth.json` | Potentially real auth data |
| `archive/server/drivers-auth.json` | Potentially real auth data |

---

*This audit was performed through static code analysis. Dynamic testing (penetration testing, fuzzing, runtime analysis) should be conducted separately before production launch.*
