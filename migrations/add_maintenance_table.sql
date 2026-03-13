-- Truck maintenance schedule: monitor oil, brakes, COF, insurance, etc. by km and/or date.
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
alter table public.maintenance disable row level security;
