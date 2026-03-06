-- ==============================================================================
-- SEGECHA GROUP ERP - SUPABASE SCHEMA
-- Execute this script in the Supabase SQL Editor to set up the database tables.
-- ==============================================================================

-- 1. Clean Slate: Drop old overlapping ghost tables if they exist
drop table if exists public.payroll cascade;
drop table if exists public.invoices cascade;
drop table if exists public.expenses cascade;
drop table if exists public.fuel cascade;
drop table if exists public.journeys cascade;
drop table if exists public.trucks cascade;
drop table if exists public.drivers cascade;

-- Note: We use double quotes for camelCase columns to match the existing React frontend data model exactly.

-- 2. Users Table (Maps to Supabase Auth)
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  role text default 'viewer'
);

-- Note: We use double quotes for camelCase columns to match the existing React frontend data model exactly.

-- 2. Drivers
create table if not exists public.drivers (
  id text primary key,
  name text not null,
  phone text,
  license text,
  class text,
  status text,
  truck text, -- will be linked after trucks table via application logic or foreign key
  joined date,
  salary numeric,
  mpesa text
);

-- 3. Trucks
create table if not exists public.trucks (
  id text primary key,
  reg text not null,
  make text,
  year int,
  type text,
  capacity numeric,
  driver text references public.drivers(id) on delete set null,
  status text,
  odom numeric,
  "tyreOdom" numeric,
  "tyreLimit" numeric
);

-- 4. Journeys
create table if not exists public.journeys (
  id text primary key,
  truck text references public.trucks(id) on delete cascade,
  driver text references public.drivers(id) on delete set null,
  origin text,
  dest text,
  date date,
  "endDate" date,
  distance numeric,
  revenue numeric,
  cargo text,
  weight numeric,
  status text,
  notes text
);

-- 5. Fuel
create table if not exists public.fuel (
  id text primary key,
  truck text references public.trucks(id) on delete cascade,
  date date,
  litres numeric,
  "pricePerL" numeric,
  station text,
  journey text references public.journeys(id) on delete set null,
  odom numeric
);

-- 6. Expenses
create table if not exists public.expenses (
  id text primary key,
  truck text references public.trucks(id) on delete cascade,
  cat text,
  amount numeric,
  date date,
  "desc" text,
  journey text references public.journeys(id) on delete set null
);

-- 7. Invoices
create table if not exists public.invoices (
  id text primary key,
  client text,
  phone text,
  journey text references public.journeys(id) on delete set null,
  amount numeric,
  issued date,
  due date,
  status text,
  "mpesaRef" text,
  "paidDate" date,
  notes text
);

-- 8. Payroll
create table if not exists public.payroll (
  id text primary key,
  driver text references public.drivers(id) on delete cascade,
  month text,
  "baseSalary" numeric,
  allowance numeric,
  deductions numeric,
  status text,
  "mpesaRef" text,
  "paidDate" date
);

-- Disable Row Level Security (RLS) temporarily to allow easy migration and testing.
-- You can enable and configure these policies later via the Supabase Dashboard.
alter table public.users disable row level security;
alter table public.drivers disable row level security;
alter table public.trucks disable row level security;
alter table public.journeys disable row level security;
alter table public.fuel disable row level security;
alter table public.expenses disable row level security;
alter table public.invoices disable row level security;
alter table public.payroll disable row level security;

-- (Optional) If you want to force enable it, you could just add permissive policies for now:
-- create policy "Allow all access" on public.trucks for all using (true) with check (true);
