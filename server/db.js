const { Pool } = require('pg');
require('dotenv').config();

let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // If not in process.env, try loading from local .env as fallback
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  } else {
    pool = { 
      query: () => { throw new Error('DATABASE_URL not set in process.env or server/.env'); },
      connect: () => { throw new Error('DATABASE_URL not set in process.env or server/.env'); }
    };
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
