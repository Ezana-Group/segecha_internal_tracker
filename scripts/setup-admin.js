const db = require('../server/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // Assume uuid is available in workspace for simple ID generation or just use crypto

// Usage: node scripts/setup-admin.js admin@segecha.com MySecurePassword "System Admin"
const email = process.argv[2] || 'admin@segecha.com';
const password = process.argv[3] || 'segecha2025';
const displayName = process.argv[4] || 'Administrator';

async function setup() {
    console.log(`Setting up admin: ${email}...`);
    
    try {
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
