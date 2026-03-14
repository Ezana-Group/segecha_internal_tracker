-- ==============================================================================
-- SMS NOTIFICATIONS (Africa's Talking) — Run in Supabase SQL Editor.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient     TEXT NOT NULL,
  recipient_name TEXT,
  message       TEXT NOT NULL,
  trigger_type  TEXT NOT NULL,
  reference_id  TEXT,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','sent','failed')),
  at_message_id TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  key     TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  label   TEXT
);

INSERT INTO public.notification_settings (key, label, enabled) VALUES
  ('invoice_due',           'Invoice due reminder (3 days before)',    true),
  ('invoice_overdue',       'Invoice overdue alert',                   true),
  ('invoice_paid',          'Invoice payment confirmed',               true),
  ('document_expiring',     'Document expiring in 30 days',            true),
  ('document_expired',      'Document expired alert',                  true),
  ('journey_started',       'Journey started notification to director', true),
  ('journey_completed',     'Journey completed notification',          true),
  ('payroll_processed',     'Payroll processed — notify driver',      true),
  ('driver_submission',     'Driver submitted fuel/expense for review', true)
ON CONFLICT (key) DO NOTHING;

-- Phones for system alerts (admin/director) — use settings table (create if not present)
CREATE TABLE IF NOT EXISTS public.settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
INSERT INTO public.settings (key, value) VALUES
  ('notification_admin_phone', ''),
  ('notification_director_phone', '')
ON CONFLICT (key) DO NOTHING;
