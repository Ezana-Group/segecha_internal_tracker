-- Segecha Internal Tracker — Full Production Schema (PostgreSQL / Neon)
-- Authoritative schema file.  Apply once to a fresh database.
-- For an already-running database, run only the ALTER TABLE sections
-- under "Schema Migrations" at the bottom of this file.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Administrative & Auth
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS superadmins (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    display_name    TEXT,
    role            TEXT DEFAULT 'admin',           -- 'admin' | 'superadmin'
    session_version INTEGER DEFAULT 1,              -- Incremented on password change for force-logout (MED-08)
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Fleet & Personnel
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trucks (
    id                  TEXT PRIMARY KEY,
    registration_number TEXT UNIQUE NOT NULL,
    model               TEXT,
    status              TEXT DEFAULT 'Active',
    current_mileage     INTEGER DEFAULT 0,
    tyre_odom           INTEGER DEFAULT 0,          -- Odometer at last tyre change
    tyre_limit          INTEGER DEFAULT 60000,      -- km between tyre changes
    metadata            JSONB DEFAULT '{}',         -- Extended fields (make, year, type, capacity …)
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trailers (
    id                  TEXT PRIMARY KEY,
    registration_number TEXT UNIQUE NOT NULL,
    type                TEXT,
    load_capacity_kg    INTEGER DEFAULT 0,
    gross_weight_kg     INTEGER DEFAULT 0,
    registration_date   DATE,
    status              TEXT DEFAULT 'Active',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    phone                   TEXT,
    email                   TEXT,
    national_id             TEXT,
    date_of_birth           DATE,
    gender                  TEXT,
    physical_address        TEXT,
    next_of_kin_name        TEXT,
    next_of_kin_relationship TEXT,
    next_of_kin_phone       TEXT,
    employee_number         TEXT,
    employment_type         TEXT,
    date_of_hire            DATE,
    department              TEXT,
    job_title               TEXT,
    license_number          TEXT,
    bank_name               TEXT,
    bank_account_number     TEXT,
    bank_branch             TEXT,
    kra_pin                 TEXT,
    nssf_number             TEXT,
    nhif_number             TEXT,
    night_out_rate          DECIMAL(12,2) DEFAULT 0,
    trip_allowance_rate     DECIMAL(12,2) DEFAULT 0,
    overtime_rate           DECIMAL(12,2) DEFAULT 0,
    status                  TEXT DEFAULT 'Active',
    truck_id                TEXT REFERENCES trucks(id) ON DELETE SET NULL,   -- Current vehicle assignment
    lock_vehicle_assignment BOOLEAN DEFAULT FALSE,
    metadata                JSONB DEFAULT '{}',     -- salary, mpesa, classes, joined, role, email …
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    role       TEXT,
    email      TEXT,
    phone      TEXT,
    national_id TEXT,
    date_of_birth DATE,
    gender TEXT,
    physical_address TEXT,
    next_of_kin_name TEXT,
    next_of_kin_relationship TEXT,
    next_of_kin_phone TEXT,
    employee_number TEXT,
    employment_type TEXT,
    date_of_hire DATE,
    department_name TEXT,
    job_title TEXT,
    reports_to_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_branch TEXT,
    mpesa_number TEXT,
    kra_pin TEXT,
    nssf_number TEXT,
    nhif_number TEXT,
    basic_salary DECIMAL(12,2) DEFAULT 0,
    house_allowance DECIMAL(12,2) DEFAULT 0,
    transport_allowance DECIMAL(12,2) DEFAULT 0,
    airtime_allowance DECIMAL(12,2) DEFAULT 0,
    other_allowance_name TEXT,
    other_allowance_amount DECIMAL(12,2) DEFAULT 0,
    status     TEXT DEFAULT 'Active',
    metadata   JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. CRM
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT,
    phone      TEXT,
    address    TEXT,
    status     TEXT DEFAULT 'Active',
    metadata   JSONB DEFAULT '{}',          -- type (Individual|Company), contact_person …
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Operations
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journeys (
    id                      TEXT PRIMARY KEY,
    truck_id                TEXT REFERENCES trucks(id)    ON DELETE SET NULL,
    trailer_id              TEXT REFERENCES trailers(id)  ON DELETE SET NULL,
    driver_id               TEXT REFERENCES drivers(id)   ON DELETE SET NULL,
    customer_id             TEXT REFERENCES customers(id) ON DELETE SET NULL,  -- Billing customer
    delivery_customer_id    TEXT REFERENCES customers(id) ON DELETE SET NULL,  -- Delivery customer
    status                  TEXT DEFAULT 'Loading',
    origin                  TEXT,
    destination             TEXT,
    cargo_type              TEXT,
    start_date              DATE,
    end_date                DATE,
    notes                   TEXT,
    metadata                JSONB DEFAULT '{}',  -- startOdom, endOdom, photo URLs, waybill, verification flags …
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Financials
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fuel_logs (
    id         TEXT PRIMARY KEY,
    journey_id TEXT REFERENCES journeys(id) ON DELETE SET NULL,
    truck_id   TEXT REFERENCES trucks(id)   ON DELETE SET NULL,
    date       DATE,
    amount     DECIMAL(12,2),               -- Total cost (litres × price_per_l)
    litres     DECIMAL(10,2),
    station    TEXT,
    status     TEXT DEFAULT 'Pending',      -- Pending | Approved | Rejected
    metadata   JSONB DEFAULT '{}',          -- pricePerL, odom, photoPump, photoReceipt, photoOdom, _submittedBy …
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id          TEXT PRIMARY KEY,
    journey_id  TEXT REFERENCES journeys(id) ON DELETE SET NULL,
    category    TEXT,
    amount      DECIMAL(12,2),
    date        DATE,
    description TEXT,
    status      TEXT DEFAULT 'Pending',     -- Pending | Approved | Rejected
    metadata    JSONB DEFAULT '{}',         -- truck, receiptUrl, _submittedBy, _maintenanceDetails …
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id          TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    journey_id  TEXT REFERENCES journeys(id)  ON DELETE SET NULL,
    amount      DECIMAL(12,2),
    status      TEXT DEFAULT 'Pending',
    due_date    DATE,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll (
    id          TEXT PRIMARY KEY,
    entity_id   TEXT NOT NULL,              -- driver_id or staff_id
    entity_type TEXT NOT NULL,              -- 'driver' | 'staff'
    amount      DECIMAL(12,2),
    month       TEXT,                       -- YYYY-MM
    status      TEXT DEFAULT 'Pending',
    payment_reference TEXT,
    payment_date DATE,
    payment_confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by TEXT,
    payslip_dispatch_allowed BOOLEAN DEFAULT FALSE,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_statutory_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config_type TEXT NOT NULL,
    formula JSONB DEFAULT '{}',
    effective_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_statutory_change_log (
    id BIGSERIAL PRIMARY KEY,
    config_name TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_deductions (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    deduction_type TEXT NOT NULL, -- recurring | one-off
    name TEXT NOT NULL,
    amount DECIMAL(12,2) DEFAULT 0,
    amount_type TEXT DEFAULT 'fixed', -- fixed | percent
    start_month TEXT,
    end_month TEXT,
    remaining_balance DECIMAL(12,2) DEFAULT 0,
    authorization_ref TEXT,
    employee_acknowledged BOOLEAN DEFAULT FALSE,
    employee_acknowledged_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payslip_dispatch_queue (
    id TEXT PRIMARY KEY,
    payroll_id TEXT NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Maintenance & Safety
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenance_logs (
    id                  TEXT PRIMARY KEY,
    truck_id            TEXT REFERENCES trucks(id) ON DELETE SET NULL,
    date                DATE,
    description         TEXT,
    cost                DECIMAL(12,2),
    next_service_mileage INTEGER,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tyre_logs (
    id          TEXT PRIMARY KEY,
    truck_id    TEXT REFERENCES trucks(id) ON DELETE SET NULL,
    position    TEXT,
    serial_number TEXT,
    status      TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    id          TEXT PRIMARY KEY,
    journey_id  TEXT REFERENCES journeys(id) ON DELETE SET NULL,
    type        TEXT,
    severity    TEXT,
    description TEXT,
    status      TEXT DEFAULT 'Open',
    metadata    JSONB DEFAULT '{}',     -- driverId, truck, location, incidentPhotoUrl, _submittedBy …
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Documents & System
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    entity_type TEXT,
    entity_id   TEXT,
    label       TEXT,
    url         TEXT,
    expiry_date DATE,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    purchase_date       DATE,
    cost                DECIMAL(14,2) DEFAULT 0,
    salvage_value       DECIMAL(14,2) DEFAULT 0,
    useful_life_years   INTEGER DEFAULT 5,
    depreciation_method TEXT DEFAULT 'straight-line',
    supplier            TEXT,
    linked_truck_id     TEXT REFERENCES trucks(id) ON DELETE SET NULL,
    status              TEXT DEFAULT 'Active',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS driver_auth (
    driver_id               TEXT PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
    email                   TEXT UNIQUE NOT NULL,
    phone                   TEXT,
    password_hash           TEXT,
    temp_password_hash      TEXT,
    otp_hash                TEXT,
    otp_expiry              TIMESTAMP WITH TIME ZONE,
    reset_token_hash        TEXT,
    reset_token_expiry      TIMESTAMP WITH TIME ZONE,
    require_password_change BOOLEAN DEFAULT TRUE,
    account_status          TEXT DEFAULT 'pending',
    preferred_method        TEXT,
    session_version         INTEGER DEFAULT 1,      -- Force-logout support (MED-01)
    failed_attempts         INTEGER DEFAULT 0,      -- Per-account lockout (HIGH-04)
    locked_until            TIMESTAMP WITH TIME ZONE, -- Per-account lockout (HIGH-04)
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_auth (
    staff_id                TEXT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
    email                   TEXT UNIQUE NOT NULL,
    phone                   TEXT,
    password_hash           TEXT,
    temp_password_hash      TEXT,
    otp_hash                TEXT,
    otp_expiry              TIMESTAMP WITH TIME ZONE,
    reset_token_hash        TEXT,
    reset_token_expiry      TIMESTAMP WITH TIME ZONE,
    require_password_change BOOLEAN DEFAULT TRUE,
    account_status          TEXT DEFAULT 'pending',
    preferred_method        TEXT,
    session_version         INTEGER DEFAULT 1,      -- Force-logout support (MED-01)
    failed_attempts         INTEGER DEFAULT 0,      -- Per-account lockout (HIGH-04)
    locked_until            TIMESTAMP WITH TIME ZONE, -- Per-account lockout (HIGH-04)
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Performance Indexes (DB-06)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_journeys_driver_id  ON journeys(driver_id);
CREATE INDEX IF NOT EXISTS idx_journeys_truck_id   ON journeys(truck_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status     ON journeys(status);
CREATE INDEX IF NOT EXISTS idx_journeys_customer   ON journeys(customer_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_truck     ON fuel_logs(truck_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_journey   ON fuel_logs(journey_id);
CREATE INDEX IF NOT EXISTS idx_expenses_journey    ON expenses(journey_id);
CREATE INDEX IF NOT EXISTS idx_incidents_journey   ON incidents(journey_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entity      ON payroll(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_payslip_dispatch_status ON payslip_dispatch_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON ledger_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity    ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admins_email        ON admins(email);
CREATE INDEX IF NOT EXISTS idx_drivers_status      ON drivers(status);

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. Schema Migrations  (run these on an already-deployed database)
-- ──────────────────────────────────────────────────────────────────────────────
-- These are idempotent — safe to re-run.

DO $$
BEGIN
    -- admins: session_version (MED-08)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='admins' AND column_name='session_version') THEN
        ALTER TABLE admins ADD COLUMN session_version INTEGER DEFAULT 1;
    END IF;

    -- trucks: tyre tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='trucks' AND column_name='tyre_odom') THEN
        ALTER TABLE trucks ADD COLUMN tyre_odom  INTEGER DEFAULT 0;
        ALTER TABLE trucks ADD COLUMN tyre_limit INTEGER DEFAULT 60000;
    END IF;

    -- drivers: truck_id FK, lock_vehicle_assignment
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='drivers' AND column_name='truck_id') THEN
        ALTER TABLE drivers ADD COLUMN truck_id TEXT REFERENCES trucks(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='drivers' AND column_name='lock_vehicle_assignment') THEN
        ALTER TABLE drivers ADD COLUMN lock_vehicle_assignment BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='email') THEN
        ALTER TABLE drivers ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='national_id') THEN
        ALTER TABLE drivers ADD COLUMN national_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='date_of_birth') THEN
        ALTER TABLE drivers ADD COLUMN date_of_birth DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='gender') THEN
        ALTER TABLE drivers ADD COLUMN gender TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='physical_address') THEN
        ALTER TABLE drivers ADD COLUMN physical_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='next_of_kin_name') THEN
        ALTER TABLE drivers ADD COLUMN next_of_kin_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='next_of_kin_relationship') THEN
        ALTER TABLE drivers ADD COLUMN next_of_kin_relationship TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='next_of_kin_phone') THEN
        ALTER TABLE drivers ADD COLUMN next_of_kin_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='employee_number') THEN
        ALTER TABLE drivers ADD COLUMN employee_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='employment_type') THEN
        ALTER TABLE drivers ADD COLUMN employment_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='date_of_hire') THEN
        ALTER TABLE drivers ADD COLUMN date_of_hire DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='department') THEN
        ALTER TABLE drivers ADD COLUMN department TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='job_title') THEN
        ALTER TABLE drivers ADD COLUMN job_title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='bank_name') THEN
        ALTER TABLE drivers ADD COLUMN bank_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='bank_account_number') THEN
        ALTER TABLE drivers ADD COLUMN bank_account_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='bank_branch') THEN
        ALTER TABLE drivers ADD COLUMN bank_branch TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='kra_pin') THEN
        ALTER TABLE drivers ADD COLUMN kra_pin TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='nssf_number') THEN
        ALTER TABLE drivers ADD COLUMN nssf_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='nhif_number') THEN
        ALTER TABLE drivers ADD COLUMN nhif_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='night_out_rate') THEN
        ALTER TABLE drivers ADD COLUMN night_out_rate DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='trip_allowance_rate') THEN
        ALTER TABLE drivers ADD COLUMN trip_allowance_rate DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='overtime_rate') THEN
        ALTER TABLE drivers ADD COLUMN overtime_rate DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- journeys: delivery_customer_id, trailer_id, updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='journeys' AND column_name='delivery_customer_id') THEN
        ALTER TABLE journeys ADD COLUMN delivery_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='journeys' AND column_name='trailer_id') THEN
        ALTER TABLE journeys ADD COLUMN trailer_id TEXT REFERENCES trailers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='trailers' AND column_name='load_capacity_kg') THEN
        ALTER TABLE trailers ADD COLUMN load_capacity_kg INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='trailers' AND column_name='gross_weight_kg') THEN
        ALTER TABLE trailers ADD COLUMN gross_weight_kg INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='trailers' AND column_name='registration_date') THEN
        ALTER TABLE trailers ADD COLUMN registration_date DATE;
    END IF;

    -- updated_at columns (DB-06) — required by upsertCollectionRow UPDATE … updated_at = NOW()
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='trucks' AND column_name='updated_at') THEN
        ALTER TABLE trucks    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='trailers' AND column_name='updated_at') THEN
        ALTER TABLE trailers  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='drivers' AND column_name='updated_at') THEN
        ALTER TABLE drivers   ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='staff' AND column_name='updated_at') THEN
        ALTER TABLE staff     ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='national_id') THEN
        ALTER TABLE staff ADD COLUMN national_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='date_of_birth') THEN
        ALTER TABLE staff ADD COLUMN date_of_birth DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='gender') THEN
        ALTER TABLE staff ADD COLUMN gender TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='physical_address') THEN
        ALTER TABLE staff ADD COLUMN physical_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='next_of_kin_name') THEN
        ALTER TABLE staff ADD COLUMN next_of_kin_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='next_of_kin_relationship') THEN
        ALTER TABLE staff ADD COLUMN next_of_kin_relationship TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='next_of_kin_phone') THEN
        ALTER TABLE staff ADD COLUMN next_of_kin_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='employee_number') THEN
        ALTER TABLE staff ADD COLUMN employee_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='employment_type') THEN
        ALTER TABLE staff ADD COLUMN employment_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='date_of_hire') THEN
        ALTER TABLE staff ADD COLUMN date_of_hire DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='department_name') THEN
        ALTER TABLE staff ADD COLUMN department_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='job_title') THEN
        ALTER TABLE staff ADD COLUMN job_title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='reports_to_staff_id') THEN
        ALTER TABLE staff ADD COLUMN reports_to_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='bank_name') THEN
        ALTER TABLE staff ADD COLUMN bank_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='bank_account_number') THEN
        ALTER TABLE staff ADD COLUMN bank_account_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='bank_branch') THEN
        ALTER TABLE staff ADD COLUMN bank_branch TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='mpesa_number') THEN
        ALTER TABLE staff ADD COLUMN mpesa_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='kra_pin') THEN
        ALTER TABLE staff ADD COLUMN kra_pin TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='nssf_number') THEN
        ALTER TABLE staff ADD COLUMN nssf_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='nhif_number') THEN
        ALTER TABLE staff ADD COLUMN nhif_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='basic_salary') THEN
        ALTER TABLE staff ADD COLUMN basic_salary DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='house_allowance') THEN
        ALTER TABLE staff ADD COLUMN house_allowance DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='transport_allowance') THEN
        ALTER TABLE staff ADD COLUMN transport_allowance DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='airtime_allowance') THEN
        ALTER TABLE staff ADD COLUMN airtime_allowance DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='other_allowance_name') THEN
        ALTER TABLE staff ADD COLUMN other_allowance_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='other_allowance_amount') THEN
        ALTER TABLE staff ADD COLUMN other_allowance_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='customers' AND column_name='updated_at') THEN
        ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='invoices' AND column_name='updated_at') THEN
        ALTER TABLE invoices  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='payroll' AND column_name='updated_at') THEN
        ALTER TABLE payroll   ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payment_reference') THEN
        ALTER TABLE payroll ADD COLUMN payment_reference TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payment_date') THEN
        ALTER TABLE payroll ADD COLUMN payment_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payment_confirmed_at') THEN
        ALTER TABLE payroll ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='confirmed_by') THEN
        ALTER TABLE payroll ADD COLUMN confirmed_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll' AND column_name='payslip_dispatch_allowed') THEN
        ALTER TABLE payroll ADD COLUMN payslip_dispatch_allowed BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='maintenance_logs' AND column_name='updated_at') THEN
        ALTER TABLE maintenance_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='tyre_logs' AND column_name='updated_at') THEN
        ALTER TABLE tyre_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='assets' AND column_name='updated_at') THEN
        ALTER TABLE assets ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='journeys' AND column_name='updated_at') THEN
        ALTER TABLE journeys  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='fuel_logs' AND column_name='updated_at') THEN
        ALTER TABLE fuel_logs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='expenses' AND column_name='updated_at') THEN
        ALTER TABLE expenses  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='fuel_logs' AND column_name='status') THEN
        ALTER TABLE fuel_logs ADD COLUMN status TEXT DEFAULT 'Pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='expenses' AND column_name='status') THEN
        ALTER TABLE expenses  ADD COLUMN status TEXT DEFAULT 'Pending';
    END IF;

    -- driver_auth / staff_auth: session_version (MED-01)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='driver_auth' AND column_name='session_version') THEN
        ALTER TABLE driver_auth ADD COLUMN session_version INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='staff_auth' AND column_name='session_version') THEN
        ALTER TABLE staff_auth  ADD COLUMN session_version INTEGER DEFAULT 1;
    END IF;

    -- Per-account lockout columns (HIGH-04)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='driver_auth' AND column_name='failed_attempts') THEN
        ALTER TABLE driver_auth ADD COLUMN failed_attempts INTEGER DEFAULT 0;
        ALTER TABLE driver_auth ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='staff_auth' AND column_name='failed_attempts') THEN
        ALTER TABLE staff_auth  ADD COLUMN failed_attempts INTEGER DEFAULT 0;
        ALTER TABLE staff_auth  ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
    END IF;

    -- metadata JSONB column on all tables that need it (for older DBs created before this column existed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_logs'         AND column_name='metadata') THEN
        ALTER TABLE fuel_logs         ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses'          AND column_name='metadata') THEN
        ALTER TABLE expenses          ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents'         AND column_name='metadata') THEN
        ALTER TABLE incidents         ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll'           AND column_name='metadata') THEN
        ALTER TABLE payroll           ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers'         AND column_name='metadata') THEN
        ALTER TABLE customers         ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance_logs'  AND column_name='metadata') THEN
        ALTER TABLE maintenance_logs  ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_logs'         AND column_name='metadata') THEN
        ALTER TABLE tyre_logs         ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices'          AND column_name='metadata') THEN
        ALTER TABLE invoices          ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents'         AND column_name='metadata') THEN
        ALTER TABLE documents         ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='journeys'          AND column_name='metadata') THEN
        ALTER TABLE journeys          ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers'           AND column_name='metadata') THEN
        ALTER TABLE drivers           ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trucks'            AND column_name='metadata') THEN
        ALTER TABLE trucks            ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff'             AND column_name='metadata') THEN
        ALTER TABLE staff             ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers'         AND column_name='status') THEN
        ALTER TABLE customers         ADD COLUMN status TEXT DEFAULT 'Active';
    END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- Error logs (client portals + admin dashboard; POST /api/client-error, GET /api/admin/error-logs)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS error_logs (
    id           BIGSERIAL PRIMARY KEY,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source       TEXT NOT NULL,
    level        TEXT NOT NULL DEFAULT 'error',
    message      TEXT NOT NULL,
    stack        TEXT,
    url          TEXT,
    user_agent   TEXT,
    meta         JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs (source);
