-- ═══════════════════════════════════════════════════════════════
-- SEGECHA GROUP ERP — USER AUDIT & CLEANUP
-- Run in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════
-- Compatible with public.users (id, email, name, role, ...).
-- New profile rows get role 'admin'; change COALESCE(..., 'viewer') in STEP 4 if you prefer.
-- If your table has no created_at, remove "u.created_at," from STEP 1 and STEP 5.
-- Run STEP 0 once if you get "users_role_check" violation (role must include 'staff').
-- Run STEPs 1–2 first to inspect; then 3–4 to clean; then 5 to confirm.
-- ═══════════════════════════════════════════════════════════════

-- ── STEP 0: Allow 'staff' role (RUN THESE TWO LINES FIRST, THEN RUN STEP 4) ─────
-- Copy and run these two statements alone in Supabase SQL Editor:
--   1) ALTER TABLE public.users DROP CONSTRAINT users_role_check;
--   2) ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'viewer', 'staff', 'revoked'));
ALTER TABLE public.users DROP CONSTRAINT users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'director', 'viewer', 'staff', 'revoked'));


-- ── STEP 1: See ALL users in your public.users table ────────────
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  CASE
    WHEN a.id IS NOT NULL THEN '✅ HAS AUTH ACCOUNT'
    ELSE '❌ NO AUTH ACCOUNT — ORPHAN'
  END AS auth_status
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
ORDER BY u.email;


-- ── STEP 2: See ALL users in Supabase Auth ──────────────────────
SELECT
  a.id,
  a.email,
  a.created_at,
  a.last_sign_in_at,
  CASE
    WHEN u.id IS NOT NULL THEN '✅ HAS PROFILE ROW'
    ELSE '⚠️ MISSING PROFILE ROW'
  END AS profile_status
FROM auth.users a
LEFT JOIN public.users u ON u.id = a.id
ORDER BY a.created_at;


-- ── STEP 3: Delete orphaned profile rows (no Auth account) ──────
-- This removes rows like "test" that have no real login
DELETE FROM public.users
WHERE id NOT IN (
  SELECT id FROM auth.users
);


-- ── STEP 4: Create missing profile rows for Auth users ──────────
-- Ensures every real Auth user has a profile row (role must be admin/director/viewer/staff)
INSERT INTO public.users (id, email, name, role)
SELECT
  a.id,
  a.email,
  COALESCE(a.raw_user_meta_data->>'name', split_part(a.email, '@', 1)),
  CASE
    WHEN a.raw_user_meta_data->>'role' IN ('admin', 'director', 'viewer', 'staff')
    THEN a.raw_user_meta_data->>'role'
    ELSE 'admin'
  END
FROM auth.users a
WHERE a.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;


-- ── STEP 5: Final clean state — confirm what you have ───────────
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  a.last_sign_in_at AS last_login_auth
FROM public.users u
JOIN auth.users a ON a.id = u.id
ORDER BY u.email;
