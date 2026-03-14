# Segecha Group Fleet ERP — System Documentation

Complete technical documentation of the system: backend, frontend, database, and all connections.

---

## 1. Overview

**Segecha Group Fleet ERP** is a full-stack fleet operations management system for trucking/logistics. It covers:

- **Fleet & drivers** — Trucks, drivers, assignments
- **Journeys** — Trips with origin, destination, revenue, cargo, odometer
- **Fuel, expenses, maintenance** — Per-truck tracking
- **Invoices & M-Pesa** — Client invoicing and STK Push / payment matching
- **Payroll** — Driver pay, M-Pesa payouts
- **P&L** — Profit & loss reporting
- **Auth & roles** — Admin, Director, Viewer, Staff (with limited access by type)
- **Driver portal** — Trip start/end, odometer photos, submissions for admin approval

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **UI** | React 18, Tailwind CSS, react-hot-toast |
| **Database & Auth** | Supabase (PostgreSQL + Auth) |
| **Storage** | Supabase Storage (driver-uploads bucket) |
| **Payments** | Safaricom M-Pesa Daraja API (STK Push, callbacks) |
| **Charts** | Recharts |
| **Excel** | xlsx (import script) |

### Key dependencies (package.json)

- `@supabase/ssr`, `@supabase/supabase-js` — Supabase client and SSR
- `next`, `react`, `react-dom` — Core framework
- `react-hot-toast` — Toasts
- `recharts` — Charts (P&L, dashboard)
- `xlsx` — Excel import
- `lucide-react` — Icons (if used)
- `@vercel/speed-insights` — Analytics

---

## 3. Project Structure

```
segecha-erp/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout: ErpProvider, Toaster, SpeedInsights
│   ├── page.tsx                  # Redirects / → /login
│   ├── globals.css
│   ├── login/page.tsx            # Email/password sign-in
│   ├── account/page.tsx          # Profile, change password, photo
│   ├── dashboard/page.tsx        # KPIs, alerts (tyres, maintenance, overdue invoices)
│   ├── fleet/page.tsx           # Trucks CRUD
│   ├── drivers/page.tsx         # Drivers CRUD
│   ├── journeys/page.tsx        # Journeys CRUD
│   ├── fuel/page.tsx            # Fuel log
│   ├── expenses/page.tsx        # Expenses
│   ├── invoices/page.tsx        # Invoices, payments, M-Pesa STK Push
│   ├── transactions/page.tsx    # M-Pesa transactions, match to invoice/payroll
│   ├── payroll/page.tsx         # Payroll, mark paid via M-Pesa
│   ├── tyres/page.tsx           # Tyre monitor (odom, limit)
│   ├── maintenance/page.tsx     # Maintenance schedules
│   ├── pnl/page.tsx             # P&L report
│   ├── driver/page.tsx          # Driver portal (trip start/end, submissions)
│   ├── admin/
│   │   ├── users/page.tsx       # Manage users, roles, driver link, invite, reset password
│   │   ├── staff/page.tsx       # Manage staff (invite with staff_type: driver/marketing/office)
│   │   ├── settings/page.tsx    # M-Pesa Paybill/Till, account prefix
│   │   └── driver-submissions/page.tsx  # Approve/reject driver submissions
│   └── api/                     # API routes
│       ├── auth/
│       │   ├── invite/route.ts           # POST: invite user (Supabase Admin invite + users row)
│       │   └── ensure-profile/route.ts   # POST: create/update current user row (admin)
│       ├── admin/
│       │   └── reset-password/route.ts  # POST: admin sets user password (Supabase Admin API)
│       ├── mpesa/
│       │   ├── callback/route.ts   # POST: Daraja STK callback → mpesa_transactions
│       │   ├── stk-push/route.ts   # POST: trigger STK Push for invoice
│       │   └── reversal/route.ts   # POST: mark transaction reversed
│       └── upload/
│           └── driver-photo/route.ts  # POST: upload file → Supabase Storage, return URL
├── components/
│   ├── AppLayout.tsx             # Sidebar, nav, auth load, role-based menu (Admin, Staff)
│   └── ErpShared.tsx            # Shared UI: modals, filters, tables, form fields
├── lib/
│   ├── supabase.ts              # Browser client + server admin client
│   ├── auth.ts                  # signIn, signOut, getSession, getCurrentUser, resetPassword
│   ├── ErpContext.tsx           # Theme (dark/light), styles (S), helpers (fmt, today, uid)
│   ├── seed-data.ts             # SC (status colors), TYRE_WARN_KM, SEED
│   ├── mpesa-daraja.ts          # Server-only: getAccessToken, stkPush (Daraja API)
│   └── api.ts                   # Optional API helpers
├── middleware.ts                # Cookie check (optional redirect to /login)
├── next.config.js
├── supabase_schema.sql          # Full DB schema
├── .env.local.example           # Env template
└── scripts/
    └── import-excel.ts          # Excel import (e.g. drivers/trucks)
```

