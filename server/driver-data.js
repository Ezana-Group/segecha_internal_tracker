/**
 * driver-data.js — PostgreSQL-backed driver portal data layer (CRIT-10)
 *
 * Previously read/wrote a flat tracker-data.json file which caused a split-brain
 * situation where driver submissions were invisible to the admin panel and vice-versa.
 * All operations now go directly to the PostgreSQL database so both portals share
 * a single source of truth.
 *
 * Field-name conventions
 * ─────────────────────
 * The admin panel and the driver portal both use camelCase JSON field names
 * (e.g. `driver`, `truck`, `startOdom`).  The PostgreSQL schema uses snake_case
 * column names (e.g. `driver_id`, `truck_id`, `start_odom`).
 * Extended fields that have no dedicated column are stored in the `metadata JSONB`
 * column and merged into the returned row so callers see a flat object.
 */

'use strict';

const crypto = require('crypto');
const db = require('./db');

// ─── ID helpers ───────────────────────────────────────────────────────────────

/** Generates a short, URL-safe unique ID.  Replaces Math.random() (LOW-06). */
function uid() {
    return crypto.randomBytes(6).toString('base64url').toUpperCase();
}

// ─── Status sets ──────────────────────────────────────────────────────────────

const ACTIVE_JOURNEY_STATUSES = [
    'Loading',
    'Approved',
    'In Transit',
    'Awaiting Start Verification',
    'Awaiting Verification',
];

// ─── Row → portal shape helpers ───────────────────────────────────────────────

/**
 * Merge a DB row's `metadata` JSONB field into the top-level object and
 * expose camelCase aliases for the most-used snake_case columns so that
 * the driver portal frontend continues to work without change.
 */
function flattenRow(row) {
    if (!row) return null;
    const { metadata, ...rest } = row;
    return { ...rest, ...(metadata || {}) };
}

function flattenJourneyRow(row) {
    if (!row) return null;
    const flat = flattenRow(row);
    // Expose the camelCase aliases expected by the driver portal
    return {
        ...flat,
        driver:            flat.driver_id       ?? flat.driver,
        truck:             flat.truck_id         ?? flat.truck,
        customerId:        flat.customer_id      ?? flat.customerId,
        deliveryCustomerId:flat.delivery_customer_id ?? flat.deliveryCustomerId,
        dest:              flat.destination      ?? flat.dest,
        cargo:             flat.cargo_type       ?? flat.cargo,
        date:              flat.date             ? String(flat.date).split('T')[0] : '',
    };
}

function flattenDriverRow(row) {
    if (!row) return null;
    const flat = flattenRow(row);
    return {
        ...flat,
        // The driver's assigned truck is stored either in a dedicated column or metadata
        truck: flat.truck_id ?? flat.truck ?? '',
    };
}

function flattenTruckRow(row) {
    if (!row) return null;
    const flat = flattenRow(row);
    return {
        ...flat,
        odom:      flat.current_mileage ?? flat.odom ?? 0,
        tyreOdom:  flat.tyre_odom       ?? flat.tyreOdom ?? 0,
        tyreLimit: flat.tyre_limit      ?? flat.tyreLimit ?? 60000,
        reg:       flat.registration_number ?? flat.reg ?? '',
    };
}

// ─── enrichJourneyForPortal ───────────────────────────────────────────────────

/**
 * Enrich a flat journey object with display data fetched via a single JOIN query.
 * `enrichedData` is an optional pre-fetched object with { driverPhone, trailerReg,
 * billingCustomerName, deliveryCustomerName }.
 */
function enrichJourney(journey, enrichedData = {}) {
    return {
        ...journey,
        _driverPhone:          enrichedData.driverPhone          ?? '',
        _turnboyDisplay:       enrichedData.turnboyDisplay        ?? '',
        _trailerReg:           enrichedData.trailerReg            ?? '',
        _billingCustomerName:  enrichedData.billingCustomerName   ?? '',
        _deliveryCustomerName: enrichedData.deliveryCustomerName  ?? '',
    };
}

