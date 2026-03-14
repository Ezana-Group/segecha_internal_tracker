# CURSOR AI PROMPT — UI Streamlining + Driver Mobile Portal
# Based on SYSTEM_DOCUMENTATION.md — read that file before starting.
# Paste this entire prompt into Cursor AI.

---

## CONTEXT — READ FIRST

This is the **Segecha Group Fleet ERP** built with:
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (PostgreSQL + Auth + Storage bucket `driver-uploads`)
- `ErpContext` (provides `dark`, `setDark`, styles object `S`, `fmt`, `today`, `uid`)
- `ErpShared` (reusable modals, table filters, form fields, sortable headers)
- `AppLayout` (sidebar, session load, role-based nav, `STAFF_ALLOWED_ROUTES`)
- Roles: `admin` | `director` | `viewer` | `staff` (with `staff_type`: driver/marketing/office)
- `users.driver_id` → links a user account to a `drivers` row for the driver portal

**Do NOT rewrite any existing data-fetching logic, Supabase queries, API routes, or
ErpContext/ErpShared components. Only reorganise, merge, and add UI as described below.**

**Always use the existing `S` styles object from `ErpContext` for all styling.
Always use `ErpShared` components (modals, form fields, filters) where they already exist.**

---

## PART 1 — SIDEBAR RESTRUCTURE (AppLayout.tsx)

The sidebar currently has too many top-level items. Consolidate as follows.

### Current sidebar items to KEEP as-is:
```
Dashboard, Account, Fleet, Drivers, Journeys, Fuel Log,
Expenses, Payroll, Tyre Monitor, Maintenance, P&L Report
```

### Changes:
1. **Remove** `Transactions` from sidebar → it becomes a tab inside `Invoices & M-Pesa` (see Part 2)
2. **Remove** `Admin → Manage Users`, `Admin → Staff`, `Admin → Settings`, `Admin → Driver approvals`
   as separate sidebar links → replace with single `Admin → ⚙️ Admin Panel` link to `/admin`
3. **Rename** `Invoices` → `Invoices & M-Pesa` in the sidebar label (href stays `/invoices`)
4. **Driver portal link** in sidebar: already shown only when `user.driver_id` is set — keep this logic

### New sidebar structure:
```
MAIN MENU
  ◈  Dashboard               /dashboard
  👤  Account                /account
  🚛  Fleet                  /fleet
  👥  Drivers                /drivers
  🗺️  Journeys               /journeys
  ⛽  Fuel Log               /fuel
  💸  Expenses               /expenses
  📄  Invoices & M-Pesa      /invoices
  💰  Payroll                /payroll
  🔵  Tyre Monitor           /tyres
  🔧  Maintenance            /maintenance
  📈  P&L Report             /pnl
  🚗  Driver Portal          /driver        ← only if user.driver_id is set

ADMIN  (role === 'admin' only)
  ⚙️  Admin Panel            /admin
```

The existing `STAFF_ALLOWED_ROUTES` logic must remain intact — do not remove it.

---

## PART 2 — INVOICES PAGE: ADD TABS (app/invoices/page.tsx)

The current `/invoices` page has invoices only. Add a **3-tab layout** at the top of the page.
Use `useSearchParams` + `router.replace` so the active tab persists in the URL (`?tab=invoices` etc).

### Tab 1: "Invoices" (default, `?tab=invoices`)
- Existing invoices page content — keep ALL existing functionality unchanged
- STK Push button, create invoice, status filters, invoice table — all unchanged

### Tab 2: "M-Pesa Transactions" (`?tab=transactions`)
- Move the ENTIRE content of `app/transactions/page.tsx` into this tab
- Keep all existing Supabase queries, match-to-invoice logic, reversal button, etc.
- After moving, `app/transactions/page.tsx` should redirect to `/invoices?tab=transactions`

### Tab 3: "Settings" (`?tab=settings`)
- Move the ENTIRE content of `app/admin/settings/page.tsx` into this tab
- Paybill Number, Till/Buy Goods Number, Account Number Prefix fields
- Save settings button
- The M-Pesa STK note at the bottom
- After moving, `app/admin/settings/page.tsx` should redirect to `/invoices?tab=settings`

**Tab UI:** Use the existing `S` styles. Tabs should be a simple pill-style row at the top of
the page, consistent with other multi-tab pages in the codebase.

---

## PART 3 — ADMIN PANEL: MERGE INTO ONE PAGE (app/admin/page.tsx)

Replace the separate admin sub-pages with ONE page at `/admin` using **3 tabs**.
Use `useSearchParams` for tab state (`?tab=users` default, `?tab=staff`, `?tab=approvals`).

### Tab 1: "Users" (`?tab=users`) — from `app/admin/users/page.tsx`
- Keep ALL existing content: role explanation cards (Admin/Director/Viewer), users table,
  Role dropdown, "Reset password" action, "Invite User" modal
