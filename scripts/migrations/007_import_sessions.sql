-- ==============================================================================
-- IMPORT SESSIONS & LOG — Track Excel/CSV import runs and row-level outcomes.
-- Run in Supabase SQL Editor before using Settings → Import Data.
-- ==============================================================================

-- Ensure uuid extension for import_sessions.id
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Track import sessions
CREATE TABLE IF NOT EXISTS public.import_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename      TEXT NOT NULL,
  sheet_name    TEXT,
  imported_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  imported_by_name TEXT,
  total_rows    INTEGER DEFAULT 0,
  passed_rows   INTEGER DEFAULT 0,
  failed_rows   INTEGER DEFAULT 0,
  warning_rows  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','previewing','importing','completed','cancelled')),
  summary       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- Track individual row outcomes
CREATE TABLE IF NOT EXISTS public.import_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  row_number    INTEGER NOT NULL,
  sheet_name    TEXT,
  row_data      JSONB,
  status        TEXT NOT NULL
                CHECK (status IN ('passed','warning','failed','skipped','imported')),
  issues        TEXT[],
  warnings      TEXT[],
  fix_applied   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent import: unique constraint so re-importing same file updates instead of duplicating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journeys_truck_date_origin_dest_key'
  ) THEN
    ALTER TABLE public.journeys
      ADD CONSTRAINT journeys_truck_date_origin_dest_key
      UNIQUE (truck, date, origin, dest);
  END IF;
END $$;

-- Fuel: unique per truck, date, journey for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fuel_truck_date_journey_key'
  ) THEN
    ALTER TABLE public.fuel
      ADD CONSTRAINT fuel_truck_date_journey_key
      UNIQUE (truck, date, journey);
  END IF;
END $$;

ALTER TABLE public.import_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log DISABLE ROW LEVEL SECURITY;