/**
 * Fetch enrichment data for a list of flat journey objects in one round-trip.
 */
async function enrichJourneys(journeys) {
    if (!journeys.length) return journeys;

    // Collect all referenced IDs
    const truckIds    = [...new Set(journeys.map(j => j.truck_id).filter(Boolean))];
    const driverIds   = [...new Set(journeys.map(j => j.driver_id).filter(Boolean))];
    const custIds     = [...new Set([
        ...journeys.map(j => j.customer_id).filter(Boolean),
        ...journeys.map(j => j.delivery_customer_id).filter(Boolean),
    ])];
    const trailerIds  = [...new Set(journeys.map(j => j.trailer_id ?? j.metadata?.trailer).filter(Boolean))];

    const [driversRes, custsRes, trailersRes] = await Promise.all([
        driverIds.length  ? db.query('SELECT id, phone FROM drivers WHERE id = ANY($1)', [driverIds])           : { rows: [] },
        custIds.length    ? db.query('SELECT id, name FROM customers WHERE id = ANY($1)', [custIds])            : { rows: [] },
        trailerIds.length ? db.query('SELECT id, registration_number FROM trailers WHERE id = ANY($1)', [trailerIds]) : { rows: [] },
    ]);

    const driverMap  = Object.fromEntries(driversRes.rows.map(r => [r.id, r]));
    const custMap    = Object.fromEntries(custsRes.rows.map(r => [r.id, r]));
    const trailerMap = Object.fromEntries(trailersRes.rows.map(r => [r.id, r]));

    return journeys.map(j => enrichJourney(j, {
        driverPhone:          driverMap[j.driver_id]?.phone ?? '',
        trailerReg:           trailerMap[j.trailer_id ?? j.metadata?.trailer]?.registration_number ?? '',
        billingCustomerName:  custMap[j.customer_id]?.name ?? '',
        deliveryCustomerName: custMap[j.delivery_customer_id]?.name ?? '',
    }));
}

// ─── getDriverData ────────────────────────────────────────────────────────────

