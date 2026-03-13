-- Run this script in your Supabase SQL Editor to wipe all dummy/testing data.
-- Use for: production before go-live, or local/dev before loading real data.
-- This will delete all generated records but maintain the table structures.
-- We use CASCADE to handle any foreign key constraints.

-- Use 'fuel' if your app uses supabase_schema.sql; use 'fuel_log' if you use supabase-schema.sql
TRUNCATE TABLE 
  payroll, 
  invoices, 
  expenses, 
  fuel, 
  journeys, 
  drivers, 
  trucks 
RESTART IDENTITY CASCADE;

-- Note: We are NOT truncating the 'users' table or the 'auth.users' table here, 
-- in case you want to keep the initial admin accounts you've created (like test@segechagroup.co.ke).
-- If you want to wipe users too, you can execute:
-- DELETE FROM auth.users;
