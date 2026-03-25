const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'tracker-data.json');

function readTrackerData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch {
        // Return empty structure if no data file yet
        return { trucks: [], drivers: [], journeys: [], fuel: [], expenses: [], incidents: [], invoices: [], payroll: [] };
    }
}

/**
 * Generate a sequential uId like "FUL-011" for a given collection.
 * Mirrors the admin-side logic in useAppState.js.
 */
function generateUId(data, collection) {
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
    // Read custom prefixes from profilePermissions/settings if available
    const settings = data.settings || {};
    const prefix = settings[collection + 'IdPrefix'] || prefixes[collection] || '';
    if (!prefix) return '';
    const arr = data[collection] || [];
    const count = arr.length + 1;
    return prefix + String(count).padStart(3, '0');
}

function writeTrackerData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function enrichJourneyForPortal(j, data) {
    const turnboyName =
        j.turnboyName ||
        (j.turnboyId && (data.turnboys || []).find((t) => t.id === j.turnboyId)?.name) ||
        "";
    const trailerReg = j.trailer && (data.trailers || []).find((t) => t.id === j.trailer)?.reg;
    const cust = (data.customers || []).find((c) => c.id === j.customerId);
    const del = (data.customers || []).find((c) => c.id === j.deliveryCustomerId);
    const drv = (data.drivers || []).find((d) => d.id === j.driver);
    return {
        ...j,
        _driverPhone: drv?.phone || '',
        _turnboyDisplay: turnboyName,
        _trailerReg: trailerReg || "",
        _billingCustomerName: cust?.name || "",
        _deliveryCustomerName: del?.name || "",
    };
}

function getDriverData(driverId, settings = {}) {
    const data = readTrackerData();

    const driver = data.drivers.find(d => d.id === driverId);
    if (!driver) return null;

    const truck = driver.truck ? data.trucks.find(t => t.id === driver.truck) : null;

    const journeys = data.journeys
        .filter(j => j.driver === driverId)
        .sort((a, b) => b.date.localeCompare(a.date));

    const activeJourneys = journeys
        .filter(j => ['Loading', 'Approved', 'In Transit', 'Awaiting Start Verification', 'Awaiting Verification'].includes(j.status))
        .map(j => enrichJourneyForPortal(j, data));
    const completedJourneys = journeys
        .filter(j => j.status === 'Completed')
        .map(j => enrichJourneyForPortal(j, data));

    const fuelEntries = data.fuel
        .filter(f => f._submittedBy === driverId || f.driver === driverId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20);

    const payslips = data.payroll
        .filter(p => p.driver === driverId)
        .sort((a, b) => b.month.localeCompare(a.month));

    // Total expense history for this truck/driver
    const expenseEntries = (data.expenses || [])
        .filter(e => e.truck === driver.truck || e.driver === driverId || e._submittedBy === driverId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20);

    // Incident history for this driver
    const incidentEntries = (data.incidents || [])
        .filter(i => i.driverId === driverId || i.driver === driverId)
        .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
        .slice(0, 20);

    // Maintenance history for this truck (subset of expenses)
    const maintenanceHistory = expenseEntries
        .filter(e => e.cat === 'Maintenance');

    // Tyre status calculation
    let tyreInfo = null;
    if (truck) {
        const kmSince = truck.odom - truck.tyreOdom;
        const remaining = truck.tyreLimit - kmSince;
        const pct = Math.min(100, (kmSince / truck.tyreLimit) * 100);
        tyreInfo = {
            kmSinceChange: kmSince,
            remaining,
            pct: pct.toFixed(1),
            status: remaining <= 0 ? 'Overdue' : remaining <= 5000 ? 'Due Soon' : 'OK',
        };
    }

    const customers = (data.customers || []).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        type: c.type || 'Individual',
    }));

    return {
        driver,
        truck,
        tyreInfo,
        activeJourneys,
        completedJourneys,
        fuelEntries,
        expenseEntries,
        incidentEntries,
        maintenanceHistory,
        payslips,
        customers,
        profilePermissions: data.profilePermissions || null,
        settings: settings || {},
    };
}