async function getDriverData(driverId) {
    // 1. Driver record
    const driverRes = await db.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    if (!driverRes.rows[0]) return null;
    const driver = flattenDriverRow(driverRes.rows[0]);

    // 2. Assigned truck
    const truckId = driver.truck_id || driver.truck || driver.metadata?.truck || null;
    let truck = null;
    if (truckId) {
        const truckRes = await db.query('SELECT * FROM trucks WHERE id = $1', [truckId]);
        if (truckRes.rows[0]) truck = flattenTruckRow(truckRes.rows[0]);
    }

    // 3. All journeys for this driver
    const journeysRes = await db.query(
        'SELECT * FROM journeys WHERE driver_id = $1 ORDER BY created_at DESC',
        [driverId]
    );
    const allJourneys = journeysRes.rows.map(flattenJourneyRow);

    const activeJourneys    = await enrichJourneys(allJourneys.filter(j => ACTIVE_JOURNEY_STATUSES.includes(j.status)));
    const completedJourneys = await enrichJourneys(allJourneys.filter(j => j.status === 'Completed'));

    // 4. Fuel entries (submitted by this driver OR on their truck)
    const fuelRes = await db.query(
        `SELECT * FROM fuel_logs
         WHERE metadata->>'_submittedBy' = $1
            OR (truck_id = $2 AND $2 IS NOT NULL)
         ORDER BY date DESC, created_at DESC
         LIMIT 20`,
        [driverId, truckId || null]
    );
    const fuelEntries = fuelRes.rows.map(flattenRow);

    // 5. Expenses
    const expenseRes = await db.query(
        `SELECT * FROM expenses
         WHERE metadata->>'_submittedBy' = $1
            OR journey_id IN (SELECT id FROM journeys WHERE driver_id = $1)
         ORDER BY date DESC, created_at DESC
         LIMIT 20`,
        [driverId]
    );
    const expenseEntries = expenseRes.rows.map(flattenRow);

    // 6. Incidents
    const incidentRes = await db.query(
        `SELECT * FROM incidents
         WHERE metadata->>'driverId' = $1
            OR metadata->>'driver' = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [driverId]
    );
    const incidentEntries = incidentRes.rows.map(flattenRow);

    // 7. Payroll / payslips
    const payrollRes = await db.query(
        `SELECT * FROM payroll
         WHERE entity_id = $1 AND entity_type = 'driver'
         ORDER BY month DESC`,
        [driverId]
    );
    const payslips = payrollRes.rows.map(flattenRow);

    // 8. Customers list (id + name + phone + email + type)
    const custRes = await db.query(
        'SELECT id, name, phone, email, metadata FROM customers WHERE status = $1 OR status IS NULL ORDER BY name',
        ['Active']
    );
    const customers = custRes.rows.map(r => ({
        id:    r.id,
        name:  r.name,
        phone: r.phone  || '',
        email: r.email  || '',
        type:  r.metadata?.type || 'Individual',
    }));

    // 9. Tyre info
    let tyreInfo = null;
    if (truck) {
        const odom      = truck.odom      || truck.current_mileage || 0;
        const tyreOdom  = truck.tyreOdom  || 0;
        const tyreLimit = truck.tyreLimit || 60000;
        const kmSince   = odom - tyreOdom;
        const remaining = tyreLimit - kmSince;
        tyreInfo = {
            kmSinceChange: kmSince,
            remaining,
            pct:    Math.min(100, (kmSince / tyreLimit) * 100).toFixed(1),
            status: remaining <= 0 ? 'Overdue' : remaining <= 5000 ? 'Due Soon' : 'OK',
        };
    }

    // 10. Profile permissions from settings
    const ppRes = await db.query(
        "SELECT value FROM system_settings WHERE key = 'profilePermissions'",
        []
    );
    const profilePermissions = ppRes.rows[0]?.value || null;

    return {
        driver,
        truck,
        tyreInfo,
        activeJourneys,
        completedJourneys,
        fuelEntries,
        expenseEntries,
        incidentEntries,
        maintenanceHistory: expenseEntries.filter(
            e => e.cat === 'Maintenance' || e.category === 'Maintenance'
        ),
        payslips,
        customers,
        profilePermissions,
        settings: {},
    };
}

// ─── validateDriverSubmission ─────────────────────────────────────────────────

async function validateDriverSubmission(driverId, payload = {}) {
    const driverRes = await db.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    const driverRow = driverRes.rows[0];
    if (!driverRow) return { success: false, error: 'Driver not found' };

    const driver       = flattenDriverRow(driverRow);
    const assignedTruck = driver.truck_id || driver.truck || driver.metadata?.truck || '';
    if (!assignedTruck) {
        return { success: false, error: 'No vehicle assigned — contact the office' };
    }

    const clientTruck = payload.truck != null ? String(payload.truck).trim() : '';
    if (clientTruck && clientTruck !== assignedTruck) {
        const lockAssignment = driver.lock_vehicle_assignment ?? driver.lockVehicleAssignment ?? driver.metadata?.lockVehicleAssignment ?? false;
        const msg = lockAssignment
            ? 'Vehicle is locked to your office assignment — cannot use a different truck'
            : 'Truck must match your assigned vehicle';
        return { success: false, error: msg };
    }

    // Resolve active journey
    let journeyId = payload.journey != null ? String(payload.journey).trim() : '';
    if (journeyId) {
        const jRes = await db.query('SELECT * FROM journeys WHERE id = $1', [journeyId]);
        const j = jRes.rows[0];
        if (!j || j.driver_id !== driverId) {
            return { success: false, error: 'Trip not found or not assigned to you' };
        }
        if (!ACTIVE_JOURNEY_STATUSES.includes(j.status)) {
            return { success: false, error: 'That trip is finished — choose an active trip or leave trip blank' };
        }
        const jTruck = j.truck_id || (j.metadata || {}).truck;
        if (jTruck && jTruck !== assignedTruck) {
            return { success: false, error: 'That trip is not on your assigned vehicle — contact the office' };
        }
    } else {
        // Auto-resolve if there is exactly one active journey
        const activesRes = await db.query(
            'SELECT id FROM journeys WHERE driver_id = $1 AND status = ANY($2)',
            [driverId, ACTIVE_JOURNEY_STATUSES]
        );
        if (activesRes.rows.length === 1) journeyId = activesRes.rows[0].id;
    }

    return { success: true, truck: assignedTruck, journey: journeyId };
}

// ─── updateJourneyStatus ──────────────────────────────────────────────────────

async function updateJourneyStatus(driverId, journeyId, newStatus, extras = {}) {
    const jRes = await db.query(
        'SELECT * FROM journeys WHERE id = $1 AND driver_id = $2',
        [journeyId, driverId]
    );
    const jRow = jRes.rows[0];
    if (!jRow) return { success: false, error: 'Journey not found or not assigned to you' };

    const j        = flattenJourneyRow(jRow);
    const metadata = { ...(jRow.metadata || {}) };

    // Vehicle lock check
    const driverRes = await db.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    const driver    = flattenDriverRow(driverRes.rows[0] || {});
    const lockAssign = driver.lock_vehicle_assignment ?? driver.lockVehicleAssignment ?? driver.metadata?.lockVehicleAssignment ?? false;
    if (lockAssign && j.truck_id && driver.truck_id && j.truck_id !== driver.truck_id) {
        return { success: false, error: 'This trip is on a different vehicle than your office assignment. Contact the office.' };
    }

    // Validate transition
    const validDriverTransitions = {
        'Loading':     ['Awaiting Start Verification'],
        'Approved':    ['Loading', 'In Transit'],
        'In Transit':  ['Awaiting Verification'],
    };
    if (!validDriverTransitions[jRow.status]?.includes(newStatus)) {
        return {
            success: false,
            error: jRow.status === 'Awaiting Verification'
                ? 'This trip is waiting for office verification. You cannot make changes until it is reviewed.'
                : `Cannot change status from ${jRow.status} to ${newStatus}`,
        };
    }

    // Guard: no concurrent active trips when starting a new one
    if (newStatus === 'Awaiting Start Verification' && jRow.status === 'Loading') {
        const othersRes = await db.query(
            'SELECT id, status FROM journeys WHERE driver_id = $1 AND id <> $2 AND status = ANY($3)',
            [driverId, journeyId, ACTIVE_JOURNEY_STATUSES]
        );
        if (othersRes.rows.length > 0) {
            const s = othersRes.rows.map(r => `${r.id} (${r.status})`).join(', ');
            return { success: false, error: `Finish your previous trip first. Open trip(s): ${s}` };
        }
        if (!j.customerId && !jRow.customer_id) {
            return { success: false, error: 'Billing customer and delivery customer must be set before you start.' };
        }
    }

    // Build column updates
    const updates = { status: newStatus };

    if (newStatus === 'Awaiting Start Verification') {
        if (extras.origin != null)  updates.origin       = String(extras.origin).trim();
        if (extras.dest   != null)  updates.destination  = String(extras.dest).trim();
        if (extras.cargo  != null)  updates.cargo_type   = String(extras.cargo).trim();
        if (extras.notes  != null)  updates.notes        = String(extras.notes).trim();

        if (!extras.startOdom)         return { success: false, error: 'Start odometer reading is required' };
        if (!extras.startOdomPhotoUrl) return { success: false, error: 'Start odometer photo is required' };

        metadata.startOdom                          = +extras.startOdom;
        metadata.startOdomPhotoUrl                  = extras.startOdomPhotoUrl;
        metadata.submittedStartForVerificationAt    = new Date().toISOString();
        metadata._pendingStartVerification          = true;
        metadata._rejectionReason                   = null;
    }

    if (newStatus === 'Awaiting Verification') {
        if (!extras.endOdom)          return { success: false, error: 'End odometer reading is required' };
        if (!extras.endOdomPhotoUrl)  return { success: false, error: 'End odometer photo is required' };
        if (!extras.deliveryProofUrl) return { success: false, error: 'Delivery proof photo is required' };

        metadata.endOdom                  = +extras.endOdom;
        metadata.endOdomPhotoUrl          = extras.endOdomPhotoUrl;
        metadata.deliveryProofUrl         = extras.deliveryProofUrl;
        metadata.submittedForVerificationAt = new Date().toISOString();
        metadata._pendingVerification     = true;
        metadata._rejectionReason         = null;
    }

    if (newStatus === 'In Transit' && !metadata.startedAt) {
        metadata.startedAt = new Date().toISOString();
    }

    // Build parameterised UPDATE
    const setClauses = ['status = $1', 'metadata = $2'];
    const values     = [newStatus, JSON.stringify(metadata)];
    let paramIdx     = 3;

    for (const [col, val] of Object.entries(updates)) {
        if (col === 'status') continue; // already set
        setClauses.push(`${col} = $${paramIdx++}`);
        values.push(val);
    }
    values.push(journeyId);

    await db.query(
        `UPDATE journeys SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
        values
    );

    const updatedRes = await db.query('SELECT * FROM journeys WHERE id = $1', [journeyId]);
    const updated    = flattenJourneyRow(updatedRes.rows[0]);
    return { success: true, journey: updated };
}

