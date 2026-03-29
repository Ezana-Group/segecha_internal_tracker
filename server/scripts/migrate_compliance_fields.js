const db = require('../db');
const path = require('path');
const fs = require('fs');

// Robust environment loading
const rootEnv = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(rootEnv)) {
    require('dotenv').config({ path: rootEnv, override: true });
}

async function migrate() {
    console.log('\n[MIGRATION] Checking for inconsistent truck metadata...');
    try {
        // Query for trucks needing migration
        const res = await db.query(`
            SELECT id, registration_number, metadata 
            FROM trucks 
            WHERE metadata ? 'kraPin' OR metadata ? 'insuranceId'
        `);

        if (res.rows.length === 0) {
            console.log('[MIGRATION] No records require migration. Database is already consistent.');
            process.exit(0);
        }

        console.log(`[MIGRATION] Identified ${res.rows.length} records for update.`);

        for (const row of res.rows) {
            const metadata = { ...row.metadata };
            let changed = false;

            if (metadata.kraPin !== undefined) {
                metadata.kra_pin = metadata.kraPin;
                delete metadata.kraPin;
                changed = true;
            }

            if (metadata.insuranceId !== undefined) {
                metadata.insurance_id = metadata.insuranceId;
                delete metadata.insuranceId;
                changed = true;
            }

            if (changed) {
                await db.query(
                    "UPDATE trucks SET metadata = $1 WHERE id = $2",
                    [metadata, row.id]
                );
                console.log(`[MIGRATION] -> Updated truck: ${row.registration_number} (${row.id})`);
            }
        }

        console.log('[MIGRATION] Complete: All records standardized to snake_case.\n');
    } catch (err) {
        console.error('[MIGRATION] ERROR:', err.message);
    } finally {
        process.exit(0);
    }
}

migrate();
