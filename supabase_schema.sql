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

-- 2b. Link user to driver for driver portal (after drivers table exists)
alter table public.users add column if not exists driver_id text references public.drivers(id) on delete set null;

-- 2c. Staff type when role = 'staff' (e.g. driver, marketing, office) — limits which areas they can access
alter table public.users add column if not exists staff_type text;

-- 2d. Profile photo URL (e.g. from storage bucket)
alter table public.users add column if not exists avatar_url text;

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

-- 4. Journeys (truck = tractor/prime mover; trailer = optional skeletal/trailer unit being pulled)
-- odometerStart/End and photos filled when admin approves driver submission
create table if not exists public.journeys (
  id text primary key,
  truck text references public.trucks(id) on delete cascade,
  trailer text references public.trucks(id) on delete set null,
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
  notes text,
  "odometerStart" numeric,
  "odometerEnd" numeric,
  "odometerStartPhoto" text,
  "odometerEndPhoto" text
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

-- 7b. Invoice payments (deposits, partial, final). Invoice is Paid when sum >= amount.
create table if not exists public.invoice_payments (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  amount numeric not null,
  "paidDate" date not null,
  "mpesaRef" text,
  "type" text default 'payment' check ("type" in ('deposit', 'partial', 'final', 'payment')),
  notes text
);
create index if not exists idx_invoice_payments_invoice on public.invoice_payments(invoice_id);

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

-- 8b. Truck maintenance schedule (oil, brakes, COF, insurance, etc. – due by km or date)
create table if not exists public.maintenance (
  id text primary key,
  truck text not null references public.trucks(id) on delete cascade,
  type text not null,
  "lastDoneOdom" numeric,
  "lastDoneDate" date,
  "intervalKm" numeric,
  "intervalMonths" int,
  notes text
);
create index if not exists idx_maintenance_truck on public.maintenance(truck);
create index if not exists idx_maintenance_type on public.maintenance(type);

-- Disable Row Level Security (RLS) temporarily to allow easy migration and testing.
-- You can enable and configure these policies later via the Supabase Dashboard.
alter table public.users disable row level security;
alter table public.drivers disable row level security;
alter table public.trucks disable row level security;
alter table public.journeys disable row level security;
alter table public.fuel disable row level security;
alter table public.expenses disable row level security;
alter table public.invoices disable row level security;
alter table public.invoice_payments disable row level security;
alter table public.payroll disable row level security;
alter table public.maintenance disable row level security;

-- 9. Settings (key-value: Paybill/Till display for M-Pesa)
create table if not exists public.settings (
  key text primary key,
  value text
);
insert into public.settings (key, value) values ('paybill_display', ''), ('till_display', ''), ('account_prefix', 'INV')
  on conflict (key) do nothing;

-- 10. M-Pesa transactions (from Daraja callbacks: STK Push, B2C)
create table if not exists public.mpesa_transactions (
  id text primary key,
  "transactionId" text,
  "receiptNumber" text,
  phone text,
  amount numeric not null,
  "transactionDate" text,
  "accountReference" text,
  "resultCode" int,
  "resultDescription" text,
  "invoiceId" text references public.invoices(id) on delete set null,
  "payrollId" text references public.payroll(id) on delete set null,
  status text default 'completed',
  "rawPayload" jsonb,
  "createdAt" timestamptz default now()
);
create index if not exists idx_mpesa_transactions_invoice on public.mpesa_transactions("invoiceId");
create index if not exists idx_mpesa_transactions_payroll on public.mpesa_transactions("payrollId");
create index if not exists idx_mpesa_transactions_created on public.mpesa_transactions("createdAt" desc);

-- 11. Driver submissions (pending admin approval; then applied to journeys/fuel/expenses)
create table if not exists public.driver_submissions (
  id text primary key,
  type text not null check (type in ('journey_start', 'journey_end', 'fuel', 'expense')),
  "referenceId" text,
  "driverId" text not null references public.drivers(id) on delete cascade,
  payload jsonb not null default '{}',
  "photoUrls" jsonb default '[]',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  "rejectionReason" text,
  "reviewedBy" uuid references auth.users(id) on delete set null,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz default now()
);
create index if not exists idx_driver_submissions_driver on public.driver_submissions("driverId");
create index if not exists idx_driver_submissions_status on public.driver_submissions(status);
create index if not exists idx_driver_submissions_created on public.driver_submissions("createdAt" desc);

alter table public.settings disable row level security;
alter table public.mpesa_transactions disable row level security;
alter table public.driver_submissions disable row level security;

-- (Optional) If you want to force enable it, you could just add permissive policies for now:
-- create policy "Allow all access" on public.trucks for all using (true) with check (true);
