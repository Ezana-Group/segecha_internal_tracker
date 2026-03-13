-- ═══════════════════════════════════════════════════════════════════
-- SEGECHA GROUP ERP — SUPABASE DATABASE SCHEMA
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS (Directors / Staff) ─────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'director', 'viewer')),
  avatar      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

-- ── TRUCKS ────────────────────────────────────────────────────────
CREATE TABLE trucks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reg          TEXT UNIQUE NOT NULL,
  make         TEXT NOT NULL,
  year         INTEGER,
  type         TEXT,
  capacity     NUMERIC,
  status       TEXT DEFAULT 'Active' CHECK (status IN ('Active','Maintenance','Off Road')),
  odom         INTEGER DEFAULT 0,
  tyre_odom    INTEGER DEFAULT 0,
  tyre_limit   INTEGER DEFAULT 60000,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── DRIVERS ───────────────────────────────────────────────────────
CREATE TABLE drivers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  phone        TEXT,
  mpesa        TEXT,
  license      TEXT,
  license_class TEXT,
  status       TEXT DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Suspended')),
  truck_id     UUID REFERENCES trucks(id) ON DELETE SET NULL,
  salary       NUMERIC DEFAULT 0,
  joined       DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── JOURNEYS (truck_id = tractor/prime mover; trailer_id = optional trailer being pulled) ──
CREATE TABLE journeys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  truck_id     UUID REFERENCES trucks(id) ON DELETE SET NULL,
  trailer_id    UUID REFERENCES trucks(id) ON DELETE SET NULL,
  driver_id    UUID REFERENCES drivers(id) ON DELETE SET NULL,
  origin       TEXT NOT NULL,
  destination  TEXT NOT NULL,
  date_start   DATE NOT NULL,
  date_end     DATE,
  distance     NUMERIC DEFAULT 0,
  revenue      NUMERIC DEFAULT 0,
  cargo        TEXT,
  weight       NUMERIC,
  status       TEXT DEFAULT 'Loading' CHECK (status IN ('Loading','In Transit','Completed','Cancelled')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── FUEL LOG ──────────────────────────────────────────────────────
CREATE TABLE fuel_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  truck_id     UUID REFERENCES trucks(id) ON DELETE CASCADE,
  journey_id   UUID REFERENCES journeys(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  litres       NUMERIC NOT NULL,
  price_per_l  NUMERIC NOT NULL,
  station      TEXT,
  odom         INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── EXPENSES ──────────────────────────────────────────────────────
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  truck_id     UUID REFERENCES trucks(id) ON DELETE SET NULL,
  journey_id   UUID REFERENCES journeys(id) ON DELETE SET NULL,
  category     TEXT NOT NULL CHECK (category IN ('Fuel','Maintenance','Toll','Permit','Tyre','Allowance','Salary','Insurance','Other')),
  amount       NUMERIC NOT NULL,
  description  TEXT,
  date         DATE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVOICES ──────────────────────────────────────────────────────
CREATE TABLE invoices (
  id           TEXT PRIMARY KEY,  -- e.g. INV-001
  journey_id   UUID REFERENCES journeys(id) ON DELETE SET NULL,
  client       TEXT NOT NULL,
  phone        TEXT,
  amount       NUMERIC NOT NULL,
  issued       DATE NOT NULL,
  due          DATE NOT NULL,
  status       TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Paid','Overdue')),
  mpesa_ref    TEXT,
  paid_date    DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYROLL ───────────────────────────────────────────────────────
CREATE TABLE payroll (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id    UUID REFERENCES drivers(id) ON DELETE CASCADE,
  month        TEXT NOT NULL,  -- format: YYYY-MM
  base_salary  NUMERIC NOT NULL,
  allowance    NUMERIC DEFAULT 0,
  deductions   NUMERIC DEFAULT 0,
  status       TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Paid')),
  mpesa_ref    TEXT,
  paid_date    DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id, month)
);

-- ── AUDIT LOG (tracks who changed what) ───────────────────────────
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name    TEXT,
  action       TEXT NOT NULL,   -- e.g. 'Created invoice INV-005'
  table_name   TEXT,
  record_id    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — only authenticated users can read/write
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE trucks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read everything
CREATE POLICY "Authenticated read" ON trucks      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON drivers     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON journeys    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON fuel_log    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON expenses    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON invoices    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON payroll     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read" ON audit_log   FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated write" ON trucks      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write" ON drivers     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write" ON journeys    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write" ON fuel_log    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write" ON expenses    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write" ON invoices    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write" ON payroll     FOR ALL USING (auth.role() = 'authenticated');

-- Users can only read their own profile
CREATE POLICY "Own profile" ON users FOR SELECT USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA — Sample trucks and drivers to get started
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO trucks (reg, make, year, type, capacity, status, odom, tyre_odom, tyre_limit) VALUES
  ('KCB 100A', 'Isuzu FVR',          2020, 'Rigid',        7,  'Active',      142300, 110000, 60000),
  ('KDA 200B', 'Mercedes Actros',    2019, 'Semi-Trailer', 28, 'Active',      310500, 270000, 60000),
  ('KDD 300C', 'Man TGS',            2021, 'Tipper',       20, 'Maintenance', 87200,  60000,  60000);
