const db = require('./db');

async function checkColumns() {
    try {
        const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'journeys'");
        console.log('Columns in journeys table:', res.rows.map(r => r.column_name).join(', '));
        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

checkColumns();
