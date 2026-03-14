-- ==============================================================================
-- DOCUMENT VAULT — Run in Supabase SQL Editor before using Documents page.
-- entity_id is TEXT to match trucks.id and drivers.id (text PKs in this app).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('truck', 'driver', 'company')),
  entity_id     TEXT,                   -- truck.id or driver.id (text); NULL for company docs
  entity_name   TEXT,                   -- denormalised for display
  doc_type      TEXT NOT NULL,
  doc_number    TEXT,
  issuer        TEXT,
  issued_date   DATE,
  expiry_date   DATE NOT NULL,
  file_url      TEXT,
  notes         TEXT,
  status        TEXT DEFAULT 'Valid',  -- set by trigger from expiry_date: Expired / Expiring Soon / Valid
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to set status from expiry_date (CURRENT_DATE is not allowed in GENERATED columns)
CREATE OR REPLACE FUNCTION public.documents_set_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.expiry_date < CURRENT_DATE THEN 'Expired'
    WHEN NEW.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
    ELSE 'Valid'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_set_status_trigger ON public.documents;
CREATE TRIGGER documents_set_status_trigger
  BEFORE INSERT OR UPDATE OF expiry_date ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_set_status();

-- Backfill status for any existing rows (no-op if table is empty)
UPDATE public.documents SET status = CASE
  WHEN expiry_date < CURRENT_DATE THEN 'Expired'
  WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
  ELSE 'Valid'
END;

CREATE INDEX IF NOT EXISTS idx_documents_expiry ON public.documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON public.documents(entity_type, entity_id);
