const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Initializes the superadmins table in Neon if it doesn't exist.
 */
async function initSuperAdminTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS superadmins (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await db.query(query);
    console.log('Superadmins table ready');
  } catch (err) {
    console.error('Failed to init superadmins table:', err.message);
  }
}

/**
 * Creates a new superadmin.
 */
async function createSuperAdmin(email, password, displayName) {
  const hash = await bcrypt.hash(password, 10);
  const query = 'INSERT INTO superadmins (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name';
  const result = await db.query(query, [email.toLowerCase().trim(), hash, displayName]);
  return result.rows[0];
}

/**
 * Authenticates a superadmin.
 */
async function loginSuperAdmin(email, password) {
  const query = 'SELECT * FROM superadmins WHERE email = $1';
  const result = await db.query(query, [email.toLowerCase().trim()]);
  const user = result.rows[0];

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'superadmin' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name
    }
  };
}

module.exports = {
  initSuperAdminTable,
  createSuperAdmin,
  loginSuperAdmin
};
