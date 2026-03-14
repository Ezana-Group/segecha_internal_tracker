-- Run this in Supabase SQL Editor to allow role = 'staff' on public.users.
-- Run it once, then re-run your audit/cleanup or STEP 4.

ALTER TABLE public.users DROP CONSTRAINT users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'director', 'viewer', 'staff', 'revoked'));
