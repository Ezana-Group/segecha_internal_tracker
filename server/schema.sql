-- Segecha Internal Tracker - Full Production Schema (PostgreSQL/Neon)

-- 1. Administrative & Auth
CREATE TABLE IF NOT EXISTS superadmins (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_version INTEGER DEFAULT 1
);

-- 2. Fleet & Personnel
CREATE TABLE IF NOT EXISTS trucks (
    id TEXT PRIMARY KEY,
    registration_number TEXT UNIQUE NOT NULL,
    model TEXT,
    status TEXT DEFAULT 'Active',
    current_mileage NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trailers (
    id TEXT PRIMARY KEY,
    registration_number TEXT UNIQUE NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'Active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    make TEXT,
    year TEXT,
    truck_id TEXT REFERENCES trucks(id)
);

CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    license_number TEXT,
    status TEXT DEFAULT 'Active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    email TEXT,
    role TEXT DEFAULT 'Driver',
    truck TEXT REFERENCES trucks(id),
    license_class TEXT
);

CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    joined TEXT,
    salary NUMERIC
);

-- 3. CRM
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Operations
CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY,
    truck_id TEXT REFERENCES trucks(id),
    driver_id TEXT REFERENCES drivers(id),
    customer_id TEXT REFERENCES customers(id),
    status TEXT DEFAULT 'Loading',
    origin TEXT,
    destination TEXT,
    cargo_type TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tr_form_url TEXT,
    t1_form_url TEXT,
    booking_no TEXT,
    tracking_id TEXT UNIQUE,
    is_international BOOLEAN DEFAULT FALSE,
    delivery_customer_id TEXT REFERENCES customers(id)
);

-- 5. Financials
CREATE TABLE IF NOT EXISTS fuel_logs (
    id TEXT PRIMARY KEY,
    journey_id TEXT REFERENCES journeys(id) ON DELETE CASCADE,
    truck_id TEXT REFERENCES trucks(id),
    date DATE,
    amount DECIMAL(12,2),
    litres DECIMAL(10,2),
    station TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    driver_id TEXT REFERENCES drivers(id),
    _submitted_by TEXT,
    price_per_l NUMERIC,
    odom NUMERIC
);

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    journey_id TEXT REFERENCES journeys(id) ON DELETE CASCADE,
    category TEXT,
    amount DECIMAL(12,2),
    date DATE,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    driver_id TEXT REFERENCES drivers(id),
    truck_id TEXT REFERENCES trucks(id),
    _submitted_by TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id),
    journey_id TEXT REFERENCES journeys(id) ON DELETE CASCADE,
    amount DECIMAL(12,2),
    status TEXT DEFAULT 'Pending',
    due_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    issued_date DATE
);

CREATE TABLE IF NOT EXISTS payroll (
    id TEXT PRIMARY KEY,
    entity_id TEXT, -- Can be driver_id or staff_id
    entity_type TEXT, -- 'driver' or 'staff'
    amount DECIMAL(12,2),
    month TEXT, -- e.g. '2025-03'
    status TEXT DEFAULT 'Pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Maintenance & Safety
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id TEXT PRIMARY KEY,
    truck_id TEXT REFERENCES trucks(id),
    date DATE,
    description TEXT,
    cost DECIMAL(12,2),
    next_service_mileage NUMERIC,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tyre_logs (
    id TEXT PRIMARY KEY,
    truck_id TEXT REFERENCES trucks(id),
    position TEXT,
    serial_number TEXT,
    status TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    journey_id TEXT REFERENCES journeys(id) ON DELETE CASCADE,
    type TEXT,
    severity TEXT,
    description TEXT,
    status TEXT DEFAULT 'Open',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    driver_id TEXT REFERENCES drivers(id),
    truck_id TEXT REFERENCES trucks(id),
    _submitted_by TEXT
);

-- 7. Documents & System
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    entity_type TEXT,
    entity_id TEXT,
    label TEXT,
    url TEXT,
    expiry_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    filename TEXT,
    mime_type TEXT
);

CREATE TABLE IF NOT EXISTS driver_auth (
    driver_id TEXT PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    temp_password_hash TEXT,
    otp_hash TEXT,
    otp_expiry TIMESTAMP WITH TIME ZONE,
    reset_token_hash TEXT,
    reset_token_expiry TIMESTAMP WITH TIME ZONE,
    require_password_change BOOLEAN DEFAULT TRUE,
    account_status TEXT DEFAULT 'pending',
    preferred_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_auth (
    staff_id TEXT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    temp_password_hash TEXT,
    otp_hash TEXT,
    otp_expiry TIMESTAMP WITH TIME ZONE,
    reset_token_hash TEXT,
    reset_token_expiry TIMESTAMP WITH TIME ZONE,
    require_password_change BOOLEAN DEFAULT TRUE,
    account_status TEXT DEFAULT 'pending',
    preferred_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings_audit (
    id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
