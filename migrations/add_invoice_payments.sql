-- Multiple payments per invoice (deposits, partial, final). Invoice is Paid when total payments >= amount.
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
alter table public.invoice_payments disable row level security;