// ─── updateJourneyPartyCustomers ──────────────────────────────────────────────

async function updateJourneyPartyCustomers(driverId, journeyId, body = {}) {
    const jRes = await db.query(
        'SELECT * FROM journeys WHERE id = $1 AND driver_id = $2',
        [journeyId, driverId]
    );
    const jRow = jRes.rows[0];
    if (!jRow) return { success: false, error: 'Journey not found or not assigned to you' };
    if (jRow.status !== 'Loading') {
        return { success: false, error: 'Customers can only be set while the trip is waiting to start' };
    }

    const billingType  = body.billingType  || body.newBillingCustomer?.type  || 'Individual';
    const deliveryType = body.deliveryType || body.newDeliveryCustomer?.type || 'Individual';
    const billingEmail  = body.billingEmail  || body.newBillingCustomer?.email  || '';
    const deliveryEmail = body.deliveryEmail || body.newDeliveryCustomer?.email || '';

    if (String(billingType)  === 'Company' && !String(billingEmail).trim())  return { success: false, error: 'Billing customer email is required for companies' };
    if (String(deliveryType) === 'Company' && !String(deliveryEmail).trim()) return { success: false, error: 'Delivery customer email is required for companies' };

    // Upsert helper
    async function resolveOrCreateCustomer(id, newObj, type, email) {
        if (id && String(id).trim()) {
            const r = await db.query('SELECT id FROM customers WHERE id = $1', [String(id).trim()]);
            if (r.rows.length) return r.rows[0].id;
        }
        if (!newObj || !String(newObj.name || '').trim()) return null;
        const normalizedName = String(newObj.name).trim().toLowerCase();
        const existing = await db.query(
            'SELECT id FROM customers WHERE LOWER(name) = $1 LIMIT 1',
            [normalizedName]
        );
        if (existing.rows.length) return existing.rows[0].id;
        const newId = uid();
        await db.query(
            'INSERT INTO customers (id, name, phone, email, metadata) VALUES ($1, $2, $3, $4, $5)',
            [newId, String(newObj.name).trim(), String(newObj.phone || '').trim(), String(email || '').trim(),
             JSON.stringify({ type: type === 'Company' ? 'Company' : 'Individual' })]
        );
        return newId;
    }

    const billingId  = await resolveOrCreateCustomer(body.customerId,         body.newBillingCustomer,  billingType,  billingEmail);
    const deliveryId = await resolveOrCreateCustomer(body.deliveryCustomerId,  body.newDeliveryCustomer, deliveryType, deliveryEmail);

    if (!billingId || !deliveryId) {
        return { success: false, error: 'Choose or create both billing and delivery customers' };
    }

    // Persist email/type updates to existing customers
    if (billingId  && (body.billingEmail  != null || body.billingType  != null)) {
        await db.query(
            "UPDATE customers SET email = COALESCE($1, email), metadata = metadata || $2 WHERE id = $3",
            [body.billingEmail  || null, JSON.stringify({ type: billingType  }), billingId]
        );
    }
    if (deliveryId && (body.deliveryEmail != null || body.deliveryType != null)) {
        await db.query(
            "UPDATE customers SET email = COALESCE($1, email), metadata = metadata || $2 WHERE id = $3",
            [body.deliveryEmail || null, JSON.stringify({ type: deliveryType }), deliveryId]
        );
    }

    await db.query(
        'UPDATE journeys SET customer_id = $1, delivery_customer_id = $2 WHERE id = $3',
        [billingId, deliveryId, journeyId]
    );

    const updatedRes = await db.query('SELECT * FROM journeys WHERE id = $1', [journeyId]);
    const [enriched] = await enrichJourneys([flattenJourneyRow(updatedRes.rows[0])]);
    return { success: true, journey: enriched };
}

