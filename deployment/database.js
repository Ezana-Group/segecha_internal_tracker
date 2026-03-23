// Segecha Internal Tracker - Database Helper
// Use this file to connect your Express app to Neon (PostgreSQL).
// To use this, run 'npm install pg' in your 'server/' directory.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon
  }
});

// Helper for generic queries
const query = (text, params) => pool.query(text, params);

// Migration Example: Replacing JSON storage
/**
 * Example for readTrackerData() replacement:
 * 
 * async function readTrackerDataFromDB() {
 *   const trucks = await db.query('SELECT * FROM trucks');
 *   const drivers = await db.query('SELECT * FROM drivers');
 *   // ... and so on
 *   return {
 *     trucks: trucks.rows,
 *     drivers: drivers.rows,
 *     // ...
 *   };
 * }
 */

module.exports = {
  query,
  pool,
};