function updateJourneyPartyCustomers(driverId, journeyId, body = {}) {
    const data = readTrackerData();
    const journey = data.journeys.find((j) => j.id === journeyId && j.driver === driverId);
    if (!journey) return { success: false, error: 'Journey not found or not assigned to you' };
    const driver = data.drivers.find((d) => d.id === driverId);
    if (
        driver?.lockVehicleAssignment &&
        journey.truck &&
        driver.truck &&
        journey.truck !== driver.truck
    ) {
        return {
            success: false,
            error: 'This trip is on a different vehicle than your office assignment. Contact the office.',
        };
    }
    if (journey.status !== 'Loading') {
        return { success: false, error: 'Customers can only be set while the trip is waiting to start' };
    }

    data.customers = data.customers || [];

    const addNew = (obj) => {
        if (!obj || !String(obj.name || '').trim()) return null;
        const normalizedName = String(obj.name).trim().toLowerCase();
        const existing = data.customers.find(c => c.name.trim().toLowerCase() === normalizedName);
        if (existing) return existing.id;
        
        const id =
            'C' +
            Date.now().toString(36).toUpperCase() +
            Math.random().toString(36).slice(2, 5).toUpperCase();
        const type = obj.type === 'Company' ? 'Company' : 'Individual';
        const email = obj.email != null ? String(obj.email).trim() : '';
        data.customers.push({
            id,
            uId: generateUId(data, 'customers'),
            name: String(obj.name).trim(),
            phone: String(obj.phone || '').trim(),
            email,
            type,
            status: 'Active',
        });
        return id;
    };

    let billingId = body.customerId && String(body.customerId).trim();
    let deliveryId = body.deliveryCustomerId && String(body.deliveryCustomerId).trim();

    const billingType = body.billingType || body.newBillingCustomer?.type || 'Individual';
    const deliveryType = body.deliveryType || body.newDeliveryCustomer?.type || 'Individual';
    const billingEmail = body.billingEmail || body.newBillingCustomer?.email || '';
    const deliveryEmail = body.deliveryEmail || body.newDeliveryCustomer?.email || '';

    // Enforce email rules for companies
    if (String(billingType) === 'Company' && !String(billingEmail).trim()) {
        return { success: false, error: 'Billing customer email is required for companies' };
    }
    if (String(deliveryType) === 'Company' && !String(deliveryEmail).trim()) {
        return { success: false, error: 'Delivery customer email is required for companies' };
    }

    if (!billingId && body.newBillingCustomer) billingId = addNew({ ...body.newBillingCustomer, type: billingType });
    if (!deliveryId && body.newDeliveryCustomer) deliveryId = addNew({ ...body.newDeliveryCustomer, type: deliveryType });

    if (!billingId || !deliveryId) {
        return { success: false, error: 'Choose or create both billing and delivery customers' };
    }

    if (!data.customers.some((c) => c.id === billingId)) {
        return { success: false, error: 'Billing customer not found' };
    }
    if (!data.customers.some((c) => c.id === deliveryId)) {
        return { success: false, error: 'Delivery customer not found' };
    }

    // If driver provided email/type edits, persist them to existing customer records.
    if (billingId && (body.billingEmail != null || body.billingType != null)) {
        const c = data.customers.find((x) => x.id === billingId);
        if (c) {
            if (body.billingType != null) c.type = String(body.billingType) === 'Company' ? 'Company' : 'Individual';
            if (body.billingEmail != null) c.email = String(body.billingEmail).trim();
        }
    }
    if (deliveryId && (body.deliveryEmail != null || body.deliveryType != null)) {
        const c = data.customers.find((x) => x.id === deliveryId);
        if (c) {
            if (body.deliveryType != null) c.type = String(body.deliveryType) === 'Company' ? 'Company' : 'Individual';
            if (body.deliveryEmail != null) c.email = String(body.deliveryEmail).trim();
        }
    }

    journey.customerId = billingId;
    journey.deliveryCustomerId = deliveryId;
    writeTrackerData(data);
    return { success: true, journey: enrichJourneyForPortal(journey, data) };
}

