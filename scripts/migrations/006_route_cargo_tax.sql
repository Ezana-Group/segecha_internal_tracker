-- ==============================================================================
-- ROUTE / CARGO / WAYBILL — Add cargo and waybill fields to journeys.
-- Run in Supabase SQL Editor before using Cargo page and waybill generator.
-- ==============================================================================

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS waybill_number TEXT,
  ADD COLUMN IF NOT EXISTS shipper TEXT,
  ADD COLUMN IF NOT EXISTS shipper_address TEXT,
  ADD COLUMN IF NOT EXISTS consignee TEXT,
  ADD COLUMN IF NOT EXISTS consignee_address TEXT,
  ADD COLUMN IF NOT EXISTS cargo_value NUMERIC,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS cargo_description TEXT,
  ADD COLUMN IF NOT EXISTS packages_count INTEGER;
