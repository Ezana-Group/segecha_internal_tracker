-- Run this script in your Supabase SQL Editor to wipe all dummy testing data before going live.
-- This will delete all generated records but maintain the table structures.
-- We use CASCADE to handle any foreign key constraints.

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
