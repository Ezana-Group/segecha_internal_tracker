-- ==============================================================================
-- BUDGET VS ACTUAL TRACKER — Run in Supabase SQL Editor.
-- truck_id is TEXT to match trucks(id). NULL = company-wide budget.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.budgets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month         TEXT NOT NULL,
  truck_id      TEXT REFERENCES public.trucks(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  amount        NUMERIC NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_month_truck_cat ON public.budgets(month, truck_id, category) WHERE truck_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_month_cat_company ON public.budgets(month, category) WHERE truck_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_month ON public.budgets(month);
CREATE INDEX IF NOT EXISTS idx_budgets_truck ON public.budgets(truck_id);