- Add a "Driver" option to the Role dropdown in the Invite modal
  (role: 'staff', staff_type: 'driver') — this is already supported by the invite API
- Keep the existing `+ Create Driver` and `+ Invite User` buttons

### Tab 2: "Staff" (`?tab=staff`) — from `app/admin/staff/page.tsx`
- Move the ENTIRE content of `app/admin/staff/page.tsx` into this tab unchanged
- Keep all existing functionality: staff list, invite staff, staff_type badges

### Tab 3: "Driver Approvals" (`?tab=approvals`) — from `app/admin/driver-submissions/page.tsx`
- Move the ENTIRE content of `app/admin/driver-submissions/page.tsx` into this tab unchanged
- Keep all existing approve/reject logic, payload display, photo URLs, etc.

### After merging:
- `app/admin/users/page.tsx` → redirect to `/admin?tab=users`
- `app/admin/staff/page.tsx` → redirect to `/admin?tab=staff`
- `app/admin/driver-submissions/page.tsx` → redirect to `/admin?tab=approvals`
- `app/admin/settings/page.tsx` → redirect to `/invoices?tab=settings` (moved there in Part 2)

---

## PART 4 — ACCOUNT PAGE IMPROVEMENTS (app/account/page.tsx)

The current account page is narrow and sparse. Improve layout only — do not change any
existing Supabase queries or auth logic.

### Layout changes:
- Increase max-width from current narrow card to `max-w-3xl`
- On desktop (md+): split into **2 columns** side by side
  - **Left column**: Avatar circle with initials + "Change photo" button (existing) +
    Name (large, bold) + Email + Role badge (existing coloured badge)
  - **Right column**: Edit Profile form + Security section

### Add "Edit Profile" form (right column, top):
- **Full Name** text input (pre-filled with `user.name`)
- **Phone Number** text input (pre-filled with `user.phone` if exists in users table, else blank)
- **Save Profile** button → `supabase.from('users').update({ name, phone }).eq('id', user.id)`
- Show toast on success/error using existing `react-hot-toast`

### Security section (right column, below Edit Profile):
- Keep existing "Send password reset email" button
- Add a "Last login" line: `Last login: {user.last_login ? formatDate : 'Never'}`
  (the `last_login` column already exists on the `users` table per the schema)

### No other changes — keep existing photo upload, role display, etc.

---

## PART 5 — DRIVER MOBILE PORTAL (app/driver/ pages)

The `/driver` route already exists (`app/driver/page.tsx`). Based on the docs, the driver
portal handles: trip start/end with odometer photos, fuel submissions, expense submissions —
all going into `driver_submissions` table for admin approval.

**The existing data logic is already built. Only improve the UI/UX for mobile.**

### Create `components/DriverLayout.tsx` (replaces or wraps existing driver page layout):

```
- NO AppLayout sidebar — completely separate layout
- Top bar (fixed, 56px):
    Left: 🚛 small icon + "Segecha Group" (small, bold)
    Center: Page title (passed as prop)
    Right: Driver's first name
- Page content: scrollable, padding 16px, max-width 430px centered on desktop
- Bottom nav bar (fixed, 60px, white bg, top border):
    4 items: 🗺️ Trips | ⛽ Fuel | 💸 Expenses | 👤 Profile
    Active item: orange text + orange dot indicator below icon
    Each item: icon (24px) + label (10px) stacked, tap area full height
- Always light mode (white background) — drivers use phones outdoors
  Do NOT use dark mode or S styles from ErpContext in the driver portal
- Font size minimum 16px everywhere
- All buttons: min-height 52px, full width, rounded-xl, orange gradient
- Cards: 16px padding, 12px border-radius, subtle shadow (shadow-sm), white bg
```

### Improve `app/driver/page.tsx` — My Trips:
- Use `DriverLayout` with title "My Trips"
- Show driver's trips from `journeys` where `driver = user.driver_id`
  ordered by date descending, last 10 trips
- Each trip: a card showing Route (origin → dest, bold), Date, Status badge,
  Revenue (KES formatted), Cargo
- Status badge colours: Loading=amber, In Transit=blue, Completed=green
- **Large "＋ Start New Trip" button** at top (orange, full width, 52px)
  → opens existing trip-start modal/form (keep existing logic)
- Empty state: friendly message "No trips yet. Tap + to log your first trip."

### Improve `app/driver/fuel/page.tsx` — Log Fuel:
- Use `DriverLayout` with title "Fuel Log"
- **Top section**: Log Fuel form (card):
  - Truck: read-only, shows assigned truck reg
  - Date: date picker, defaults to today
  - Litres: large number input (font-size 24px inside input)
  - Price per Litre (KES): large number input
  - Computed total: "Total cost: KES X" shown live as they type
  - Station name: text input
  - Photo: file input for receipt photo (uses existing `/api/upload/driver-photo`)
  - Submit button: "Submit Fuel Entry" (orange, 52px, full width)
