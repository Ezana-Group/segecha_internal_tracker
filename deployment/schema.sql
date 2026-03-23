-- Segecha Internal Tracker - PostgreSQL Schema for Neon
-- This schema mirrors the tracker-data.json structure.

-- Enable UUID extension if needed (though we use custom IDs in the app)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Trucks Table
CREATE TABLE IF NOT EXISTS trucks (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    reg TEXT NOT NULL,
    make TEXT,
    year INTEGER,
    type TEXT,
    capacity NUMERIC,
    driver_id TEXT,
    status TEXT DEFAULT 'Active',
    odom INTEGER DEFAULT 0,
    tyre_odom INTEGER DEFAULT 0,
    tyre_limit INTEGER DEFAULT 60000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Trailers Table
CREATE TABLE IF NOT EXISTS trailers (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    reg TEXT NOT NULL,
    make TEXT,
    type TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    license TEXT,
    classes JSONB, -- Array of strings
    status TEXT DEFAULT 'Active',
    truck_id TEXT REFERENCES trucks(id) ON DELETE SET NULL,
    joined DATE,
    salary NUMERIC,
    mpesa TEXT,
    email TEXT,
    role TEXT DEFAULT 'Driver',
    otp TEXT,
    first_login BOOLEAN DEFAULT TRUE,
    password_hash TEXT,
    lock_vehicle_assignment BOOLEAN DEFAULT FALSE,
    assigned_trailer TEXT REFERENCES trailers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Individual',
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Journeys Table
CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    customer_id TEXT REFERENCES customers(id),
    delivery_customer_id TEXT REFERENCES customers(id),
    truck_id TEXT REFERENCES trucks(id),
    driver_id TEXT REFERENCES drivers(id),
    trailer_id TEXT REFERENCES trailers(id),
    origin TEXT,
    destination TEXT,
    date DATE,
    end_date DATE,
    start_odom INTEGER,
    final_odom INTEGER,
    distance INTEGER,
    revenue NUMERIC,
    cargo TEXT,
    weight NUMERIC,
    status TEXT DEFAULT 'Loading',
    notes TEXT,
    waybill_no TEXT,
    waybill_generated BOOLEAN DEFAULT FALSE,
    waybill_data JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    submitted_start_for_verification_at TIMESTAMP WITH TIME ZONE,
    pending_start_verification BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT,
    rejected_fields JSONB,
    rejected_at TIMESTAMP WITH TIME ZONE,
    start_verified_at TIMESTAMP WITH TIME ZONE,
    pending_verification BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Fuel Entries Table
CREATE TABLE IF NOT EXISTS fuel_entries (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    truck_id TEXT REFERENCES trucks(id),
    date DATE,
    litres NUMERIC,
    price_per_l NUMERIC,
    station TEXT,
    journey_id TEXT REFERENCES journeys(id),
    odom INTEGER,
    photo_pump TEXT,
    photo_receipt TEXT,
    photo_odom TEXT,
    pending_approval BOOLEAN DEFAULT TRUE,
    submitted_by TEXT REFERENCES drivers(id),
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    rejection_reason TEXT,
    rejected_fields JSONB,
    is_rejected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Expense Entries Table
CREATE TABLE IF NOT EXISTS expense_entries (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    truck_id TEXT REFERENCES trucks(id),
    date DATE,
    category TEXT,
    amount NUMERIC,
    description TEXT,
    journey_id TEXT REFERENCES journeys(id),
    receipt_url TEXT,
    pending_approval BOOLEAN DEFAULT TRUE,
    submitted_by TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    maintenance_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Payroll Entries Table
CREATE TABLE IF NOT EXISTS payroll_entries (
    id TEXT PRIMARY KEY,
    driver_id TEXT REFERENCES drivers(id),
    month TEXT, -- YYYY-MM
    base_salary NUMERIC,
    allowance NUMERIC,
    deductions NUMERIC,
    status TEXT DEFAULT 'Pending',
    mpesa_ref TEXT,
    paid_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    role TEXT,
    salary NUMERIC,
    joined DATE,
    status TEXT DEFAULT 'Active',
    first_login BOOLEAN DEFAULT TRUE,
    otp TEXT,
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    u_id TEXT UNIQUE,
    driver_id TEXT REFERENCES drivers(id),
    truck_id TEXT REFERENCES trucks(id),
    journey_id TEXT REFERENCES journeys(id),
    type TEXT,
    description TEXT,
    location TEXT,
    date DATE,
    status TEXT DEFAULT 'Open',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journeys_driver ON journeys(driver_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status);
CREATE INDEX IF NOT EXISTS idx_fuel_truck ON fuel_entries(truck_id);
CREATE INDEX IF NOT EXISTS idx_expenses_truck ON expense_entries(truck_id);
