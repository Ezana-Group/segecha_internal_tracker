-- Payroll compliance foundation migration
-- Adds driver/staff HR-compliance fields, payroll payment-gate fields,
-- and statutory configuration / deduction tables.

BEGIN;

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS physical_address TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS next_of_kin_relationship TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS date_of_hire DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS kra_pin TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS nssf_number TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS nhif_number TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS night_out_rate DECIMAL(12,2) DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS trip_allowance_rate DECIMAL(12,2) DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS overtime_rate DECIMAL(12,2) DEFAULT 0;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS physical_address TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS next_of_kin_relationship TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_of_hire DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS reports_to_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS mpesa_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS kra_pin TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS nssf_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS nhif_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(12,2) DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS house_allowance DECIMAL(12,2) DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS transport_allowance DECIMAL(12,2) DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS airtime_allowance DECIMAL(12,2) DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS other_allowance_name TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS other_allowance_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE payroll ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS confirmed_by TEXT;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS payslip_dispatch_allowed BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS payroll_statutory_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config_type TEXT NOT NULL,
    formula JSONB DEFAULT '{}',
    effective_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_statutory_change_log (
    id BIGSERIAL PRIMARY KEY,
    config_name TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by TEXT,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    effective_date DATE
);

CREATE TABLE IF NOT EXISTS deduction_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_amount DECIMAL(12,2) DEFAULT 0,
    default_type TEXT DEFAULT 'fixed',
    requires_authorization BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_deductions (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    deduction_type TEXT NOT NULL,
    name TEXT NOT NULL,
    amount DECIMAL(12,2) DEFAULT 0,
    amount_type TEXT DEFAULT 'fixed',
    start_month TEXT,
    end_month TEXT,
    remaining_balance DECIMAL(12,2) DEFAULT 0,
    authorization_ref TEXT,
    employee_acknowledged BOOLEAN DEFAULT FALSE,
    employee_acknowledged_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payslip_dispatch_queue (
    id TEXT PRIMARY KEY,
    payroll_id TEXT NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    entry_date DATE NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    debit DECIMAL(14,2) DEFAULT 0,
    credit DECIMAL(14,2) DEFAULT 0,
    currency TEXT DEFAULT 'KES',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