function createJourneyStartRequest(driverId, payload = {}) {
    const data = readTrackerData();
    const driver = data.drivers.find((d) => d.id === driverId);
    if (!driver) return { success: false, error: 'Driver not found' };
    const truck = driver.truck && String(driver.truck).trim();
    if (!truck) return { success: false, error: 'No vehicle assigned — contact the office' };

    const existingActives = activeJourneysForDriver(data, driverId);
    if (existingActives.length > 0) {
        const s = existingActives.map((j) => `${j.id} (${j.status})`).join(', ');
        return { success: false, error: `Finish your previous trip first. Open trip(s): ${s}` };
    }

    const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
    const journeyId = uid();
    const date = payload.date || new Date().toISOString().split('T')[0];

    // Create a placeholder journey record in Loading so we can re-use the existing
    // customer-assignment logic and then transition to Awaiting Start Verification.
    const journeyUId = generateUId(data, 'journeys');
    data.journeys.push({
        id: journeyId,
        uId: journeyUId,
        driver: driverId,
        truck,
        trailer: payload.trailer || '',
        origin: payload.origin || '',
        dest: payload.dest || '',
        cargo: payload.cargo || '',
        weight: payload.weight != null && payload.weight !== '' ? +payload.weight : '',
        notes: payload.notes || '',
        date,
        status: 'Loading',
        customerId: '',
        deliveryCustomerId: '',
        startOdom: null,
        startOdomPhotoUrl: null,
        startedAt: null,
        waybillNo: null,
        waybillGenerated: false,
        waybillData: null,
    });

    writeTrackerData(data);

    // 1) Save customers (billing + delivery) to the new journey
    const customersResult = updateJourneyPartyCustomers(driverId, journeyId, payload);
    if (!customersResult.success) return customersResult;

    // 2) Move it to office start-verification with required odometer proof.
    const startResult = updateJourneyStatus(driverId, journeyId, 'Awaiting Start Verification', {
        origin: payload.origin,
        dest: payload.dest,
        cargo: payload.cargo,
        weight: payload.weight,
        notes: payload.notes,
        startOdom: payload.startOdom,
        startOdomPhotoUrl: payload.startOdomPhotoUrl,
    });
    return startResult;
}

function createJourneyStartPlaceholder(driverId, payload = {}) {
    const data = readTrackerData();
    const driver = data.drivers.find((d) => d.id === driverId);
    if (!driver) return { success: false, error: 'Driver not found' };
    const truck = driver.truck && String(driver.truck).trim();
    if (!truck) return { success: false, error: 'No vehicle assigned — contact the office' };

    const existingActives = activeJourneysForDriver(data, driverId);
    if (existingActives.length > 0) {
        const s = existingActives.map((j) => `${j.id} (${j.status})`).join(', ');
        return { success: false, error: `Finish your previous trip first. Open trip(s): ${s}` };
    }

    const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
    const journeyId = uid();
    const date = payload.date || new Date().toISOString().split('T')[0];

    data.journeys.push({
        id: journeyId,
        driver: driverId,
        truck,
        trailer: payload.trailer || '',
        origin: payload.origin || '',
        dest: payload.dest || '',
        cargo: payload.cargo || '',
        weight: payload.weight != null && payload.weight !== '' ? +payload.weight : '',
        notes: payload.notes || '',
        date,
        status: 'Loading',
        customerId: '',
        deliveryCustomerId: '',
        startOdom: null,
        startOdomPhotoUrl: null,
        startedAt: null,
        waybillNo: null,
        waybillGenerated: false,
        waybillData: null,
    });

    writeTrackerData(data);
    // Return enriched view for display in driver portal.
    return { success: true, journey: enrichJourneyForPortal(data.journeys.find(j => j.id === journeyId), data) };
}

function otherActiveJourneys(data, driverId, excludeJourneyId) {
    return (data.journeys || []).filter(
        (j) =>
            j.driver === driverId &&
            j.id !== excludeJourneyId &&
            !['Completed', 'Cancelled'].includes(j.status)
    );
}

const ACTIVE_JOURNEY_STATUSES = ['Loading', 'Approved', 'In Transit', 'Awaiting Start Verification', 'Awaiting Verification'];