- **Bottom section**: "Recent Submissions" — last 5 entries from `driver_submissions`
  where `type = 'fuel'` and `driver_id = user.driver_id`
  Each card: Date, Litres, Total Cost, Status badge (Pending/Approved/Rejected)

### Improve `app/driver/expenses/page.tsx` — Log Expense:
- Use `DriverLayout` with title "Expenses"
- **Top section**: Log Expense form (card):
  - Category: large segmented button group (not a select dropdown):
    `[Toll] [Maintenance] [Other]` — tap to select, orange = active
  - Amount (KES): large number input (font-size 24px)
  - Description: text input
  - Date: date picker, defaults to today
  - Photo: file input for receipt
  - Submit button: "Submit Expense" (orange, 52px, full width)
- **Bottom section**: "Recent Submissions" — last 5 from `driver_submissions`
  where `type = 'expense'` and `driver_id = user.driver_id`

### Create `app/driver/profile/page.tsx` — My Profile:
- Use `DriverLayout` with title "Profile"
- Show (read-only card):
  - Name (large, bold)
  - Phone number
  - License number
  - License class
  - Assigned truck registration
  - Status badge
- **"Reset Password"** button → `supabase.auth.resetPasswordForEmail(user.email)`
  → toast "Password reset email sent"
- **"Sign Out"** button (red/outline, full width, 52px) → `supabase.auth.signOut()` → `/login`

### Routing for driver portal:
- In `AppLayout.tsx`: if `user.role === 'staff' && user.staff_type === 'driver'` AND
  `user.driver_id` is set → redirect all non-`/driver/**` routes to `/driver`
- The existing `STAFF_ALLOWED_ROUTES` already handles staff routing —
  add `'driver'` staff_type to it: `STAFF_ALLOWED_ROUTES['driver'] = ['/driver']`

---

## PART 6 — SQL TO RUN IN SUPABASE BEFORE STARTING

Run this in Supabase SQL Editor to add the phone column if missing:

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
```

The following columns should already exist per the schema — verify and add only if missing:
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS driver_id TEXT REFERENCES public.drivers(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS staff_type TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

---

## PART 7 — SUMMARY OF FILES TO CHANGE

### Modify:
- `components/AppLayout.tsx` — new streamlined sidebar (Part 1)
- `app/invoices/page.tsx` — add 3 tabs: Invoices / M-Pesa Transactions / Settings (Part 2)
- `app/account/page.tsx` — 2-column layout, edit name/phone, last login (Part 4)
- `lib/seed-data.ts` or wherever `STAFF_ALLOWED_ROUTES` is defined —
  add `driver: ['/driver']` entry (Part 5)

### Create:
- `app/admin/page.tsx` — 3-tab Admin Panel: Users / Staff / Driver Approvals (Part 3)
- `components/DriverLayout.tsx` — mobile bottom-nav layout for driver portal (Part 5)
- `app/driver/profile/page.tsx` — driver profile page (Part 5)

### Redirect (add a redirect at top of file, keep rest of file intact):
- `app/admin/users/page.tsx` → redirect to `/admin?tab=users`
- `app/admin/staff/page.tsx` → redirect to `/admin?tab=staff`
- `app/admin/driver-submissions/page.tsx` → redirect to `/admin?tab=approvals`
- `app/admin/settings/page.tsx` → redirect to `/invoices?tab=settings`
- `app/transactions/page.tsx` → redirect to `/invoices?tab=transactions`

### Do NOT touch:
- Any API routes (`app/api/**`) — none of these change
- `lib/ErpContext.tsx`, `lib/ErpShared.tsx`, `lib/supabase.ts`, `lib/auth.ts`,
  `lib/mpesa-daraja.ts` — do not modify these files
- `middleware.ts` — leave as-is per the docs (auth handled by AppLayout)
- Any existing Supabase queries — move them into tabs, never rewrite them

---

## IMPORTANT NOTES FOR CURSOR

1. **Read `SYSTEM_DOCUMENTATION.md` before writing any code** — the system is more
   complete than it may appear. Many things already exist.

2. **Use `ErpContext`** (`useErp()` or however it's consumed) for the `S` styles object
   in all admin/main app pages. Never use hardcoded hex colours in the main app.

3. **Use `ErpShared`** components for any modals, form fields, table filters — do not
   rebuild these from scratch.

4. **Driver portal is always light mode** — do NOT import `ErpContext` or `S` in
   `DriverLayout.tsx` or any `app/driver/**` pages. Use plain Tailwind only.

5. **Tab state via URL params** — use `useSearchParams()` + `router.replace` for all
   tab navigation so the browser back button works and tabs survive refresh.

6. **Do not break existing functionality** — every piece of existing data fetching,
   form submission, M-Pesa STK push, and driver submission approval must continue
   working exactly as before. You are only reorganising and improving the UI.

7. **Test the sidebar change last** — it's the most impactful. Verify all existing
   nav links still work after restructuring AppLayout.
