-- Run in Supabase SQL Editor if your schema was created before driver portal columns were added.
-- (Main supabase_schema.sql already includes these; use this to align existing projects.)

-- Ensure journeys table has odometer columns (schema uses camelCase: odometerStart, odometerEnd)
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS "odometerStart" numeric,
  ADD COLUMN IF NOT EXISTS "odometerEnd" numeric,
  ADD COLUMN IF NOT EXISTS "odometerStartPhoto" text,
  ADD COLUMN IF NOT EXISTS "odometerEndPhoto" text;

-- driver_submissions: payload and photoUrls are jsonb, rejectionReason text
ALTER TABLE public.driver_submissions
  ADD COLUMN IF NOT EXISTS "photoUrls" jsonb default '[]',
  ADD COLUMN IF NOT EXISTS payload jsonb default '{}',
  ADD COLUMN IF NOT EXISTS "rejectionReason" text;

-- Check column names (run to verify)
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'driver_submissions' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journeys' ORDER BY ordinal_position;
