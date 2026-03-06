# 🚛 Segecha Group ERP — Full Deployment Guide
### Vercel + Supabase · Step-by-Step · No Developer Needed

---

## WHAT YOU'LL END UP WITH

- ✅ Live app at: `https://segecha-erp.vercel.app` (or your custom domain)
- ✅ Secure login — every director has their own email + password
- ✅ Real database — data never lost, updates appear instantly for everyone
- ✅ 6–15 users can all log in and use it simultaneously
- ✅ Works on phone, tablet, laptop — anywhere in the world
- ✅ Free (Supabase free tier + Vercel free tier covers your usage)

**Time required:** ~30–45 minutes

---

## STEP 1 — Create Your Supabase Database (10 mins)

Supabase is your free database. All truck, journey, invoice data lives here.

1. Go to **https://supabase.com** and click **"Start your project"**
2. Sign up with Google or email
3. Click **"New Project"**
   - Name: `segecha-erp`
   - Database Password: choose a strong password and **save it somewhere safe**
   - Region: **East Africa (choose closest — Mumbai or Frankfurt)**
   - Click **"Create new project"** (takes ~2 minutes)

4. Once created, click **"SQL Editor"** in the left sidebar
5. Click **"New Query"**
6. Open the file `supabase-schema.sql` from this folder
7. **Copy all of its contents** and paste into the SQL editor
8. Click **"Run"** (green button)
   - You should see: *"Success. No rows returned"*
   - This creates all your tables, security rules, and sample data ✅

