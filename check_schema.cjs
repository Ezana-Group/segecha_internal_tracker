const db = require('./server/db');

async function checkSchema() {
    try {
        const tables = ['journeys', 'fuel_logs', 'expenses', 'incidents', 'payroll'];
        for (const table of tables) {
            console.log(`\n--- SCHEMA FOR ${table} ---`);
            const res = await db.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
                [table]
            );
            console.log(res.rows.map(r => r.column_name).join(', '));
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSchema();
