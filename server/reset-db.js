const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// 1. Load environment variables from all possible locations
require('dotenv').config();

const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env'),
  path.join(homeDir, 'Library/Application Support/SegechaTracker/.env'), // macOS AppData
  path.join(homeDir, 'Library/Application Support/truck-erp-app/.env'), // macOS AppData Alternate
  path.join(homeDir, 'AppData/Roaming/SegechaTracker/.env'), // Windows AppData
  path.join(homeDir, 'AppData/Roaming/truck-erp-app/.env') // Windows AppData Alternate
];

envPaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`[Reset DB] Loading environment from: ${p}`);
    require('dotenv').config({ path: p, override: true });
  }
});

const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_KEY = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';
const INITIAL_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || 'admin@segecha.com';
const INITIAL_ADMIN_PHONE = process.env.INITIAL_ADMIN_PHONE || '+254700000000';
const COMPANY_NAME = process.env.COMPANY_NAME || 'Segecha Group Ltd';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@yourdomain.com';

if (!DATABASE_URL) {
  console.error('\nERROR: DATABASE_URL is not set in any environment configurations.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('\n=========================================');
  console.log('  SEGECHA DATABASE RESET & SEED TOOL');
  console.log('=========================================');
  console.log(`Target Database: ${DATABASE_URL.split('@')[1] || DATABASE_URL}`);
  console.log(`Initial Admin Email: ${INITIAL_ADMIN_EMAIL}`);
  console.log(`Admin Password (will be your ADMIN_KEY): ${ADMIN_KEY}\n`);

  try {
    // 2. Clear all tables (TRUNCATE) to avoid schema ownership restrictions
    console.log('[1/4] Clearing all database tables data...');
    const tables = [
      'invoices', 'payroll', 'fuel_logs', 'expenses', 'incidents', 'maintenance_logs', 'tyre_logs',
      'documents', 'journeys', 'assets', 'mpesa_transactions', 'payslip_dispatch_queue', 'ledger_entries',
      'payroll_statutory_configs', 'payroll_statutory_change_log', 'deduction_templates', 'employee_deductions',
      'error_logs', 'driver_auth', 'staff_auth',
      'trucks', 'trailers', 'drivers', 'staff', 'customers', 'admins', 'superadmins', 'system_settings'
    ];
    for (const table of tables) {
      try {
        await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      } catch (err) {
        // Table might not exist yet, which is fine
        console.log(`      Table ${table} not present or could not be truncated (will build via schema.sql)`);
      }
    }
    console.log('      Data cleared successfully.');

    // 3. Read and execute schema.sql
    console.log('[2/4] Executing schema.sql to rebuild tables...');
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaSqlPath)) {
      throw new Error(`schema.sql not found at path: ${schemaSqlPath}`);
    }
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    await pool.query(schemaSql);
    console.log('      All tables, indexes, and constraints built successfully.');

    // 4. Seed the initial Administrator accounts
    console.log('[3/4] Seeding initial superadmin credentials...');
    const staffId = 'staff-admin-init';
    const passwordHash = bcrypt.hashSync(ADMIN_KEY, 10);

    // Seed staff record
    await pool.query(`
      INSERT INTO staff (id, name, email, phone, role)
      VALUES ($1, 'System Admin', $2, $3, 'superadmin')
    `, [staffId, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PHONE]);

    // Seed staff portal auth
    await pool.query(`
      INSERT INTO staff_auth (staff_id, email, phone, password_hash, account_status)
      VALUES ($1, $2, $3, $4, 'active')
    `, [staffId, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PHONE, passwordHash]);

    // Seed admin dashboard auth
    await pool.query(`
      INSERT INTO admins (id, email, password_hash, role, display_name)
      VALUES ($1, $2, $3, 'superadmin', 'System Admin')
    `, [staffId, INITIAL_ADMIN_EMAIL, passwordHash]);

    // Seed superadmins audit list
    await pool.query(`
      INSERT INTO superadmins (id, email, password_hash, display_name)
      VALUES ($1, $2, $3, 'System Admin')
    `, [staffId, INITIAL_ADMIN_EMAIL, passwordHash]);

    // Seed system settings
    await pool.query(`
      INSERT INTO system_settings (key, value) 
      VALUES 
      ('companyName', $1),
      ('companyEmail', $2),
      ('defaultCurrency', '"KES"'),
      ('admin_email', $3)
    `, [JSON.stringify(COMPANY_NAME), JSON.stringify(EMAIL_FROM), JSON.stringify(INITIAL_ADMIN_EMAIL)]);

    console.log('      Superadmin seed entries created successfully.');

    // 5. Final check
    console.log('[4/4] Verifying schema health...');
    const tablesCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`      Database reset completed successfully. Rebuilt ${tablesCheck.rows.length} tables.`);
    console.log('\n=========================================');
    console.log('  SUCCESS: You can now log into the app!');
    console.log(`  Email: ${INITIAL_ADMIN_EMAIL}`);
    console.log(`  Password: [Your ADMIN_KEY value]`);
    console.log('=========================================\n');

  } catch (err) {
    console.error('\nDATABASE RESET FAILED:', err.message);
  } finally {
    await pool.end();
  }
}

main();
