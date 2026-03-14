-- ==============================================================================
-- CLIENTS CRM — Run in Supabase SQL Editor before using Clients page.
-- Adds clients table and links invoices + journeys to clients.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.clients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  contact_person   TEXT,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  city             TEXT,
  country          TEXT DEFAULT 'Kenya',
  payment_terms    INTEGER DEFAULT 14,
  credit_limit     NUMERIC DEFAULT 0,
  notes            TEXT,
  status           TEXT DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Seed sample clients (run once; comment out or skip if you already have clients)
INSERT INTO public.clients (name, contact_person, phone, city) VALUES
  ('Bamburi Cement Ltd',      'John Kamau',    '0700 111 222', 'Mombasa'),
  ('Bidco Africa',            'Sarah Wanjiku', '0700 333 444', 'Nairobi'),
  ('East African Breweries',  'Peter Ochieng', '0700 555 666', 'Nairobi'),
  ('Kapa Oil Refineries',     'Mary Njeri',    '0700 777 888', 'Nairobi');
