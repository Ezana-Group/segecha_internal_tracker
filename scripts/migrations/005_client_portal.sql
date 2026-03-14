-- ==============================================================================
-- CLIENT PORTAL — Run in Supabase SQL Editor. Requires clients table (001).
-- client_users: portal login per client; auth_user_id links to Supabase Auth.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.client_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  auth_user_id  UUID UNIQUE,
  status        TEXT DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_users_client ON public.client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_auth ON public.client_users(auth_user_id);