// ─── createJourneyStartRequest ────────────────────────────────────────────────

async function createJourneyStartRequest(driverId, payload = {}) {
    const driverRes = await db.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    const driver    = flattenDriverRow(driverRes.rows[0] || {});
    if (!driver.id) return { success: false, error: 'Driver not found' };

    const truckId = driver.truck_id || driver.truck || driver.metadata?.truck || '';
    if (!truckId) return { success: false, error: 'No vehicle assigned — contact the office' };

    // No concurrent active trips
    const activesRes = await db.query(
        'SELECT id, status FROM journeys WHERE driver_id = $1 AND status = ANY($2)',
        [driverId, ACTIVE_JOURNEY_STATUSES]
    );
    if (activesRes.rows.length > 0) {
        const s = activesRes.rows.map(r => `${r.id} (${r.status})`).join(', ');
        return { success: false, error: `Finish your previous trip first. Open trip(s): ${s}` };
    }

    const journeyId = uid();
    const date      = payload.date || new Date().toISOString().split('T')[0];

    await db.query(
        `INSERT INTO journeys
            (id, driver_id, truck_id, origin, destination, cargo_type, notes, start_date, status,
             customer_id, delivery_customer_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Loading',$9,$10,$11)`,
        [
            journeyId, driverId, truckId,
            payload.origin || '', payload.dest || '', payload.cargo || '',
            payload.notes  || '',
            date,
            null, null,
            JSON.stringify({
                trailer:   payload.trailer  || '',
                weight:    payload.weight   != null && payload.weight !== '' ? +payload.weight : '',
                waybillNo: null, waybillGenerated: false, waybillData: null,
            }),
        ]
    );

    // 1) Assign customers
    const custResult = await updateJourneyPartyCustomers(driverId, journeyId, payload);
    if (!custResult.success) return custResult;

    // 2) Transition to Awaiting Start Verification
    return updateJourneyStatus(driverId, journeyId, 'Awaiting Start Verification', {
        origin:             payload.origin,
        dest:               payload.dest,
        cargo:              payload.cargo,
        notes:              payload.notes,
        startOdom:          payload.startOdom,
        startOdomPhotoUrl:  payload.startOdomPhotoUrl,
    });
}

