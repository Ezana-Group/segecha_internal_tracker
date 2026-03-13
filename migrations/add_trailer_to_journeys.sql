-- Add optional trailer to journeys (run in Supabase SQL Editor if you already have journeys table).
-- Trailer = skeletal/trailer unit being pulled by the tractor on this trip.

-- Old schema (text id, truck/driver columns):
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS trailer TEXT REFERENCES trucks(id) ON DELETE SET NULL;

-- New schema (UUID, truck_id/driver_id) — use only one of the two below depending on your schema:
-- ALTER TABLE journeys ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES trucks(id) ON DELETE SET NULL;
