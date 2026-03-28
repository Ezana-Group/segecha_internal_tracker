const db = require('./server/db');

async function findConstraints() {
    try {
        const tables = ['fuel_logs', 'expenses', 'invoices', 'incidents'];
        for (const table of tables) {
            console.log(`\n--- CONSTRAINTS FOR ${table} ---`);
            const res = await db.query(
                `SELECT
                    tc.constraint_name, 
                    kcu.column_name, 
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
                [table]
            );
            res.rows.forEach(r => console.log(`${r.constraint_name}: ${r.column_name} -> ${r.foreign_table_name}(${r.foreign_column_name})`));
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

findConstraints();