// ─── createJourneyStartPlaceholder ───────────────────────────────────────────

async function createJourneyStartPlaceholder(driverId, payload = {}) {
    const driverRes = await db.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    const driver    = flattenDriverRow(driverRes.rows[0] || {});
    if (!driver.id) return { success: false, error: 'Driver not found' };

    const truckId = driver.truck_id || driver.truck || driver.metadata?.truck || '';
    if (!truckId) return { success: false, error: 'No vehicle assigned — contact the office' };

    const activesRes = await db.query(
        'SELECT id, status FROM journeys WHERE driver_id = $1 AND status = ANY($2)',
        [driverId, ACTIVE_JOURNEY_STATUSES]
    );
    if (activesRes.rows.length > 0) {
        const s = activesRes.rows.map(r => `${r.id} (${r.status})`).join(', ');
        return { success: false, error: `Finish your previous trip first. Open trip(s): ${s}` };
    }

    const journeyId = uid();
    const date      = payload.date || new Date().toISOString().split('T')[0];

    await db.query(
        `INSERT INTO journeys
            (id, driver_id, truck_id, origin, destination, cargo_type, notes, start_date, status, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Loading',$9)`,
        [
            journeyId, driverId, truckId,
            payload.origin || '', payload.dest || '', payload.cargo || '',
            payload.notes  || '', date,
            JSON.stringify({ trailer: payload.trailer || '', weight: payload.weight || '' }),
        ]
    );

    const jRes = await db.query('SELECT * FROM journeys WHERE id = $1', [journeyId]);
    const [enriched] = await enrichJourneys([flattenJourneyRow(jRes.rows[0])]);
    return { success: true, journey: enriched };
}

