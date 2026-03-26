const axios = require('axios');
require('dotenv').config();

const email = process.argv[2];
const password = process.argv[3];
const displayName = process.argv[4] || 'Super Admin';

if (!email || !password) {
  console.log('Usage: node setup-admin.js <email> <password> ["Display Name"]');
  process.exit(1);
}

const url = 'http://localhost:3001/api/admin/setup';
const adminKey = process.env.ADMIN_KEY || 'segecha-admin-key-change-this';

async function setup() {
  try {
    const resp = await axios.post(url, {
      email,
      password,
      displayName,
      adminKey
    });
    console.log('Success!', resp.data);
  } catch (err) {
    console.error('Failed:', err.response ? err.response.data : err.message);
  }
}

setup();
