require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migration...');
    await client.query(`
      ALTER TABLE journeys 
      ADD COLUMN IF NOT EXISTS tr_form_url TEXT, 
      ADD COLUMN IF NOT EXISTS t1_form_url TEXT, 
      ADD COLUMN IF NOT EXISTS booking_no TEXT, 
      ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT FALSE;
    `);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
