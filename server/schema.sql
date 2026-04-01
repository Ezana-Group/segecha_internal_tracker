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
    status              TEXT DEFAULT 'Active',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    phone                   TEXT,
    license_number          TEXT,
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
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

    -- journeys: delivery_customer_id, trailer_id, updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='journeys' AND column_name='delivery_customer_id') THEN
        ALTER TABLE journeys ADD COLUMN delivery_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='journeys' AND column_name='trailer_id') THEN
        ALTER TABLE journeys ADD COLUMN trailer_id TEXT REFERENCES trailers(id) ON DELETE SET NULL;
    END IF;

    -- updated_at columns (DB-06)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='trucks' AND column_name='updated_at') THEN
        ALTER TABLE trucks    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='drivers' AND column_name='updated_at') THEN
        ALTER TABLE drivers   ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
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
END $$;