---

## 4. Database (Supabase / PostgreSQL)

Schema is defined in **supabase_schema.sql**. All tables live in `public`; RLS is disabled for simplicity.

### 4.1 Tables and relationships

| Table | Purpose | Key columns / relations |
|-------|---------|--------------------------|
| **users** | App profile per Auth user | `id` (PK, FK → auth.users), `email`, `name`, `role`, `driver_id` (FK → drivers), `staff_type`, `avatar_url` |
| **drivers** | Driver roster | `id` (PK), `name`, `phone`, `license`, `class`, `status`, `truck`, `joined`, `salary`, `mpesa` |
| **trucks** | Fleet | `id` (PK), `reg`, `make`, `year`, `type`, `capacity`, `driver` (FK → drivers), `status`, `odom`, `tyreOdom`, `tyreLimit` |
| **journeys** | Trips | `id` (PK), `truck`, `trailer`, `driver`, `origin`, `dest`, `date`, `endDate`, `distance`, `revenue`, `cargo`, `weight`, `status`, `odometerStart/End`, photos |
| **fuel** | Fuel log | `id`, `truck`, `date`, `litres`, `pricePerL`, `station`, `journey`, `odom` |
| **expenses** | Expenses | `id`, `truck`, `cat`, `amount`, `date`, `desc`, `journey` |
| **invoices** | Client invoices | `id`, `client`, `phone`, `journey`, `amount`, `issued`, `due`, `status`, `mpesaRef`, `paidDate`, `notes` |
| **invoice_payments** | Invoice payments | `id`, `invoice_id` (FK), `amount`, `paidDate`, `mpesaRef`, `type` |
| **payroll** | Driver pay | `id`, `driver`, `month`, `baseSalary`, `allowance`, `deductions`, `status`, `mpesaRef`, `paidDate` |
| **maintenance** | Maintenance schedule | `id`, `truck`, `type`, `lastDoneOdom`, `lastDoneDate`, `intervalKm`, `intervalMonths`, `notes` |
| **settings** | Key-value config | `key`, `value` (e.g. paybill_display, till_display, account_prefix) |
| **mpesa_transactions** | M-Pesa callback data | `id`, `transactionId`, `receiptNumber`, `phone`, `amount`, `transactionDate`, `accountReference`, `invoiceId`, `payrollId`, `status`, `rawPayload`, `createdAt` |
| **driver_submissions** | Driver-submitted data (pending approval) | `id`, `type` (journey_start/end, fuel, expense), `referenceId`, `driverId`, `payload`, `photoUrls`, `status`, `rejectionReason`, `reviewedBy`, `reviewedAt`, `createdAt` |

### 4.2 Users and roles

- **users.id** = Supabase Auth user UUID.
- **role**: `admin` | `director` | `viewer` | `staff`.
- **staff_type** (when role = staff): `driver` | `marketing` | `office` — used to restrict sidebar and routes.
- **driver_id**: links a user to a driver for the Driver portal.
- **avatar_url**: optional profile photo URL (Supabase Storage).

