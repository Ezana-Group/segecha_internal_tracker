const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db');
const bcrypt = require('bcryptjs');

// Usage: node scripts/setup-admin.js admin@segecha.com MySecurePassword "System Admin"
const email = process.argv[2] || 'admin@segecha.com';
const password = process.argv[3] || 'segecha2025';
const displayName = process.argv[4] || 'Administrator';

async function setup() {
    console.log(`Setting up admin: ${email}...`);
    
    try {
        // Ensure table exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                role TEXT DEFAULT 'admin',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
        `);

        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        const id = 'adm-' + Math.random().toString(36).substr(2, 9);

        // First check if already exists
        const check = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            console.log('Admin already exists. Updating password...');
            await db.query('UPDATE admins SET password_hash = $1, display_name = $2 WHERE email = $3', [hash, displayName, email]);
            console.log('Updated successfully.');
        } else {
            await db.query(
                'INSERT INTO admins (id, email, password_hash, display_name, role) VALUES ($1, $2, $3, $4, $5)',
                [id, email.toLowerCase(), hash, displayName, 'superadmin']
            );
            console.log('Created successfully.');
        }
    } catch (e) {
        console.error('Setup failed:', e);
    } finally {
        process.exit();
    }
}

setup();
