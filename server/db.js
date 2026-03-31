const { Pool } = require('pg');
require('dotenv').config();

// Use proper SSL in production; allow self-signed certs only in local dev
const sslConfig = process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: true }          // Validates Neon's certificate — prevents MITM
  : { rejectUnauthorized: false };        // Local dev / Docker where self-signed certs are common

let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig
  });
} else {
  // If not in process.env, try loading from local .env as fallback
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
    });
  } else {
    const errorMsg = 'CRITICAL: DATABASE_URL not set in process.env or server/.env. Database features will be unavailable.';
    console.error(`[DB] ${errorMsg}`);
    pool = { 
      query: () => { throw new Error(errorMsg); },
      connect: () => { throw new Error(errorMsg); }
    };
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
