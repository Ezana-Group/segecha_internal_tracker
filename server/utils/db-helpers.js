const db = require('../db');

/**
 * Consolidated upsert logic for PostgreSQL.
 * Handles field mapping for all entities (Trucks, Drivers, Journeys, Fuel, Expenses, etc.)
 */
async function upsertEntity(table, item) {
    if (!item || !item.id) throw new Error('Item ID is required for upsert');

    // 1. Get existing columns for this table to avoid SQL errors
    const colRes = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
        [table]
    );
    const validCols = colRes.rows.map(r => r.column_name);
    if (validCols.length === 0) throw new Error(`Table ${table} not found or has no columns`);

    const finalData = {};
    const metadata = { ...(item.metadata || {}) };

    Object.entries(item).forEach(([k, v]) => {
        // Skip internal/meta fields
        if (['created_at', 'updated_at', '_type', '_Salary', '_contact', '_joined', 'metadata'].includes(k)) return;
        
        let dbKey = k;

        // Generic camelCase → snake_case mappings (table-agnostic)
        if (k === 'expiryDate') dbKey = 'expiry_date';
        else if (k === 'customerId') dbKey = 'customer_id';
        else if (k === 'deliveryCustomerId') dbKey = 'delivery_customer_id';
        else if (k === 'journeyId') dbKey = 'journey_id';
        else if (k === 'truckId') dbKey = 'truck_id';
        else if (k === 'driverId') dbKey = 'driver_id';
        else if (k === 'licenseNumber') dbKey = 'license_number';
        else if (k === 'plateNumber') dbKey = 'registration_number';
        else if (k === 'registrationNumber') dbKey = 'registration_number';
        else if (k === 'currentMileage') dbKey = 'current_mileage';
        else if (k === 'startDate') dbKey = 'start_date';
        else if (k === 'endDate') dbKey = 'end_date';
        else if (k === 'cargoType') dbKey = 'cargo_type';
        else if (k === 'nextServiceMileage') dbKey = 'next_service_mileage';
        else if (k === 'entityId') dbKey = 'entity_id';
        else if (k === 'entityType') dbKey = 'entity_type';
        else if (k === 'dueDate') dbKey = 'due_date';
        else if (k === 'serialNumber') dbKey = 'serial_number';
        else if (k === 'staffId') dbKey = 'staff_id';
        
        // Short-form frontend keys — TABLE-AWARE mappings
        else if (k === 'reg') dbKey = 'registration_number';
        else if (k === 'license') dbKey = 'license_number';
        else if (k === 'dest') dbKey = 'destination';
        else if (k === 'cargo') dbKey = 'cargo_type';
        else if (k === 'cat') dbKey = 'category';
        else if (k === 'desc') dbKey = 'description';
        else if (k === 'due') dbKey = 'due_date';
        else if (k === 'pricePerL') dbKey = 'amount';
        else if (k === 'truck') dbKey = 'truck_id';
        else if (k === 'journey') dbKey = 'journey_id';
        
        // 'driver' → driver_id for journeys, entity_id for payroll
        else if (k === 'driver') {
            dbKey = table === 'payroll' ? 'entity_id' : 'driver_id';
        }
        // 'date' → start_date only for journeys; stays 'date' elsewhere
        else if (k === 'date') {
            dbKey = table === 'journeys' ? 'start_date' : 'date';
        }
        // 'odom' → current_mileage only for trucks; goes to metadata elsewhere
        else if (k === 'odom') {
            dbKey = table === 'trucks' ? 'current_mileage' : 'odom';
        }

        if (validCols.includes(dbKey)) {
            finalData[dbKey] = v;
        } else {
            metadata[k] = v;
        }
    });

    // Special Post-Processing for specific tables
    if (table === 'expenses') {
        if (!finalData.description && metadata.desc) finalData.description = metadata.desc;
        if (!finalData.journey_id && metadata.journey) finalData.journey_id = metadata.journey;
        delete metadata.desc;
        delete metadata.journey;
    }

    if (table === 'invoices') {
        if (!finalData.journey_id && metadata.journey) finalData.journey_id = metadata.journey;
        if (!finalData.due_date && metadata.due) finalData.due_date = metadata.due;
        delete metadata.journey;
        delete metadata.due;
    }

    if (table === 'payroll') {
        if (!finalData.entity_id && metadata.driver) finalData.entity_id = metadata.driver;
        if (!finalData.amount && (metadata.baseSalary || metadata.allowance || metadata.deductions)) {
            const base = parseFloat(metadata.baseSalary) || 0;
            const allowance = parseFloat(metadata.allowance) || 0;
            const deductions = parseFloat(metadata.deductions) || 0;
            finalData.amount = base + allowance - deductions;
        }
        delete metadata.driver;
    }

    if (validCols.includes('metadata')) {
        finalData.metadata = metadata;
    }

    const keys = Object.keys(finalData);
    const values = Object.values(finalData).map(v =>
        (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v
    );

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updates = keys.map((k) => k === 'id' ? null : `${k} = EXCLUDED.${k}`).filter(Boolean).join(', ');

    const query = `
        INSERT INTO ${table} (${keys.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${updates}
    `;

    return db.query(query, values);
}

