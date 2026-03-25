const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'segecha-driver-secret-change-in-production';
const driver = { driverId: 'D002', email: 'peter.ochieng@segecha.com' };

const token = jwt.sign(driver, JWT_SECRET, { expiresIn: '1h' });
console.log(token);
