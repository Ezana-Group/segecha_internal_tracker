const db = require('./db');

/**
 * Common upsert logic for PostgreSQL. 
 * Replaces writeTrackerData for individual entities.
 */
async function upsertEntity(table, item) {
    if (!item || !item.id) throw new Error('Item ID is required for upsert');
    
    // 1. Get existing columns for this table
    const colRes = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
        [table]
    );
    const validCols = colRes.rows.map(r => r.column_name);
    if (validCols.length === 0) throw new Error(`Table ${table} not found`);

    const finalData = {};
    const metadata = item.metadata || {};

    Object.entries(item).forEach(([k, v]) => {
        if (['created_at', 'updated_at', '_type', '_Salary', '_contact', '_joined'].includes(k)) return;
        
        let dbKey = k;
        // Basic mapping for common driver-portal keys to DB columns
        if (k === 'expiryDate') dbKey = 'expiry_date';
        else if (k === 'customerId') dbKey = 'customer_id';
        else if (k === 'deliveryCustomerId') dbKey = 'delivery_customer_id';
        else if (k === 'journeyId') dbKey = 'journey_id';
        else if (k === 'truckId') dbKey = 'truck_id';
        else if (k === 'driverId') dbKey = 'driver_id';

        if (validCols.includes(dbKey)) {
            finalData[dbKey] = v;
        } else if (k !== 'metadata') {
            metadata[k] = v;
        }
    });

    if (validCols.includes('metadata')) {
        finalData.metadata = metadata;
    }

    const keys = Object.keys(finalData);
    const values = Object.values(finalData).map(v => 
        (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v
    );
    
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updates = keys.map((k, i) => k === 'id' ? null : `${k} = EXCLUDED.${k}`).filter(Boolean).join(', ');

    const query = `
        INSERT INTO ${table} (${keys.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${updates}
    `;
    
    return db.query(query, values);
}

/**
 * Generate a sequential uId like "FUL-011".
 * Now queries the DB for the count.
 */
async function generateUId(collection) {
    const prefixes = {
        trucks: 'TRK-',
        drivers: 'DRV-',
        turnboys: 'TBY-',
        staff: 'EMP-',
        payroll: 'PAY-',
        customers: 'CST-',
        trailers: 'TRL-',
        fuel: 'FUL-',
        expenses: 'EXP-',
        journeys: 'J',
        incidents: 'INC-',
    };
    
    const prefix = prefixes[collection] || '';
    if (!prefix) return '';

    // Count rows in the table to determine the next ID
    // Note: This is a simple counter, for absolute uniqueness in high concurrency 
    // we would use a DB sequence, but this matches the existing logic.
    const res = await db.query(`SELECT COUNT(*) FROM ${collection}`);
    const count = parseInt(res.rows[0].count) + 1;
    return prefix + String(count).padStart(3, '0');
}

/**
 * Enriches basic journey data with related names (Customer, Driver etc.) for the portal UI.
 */
function enrichJourneyForPortal(j, customers = [], trailers = [], drivers = []) {
    const trailer = j.trailer && trailers.find((t) => t.id === j.trailer);
    const trailerReg = trailer?.reg || "";
    
    const cust = customers.find((c) => c.id === j.customer_id || c.id === j.customerId);
    const del = customers.find((c) => c.id === j.delivery_customer_id || c.id === j.deliveryCustomerId);
    const drv = drivers.find((d) => d.id === j.driver);

    return {
        ...j,
        customerId: j.customer_id || j.customerId,
        deliveryCustomerId: j.delivery_customer_id || j.deliveryCustomerId,
        _driverPhone: drv?.phone || '',
        _trailerReg: trailerReg,
        _billingCustomerName: cust?.name || "",
        _deliveryCustomerName: del?.name || "",
    };
}

