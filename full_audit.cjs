const db = require('./server/db');

async function fullAudit() {
    try {
        // 1. Get all table names in the public schema
        const tablesRes = await db.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        );
        const tables = tablesRes.rows.map(r => r.table_name).sort();

        console.log(`Auditing ${tables.length} tables...\n`);

        for (const table of tables) {
            console.log(`\n[TABLE] ${table}`);
            const colsRes = await db.query(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
                [table]
            );
            colsRes.rows.forEach(c => {
                console.log(`  - ${c.column_name.padEnd(25)} | ${c.data_type.padEnd(15)} | Nullable: ${c.is_nullable}`);
            });
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fullAudit();