function activeJourneysForDriver(data, driverId) {
    return (data.journeys || []).filter(
        (j) => j.driver === driverId && ACTIVE_JOURNEY_STATUSES.includes(j.status)
    );
}

/**
 * Server-side guard: resolve truck from driver record, reject tampered truck in body,
 * validate optional journey belongs to driver and matches assignment rules.
 */
function validateDriverSubmission(driverId, payload = {}) {
    const data = readTrackerData();
    const driver = data.drivers.find((d) => d.id === driverId);
    if (!driver) return { success: false, error: 'Driver not found' };

    const assignedTruck = driver.truck && String(driver.truck).trim();
    if (!assignedTruck) {
        return { success: false, error: 'No vehicle assigned — contact the office' };
    }

    const clientTruck = payload.truck != null && String(payload.truck).trim();
    if (clientTruck && clientTruck !== assignedTruck) {
        const msg = driver.lockVehicleAssignment
            ? 'Vehicle is locked to your office assignment — cannot use a different truck'
            : 'Truck must match your assigned vehicle';
        return { success: false, error: msg };
    }

    let journeyId = payload.journey != null ? String(payload.journey).trim() : '';
    const actives = activeJourneysForDriver(data, driverId);

    if (journeyId) {
        const j = data.journeys.find((x) => x.id === journeyId);
        if (!j || j.driver !== driverId) {
            return { success: false, error: 'Trip not found or not assigned to you' };
        }
        if (!ACTIVE_JOURNEY_STATUSES.includes(j.status)) {
            return { success: false, error: 'That trip is finished — choose an active trip or leave trip blank' };
        }
        if (j.truck && j.truck !== assignedTruck) {
            return { success: false, error: 'That trip is not on your assigned vehicle — contact the office' };
        }
    } else if (actives.length === 1) {
        journeyId = actives[0].id;
    }

    return { success: true, truck: assignedTruck, journey: journeyId };
}

function updateJourneyStatus(driverId, journeyId, newStatus, extras = {}) {
    const data = readTrackerData();
    const journey = data.journeys.find(j => j.id === journeyId && j.driver === driverId);
    if (!journey) return { success: false, error: 'Journey not found or not assigned to you' };

    const driver = data.drivers.find((d) => d.id === driverId);
    if (
        driver?.lockVehicleAssignment &&
        journey.truck &&
        driver.truck &&
        journey.truck !== driver.truck
    ) {
        return {
            success: false,
            error: 'This trip is on a different vehicle than your office assignment. Contact the office.',
        };
    }

    // Cannot submit a new start request while another trip is still open
    if (newStatus === 'Awaiting Start Verification' && journey.status === 'Loading') {
        const others = otherActiveJourneys(data, driverId, journeyId);
        if (others.length > 0) {
            const s = others.map((j) => `${j.id} (${j.status})`).join(', ');
            return {
                success: false,
                error: `Finish your previous trip first (office must approve completion). Open trip(s): ${s}`,
            };
        }
        if (!journey.customerId || !journey.deliveryCustomerId) {
            return {
                success: false,
                error:
                    'Billing customer and delivery customer must be set before you start. Add them below or ask the office.',
            };
        }
    }

    // Valid driver-initiated transitions only
    const validDriverTransitions = {
        'Loading': ['Awaiting Start Verification'],
        'Approved': ['Loading', 'In Transit'],
        'In Transit': ['Awaiting Verification'],
        // Drivers cannot set Completed — only admin can do that
    };

    if (!validDriverTransitions[journey.status]?.includes(newStatus)) {
        return {
            success: false,
            error: journey.status === 'Awaiting Verification'
                ? 'This trip is waiting for office verification. You cannot make changes until it is reviewed.'
                : `Cannot change status from ${journey.status} to ${newStatus}`,
        };
    }

    // For Awaiting Start Verification: require start odometer + photo
    if (newStatus === 'Awaiting Start Verification') {
        // Driver may fill missing trip details during loading before requesting office approval.
        if (extras.origin != null) journey.origin = String(extras.origin).trim();
        if (extras.dest != null) journey.dest = String(extras.dest).trim();
        if (extras.cargo != null) journey.cargo = String(extras.cargo).trim();
        if (extras.weight != null && extras.weight !== '') journey.weight = +extras.weight;
        if (extras.notes != null) journey.notes = String(extras.notes).trim();

        if (!extras.startOdom) return { success: false, error: 'Start odometer reading is required' };
        if (!extras.startOdomPhotoUrl) return { success: false, error: 'Start odometer photo is required' };
        journey.startOdom = +extras.startOdom;
        journey.startOdomPhotoUrl = extras.startOdomPhotoUrl;
        journey.submittedStartForVerificationAt = new Date().toISOString();
        journey._pendingStartVerification = true;
        journey._rejectionReason = null; // clear any previous rejection
    }

    // For Awaiting Verification: require end odometer + photo + delivery proof
    if (newStatus === 'Awaiting Verification') {
        if (!extras.endOdom) return { success: false, error: 'End odometer reading is required before submitting for verification' };
        if (!extras.endOdomPhotoUrl) return { success: false, error: 'End odometer photo is required before submitting for verification' };
        if (!extras.deliveryProofUrl) return { success: false, error: 'Delivery proof photo is required before submitting for verification' };

        journey.endOdom = +extras.endOdom;
        journey.endOdomPhotoUrl = extras.endOdomPhotoUrl;
        journey.deliveryProofUrl = extras.deliveryProofUrl;
        journey.submittedForVerificationAt = new Date().toISOString();
        journey._pendingVerification = true;
        journey._rejectionReason = null; // clear any previous rejection
    }

    if (newStatus === 'In Transit' && !journey.startedAt) {
        journey.startedAt = new Date().toISOString();
    }
    journey.status = newStatus;
    writeTrackerData(data);
    return { success: true, journey };
}