9. Now get your API keys:
   - Go to **Settings → API** (left sidebar)
   - Copy these three values (you'll need them in Step 3):
     ```
     Project URL:        https://xxxxxxxxxx.supabase.co
     anon/public key:    eyJhbGci...  (long string)
     service_role key:   eyJhbGci...  (different long string — KEEP SECRET)
     ```

---

## STEP 2 — Set Up GitHub Repository (5 mins)

1. Go to **https://github.com** and sign in (create free account if needed)
2. Click **"New repository"**
   - Repository name: `segecha-erp`
   - Set to **Private** ← important for security
   - Click **"Create repository"**

3. On your computer, open **Terminal** (Mac) or **Command Prompt** (Windows)
4. Run these commands one by one:

```bash
# Navigate to this project folder (adjust path as needed)
cd /path/to/segecha-erp

# Initialize git and push to GitHub
git init
git add .
git commit -m "Initial Segecha Group ERP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/segecha-erp.git
git push -u origin main
```

> **Tip:** Replace `YOUR_USERNAME` with your actual GitHub username.
> GitHub will ask for your username/password the first time.

---

## STEP 3 — Deploy to Vercel (10 mins)

Vercel hosts your app and makes it live on the internet.

1. Go to **https://vercel.com** and click **"Sign Up"**
   - Choose **"Continue with GitHub"** — this links your repos automatically

2. Click **"Add New Project"**
3. Find `segecha-erp` in the list and click **"Import"**
4. On the configuration screen:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: leave as `/`
   - Click **"Environment Variables"** to expand it

5. Add these environment variables one by one (click "Add" after each):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon/public key from Step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your service_role key from Step 1 |
   | `NEXTAUTH_SECRET` | Any random string (e.g. `segecha2024xK9mP3qR`) |
   | `NEXTAUTH_URL` | `https://segecha-erp.vercel.app` |
   | `NEXT_PUBLIC_COMPANY_NAME` | `Segecha Group` |
   | `NEXT_PUBLIC_COMPANY_LOCATION` | `Nairobi, Kenya` |

6. Click **"Deploy"**
   - Vercel builds the app (takes ~3 minutes)
   - You'll see a progress bar and then 🎉 **"Congratulations!"**

7. Your app is now live at: `https://segecha-erp.vercel.app`

---

## STEP 4 — Configure Supabase Auth (5 mins)

Tell Supabase to allow logins from your Vercel URL.

1. Go back to your Supabase project
2. Click **Authentication → URL Configuration** (left sidebar)
3. Set **Site URL** to: `https://segecha-erp.vercel.app`
4. Under **Redirect URLs**, click **"Add URL"** and add:
   ```
   https://segecha-erp.vercel.app/**
   ```
5. Click **Save**

---

## STEP 5 — Create Your Admin Account (5 mins)

1. Go to Supabase → **Authentication → Users**
2. Click **"Add user" → "Create new user"**
   - Email: your email address (e.g. `ceo@segechagroup.co.ke`)
   - Password: choose a strong password
   - Click **"Create User"**
   - Copy the **User UID** (looks like: `a1b2c3d4-...`)

3. Go to **SQL Editor → New Query** and run:
```sql
INSERT INTO users (id, email, name, role)
VALUES (
  'PASTE_YOUR_USER_UID_HERE',
  'your@email.com',
  'Your Full Name',
  'admin'
);
```
> Replace the UID, email, and name with yours.

4. Go to `https://segecha-erp.vercel.app` and log in with your email and password
5. You should see the dashboard! ✅

---

## STEP 6 — Invite Your Directors (5 mins)

Now invite the other 6–15 staff/directors.

1. Log into the app at `https://segecha-erp.vercel.app`
2. In the sidebar, click **⚙️ Manage Users** (only visible to admins)
3. Click **"+ Invite User"**
4. Enter their:
   - Full name
   - Work email address
   - Role: **Director** (full access) or **Viewer** (read only)
5. Click **"Send Invite"**

Each person gets an email with a **magic link**. They click it, set their password, and they're in. That's it!

**Roles explained:**
- 🔴 **Admin** — You. Can invite users, change roles, full access.
- 🟠 **Director** — Can view and edit all data (trucks, journeys, invoices, payroll etc.)
- 🔵 **Viewer** — Can only view data, cannot edit anything.

---

## STEP 7 — Custom Domain (Optional, 10 mins)

If you want `erp.segechagroup.co.ke` instead of `segecha-erp.vercel.app`:

1. In Vercel → your project → **Settings → Domains**
2. Click **"Add Domain"**
3. Type: `erp.segechagroup.co.ke`
4. Vercel gives you DNS records to add at your domain registrar
5. Add those records at wherever you bought the domain (GoDaddy, Kenya Network Info etc.)
6. Wait 10–60 minutes for DNS to propagate
7. Update `NEXTAUTH_URL` in Vercel environment variables to your new domain

---

## KEEPING YOUR APP UPDATED

Whenever code changes need to be made:
1. Update files on your computer
2. Run: `git add . && git commit -m "Update" && git push`
3. Vercel automatically detects the push and redeploys in ~2 minutes

---

## SECURITY NOTES

- 🔒 All data is protected — only logged-in users can access it (Row Level Security)
- 🔒 The `service_role` key is never exposed to the browser
- 🔒 Passwords are handled by Supabase Auth (bcrypt hashed, never stored as plain text)
- 🔒 Session tokens expire and auto-refresh
- 🔒 Every user has their own login — no shared passwords
- 🔒 An audit log records who made what change

---

## TROUBLESHOOTING

**"Invalid login credentials"**
→ Double-check email/password. Passwords are case-sensitive.

**"User not found" after invite**
→ Check spam folder. Have them click the link within 24 hours.

**Build fails on Vercel**
→ Check all 7 environment variables are entered correctly (no spaces).

**App loads but data is empty**
→ Re-run the `supabase-schema.sql` file in Supabase SQL Editor.

**Need help?**
→ Supabase docs: https://supabase.com/docs
→ Vercel docs: https://vercel.com/docs
→ Or bring this guide back to Claude for help!

---

## YOUR APP DETAILS (fill in after setup)

```
Live URL:          https://_________________________.vercel.app
Custom Domain:     https://_________________________ (if configured)
Supabase Project:  https://_________________________.supabase.co
Admin Email:       _________________________
Date Deployed:     _________________________
```

---

*Segecha Group ERP — Built for Kenyan long-haul transport operations*
