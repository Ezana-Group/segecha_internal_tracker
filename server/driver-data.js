const db = require('./db');

const { upsertEntity } = require('./utils/db-helpers');

const _uIdCounters = {};

/**
 * Generate a sequential uId like "FUL-011".
 * Uses DB query and an in-memory lock to prevent race conditions.
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

    if (!_uIdCounters[collection]) {
        // Find max existing number
        try {
            const res = await db.query(`SELECT u_id FROM ${collection} WHERE u_id LIKE $1 ORDER BY LENGTH(u_id) DESC, u_id DESC LIMIT 1`, [prefix + '%']);
            if (res.rows.length > 0 && res.rows[0].u_id) {
                const numStr = res.rows[0].u_id.replace(prefix, '');
                const num = parseInt(numStr, 10);
                if (!isNaN(num)) {
                    _uIdCounters[collection] = num;
                }
            }
        } catch (e) {
            // column might not exist or table empty
        }
        
        if (!_uIdCounters[collection]) {
            const fallback = await db.query(`SELECT COUNT(*) FROM ${collection}`);
            _uIdCounters[collection] = parseInt(fallback.rows[0].count) || 0;
        }
    }
    
    _uIdCounters[collection] += 1;
    return prefix + String(_uIdCounters[collection]).padStart(3, '0');
}

/**
 * Enriches basic journey data with related names (Customer, Driver etc.) for the portal UI.
 */
function enrichJourneyForPortal(j, customers = [], trailers = [], drivers = []) {
    const trailer = j.trailer_id && trailers.find((t) => t.id === j.trailer_id);
    const trailerReg = trailer?.registration_number || trailer?.reg || "";

    const cust = customers.find((c) => c.id === j.customer_id);
    const del = customers.find((c) => c.id === j.delivery_customer_id);
    const drvId = j.driver_id || j.driver;
    const drv = drivers.find((d) => d.id === drvId);

    return {
        ...j,
        dest: j.destination || j.dest || '',
        distance: j.distance || j.metadata?.distance || 0,
        driverMileage: j.driverMileage || j.metadata?.driverMileage || 0,
        turnboyMileage: j.turnboyMileage || j.metadata?.turnboyMileage || 0,
        roadUserAllowance: j.roadUserAllowance || j.metadata?.roadUserAllowance || 0,
        customerId: j.customer_id,
        deliveryCustomerId: j.delivery_customer_id,
        _driverPhone: drv?.phone || '',
        _trailerReg: trailerReg,
        _billingCustomerName: cust?.name || "",
        _deliveryCustomerName: del?.name || "",
    };
}

const safeSort = (arr, key) => {
    return arr.sort((a, b) => {
        const da = a[key] ? new Date(a[key]).getTime() : 0;
        const db = b[key] ? new Date(b[key]).getTime() : 0;
        return db - da;
    });
};

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
        db.query("SELECT * FROM journeys WHERE driver_id = $1", [driverId]),
        db.query("SELECT * FROM fuel_logs WHERE (_submitted_by = $1 OR driver_id = $1)", [driverId]),
        db.query("SELECT * FROM expenses WHERE (truck_id IN (SELECT id FROM trucks WHERE driver_id = $1) OR driver_id = $1 OR _submitted_by = $1)", [driverId]),
        db.query("SELECT * FROM incidents WHERE (driver_id = $1 OR _submitted_by = $1)", [driverId]),
        db.query("SELECT * FROM customers"),
        db.query("SELECT * FROM trailers"),
        db.query("SELECT * FROM payroll WHERE entity_id = $1 AND entity_type = 'driver'", [driverId]),
        db.query("SELECT * FROM system_settings")
    ]);

    const driver = driverRes.rows[0];
    if (!driver) return null;

    // Map DB fields to frontend legacy names
    driver.license = driver.license_number;
    
    // Safety: parse license_class if it's a JSON string
    try {
        if (typeof driver.license_class === 'string' && driver.license_class.startsWith('[')) {
            driver.class = JSON.parse(driver.license_class);
        } else {
            driver.class = driver.license_class;
        }
    } catch {
        driver.class = driver.license_class;
    }

    const trucks = trucksRes.rows;
    const journeys = safeSort(journeysRes.rows, 'date');
    const fuel = safeSort(fuelRes.rows, 'date').slice(0, 20);
    const expenses = safeSort(expensesRes.rows, 'date').slice(0, 20);
    const incidents = safeSort(incidentsRes.rows, 'created_at').slice(0, 20);
    const customers = customersRes.rows;
    const trailers = trailersRes.rows;
    const payroll = safeSort(payrollRes.rows, 'month');

    const settings = {};
    settingsRes.rows.forEach(r => settings[r.key] = r.value);

    const truck = driver.truck ? trucks.find(t => t.id === driver.truck) : null;
    if (truck) truck.reg = truck.registration_number;

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
        const odom = Number(truck.current_mileage || 0);
        const tyreOdom = Number(truck.metadata?.tyreOdom || 0);
        const tyreLimit = Number(truck.metadata?.tyreLimit || 40000);
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
        maintenanceHistory: expenses.filter(e => (e.category === 'Maintenance' || e.cat === 'Maintenance')),
        payslips: payroll,
        customers: customers.map(c => ({ id: c.id, name: c.name, phone: c.phone || '', email: c.email || '', type: c.type || 'Individual' })),
        settings
    };
}

async function updateJourneyPartyCustomers(driverId, journeyId, body = {}) {
    const [journeyRes, customersRes] = await Promise.all([
        db.query("SELECT * FROM journeys WHERE id = $1 AND driver_id = $2", [journeyId, driverId]),
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
    const activeStat = "status IN ('Loading', 'Approved', 'In Transit', 'Awaiting Start Verification', 'Awaiting Verification')";
    const activeRes = await db.query(`SELECT id FROM journeys WHERE driver_id = $1 AND ${activeStat}`, [driverId]);
    if (activeRes.rows.length > 0) return { success: false, error: 'Finish your previous trip first' };

    const id = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
    const uId = await generateUId('journeys');
    const tracking_id = require('crypto').randomBytes(6).toString('hex').toUpperCase();

    const journey = {
        id,
        uId,
        tracking_id,
        driver_id: driverId,
        truck_id: driver.truck,
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
    const journeyRes = await db.query("SELECT * FROM journeys WHERE id = $1 AND driver_id = $2", [journeyId, driverId]);
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
        await db.query("UPDATE trucks SET current_mileage = $1 WHERE id = $2 AND current_mileage < $1", [journey.end_odom, journey.truck_id || journey.truck]);
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
            type: payload.incidentType || payload.type || 'Other',
            severity: payload.severity || 'Medium',
            description: payload.description,
            status: 'Open',
            metadata: {
                incidentPhotoUrl: payload.incidentPhotoUrl,
                location: payload.location,
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