// ─── addPendingSubmission ─────────────────────────────────────────────────────

async function addPendingSubmission(driverId, type, payload) {
    const v = await validateDriverSubmission(driverId, payload);
    if (!v.success) return v;

    const { truck, journey } = v;
    const now  = new Date().toISOString();
    const id   = uid();
    const date = payload.date || now.split('T')[0];

    // Read approval settings from DB
    const ppRes = await db.query("SELECT value FROM system_settings WHERE key = 'profilePermissions'");
    const pp    = ppRes.rows[0]?.value || {};
    const needsFuelApproval    = pp.driverPortal?.fuelVerification    !== false;
    const needsExpenseApproval = pp.driverPortal?.expenseVerification !== false;

    if (type === 'fuel') {
        const amount = (+(payload.litres || 0)) * (+(payload.pricePerL || 0));
        await db.query(
            `INSERT INTO fuel_logs
                (id, journey_id, truck_id, date, amount, litres, station, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                id, journey || null, truck, date,
                amount, +payload.litres, payload.station || '',
                JSON.stringify({
                    pricePerL:        +payload.pricePerL || 0,
                    odom:             +payload.odom || 0,
                    photoPump:        payload.photoPump        || '',
                    photoReceipt:     payload.photoReceipt     || payload.receiptUrl || '',
                    photoOdom:        payload.photoOdom        || payload.odomPhotoUrl || '',
                    _pendingApproval: needsFuelApproval,
                    _submittedBy:     driverId,
                    _submittedAt:     now,
                }),
            ]
        );
    } else if (type === 'expense' || type === 'maintenance') {
        const category = type === 'maintenance' ? 'Maintenance' : (payload.cat || payload.category || '');
        const desc     = type === 'maintenance'
            ? `${payload.task || 'General Maintenance'}${payload.notes ? ' — ' + payload.notes : ''}`
            : (payload.cat === 'Maintenance' && payload.task
                ? `${payload.task}${payload.desc ? ' — ' + payload.desc : ''}`
                : (payload.desc || ''));

        await db.query(
            `INSERT INTO expenses
                (id, journey_id, category, amount, date, description, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
                id, journey || null, category,
                +(payload.amount || payload.cost || 0), date, desc,
                JSON.stringify({
                    truck:            truck,
                    receiptUrl:       payload.receiptUrl || '',
                    _pendingApproval: needsExpenseApproval,
                    _submittedBy:     driverId,
                    _submittedAt:     now,
                    ...(category === 'Maintenance' ? {
                        _maintenanceDetails: {
                            task:        payload.task        || 'General Maintenance',
                            workshop:    payload.workshop    || '',
                            cost:        +(payload.cost || payload.amount || 0),
                            odomReading: +(payload.odomReading || 0),
                            receiptUrl:  payload.receiptUrl  || '',
                            notes:       payload.notes       || '',
                        }
                    } : {}),
                }),
            ]
        );
    } else if (type === 'incident') {
        await db.query(
            `INSERT INTO incidents
                (id, journey_id, type, description, status, metadata)
             VALUES ($1,$2,$3,$4,'Open',$5)`,
            [
                id, journey || null,
                payload.incidentType || 'Other',
                payload.description || '',
                JSON.stringify({
                    driverId:         driverId,
                    truck:            truck,
                    location:         payload.location         || '',
                    incidentPhotoUrl: payload.incidentPhotoUrl || '',
                    _pendingApproval: true,
                    _submittedAt:     now,
                }),
            ]
        );
    } else {
        return { success: false, error: `Unknown submission type: ${type}` };
    }

    const msgMap = {
        fuel:        'Fuel log submitted',
        expense:     'Expense claim submitted',
        incident:    'Incident report submitted',
        maintenance: 'Maintenance log submitted',
    };
    return { success: true, message: msgMap[type] || 'Submitted successfully' };
}