### 4.3 Optional columns (add if missing)

If your DB was created before some migrations, add:

```sql
alter table public.users add column if not exists driver_id text references public.drivers(id) on delete set null;
alter table public.users add column if not exists staff_type text;
alter table public.users add column if not exists avatar_url text;
```

---

## 5. Backend (API Routes & Server Logic)

### 5.1 Auth APIs

| Route | Method | Purpose | Auth |
|-------|--------|--------|------|
| **/api/auth/invite** | POST | Invite user by email (Supabase Admin invite + upsert `users`) | None (should be restricted to admin in production) |
| **/api/auth/ensure-profile** | POST | Ensure current user has a `users` row (role admin). Accepts session in body (`access_token`, `refresh_token`) or cookies | Session (cookies or body) |

**ensure-profile flow:** Resolve user from body tokens (or cookies) → upsert `users` with `id`, `email`, `name`, `role: 'admin'` via **supabaseAdmin** (service role).

### 5.2 Admin API

| Route | Method | Purpose | Auth |
|-------|--------|--------|------|
| **/api/admin/reset-password** | POST | Set another user’s password. Body: `userId`, `newPassword` | Session; caller must be admin (role from `users`) |

Uses **supabaseAdmin.auth.admin.updateUserById(userId, { password })**.

### 5.3 M-Pesa APIs

| Route | Method | Purpose | Auth |
|-------|--------|--------|------|
| **/api/mpesa/callback** | POST | Daraja STK callback; parses payload, inserts into **mpesa_transactions** | None (called by Safaricom) |
| **/api/mpesa/stk-push** | POST | Trigger STK Push for an invoice. Body: `invoiceId`. Uses **lib/mpesa-daraja.ts** (getAccessToken, stkPush) | None (frontend calls it) |
| **/api/mpesa/reversal** | POST | Mark transaction reversed in DB; body: `transactionId` | None |

**Connections:** Daraja OAuth and STK Push use env: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_BASE_URL`. Callback URL is `{base}/api/mpesa/callback`.

### 5.4 Upload API

| Route | Method | Purpose | Auth |
|-------|--------|--------|------|
| **/api/upload/driver-photo** | POST | Multipart form: `file`, `folder`. Uploads to Supabase Storage bucket **driver-uploads** (created if missing), returns public URL | None |

Used for driver photos, odometer photos, avatars (folder e.g. `avatars`, `odometer`, `photos`).

---

## 6. Frontend (App Router & Client)

### 6.1 Layout and auth

- **Root layout** (`app/layout.tsx`): Wraps app with `ErpProvider`, `Toaster`, `SpeedInsights`. No auth here.
- **AppLayout** (`components/AppLayout.tsx`): Used by (almost) all authenticated pages. It:
  - Loads session via **supabase.auth.getSession()**.
  - Loads profile from **users** (id, email, name, role). If missing, tries client upsert or **POST /api/auth/ensure-profile** with session in body, then refetches.
  - Redirects to `/login` if no session.
  - Renders sidebar: main nav + Admin nav (if role = admin) + Staff nav (if role = admin).
  - For **staff** role, filters nav by **STAFF_ALLOWED_ROUTES[staff_type]** and redirects disallowed paths to `/dashboard`.
  - Shows user name/role, dark toggle, sign out.
- **middleware.ts**: Does not redirect; only checks for Supabase cookies. Auth redirect is handled in AppLayout.

### 6.2 Routing and access

- **/** → redirect to **/login**.
- **/login**: Email/password via **lib/auth.ts** `signIn()` (Supabase signInWithPassword) → then push to `/dashboard`.
- All other app routes (dashboard, account, fleet, drivers, journeys, fuel, expenses, invoices, transactions, payroll, tyres, maintenance, pnl, driver, admin/*) are wrapped in **AppLayout** and require a session.
- **Driver** link in sidebar is shown only if `user.driver_id` is set.
- **Admin** and **Staff** sections are shown only if `user.role === 'admin'`.

### 6.3 Data access (client)

- **Supabase client** from **lib/supabase.ts**: `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Used for all client-side reads/writes (tables, auth).
- **Service role** is never sent to the client; it’s used only in API routes via **supabaseAdmin** (created server-side in `lib/supabase.ts`).

