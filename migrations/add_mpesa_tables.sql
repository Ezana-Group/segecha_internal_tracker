-- M-Pesa integration: settings (editable Paybill/Till) and transaction log from Daraja callbacks
-- Run this in Supabase SQL Editor after the main schema.

-- Key-value settings (Paybill/Till display, account prefix)
create table if not exists public.settings (
  key text primary key,
  value text
);

-- Seed default so UI can read Paybill even before first edit
insert into public.settings (key, value) values ('paybill_display', '')
  on conflict (key) do nothing;
insert into public.settings (key, value) values ('till_display', '')
  on conflict (key) do nothing;
insert into public.settings (key, value) values ('account_prefix', 'INV')
  on conflict (key) do nothing;

-- All M-Pesa transactions received via Daraja callback (STK Push, B2C results)
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
  status text default 'completed',  -- completed, failed, reversed
  "rawPayload" jsonb,
  "createdAt" timestamptz default now()
);

create index if not exists idx_mpesa_transactions_invoice on public.mpesa_transactions("invoiceId");
create index if not exists idx_mpesa_transactions_payroll on public.mpesa_transactions("payrollId");
create index if not exists idx_mpesa_transactions_created on public.mpesa_transactions("createdAt" desc);

alter table public.settings disable row level security;
alter table public.mpesa_transactions disable row level security;
