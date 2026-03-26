// migrate_to_neon.js - Data Porting Utility (JSON to PostgreSQL)
const db = require('./db');
const fs = require('fs');
const path = require('path');

const JOURNEYS_FILE = path.join(__dirname, 'tracker-data.json');
const DOCUMENTS_FILE = path.join(__dirname, 'documents.json');
const SETTINGS_FILE = path.join(__dirname, 'cached-settings.json');

const getData = (file, defaultVal = {}) => {
    if (!fs.existsSync(file)) return defaultVal;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return defaultVal; }
};

async function migrate() {
    console.log('🚀 Starting Migration to Neon...');

    try {
        const tracker = getData(JOURNEYS_FILE, { journeys: [], trucks: [], trailers: [], drivers: [], staff: [], customers: [], fuel: [], expenses: [], payroll: [] });
        const docs = getData(DOCUMENTS_FILE, { documents: [] }).documents || [];
        const settings = getData(SETTINGS_FILE, {});

        // Helper to insert with metadata
        const insert = async (table, data) => {
            if (!data || data.length === 0) return;
            console.log(`📦 Porting ${data.length} records to ${table}...`);
            for (const item of data) {
                const id = item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
                // Extract common fields, dump rest into metadata
                const { id: _, name, registration_number, reg, status, ...rest } = item;
                const cols = ['id', 'metadata'];
                const vals = [id, JSON.stringify(rest)];
                
                // Add specific cols if they exist in schema and item
                if (name) { cols.push('name'); vals.push(name); }
                if (registration_number || reg) { cols.push('registration_number'); vals.push(registration_number || reg); }
                if (status) { cols.push('status'); vals.push(status); }

                const query = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT (id) DO NOTHING`;
                await db.query(query, vals);
            }
        };

        // 1. Core Entities
        await insert('trucks', tracker.trucks);
        await insert('trailers', tracker.trailers);
        await insert('drivers', tracker.drivers);
        await insert('staff', tracker.staff);
        await insert('customers', tracker.customers);

        // 2. Operations
        if (tracker.journeys) {
            console.log(`📦 Porting ${tracker.journeys.length} journeys...`);
            for (const j of tracker.journeys) {
                const { id, truckId, driverId, customerId, status, origin, destination, notes, ...rest } = j;
                const query = `INSERT INTO journeys (id, truck_id, driver_id, customer_id, status, origin, destination, notes, metadata) 
                               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`;
                await db.query(query, [id, truckId, driverId, customerId, status, origin, destination, notes, JSON.stringify(rest)]);
            }
        }

        // 3. Financials
        await insert('fuel_logs', tracker.fuel);
        await insert('expenses', tracker.expenses);
        await insert('payroll', tracker.payroll);

        // 4. Documents
        if (docs) {
            console.log(`📦 Porting ${docs.length} documents...`);
            for (const d of docs) {
                const { id, entityType, entityId, label, url, expiryDate, ...rest } = d;
                const query = `INSERT INTO documents (id, entity_type, entity_id, label, url, expiry_date, metadata) 
                               VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`;
                await db.query(query, [id, entityType, entityId, label, url, expiryDate, JSON.stringify(rest)]);
            }
        }

        // 5. Settings
        console.log('📦 Porting system settings...');
        for (const [key, value] of Object.entries(settings)) {
            await db.query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, JSON.stringify(value)]);
        }

        console.log('✅ Migration COMPLETE!');
    } catch (err) {
        console.error('❌ Migration FAILED:', err);
    } finally {
        process.exit();
    }
}

migrate();
