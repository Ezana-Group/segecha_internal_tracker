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
  status        TEXT GENERATED ALWAYS AS (
    CASE
      WHEN expiry_date < CURRENT_DATE THEN 'Expired'
      WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
      ELSE 'Valid'
    END
  ) STORED,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_expiry ON public.documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON public.documents(entity_type, entity_id);