async function getDriverData(driverId) {
    // 1. Fetch all required data in parallel
    const [
        driverRes,
        trucksRes,
        journeysRes,
        fuelRes,
        expensesRes,
        incidentsRes,
        customersRes,
        trailersRes,
        payrollRes,
        settingsRes
    ] = await Promise.all([
        db.query("SELECT * FROM drivers WHERE id = $1", [driverId]),
        db.query("SELECT * FROM trucks"),
        db.query("SELECT * FROM journeys WHERE driver = $1", [driverId]),
        db.query("SELECT * FROM fuel_logs WHERE (_submitted_by = $1 OR driver = $1)", [driverId]),
        db.query("SELECT * FROM expenses WHERE (truck_id IN (SELECT id FROM trucks WHERE driver_id = $1) OR driver_id = $1 OR _submitted_by = $1)", [driverId]),
        db.query("SELECT * FROM incidents WHERE (driver_id = $1 OR driver = $1)", [driverId]),
        db.query("SELECT * FROM customers"),
        db.query("SELECT * FROM trailers"),
        db.query("SELECT * FROM payroll WHERE driver = $1", [driverId]),
        db.query("SELECT * FROM system_settings")
    ]);

    const driver = driverRes.rows[0];
    if (!driver) return null;

    const trucks = trucksRes.rows;
    const journeys = journeysRes.rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const fuel = fuelRes.rows.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20);
    const expenses = expensesRes.rows.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20);
    const incidents = incidentsRes.rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 20);
    const customers = customersRes.rows;
    const trailers = trailersRes.rows;
    const payroll = payrollRes.rows.sort((a, b) => (b.month || "").localeCompare(a.month || ""));
    
    const settings = {};
    settingsRes.rows.forEach(r => settings[r.key] = r.value);

    const truck = driver.truck ? trucks.find(t => t.id === driver.truck) : null;

    const ACTIVE_STATUSES = ['Loading', 'Approved', 'In Transit', 'Awaiting Start Verification', 'Awaiting Verification'];
    
    const activeJourneys = journeys
        .filter(j => ACTIVE_STATUSES.includes(j.status))
        .map(j => enrichJourneyForPortal(j, customers, trailers, [driver]));

    const completedJourneys = journeys
        .filter(j => j.status === 'Completed')
        .map(j => enrichJourneyForPortal(j, customers, trailers, [driver]));

    // Tyre status
    let tyreInfo = null;
    if (truck) {
        const odom = Number(truck.odom || 0);
        const tyreOdom = Number(truck.tyre_odom || 0);
        const tyreLimit = Number(truck.tyre_limit || 40000);
        const kmSince = odom - tyreOdom;
        const remaining = tyreLimit - kmSince;
        const pct = Math.min(100, (kmSince / tyreLimit) * 100);
        tyreInfo = {
            kmSinceChange: kmSince,
            remaining,
            pct: pct.toFixed(1),
            status: remaining <= 0 ? 'Overdue' : remaining <= 5000 ? 'Due Soon' : 'OK',
        };
    }

    return {
        driver,
        truck,
        tyreInfo,
        activeJourneys,
        completedJourneys,
        fuelEntries: fuel,
        expenseEntries: expenses,
        incidentEntries: incidents,
        maintenanceHistory: expenses.filter(e => e.cat === 'Maintenance'),
        payslips: payroll,
        customers: customers.map(c => ({ id: c.id, name: c.name, phone: c.phone || '', email: c.email || '', type: c.type || 'Individual' })),
        settings
    };
}