### 6.4 UI and theming

- **ErpContext**: Provides `dark`, `setDark`, and a large **S** (styles) object: cards, buttons, inputs, tables, badges, etc. Dark mode is persisted in `localStorage` (`segecha-dark`).
- **ErpShared**: Reusable table filters (text, select, date, number range), modals, form fields, sortable headers, etc.
- **Tailwind**: Used for layout and utilities; some pages also use inline styles from **S**.

---

## 7. External Connections

### 7.1 Supabase

- **URL**: `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://xxxx.supabase.co`).
- **Keys**:
  - **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Used by the browser client and by API routes for session resolution (cookies/getUser).
  - **SUPABASE_SERVICE_ROLE_KEY**: Used only in API routes (invite, ensure-profile, reset-password, callback, upload) to bypass RLS and call Auth Admin API.
- **Features used**: Auth (email/password, invite, reset password, updateUserById), Database (PostgREST), Storage (bucket `driver-uploads`).
- **Session**: Stored in cookies by `@supabase/ssr` (browser client). API routes read session via cookies (createServerClient) or via body tokens (ensure-profile).

### 7.2 Safaricom M-Pesa Daraja

- **Sandbox**: `https://sandbox.safaricom.co.ke`
- **Production**: `https://api.safaricom.co.ke`
- **Env**: `MPESA_ENV` (production vs sandbox), `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_BASE_URL`. Optional for B2C: `MPESA_INITIATOR_NAME`, `MPESA_INITIATOR_SECURITY_CREDENTIAL`, `MPESA_B2C_SHORTCODE`.
- **Flow**: App calls **/api/mpesa/stk-push** with `invoiceId` → API gets OAuth token → calls Daraja STK Push → Safaricom sends callback to **/api/mpesa/callback** → callback inserts into **mpesa_transactions**.

### 7.3 App / deployment

- **NEXTAUTH_URL**: Base URL (e.g. `http://localhost:3000` or production URL). Used in invite redirect and ensure-profile.
- **NEXT_PUBLIC_COMPANY_NAME**, **NEXT_PUBLIC_COMPANY_LOCATION**: Used for branding (e.g. “Segecha Group”, “Nairobi, Kenya”).

---

## 8. Environment Variables (Summary)

| Variable | Where used | Required |
|----------|------------|----------|
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase client (browser + API) | Yes |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Supabase client (browser + API) | Yes |
| **SUPABASE_SERVICE_ROLE_KEY** | API routes only (server) | Yes |
| **NEXTAUTH_URL** | Invite redirect, ensure-profile | Yes |
| **NEXTAUTH_SECRET** | (Reserved for future use) | Optional |
| **NEXT_PUBLIC_COMPANY_NAME** | UI | Optional |
| **NEXT_PUBLIC_COMPANY_LOCATION** | UI | Optional |
| **MPESA_CONSUMER_KEY** | Daraja OAuth | For M-Pesa |
| **MPESA_CONSUMER_SECRET** | Daraja OAuth | For M-Pesa |
| **MPESA_SHORTCODE** | STK Push | For M-Pesa |
| **MPESA_PASSKEY** | STK Push | For M-Pesa |
| **MPESA_CALLBACK_BASE_URL** | STK Push callback URL | For M-Pesa |
| **MPESA_ENV** | Daraja base URL (production/sandbox) | Optional (defaults to sandbox) |

---

## 9. Key User Flows

### 9.1 Login and profile

