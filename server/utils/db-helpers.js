const db = require('../db');

/**
 * Consolidated upsert logic for PostgreSQL.
 * Handles field mapping for all entities (Trucks, Drivers, Journeys, Fuel, Expenses, etc.)
 */

const ALLOWED_METADATA = {
    journeys: ['finalOdom', '_isRejected', '_rejectionReason', '_rejectedFields', '_pendingApproval', 'tr_form_url', 't1_form_url', 'booking_no'],
    fuel_logs: ['paymentRef', 'isPetrolCard', '_pendingApproval', '_isRejected', '_rejectionReason', 'station_coords'],
    expenses: ['fuel_log_id', 'paymentRef', 'isPetrolCard', '_pendingApproval', '_isRejected', '_rejectionReason'],
    payroll: ['baseSalary', 'allowance', 'deductions', 'mpesaRef', 'paidAt', 'workingDays']
};

const RESTRICTED_METADATA_TABLES = ['journeys', 'fuel_logs', 'expenses', 'payroll'];

function sanitizeMetadata(table, metadata) {
    if (!metadata) return {};
    
    // For operational master data, allow all metadata fields to prevent data loss on reload
    if (!RESTRICTED_METADATA_TABLES.includes(table)) {
        return metadata;
    }

    const allowed = ALLOWED_METADATA[table] || [];
    const sanitized = {};
    allowed.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(metadata, key)) {
            sanitized[key] = metadata[key];
        }
    });

    // Always allow audit/system fields starting with _ (e.g., _isSuperAdminOverride)
    Object.keys(metadata).forEach(key => {
        if (key.startsWith('_') && !sanitized[key]) sanitized[key] = metadata[key];
    });

    return sanitized;
}

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
        else if (k === 'fuelType') dbKey = 'fuel_type';
        else if (k === 'returningEmpty') dbKey = 'is_return';
        
        // Short-form frontend keys — TABLE-AWARE mappings
        else if (k === 'reg') dbKey = 'registration_number';
        else if (k === 'license') dbKey = 'license_number';
        else if (k === 'dest') dbKey = 'destination';
        else if (k === 'cargo') dbKey = 'cargo_type';
        else if (k === 'cat') dbKey = 'category';
        else if (k === 'desc') dbKey = 'description';
        else if (k === 'due') dbKey = 'due_date';
        else if (k === 'pricePerL') dbKey = 'amount';
        else if (k === 'truck') dbKey = (table === 'drivers') ? 'truck' : 'truck_id';
        else if (k === 'journey') dbKey = 'journey_id';
        else if (k === 'customer') dbKey = 'customer_id';
        else if (k === 'turnboy') dbKey = 'turnboy_id';
        else if (k === 'driver') dbKey = table === 'payroll' ? 'entity_id' : 'driver_id';
        else if (k === 'date') dbKey = table === 'journeys' ? 'start_date' : 'date';
        else if (k === 'odom') dbKey = table === 'trucks' ? 'current_mileage' : 'odom';

        if (validCols.includes(dbKey)) {
            finalData[dbKey] = (v === "" && dbKey.endsWith('_id')) ? null : v;
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
        finalData.metadata = sanitizeMetadata(table, metadata);
    }

    const keys = Object.keys(finalData);
    const values = Object.values(finalData).map(v =>
        (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v
    );

    if (keys.length === 0) return { success: true };

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updates = keys.map((k) => k === 'id' ? null : `"${k}" = EXCLUDED."${k}"`).filter(Boolean).join(', ');

    const query = `
        INSERT INTO "${table}" ("${keys.join('", "')}")
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${updates}
    `;

    if (table === 'journeys' || table === 'expenses') {
        const journeyId = table === 'journeys' ? finalData.id : finalData.journey_id;
        if (journeyId) {
            // Check if this journey is linked to a finalized payroll record
            // 1. Find the journey date
            const jrnRes = await db.query('SELECT start_date, driver_id FROM "journeys" WHERE id = $1', [journeyId]);
            if (jrnRes.rows.length > 0) {
                const jrn = jrnRes.rows[0];
                const dateHeader = jrn.start_date ? new Date(jrn.start_date).toISOString().slice(0, 7) : null;
                if (dateHeader) {
                    const payRes = await db.query(
                        'SELECT finalized FROM "payroll" WHERE entity_id = $1 AND month = $2',
                        [jrn.driver_id, dateHeader]
                    );
                    if (payRes.rows.length > 0 && payRes.rows[0].finalized) {
                        // It's finalized. Is this a superadmin override?
                        if (!item._isSuperAdminOverride) {
                            throw new Error(`Data Lock: This journey/expense is linked to ${dateHeader} payroll which has been finalized and locked.`);
                        } else {
                            console.log(`[AUDIT]: Superadmin override applied to finalized record ${table}:${finalData.id}`);
                        }
                    }
                }
            }
        }
    }

    if (table === 'invoices') {
        const existingRes = await db.query('SELECT status FROM "invoices" WHERE id = $1', [finalData.id]);
        if (existingRes.rows.length > 0) {
            const oldStatus = existingRes.rows[0].status;
            const newStatus = finalData.status || oldStatus;
            if ((oldStatus === 'Paid' || oldStatus === 'Cancelled') && newStatus !== oldStatus) {
                if (!item._isSuperAdminOverride) throw new Error(`State Error: Cannot change status of a ${oldStatus.toUpperCase()} invoice.`);
            }
        }
    }

    if (table === 'journeys') {
        if (finalData.truck_id && finalData.is_international && finalData.status !== 'Completed') {
            const truckRes = await db.query("SELECT metadata->>'kra_pin' as kra_pin, metadata->>'insurance_id' as insurance_id FROM \"trucks\" WHERE id = $1", [finalData.truck_id]);
            if (truckRes.rows.length > 0) {
                const t = truckRes.rows[0];
                if (!t.kra_pin || t.kra_pin === 'Unset' || !t.insurance_id || t.insurance_id === 'Unset') {
                    throw new Error("Cannot dispatch a vehicle with missing KRA PIN or Insurance ID");
                }
            }
        }
        if (finalData.status === 'Completed') {
            const finalOdom = finalData.metadata?.finalOdom || finalData.final_odom;
            if (finalOdom == null || finalOdom === '') {
                throw new Error("Validation Error: final odometer is required when completing a journey.");
            }
        }
    }

    await db.query(query, values);

    // ── Fuel-Expense Sync: Automatically create/update expense when fuel is logged ──
    if (table === 'fuel_logs') {
        try {
            const fuelId = finalData.id;
            const pricePerL = parseFloat(finalData.amount) || 0; // pricePerL is mapped to amount
            const litres = parseFloat(finalData.litres) || 0;
            const total = pricePerL * litres;
            const expenseId = `fuel-exp-${fuelId}`;

            const expenseData = {
                id: expenseId,
                truck: finalData.truck_id,
                journey: finalData.journey_id,
                cat: 'Fuel',
                amount: total,
                date: finalData.date,
                desc: `Fuel Fill-up: ${finalData.station || 'Station'} (${litres}L @ ${pricePerL})`,
                metadata: {
                    fuel_log_id: fuelId,
                    paymentRef: metadata.paymentRef,
                    isPetrolCard: metadata.isPetrolCard,
                    _pendingApproval: metadata._pendingApproval,
                    _isRejected: metadata._isRejected,
                    _rejectionReason: metadata._rejectionReason
                }
            };
            // Call upsertEntity recursively for the expense record
            // This is safe because 'expenses' upsert does not trigger 'fuel_logs'
            await upsertEntity('expenses', expenseData);
        } catch (err) {
            console.error('[FUEL_EXPENSE_SYNC_ERROR]:', err.message);
            // We don't throw here to avoid failing the fuel log save if expense sync fails
        }
    }
    // ── Bi-directional Driver-Vehicle Assignment Sync ──
    if (table === 'trucks' && metadata.driver_id) {
        await db.query('UPDATE "drivers" SET truck = $1 WHERE id = $2', [finalData.id, metadata.driver_id]);
    }

    return { success: true };
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
            let items = data[tableName] || [];
            // Handle frontend aliases
            if (tableName === 'fuel_logs' && (!items || !items.length)) {
                items = data['fuel'] || [];
            }
            if (!items.length) continue;
            
            // We use upsert for each item to avoid truncating and losing data not in the snapshot
            for (const item of items) {
                // We use the same upsert logic but with the client from the transaction
                // For sync operations, we inherently treat as an administrative override (SuperAdmin role)
                // because sync/restore is a privileged system-level operation.
                item._isSuperAdminOverride = true;
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
        else if (k === 'fuelType') dbKey = 'fuel_type';
        else if (k === 'returningEmpty') dbKey = 'is_return';
        else if (k === 'reg') dbKey = 'registration_number';
        else if (k === 'license') dbKey = 'license_number';
        else if (k === 'dest') dbKey = 'destination';
        else if (k === 'cargo') dbKey = 'cargo_type';
        else if (k === 'cat') dbKey = 'category';
        else if (k === 'desc') dbKey = 'description';
        else if (k === 'due') dbKey = 'due_date';
        else if (k === 'pricePerL') dbKey = 'amount';
        else if (k === 'truck') dbKey = table === 'drivers' ? 'truck' : 'truck_id';
        else if (k === 'journey') dbKey = 'journey_id';
        else if (k === 'customer') dbKey = 'customer_id';
        else if (k === 'turnboy') dbKey = 'turnboy_id';
        else if (k === 'driver') dbKey = table === 'payroll' ? 'entity_id' : 'driver_id';
        else if (k === 'date') dbKey = table === 'journeys' ? 'start_date' : 'date';
        else if (k === 'odom') dbKey = table === 'trucks' ? 'current_mileage' : 'odom';

        if (validCols.includes(dbKey)) finalData[dbKey] = (v === "" && dbKey.endsWith('_id')) ? null : v;
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

    if (validCols.includes('metadata')) {
        finalData.metadata = sanitizeMetadata(table, metadata);
    }

    const keys = Object.keys(finalData);
    const values = Object.values(finalData).map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v);
    if (keys.length === 0) return; // Nothing to insert/update for this item

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updates = keys.map((k) => k === 'id' ? null : `"${k}" = EXCLUDED."${k}"`).filter(Boolean).join(', ');

    const query = `INSERT INTO "${table}" ("${keys.join('", "')}") VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`;

    if (table === 'invoices') {
        const existingRes = await client.query('SELECT status FROM "invoices" WHERE id = $1', [finalData.id]);
        if (existingRes.rows.length > 0) {
            const oldStatus = existingRes.rows[0].status;
            const newStatus = finalData.status || oldStatus;
            if ((oldStatus === 'Paid' || oldStatus === 'Cancelled') && newStatus !== oldStatus) {
                if (!item._isSuperAdminOverride) throw new Error(`State Error: Cannot change status of a ${oldStatus.toUpperCase()} invoice.`);
            }
        }
    }

    if (table === 'journeys') {
        if (finalData.truck_id && finalData.is_international && finalData.status !== 'Completed') {
            const truckRes = await client.query("SELECT metadata->>'kra_pin' as kra_pin, metadata->>'insurance_id' as insurance_id FROM \"trucks\" WHERE id = $1", [finalData.truck_id]);
            if (truckRes.rows.length > 0) {
                const t = truckRes.rows[0];
                if (!t.kra_pin || t.kra_pin === 'Unset' || !t.insurance_id || t.insurance_id === 'Unset') {
                    throw new Error("Cannot dispatch a vehicle with missing KRA PIN or Insurance ID");
                }
            }
        }
        if (finalData.status === 'Completed') {
            const finalOdom = finalData.metadata?.finalOdom || finalData.final_odom;
            if (finalOdom == null || finalOdom === '') {
                throw new Error("Validation Error: final odometer is required when completing a journey.");
            }
        }
    }
    
    const result = await client.query(query, values);

    // ── Bi-directional Driver-Vehicle Assignment Sync ──
    if (table === 'trucks' && metadata.driver_id) {
        await client.query('UPDATE "drivers" SET truck = $1 WHERE id = $2', [finalData.id, metadata.driver_id]);
    }

    return result;
}

module.exports = {
    upsertEntity,
    syncFullData
};
