const db = require('./db');

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // 1. Add tracking_id to journeys
        await db.query(`
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE
        `);
        console.log('Added tracking_id to journeys table');

        // 2. Create system_settings_audit table
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_settings_audit (
                id SERIAL PRIMARY KEY,
                setting_key TEXT NOT NULL,
                old_value JSONB,
                new_value JSONB,
                changed_by TEXT,
                changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created system_settings_audit table');

        // 3. Populate tracking_id for existing journeys
        const crypto = require('crypto');
        const res = await db.query("SELECT id FROM journeys WHERE tracking_id IS NULL");
        console.log(`Populating tracking_id for ${res.rows.length} existing journeys...`);
        
        for (const row of res.rows) {
            const trackingId = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 chars
            await db.query("UPDATE journeys SET tracking_id = $1 WHERE id = $2", [trackingId, row.id]);
        }
        
        console.log('Migration completed successfully');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e.message);
        process.exit(1);
    }
}

migrate();
