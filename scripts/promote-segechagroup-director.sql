-- Promote segechagroup@gmail.com to Director
-- Run this in Supabase Dashboard → SQL Editor

UPDATE public.users
SET role = 'director'
WHERE email = 'segechagroup@gmail.com';

-- Verify (optional): should return 1 row with role = director
-- SELECT id, email, name, role FROM public.users WHERE email = 'segechagroup@gmail.com';
