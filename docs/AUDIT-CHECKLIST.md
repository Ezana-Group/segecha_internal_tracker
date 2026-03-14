# Segecha ERP — Audit Checklist

Use this to verify everything works after the UI streamlining (sidebar, invoices tabs, admin panel, account, driver portal).

---

## 1. Build & Lint

- [ ] **Build** — `npm run build` completes with no errors.
- [ ] **Lint** — `npm run lint` passes (if configured).

**Last verified:** Build ✓ (34 routes generated).

---

## 2. Routes & Redirects

| From (old URL) | Should redirect to |
|----------------|--------------------|
| `/transactions` | `/invoices?tab=transactions` |
| `/admin/settings` | `/invoices?tab=settings` |
| `/admin/users` | `/admin?tab=users` |
| `/admin/staff` | `/admin?tab=staff` |
| `/admin/driver-submissions` | `/admin?tab=approvals` |

**Manual check:** Visit each old URL while logged in; confirm redirect.

---

## 3. Sidebar (AppLayout)

- [ ] **Main menu** — Dashboard, Account, Fleet, Drivers, Journeys, Fuel Log, Expenses, **Invoices & M-Pesa** (one item, no separate M-Pesa), Payroll, Tyre Monitor, Maintenance, P&L Report.
- [ ] **Driver Portal** — Visible only when `user.driver_id` is set.
- [ ] **Admin** — One item: “Admin Panel” → `/admin` (no separate Manage Users / Staff / Settings / Driver approvals).
- [ ] **Staff (driver)** — If role = staff, staff_type = driver, and driver_id set: only “Driver Portal” in sidebar; visiting any non-`/driver` URL redirects to `/driver`.

---

## 4. Invoices & M-Pesa (`/invoices`)

- [ ] **Tabs** — Three pills: Invoices, M-Pesa Transactions, Settings. URL updates to `?tab=invoices`, `?tab=transactions`, `?tab=settings`.
- [ ] **Tab Invoices** — Same as before: list, filters, new/edit invoice, STK Push, record payment, view/print.
- [ ] **Tab M-Pesa Transactions** — Table, search, match to invoice/payroll, refund. Same behaviour as old `/transactions` page.
- [ ] **Tab Settings** — Paybill, Till, Account prefix; Save; M-Pesa note at bottom.

---

## 5. Admin Panel (`/admin`)

- [ ] **Tabs** — Users, Staff, Driver Approvals. URL: `?tab=users`, `?tab=staff`, `?tab=approvals`.
- [ ] **Tab Users** — Role cards, users table, Create Driver, Invite User. Invite modal has **Driver** role option (creates staff + driver). Role dropdown includes staff; driver_id column and Reset password work.
- [ ] **Tab Staff** — Staff list, Add Staff, invite with staff type (driver/marketing/office), change type.
- [ ] **Tab Driver Approvals** — Pending driver submissions; Approve / Reject with reason; payload and photo links.

---

## 6. Account (`/account`)

- [ ] **Layout** — Two columns on desktop (md+): left = avatar, name, email, role; right = Edit Profile + Security.
- [ ] **Edit Profile** — Full name and phone; Save Profile updates `users` and shows toast.
- [ ] **Security** — “Last login” line (or “Never”); “Send password reset email” works.
- [ ] **Photo** — Change photo still works.

---

## 7. Driver Portal (`/driver`, `/driver/fuel`, `/driver/expenses`, `/driver/profile`)

- [ ] **Layout** — No main app sidebar; top bar (logo, title, first name); bottom nav: Trips, Fuel, Expenses, Profile. Light theme only.
- [ ] **My Trips** — Last 10 journeys; cards with route, date, status, revenue, cargo; “＋ Start New Trip” scrolls to list; submit start/end (odometer + photo) for a trip.
- [ ] **Fuel** — Log fuel form (truck read-only, date, litres, price/L, total, station, photo); Submit; recent fuel submissions with status.
- [ ] **Expenses** — Category (Toll / Maintenance / Other), amount, description, date, photo; Submit; recent expense submissions.
- [ ] **Profile** — Read-only: name, phone, license, class, assigned truck reg, status; Reset Password; Sign Out → `/login`.
- [ ] **Access** — Driver portal only works for users with `driver_id` set; others see “not linked” message.

---

## 8. Staff Access Matrix

| staff_type | Allowed routes |
|------------|----------------|
| driver | `/driver` only (and /driver/fuel, /driver/expenses, /driver/profile) |
| marketing | `/dashboard`, `/account`, `/invoices` |
| office | `/dashboard`, `/account`, `/journeys`, `/fuel`, `/expenses`, `/invoices`, `/payroll`, `/tyres`, `/maintenance`, `/pnl` |

- [ ] **Driver staff** — With `driver_id`: only Driver Portal in sidebar; any other path redirects to `/driver`.
- [ ] **Marketing staff** — No Fleet, Drivers, Journeys, etc.; has Invoices & M-Pesa (tabs work).
- [ ] **Office staff** — No Admin, no Driver Portal (unless driver_id set); has all other main menu items.

---

## 9. Database (Supabase)

- [ ] **users.role** — Check constraint allows `admin`, `director`, `viewer`, `staff`. If not, run `scripts/fix-users-role-constraint.sql`.
- [ ] **users** — Columns exist: `id`, `email`, `name`, `role`, `driver_id`, `staff_type`, `phone`, `avatar_url`, `last_login` (add if missing; see SYSTEM_DOCUMENTATION or migration scripts).
- [ ] **User audit** — Run `scripts/user-audit-cleanup.sql` (STEP 0 first if needed, then 1–5) to remove orphan profiles and ensure every Auth user has a profile row.

---

## 10. Key Flows (smoke test)

- [ ] **Login** — Email/password → redirect to dashboard (or `/driver` for staff driver with driver_id).
- [ ] **Invite (admin)** — Admin Panel → Users → Invite User → Driver role → invite sent; new user has role staff, staff_type driver.
- [ ] **Link driver** — Admin → Users → set “Driver” dropdown for a user → that user sees Driver Portal and can use `/driver`.
- [ ] **Driver submit** — Driver logs fuel or expense → appears in Admin → Driver Approvals → Approve/Reject works.
- [ ] **Invoices** — Create invoice, send STK Push (if configured), switch to M-Pesa Transactions tab, match transaction; switch to Settings tab, save Paybill/Till/prefix.
- [ ] **Account** — Edit name/phone, Save; Last login shows; password reset email sends.

---

## Quick commands

```bash
npm run build    # Must succeed
npm run dev      # Manual testing
```

**Run after code or schema changes.** Mark items as you go; fix any failures before go-live.
