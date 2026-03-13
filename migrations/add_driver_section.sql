-- Driver section: link user to driver, journey odometer photos, driver submissions (pending admin approval)
-- Run in Supabase SQL Editor. Create Storage bucket "driver-uploads" in Dashboard (Storage → New bucket) with public read if needed.

-- Link app user to driver (so driver can log in and see /driver)
alter table public.users add column if not exists driver_id text references public.drivers(id) on delete set null;

-- Journeys: odometer and photo URLs (filled when admin approves driver submission)
alter table public.journeys add column if not exists "odometerStart" numeric;
alter table public.journeys add column if not exists "odometerEnd" numeric;
alter table public.journeys add column if not exists "odometerStartPhoto" text;
alter table public.journeys add column if not exists "odometerEndPhoto" text;

-- Driver submissions: pending until admin approves
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

alter table public.driver_submissions disable row level security;
