const { Pool } = require('pg');
require('dotenv').config();

let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  pool = { 
    query: () => { throw new Error('DATABASE_URL not set'); },
    connect: () => { throw new Error('DATABASE_URL not set'); }
  };
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