function verifyJourneyCompletion(journeyId, approved, rejectionReason = '', rejectedFields = []) {
    const data = readTrackerData();
    const journey = data.journeys.find(j => j.id === journeyId);
    if (!journey) return { success: false, error: 'Journey not found' };
    const status = journey.status;

    if (status === 'Awaiting Start Verification') {
        if (approved) {
            journey.status = 'Approved';
            journey._pendingStartVerification = false;
            journey._rejectionReason = null;
            journey._rejectedFields = null;
            // startedAt will be set when the driver actually presses "Start Trip"
            journey._startVerifiedAt = new Date().toISOString();
        } else {
            journey.status = 'Loading';
            journey._pendingStartVerification = false;
            journey._rejectionReason = rejectionReason || 'Start verification rejected by office';
            journey._rejectedFields = rejectedFields || [];
            journey._rejectedAt = new Date().toISOString();
            // We no longer clear startOdom/photo so the driver can just fix the specific field.
            // But we reset the submission timestamp.
            journey.submittedStartForVerificationAt = null;
        }
    } else if (status === 'Awaiting Verification') {
        if (approved) {
            journey.status = 'Completed';
            journey.endDate = new Date().toISOString().split('T')[0];
            journey._pendingVerification = false;
            journey._verifiedAt = new Date().toISOString();
            journey._rejectionReason = null;
            journey._rejectedFields = null;

            // Update truck odometer with verified end reading
            if (journey.endOdom) {
                const truck = data.trucks.find(t => t.id === journey.truck);
                if (truck && journey.endOdom > truck.odom) {
                    truck.odom = journey.endOdom;
                }
            }
        } else {
            // Rejected — send back to In Transit, driver must resubmit
            journey.status = 'In Transit';
            journey._pendingVerification = false;
            journey._rejectionReason = rejectionReason || 'Verification rejected by office';
            journey._rejectedFields = rejectedFields || [];
            journey._rejectedAt = new Date().toISOString();
            // Preserving end data for fix/resubmit
            journey.submittedForVerificationAt = null;
        }
    } else {
        return { success: false, error: `Journey is ${status}, not awaiting start/completion verification` };
    }

    writeTrackerData(data);
    return { success: true, journey, approved, action: status === 'Awaiting Start Verification' ? 'start' : 'completion' };
}