/**
 * Perform a full system state sync using a single transaction.
 */
async function syncFullData(data) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        
        // Order matters for FK constraints: parent tables first
        const tableOrder = [
            'customers',
            'trucks',
            'trailers',
            'drivers',
            'staff',
            'journeys',
            'fuel_logs',
            'expenses',
            'invoices',
            'payroll',
            'maintenance_logs',
            'incidents',
            'documents'
        ];

        for (const tableName of tableOrder) {
            const items = data[tableName] || [];
            if (!items.length) continue;
            
            // We use upsert for each item to avoid truncating and losing data not in the snapshot
            for (const item of items) {
                // We use the same upsert logic but with the client from the transaction
                await upsertEntityInTransaction(client, tableName, item);
            }
        }

        await client.query('COMMIT');
        return { success: true };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Internal helper: same as upsertEntity but uses a specific client (for transactions)
 */
async function upsertEntityInTransaction(client, table, item) {
    if (!item || !item.id) return;

    // Reuse column detection (ideally cached, but for now we query per table)
    const colRes = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
        [table]
    );
    const validCols = colRes.rows.map(r => r.column_name);
    
    const finalData = {};
    const metadata = { ...(item.metadata || {}) };

    Object.entries(item).forEach(([k, v]) => {
        if (['created_at', 'updated_at', '_type', '_Salary', '_contact', '_joined', 'metadata'].includes(k)) return;
        let dbKey = k;
        
        // Mappings (duplicated here for simplicity in utility, or could be extracted to a shared map)
        if (k === 'expiryDate') dbKey = 'expiry_date';
        else if (k === 'customerId') dbKey = 'customer_id';
        else if (k === 'deliveryCustomerId') dbKey = 'delivery_customer_id';
        else if (k === 'journeyId') dbKey = 'journey_id';
        else if (k === 'truckId') dbKey = 'truck_id';
        else if (k === 'driverId') dbKey = 'driver_id';
        else if (k === 'licenseNumber') dbKey = 'license_number';
        else if (k === 'registrationNumber') dbKey = 'registration_number';
        else if (k === 'currentMileage') dbKey = 'current_mileage';
        else if (k === 'startDate') dbKey = 'start_date';
        else if (k === 'endDate') dbKey = 'end_date';
        else if (k === 'cargoType') dbKey = 'cargo_type';
        else if (k === 'nextServiceMileage') dbKey = 'next_service_mileage';
        else if (k === 'entityId') dbKey = 'entity_id';
        else if (k === 'entityType') dbKey = 'entity_type';
        else if (k === 'dueDate') dbKey = 'due_date';
        else if (k === 'staffId') dbKey = 'staff_id';
        else if (k === 'reg') dbKey = 'registration_number';
        else if (k === 'license') dbKey = 'license_number';
        else if (k === 'dest') dbKey = 'destination';
        else if (k === 'cargo') dbKey = 'cargo_type';
        else if (k === 'cat') dbKey = 'category';
        else if (k === 'desc') dbKey = 'description';
        else if (k === 'due') dbKey = 'due_date';
        else if (k === 'pricePerL') dbKey = 'amount';
        else if (k === 'truck') dbKey = 'truck_id';
        else if (k === 'journey') dbKey = 'journey_id';
        else if (k === 'driver') dbKey = table === 'payroll' ? 'entity_id' : 'driver_id';
        else if (k === 'date') dbKey = table === 'journeys' ? 'start_date' : 'date';
        else if (k === 'odom') dbKey = table === 'trucks' ? 'current_mileage' : 'odom';

        if (validCols.includes(dbKey)) finalData[dbKey] = v;
        else metadata[k] = v;
    });

    // Special Post-Processing
    if (table === 'expenses') {
        if (!finalData.description && metadata.desc) finalData.description = metadata.desc;
        if (!finalData.journey_id && metadata.journey) finalData.journey_id = metadata.journey;
    }
    if (table === 'invoices') {
        if (!finalData.journey_id && metadata.journey) finalData.journey_id = metadata.journey;
        if (!finalData.due_date && metadata.due) finalData.due_date = metadata.due;
    }
    if (table === 'payroll') {
        if (!finalData.entity_id && metadata.driver) finalData.entity_id = metadata.driver;
        if (!finalData.amount && (metadata.baseSalary || metadata.allowance || metadata.deductions)) {
            const base = parseFloat(metadata.baseSalary) || 0;
            const allowance = parseFloat(metadata.allowance) || 0;
            const deductions = parseFloat(metadata.deductions) || 0;
            finalData.amount = base + allowance - deductions;
        }
    }

    if (validCols.includes('metadata')) finalData.metadata = metadata;

    const keys = Object.keys(finalData);
    const values = Object.values(finalData).map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updates = keys.map((k) => k === 'id' ? null : `${k} = EXCLUDED.${k}`).filter(Boolean).join(', ');

    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`;
    return client.query(query, values);
}

module.exports = {
    upsertEntity,
    syncFullData
};