// ─── verifyJourneyCompletion (admin-side helper kept for compatibility) ────────

async function verifyJourneyCompletion(journeyId, approved, rejectionReason = '', rejectedFields = []) {
    const jRes = await db.query('SELECT * FROM journeys WHERE id = $1', [journeyId]);
    const jRow = jRes.rows[0];
    if (!jRow) return { success: false, error: 'Journey not found' };

    const metadata = { ...(jRow.metadata || {}) };
    let newStatus;
    let action;

    if (jRow.status === 'Awaiting Start Verification') {
        action = 'start';
        if (approved) {
            newStatus = 'Approved';
            metadata._pendingStartVerification = false;
            metadata._rejectionReason          = null;
            metadata._rejectedFields           = null;
            metadata._startVerifiedAt          = new Date().toISOString();
        } else {
            newStatus = 'Loading';
            metadata._pendingStartVerification           = false;
            metadata._rejectionReason                    = rejectionReason || 'Start verification rejected by office';
            metadata._rejectedFields                     = rejectedFields || [];
            metadata._rejectedAt                         = new Date().toISOString();
            metadata.submittedStartForVerificationAt     = null;
        }
    } else if (jRow.status === 'Awaiting Verification') {
        action = 'completion';
        if (approved) {
            newStatus = 'Completed';
            metadata._pendingVerification = false;
            metadata._verifiedAt          = new Date().toISOString();
            metadata._rejectionReason     = null;
            metadata._rejectedFields      = null;
        } else {
            newStatus = 'In Transit';
            metadata._pendingVerification        = false;
            metadata._rejectionReason            = rejectionReason || 'Verification rejected by office';
            metadata._rejectedFields             = rejectedFields || [];
            metadata._rejectedAt                 = new Date().toISOString();
            metadata.submittedForVerificationAt  = null;
        }
    } else {
        return { success: false, error: `Journey is ${jRow.status}, not awaiting verification` };
    }

    // Update truck odometer when journey completes
    if (approved && action === 'completion' && metadata.endOdom) {
        await db.query(
            'UPDATE trucks SET current_mileage = GREATEST(current_mileage, $1) WHERE id = $2',
            [+metadata.endOdom, jRow.truck_id]
        );
    }

    await db.query(
        'UPDATE journeys SET status = $1, metadata = $2 WHERE id = $3',
        [newStatus, JSON.stringify(metadata), journeyId]
    );

    const updatedRes = await db.query('SELECT * FROM journeys WHERE id = $1', [journeyId]);
    return {
        success: true,
        journey: flattenJourneyRow(updatedRes.rows[0]),
        approved,
        action,
    };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    getDriverData,
    updateJourneyStatus,
    verifyJourneyCompletion,
    addPendingSubmission,
    updateJourneyPartyCustomers,
    createJourneyStartRequest,
    createJourneyStartPlaceholder,
    // Legacy export kept for any callers that used enrichJourneyForPortal
    enrichJourneyForPortal: enrichJourney,
};