function addPendingSubmission(driverId, type, payload) {
    const v = validateDriverSubmission(driverId, payload);
    if (!v.success) return v;

    const data = readTrackerData();
    const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
    const truck = v.truck;
    const journey = v.journey || '';

    if (type === 'fuel') {
        const entry = {
            id: uid(),
            uId: generateUId(data, 'fuel'),
            truck,
            date: payload.date || new Date().toISOString().split('T')[0],
            litres: +payload.litres,
            pricePerL: +payload.pricePerL,
            station: payload.station,
            odom: +payload.odom || 0,
            photoPump: payload.photoPump || '',
            photoReceipt: payload.photoReceipt || payload.receiptUrl || '', // fallback for old name
            photoOdom: payload.photoOdom || payload.odomPhotoUrl || '', // fallback for old name
            journey,
            _pendingApproval: (data.profilePermissions?.driverPortal?.fuelVerification !== false),
            _submittedBy: driverId,
            _submittedAt: new Date().toISOString(),
        };
        data.fuel.push(entry);
    }

    if (type === 'expense') {
        const entry = {
            id: uid(),
            uId: generateUId(data, 'expenses'),
            truck,
            date: payload.date || new Date().toISOString().split('T')[0],
            cat: payload.cat,
            amount: +payload.amount,
            desc: payload.cat === 'Maintenance' && payload.task 
                ? (payload.task + (payload.desc ? ' — ' + payload.desc : ''))
                : (payload.desc || ''),
            journey,
            receiptUrl: payload.receiptUrl || '',
            _pendingApproval: (data.profilePermissions?.driverPortal?.expenseVerification !== false),
            _submittedBy: driverId,
            _submittedAt: new Date().toISOString(),
        };
        // Add specific maintenance details if it's maintenance
        if (payload.cat === 'Maintenance') {
            entry._maintenanceDetails = {
                task: payload.task || 'General Maintenance',
                cost: +payload.amount || 0,
                receiptUrl: payload.receiptUrl || '',
                notes: payload.desc || '',
            };
        }
        data.expenses.push(entry);
    }

    if (type === 'incident') {
        if (!data.incidents) data.incidents = [];
        data.incidents.push({
            id: uid(),
            uId: generateUId(data, 'incidents'),
            driverId,
            truck,
            journey,
            incidentType: payload.incidentType,
            description: payload.description,
            location: payload.location,
            incidentPhotoUrl: payload.incidentPhotoUrl,
            status: 'Open',
            _pendingApproval: true,
            createdAt: new Date().toISOString(),
        });
    }

    if (type === 'maintenance') {
        if (!data.expenses) data.expenses = [];
        // Maintenance logs as an expense with cat 'Maintenance' + pending approval
        data.expenses.push({
            id: uid(),
            uId: generateUId(data, 'expenses'),
            truck,
            date: payload.date || new Date().toISOString().split('T')[0],
            cat: 'Maintenance',
            amount: +payload.cost || 0,
            desc: payload.task + (payload.notes ? ' — ' + payload.notes : ''),
            journey,
            _pendingApproval: true,
            _submittedBy: driverId,
            _submittedAt: new Date().toISOString(),
            _maintenanceDetails: {
                task: payload.task,
                workshop: payload.workshop || '',
                cost: +payload.cost || 0,
                odomReading: +payload.odomReading || 0,
                receiptUrl: payload.receiptUrl || '',
                notes: payload.notes || '',
            },
        });
    }

    writeTrackerData(data);
    const msgMap = { fuel: 'Fuel log submitted', expense: 'Expense claim submitted', incident: 'Incident report submitted', maintenance: 'Maintenance log submitted' };
    return { success: true, message: msgMap[type] || 'Submitted successfully' };
}

module.exports = {
    readTrackerData,
    writeTrackerData,
    getDriverData,
    updateJourneyStatus,
    verifyJourneyCompletion,
    addPendingSubmission,
    updateJourneyPartyCustomers,
    enrichJourneyForPortal,
    createJourneyStartRequest,
    createJourneyStartPlaceholder,
};
