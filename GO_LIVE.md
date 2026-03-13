# Segecha Group ERP — Go-live checklist

Use this as your single checklist to take the app live with real data.

---

## 1. Database (Supabase)

### 1a. Create or confirm your project

- Go to **https://supabase.com** → your project (or create one).
- Region: choose **closest to Kenya** (e.g. Mumbai or Frankfurt).

### 1b. Apply the correct schema

Your app uses the **old schema** (tables: `fuel`, `truck`/`driver`/`trailer` on journeys, text IDs).

- Open **SQL Editor** → **New query**.
- Copy the **entire** contents of **`supabase_schema.sql`** and run it.
- If the project is brand new, this creates all tables. If tables already exist, you may need to run only the parts that add missing columns (e.g. trailer).

### 1c. Add trailer column (if the DB was created before trailer was added)

If `journeys` already existed without a trailer column:

- SQL Editor → New query → run:

```sql
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS trailer TEXT REFERENCES trucks(id) ON DELETE SET NULL;
```

### 1d. Wipe dummy data (optional)

If you had test data and want a clean start before loading real data:

- SQL Editor → New query.
- Copy and run **`clear_production_data.sql`**.
- This keeps tables and **users**; it deletes trucks, drivers, journeys, fuel, expenses, invoices, payroll.

### 1e. Load real data from Excel (optional)

- Put **`Trucking 2025.xlsx`** in the project root (same folder as `package.json`).
- In `.env.local` set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to **this** Supabase project.
- In terminal, from the project folder:

```bash
npm run import-excel
```

- Then add at least one **trailer** in the app (Fleet → Add truck → Type: **Skeletal Trailer** or **Trailer**, e.g. ZH 5825), because every new journey requires a trailer.

### 1f. Get API keys

- Supabase → **Settings** → **API**.
- Copy and keep safe:
  - **Project URL**
  - **anon public** key
  - **service_role** key (secret; only for server/import).

---

## 2. Environment variables (for production)

You need these where the app runs (e.g. Vercel).

| Variable | Where to get it | Example / note |
|----------|-----------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same | anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same | service_role key (keep secret) |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` | Any long random string |
| `NEXTAUTH_URL` | Your live app URL | `https://segecha-erp.vercel.app` (or your domain) |
| `NEXT_PUBLIC_COMPANY_NAME` | Your choice | `Segecha Group` |
| `NEXT_PUBLIC_COMPANY_LOCATION` | Your choice | `Nairobi, Kenya` |

---

## 3. Deploy the app (Vercel)

### 3a. Push code to GitHub

- Create a **private** repo (e.g. `segecha-erp`).
- From your project folder:

```bash
git init
git add .
git commit -m "Segecha ERP go-live"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/segecha-erp.git
git push -u origin main
```

### 3b. Import project on Vercel

- Go to **https://vercel.com** → Sign in with GitHub.
- **Add New** → **Project** → import **segecha-erp**.
- Framework: **Next.js** (auto-detected).

### 3c. Add environment variables in Vercel

- In the project, open **Settings** → **Environment Variables**.
- Add every variable from the table in **Section 2** (for Production).
- **Redeploy** after saving (Deployments → ⋮ → Redeploy).

### 3d. Deploy

- Trigger a deploy (push to `main` or use **Deploy** in Vercel).
- Note your live URL (e.g. `https://segecha-erp.vercel.app`).

---

## 4. Supabase Auth (allow your live URL)

- Supabase → **Authentication** → **URL Configuration**.
- **Site URL**: set to your live app URL (e.g. `https://segecha-erp.vercel.app`).
- **Redirect URLs**: add `https://segecha-erp.vercel.app/**` (or your domain).
- Save.

---

## 5. First admin user

- Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
  - Email and password for the first admin.
- Copy the new user’s **UID** (UUID).
- SQL Editor → New query:

```sql
INSERT INTO users (id, email, name, role)
VALUES (
  'PASTE_UID_HERE',
  'admin@segechagroup.co.ke',
  'Your Name',
  'admin'
);
```

- Open your live app URL and log in with that email and password.

---

## 6. After go-live

- **Trailers:** In the app, **Fleet** → Add truck → Type **Skeletal Trailer** or **Trailer** (e.g. ZH 5825). Every new journey requires a trailer.
- **Invite others:** In the app, **Manage Users** (admin) → **Invite User** (Director or Viewer).
- **Custom domain (optional):** Vercel → Project → **Settings** → **Domains** → add e.g. `erp.segechagroup.co.ke`, then set `NEXTAUTH_URL` to that domain and update Supabase redirect URL.

---

## Quick reference

| Step | What | Where |
|------|------|--------|
| 1 | Schema + trailer column | Supabase SQL Editor, `supabase_schema.sql`, then `migrations/add_trailer_to_journeys.sql` if needed |
| 2 | Clear old data (optional) | Supabase SQL Editor, `clear_production_data.sql` |
| 3 | Import Excel (optional) | Terminal: `npm run import-excel` (with `.env.local` pointing at Supabase) |
| 4 | Env vars | Vercel → Settings → Environment Variables |
| 5 | Auth URLs | Supabase → Authentication → URL Configuration |
| 6 | First admin | Supabase Auth + `INSERT INTO users` |

---

*Segecha Group ERP — go-live checklist*