async function updateJourneyPartyCustomers(driverId, journeyId, body = {}) {
    const [journeyRes, customersRes] = await Promise.all([
        db.query("SELECT * FROM journeys WHERE id = $1 AND driver = $2", [journeyId, driverId]),
        db.query("SELECT * FROM customers")
    ]);
    
    const journey = journeyRes.rows[0];
    if (!journey) return { success: false, error: 'Journey not found' };
    if (journey.status !== 'Loading') return { success: false, error: 'Customers can only be set while trip is Loading' };

    let billingId = body.customerId;
    let deliveryId = body.deliveryCustomerId;

    // Helper to add new customer
    const addNew = async (obj) => {
        if (!obj || !obj.name) return null;
        const uId = await generateUId('customers');
        const id = 'CST-' + Date.now().toString(36).toUpperCase();
        await upsertEntity('customers', {
            id,
            uId,
            name: obj.name,
            phone: obj.phone || '',
            email: obj.email || '',
            type: obj.type || 'Individual',
            status: 'Active'
        });
        return id;
    };

    if (!billingId && body.newBillingCustomer) billingId = await addNew(body.newBillingCustomer);
    if (!deliveryId && body.newDeliveryCustomer) deliveryId = await addNew(body.newDeliveryCustomer);

    if (!billingId || !deliveryId) return { success: false, error: 'Both customers required' };

    await db.query("UPDATE journeys SET customer_id = $1, delivery_customer_id = $2 WHERE id = $3", [billingId, deliveryId, journeyId]);
    
    // Refresh and return
    const updated = (await db.query("SELECT * FROM journeys WHERE id = $1", [journeyId])).rows[0];
    return { success: true, journey: enrichJourneyForPortal(updated, customersRes.rows) };
}

async function createJourneyStartRequest(driverId, payload = {}) {
    const driverRes = await db.query("SELECT * FROM drivers WHERE id = $1", [driverId]);
    const driver = driverRes.rows[0];
    if (!driver || !driver.truck) return { success: false, error: 'No vehicle assigned' };

    const activeRes = await db.query("SELECT id FROM journeys WHERE driver = $1 AND status IN ('Loading', 'Approved', 'In Transit', 'Awaiting Start Verification', 'Awaiting Verification')", [driverId]);
    if (activeRes.rows.length > 0) return { success: false, error: 'Finish your previous trip first' };

    const id = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
    const uId = await generateUId('journeys');
    
    const journey = {
        id,
        uId,
        driver: driverId,
        truck: driver.truck,
        origin: payload.origin || '',
        dest: payload.dest || '',
        cargo: payload.cargo || '',
        weight: payload.weight || 0,
        date: payload.date || new Date().toISOString().split('T')[0],
        status: 'Loading',
        start_odom: payload.startOdom || null,
        metadata: {
            notes: payload.notes || '',
            startOdomPhotoUrl: payload.startOdomPhotoUrl || ''
        }
    };

    await upsertEntity('journeys', journey);
    
    // If customers are in payload, update them
    if (payload.customerId || payload.newBillingCustomer) {
        await updateJourneyPartyCustomers(driverId, id, payload);
    }

    // Transition to Awaiting Start Verification if odom is provided
    if (payload.startOdom && payload.startOdomPhotoUrl) {
        await db.query("UPDATE journeys SET status = 'Awaiting Start Verification' WHERE id = $1", [id]);
    }

    return { success: true, journeyId: id };
}

async function createJourneyStartPlaceholder(driverId, payload = {}) {
    // Similar to start request but stays in Loading
    return createJourneyStartRequest(driverId, { ...payload, startOdom: null, startOdomPhotoUrl: null });
}

async function updateJourneyStatus(driverId, journeyId, newStatus, extras = {}) {
    const journeyRes = await db.query("SELECT * FROM journeys WHERE id = $1 AND driver = $2", [journeyId, driverId]);
    const journey = journeyRes.rows[0];
    if (!journey) return { success: false, error: 'Journey not found' };

    const updates = { status: newStatus };
    const metadata = journey.metadata || {};

    if (newStatus === 'Awaiting Start Verification') {
        if (!extras.startOdom || !extras.startOdomPhotoUrl) return { success: false, error: 'Odometer reading and photo required' };
        updates.start_odom = extras.startOdom;
        metadata.startOdomPhotoUrl = extras.startOdomPhotoUrl;
    }

    if (newStatus === 'Awaiting Verification') {
        if (!extras.endOdom || !extras.endOdomPhotoUrl || !extras.deliveryProofUrl) {
            return { success: false, error: 'End odometer, photo, and delivery proof required' };
        }
        updates.end_odom = extras.endOdom;
        metadata.endOdomPhotoUrl = extras.endOdomPhotoUrl;
        metadata.deliveryProofUrl = extras.deliveryProofUrl;
    }

    if (newStatus === 'In Transit' && !journey.started_at) {
        updates.started_at = new Date().toISOString();
    }

    // Apply updates
    const keys = Object.keys(updates);
    const sql = `UPDATE journeys SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, metadata = $${keys.length + 2} WHERE id = $1`;
    await db.query(sql, [journeyId, ...Object.values(updates), JSON.stringify(metadata)]);

    return { success: true };
}