1. User opens app → redirected to **/login**.
2. Submits email/password → **signIn()** → Supabase Auth session created.
3. Redirect to **/dashboard**. AppLayout loads; fetches **users** row by `session.user.id`.
4. If no row: client upsert (if allowed) or **POST /api/auth/ensure-profile** with `access_token` + `refresh_token` → server upserts **users** with role admin → client reloads or refetches → profile and Admin/Staff menus appear.

### 9.2 Invite and staff

1. Admin goes to **Admin → Manage Users** or **Admin → Staff**.
2. **Invite user**: POST **/api/auth/invite** with `email`, `name`, `role` (and `staff_type` if role = staff). Server: Supabase Admin **inviteUserByEmail** + upsert **users**.
3. **Staff**: Same invite with `role: 'staff'` and `staff_type: driver | marketing | office`. Staff see only routes in **STAFF_ALLOWED_ROUTES[staff_type]**.

### 9.3 Reset password

1. **Admin**: Admin → Manage Users → “Reset password” for a user → POST **/api/admin/reset-password** with `userId`, `newPassword`. Server checks caller is admin, then **supabaseAdmin.auth.admin.updateUserById(userId, { password })**.
2. **Self**: Account → “Send password reset email” → **supabase.auth.resetPasswordForEmail(email)** (client).

### 9.4 M-Pesa STK Push and callback

1. User triggers “Pay via M-Pesa” on an invoice → frontend POST **/api/mpesa/stk-push** with `invoiceId`.
2. API loads invoice, builds callback URL, calls **stkPush()** in **lib/mpesa-daraja.ts** (OAuth + Daraja STK endpoint).
3. Safaricom sends callback to **/api/mpesa/callback**. Callback parses body, inserts into **mpesa_transactions**, returns 200.
4. Transactions page (and invoice/payroll logic) can match **mpesa_transactions** to invoices/payroll by reference/amount/phone.

### 9.5 Driver submissions

1. Driver (user with **driver_id** set) uses **/driver** to submit journey start/end (odometer + photo) or fuel/expense.
2. Data is stored in **driver_submissions** (type, referenceId, driverId, payload, photoUrls, status = pending).
3. Admin uses **Admin → Driver approvals** to approve or reject. On approve, app updates **journeys** (or fuel/expenses) and marks submission approved.

### 9.6 File uploads

1. Frontend sends multipart form to **/api/upload/driver-photo** (file + folder).
2. API creates bucket **driver-uploads** if needed, uploads file, returns public URL. Used for driver photos, odometer photos, account avatar (folder `avatars`).

---

## 10. Security Notes

- **Service role key** must never be exposed to the client; it is used only in server-side API routes.
- **Invite and ensure-profile** do not verify admin in code; in production you should restrict invite (and optionally ensure-profile) to authenticated admins.
- **M-Pesa callback** is public; validate payload and idempotency if needed.
- **RLS** is disabled on all tables; for production consider enabling RLS and defining policies per role.
- **Middleware** does not enforce auth; AppLayout handles redirect to login. You can re-enable middleware redirect if you want server-side protection.

---

## 11. Scripts and Commands

- **npm run dev** — Next.js dev server (default port 3000).
- **npm run build** — Production build.
- **npm run start** — Run production server.
- **npm run lint** — ESLint.
- **npm run import-excel** — Run Excel import script (e.g. `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-excel.ts`).

---

## 12. Database Setup (Quick Reference)

1. Create a Supabase project and get URL + anon key + service_role key.
2. In Supabase SQL Editor, run **supabase_schema.sql** (creates tables, indexes, disables RLS).
3. Add optional columns on **users** if missing: `driver_id`, `staff_type`, `avatar_url` (see section 4.3).
4. In Supabase Dashboard → Storage: bucket **driver-uploads** is created automatically on first upload via **/api/upload/driver-photo**; or create it manually (public, 10MB limit).
5. Configure Auth: Email provider enabled; optional custom redirect URLs for invite/reset.

This document reflects the codebase as of the last update and should be kept in sync when adding or changing APIs, tables, or env vars.