async function verifyJourneyCompletion(journeyId, approved, rejectionReason = '', rejectedFields = []) {
    const journeyRes = await db.query("SELECT * FROM journeys WHERE id = $1", [journeyId]);
    const journey = journeyRes.rows[0];
    if (!journey) return { success: false, error: 'Journey not found' };

    const metadata = journey.metadata || {};
    let newStatus = journey.status;

    if (journey.status === 'Awaiting Start Verification') {
        newStatus = approved ? 'Approved' : 'Loading';
    } else if (journey.status === 'Awaiting Verification') {
        newStatus = approved ? 'Completed' : 'In Transit';
        if (approved) updates.end_date = new Date().toISOString().split('T')[0];
    }

    if (!approved) {
        metadata.rejectionReason = rejectionReason;
        metadata.rejectedFields = rejectedFields;
    } else {
        delete metadata.rejectionReason;
        delete metadata.rejectedFields;
    }

    await db.query("UPDATE journeys SET status = $1, metadata = $2 WHERE id = $3", [newStatus, JSON.stringify(metadata), journeyId]);
    
    // If completed, update truck odom
    if (approved && newStatus === 'Completed' && journey.end_odom) {
        await db.query("UPDATE trucks SET odom = $1 WHERE id = $2 AND odom < $1", [journey.end_odom, journey.truck]);
    }

    return { success: true };
}

async function addPendingSubmission(driverId, type, payload) {
    const uId = await generateUId(type === 'fuel' ? 'fuel_logs' : (type === 'expense' ? 'expenses' : (type === 'incident' ? 'incidents' : 'expenses')));
    const id = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
    
    const driverRes = await db.query("SELECT truck FROM drivers WHERE id = $1", [driverId]);
    const truckId = driverRes.rows[0]?.truck;

    if (type === 'fuel') {
        const entry = {
            id,
            uId,
            truck_id: truckId,
            driver_id: driverId,
            date: payload.date || new Date().toISOString().split('T')[0],
            litres: Number(payload.litres),
            price_per_l: Number(payload.pricePerL),
            station: payload.station,
            odom: Number(payload.odom),
            journey_id: payload.journey || null,
            metadata: {
                photoPump: payload.photoPump,
                photoReceipt: payload.photoReceipt,
                photoOdom: payload.photoOdom,
                _pendingApproval: true
            }
        };
        await upsertEntity('fuel_logs', entry);
    } else if (type === 'expense' || type === 'maintenance') {
        const entry = {
            id,
            uId,
            truck_id: truckId,
            driver_id: driverId,
            date: payload.date || new Date().toISOString().split('T')[0],
            cat: type === 'maintenance' ? 'Maintenance' : payload.cat,
            amount: Number(payload.amount || payload.cost),
            desc: payload.desc || payload.notes || payload.task,
            journey_id: payload.journey || null,
            metadata: {
                receiptUrl: payload.receiptUrl,
                _pendingApproval: true,
                task: payload.task,
                workshop: payload.workshop
            }
        };
        await upsertEntity('expenses', entry);
    } else if (type === 'incident') {
        const entry = {
            id,
            uId,
            driver_id: driverId,
            truck_id: truckId,
            incident_type: payload.incidentType,
            description: payload.description,
            location: payload.location,
            status: 'Open',
            metadata: {
                incidentPhotoUrl: payload.incidentPhotoUrl,
                _pendingApproval: true
            }
        };
        await upsertEntity('incidents', entry);
    }

    return { success: true };
}

module.exports = {
    getDriverData,
    updateJourneyStatus,
    verifyJourneyCompletion,
    addPendingSubmission,
    updateJourneyPartyCustomers,
    createJourneyStartRequest,
    createJourneyStartPlaceholder,
};

