// ═══════════════════════════════════════════════════════════════════
// SEGECHA — CSV/EXCEL IMPORT ENGINE
// Handles CSV parsing, dynamic header mapping, row-level validation
// ═══════════════════════════════════════════════════════════════════

import { uid } from './formatters';
import { CATS, MAX_FUEL_LITRES } from '../constants/nav';

// ─── Import Schemas ──────────────────────────────────────────────

export const IMPORT_SCHEMAS = {
    journeys: {
        label: 'Journeys',
        requiredFields: ['origin', 'dest', 'date', 'truck', 'driver', 'revenue', 'distance', 'status'],
        optionalFields: ['endDate', 'cargo', 'weight', 'notes'],
        fieldAliases: {
            origin: ['origin', 'from', 'departure', 'start'],
            dest: ['dest', 'destination', 'to', 'arrival'],
            date: ['date', 'departure date', 'trip date', 'start date'],
            endDate: ['enddate', 'end date', 'arrival date', 'return date'],
            truck: ['truck', 'vehicle', 'truck id', 'vehicle reg', 'reg'],
            driver: ['driver', 'driver id', 'driver name'],
            revenue: ['revenue', 'income', 'gross income', 'amount'],
            distance: ['distance', 'km', 'distance covered', 'standard distance'],
            cargo: ['cargo', 'goods', 'description', 'cargo description'],
            weight: ['weight', 'tonnes', 'weight (tonnes)'],
            status: ['status', 'trip status'],
            notes: ['notes', 'remarks', 'comment'],
        },
        validate: (row, data) => {
            const errors = [];
            if (!row.origin || String(row.origin).trim() === '') errors.push('Origin is required');
            if (!row.dest || String(row.dest).trim() === '') errors.push('Destination is required');
            if (!row.date) errors.push('Date is required');
            if (!row.revenue || isNaN(+row.revenue) || +row.revenue <= 0) errors.push(`Revenue must be a positive number (got: ${row.revenue})`);
            if (!row.distance || isNaN(+row.distance) || +row.distance <= 0) errors.push(`Distance must be a positive number (got: ${row.distance})`);
            if (row.weight && isNaN(+row.weight)) errors.push(`Weight must be a number (got: ${row.weight})`);
            if (row.endDate && row.date && new Date(row.endDate) < new Date(row.date)) errors.push('Arrival date cannot be before departure date');
            if (!row.status || !['Loading', 'In Transit', 'Completed', 'Cancelled'].includes(row.status))
                errors.push(`Status must be one of: Loading, In Transit, Completed, Cancelled (got: ${row.status})`);
            const truck = data.trucks.find(t => t.id === row.truck || t.reg?.toLowerCase() === String(row.truck || '').toLowerCase());
            if (!truck) errors.push(`Truck not found: "${row.truck}" — must match an existing truck registration or ID`);
            else row._truckId = truck.id;
            const driver = data.drivers.find(d => d.id === row.driver || d.name?.toLowerCase() === String(row.driver || '').toLowerCase());
            if (!driver) errors.push(`Driver not found: "${row.driver}" — must match an existing driver name or ID`);
            else row._driverId = driver.id;
            return errors;
        },
        transform: (row) => ({
            id: uid(), origin: String(row.origin).trim(), dest: String(row.dest).trim(),
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0],
            endDate: row.endDate ? (row.endDate instanceof Date ? row.endDate.toISOString().split('T')[0] : String(row.endDate).split('T')[0]) : '',
            truck: row._truckId || row.truck, driver: row._driverId || row.driver,
            revenue: +row.revenue, distance: +row.distance, cargo: row.cargo || '',
            weight: row.weight ? +row.weight : 0, status: row.status, notes: row.notes || '',
        }),
        collection: 'journeys',
    },
    fuel: {
        label: 'Fuel Entries',
        requiredFields: ['truck', 'date', 'litres', 'pricePerL', 'station'],
        optionalFields: ['odom', 'journey'],
        fieldAliases: {
            truck: ['truck', 'vehicle', 'truck id', 'vehicle reg', 'reg'],
            date: ['date', 'fill date', 'fuel date'],
            litres: ['litres', 'liters', 'fuel (l)', 'fuel(l)', 'quantity'],
            pricePerL: ['priceperl', 'price per litre', 'price/l', 'fuel price (per litre)'],
            station: ['station', 'fuel station', 'station name'],
            odom: ['odom', 'odometer', 'mileage', 'km reading'],
            journey: ['journey', 'journey id', 'trip'],
        },
        validate: (row) => {
            const errors = [];
            if (!row.litres || isNaN(+row.litres) || +row.litres <= 0) errors.push(`Litres must be a positive number (got: ${row.litres})`);
            if (+row.litres > MAX_FUEL_LITRES) errors.push(`Litres exceeds maximum per fill (${MAX_FUEL_LITRES}L). Got: ${row.litres}`);
            if (!row.pricePerL || isNaN(+row.pricePerL) || +row.pricePerL <= 0) errors.push(`Price per litre must be a positive number (got: ${row.pricePerL})`);
            if (!row.station || String(row.station).trim() === '') errors.push('Station name is required');
            if (!row.date) errors.push('Date is required');
            return errors;
        },
        transform: (row, data) => {
            const truck = data.trucks.find(t => t.id === row.truck || t.reg?.toLowerCase() === String(row.truck || '').toLowerCase());
            return {
                id: uid(), truck: truck?.id || row.truck,
                date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0],
                litres: +row.litres, pricePerL: +row.pricePerL, station: String(row.station).trim(),
                odom: row.odom ? +row.odom : 0, journey: row.journey || '',
            };
        },
        collection: 'fuel',
    },
    expenses: {
        label: 'Expenses',
        requiredFields: ['truck', 'date', 'cat', 'amount', 'desc'],
        optionalFields: ['journey'],
        fieldAliases: {
            truck: ['truck', 'vehicle', 'truck id', 'vehicle reg', 'reg'],
            date: ['date', 'expense date'],
            cat: ['cat', 'category', 'type', 'expense type'],
            amount: ['amount', 'cost', 'expense amount', 'ksh', 'kes'],
            desc: ['desc', 'description', 'details', 'notes'],
            journey: ['journey', 'journey id', 'trip'],
        },
        validate: (row) => {
            const errors = [];
            if (!row.cat || !CATS.includes(row.cat)) errors.push(`Category must be one of: ${CATS.join(', ')} (got: ${row.cat})`);
            if (!row.amount || isNaN(+row.amount) || +row.amount <= 0) errors.push(`Amount must be a positive number (got: ${row.amount})`);
            if (!row.desc || String(row.desc).trim() === '') errors.push('Description is required');
            if (!row.date) errors.push('Date is required');
            return errors;
        },
        transform: (row, data) => {
            const truck = data.trucks.find(t => t.id === row.truck || t.reg?.toLowerCase() === String(row.truck || '').toLowerCase());
            return {
                id: uid(), truck: truck?.id || row.truck,
                date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0],
                cat: row.cat, amount: +row.amount, desc: String(row.desc).trim(), journey: row.journey || '',
            };
        },
        collection: 'expenses',
    },
};

// ─── Header Resolution ──────────────────────────────────────────

const resolveHeaders = (rawHeaders, aliases) => {
    const map = {};
    rawHeaders.forEach((h, i) => {
        const normalised = String(h || '').toLowerCase().trim();
        for (const [field, aliasList] of Object.entries(aliases)) {
            if (aliasList.includes(normalised) && !(field in map)) map[field] = i;
        }
    });
    return map;
};

// ─── Main Import Runner ─────────────────────────────────────────

export const runImport = async (file, entityType, data, setData, setImportResult, setShowImportPanel) => {
    const schema = IMPORT_SCHEMAS[entityType];
    if (!schema) return;

    let rawRows = [];
    try {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            setImportResult({
                entityType, imported: [], errors: [{
                    row: 'File', fields: [],
                    messages: ['Excel (.xlsx) files are not supported yet. Please save your spreadsheet as CSV (.csv) first, then import the CSV file.']
                }], fatalError: true
            });
            setShowImportPanel(true);
            return;
        }
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { setImportResult({ entityType, imported: [], errors: [{ row: 'File', fields: [], messages: ['File is empty or has no data rows.'] }], fatalError: true }); setShowImportPanel(true); return; }
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        rawRows = lines.slice(1).map((line, i) => {
            const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
            const obj = {};
            headers.forEach((h, j) => { obj[h] = vals[j] ?? ''; });
            obj._row = i + 2;
            return obj;
        });
    } catch (err) {
        setImportResult({ entityType, imported: [], errors: [{ row: 'File', fields: [], messages: [`Could not read file: ${err.message}`] }], fatalError: true });
        setShowImportPanel(true);
        return;
    }

    const allHeaders = rawRows.length > 0 ? Object.keys(rawRows[0]).filter(k => k !== '_row') : [];
    const headerMap = resolveHeaders(allHeaders, schema.fieldAliases);
    const missingColumns = schema.requiredFields.filter(f => !(f in headerMap));

    const mappedRows = rawRows.map(raw => {
        const mapped = { _row: raw._row };
        for (const [field, idx] of Object.entries(headerMap)) {
            mapped[field] = raw[allHeaders[idx]];
        }
        return mapped;
    });

    const imported = [], errors = [];
    if (missingColumns.length > 0) {
        errors.push({
            row: 'File Header', fields: missingColumns, messages: [
                `Required columns not found: ${missingColumns.join(', ')}`,
                `Columns detected: ${allHeaders.join(', ')}`,
                `Expected aliases: ${missingColumns.map(f => schema.fieldAliases[f]?.join(' / ')).join(' | ')}`,
            ]
        });
    }

    if (missingColumns.length < schema.requiredFields.length) {
        for (const row of mappedRows) {
            const rowErrors = schema.validate(row, data);
            if (rowErrors.length > 0) {
                const badFields = [];
                const check = (keywords, field) => { if (rowErrors.some(e => keywords.some(k => e.toLowerCase().includes(k)))) badFields.push(field); };
                check(['origin'], 'origin'); check(['destination', 'dest'], 'dest'); check(['date'], 'date');
                check(['revenue'], 'revenue'); check(['distance'], 'distance'); check(['litres'], 'litres');
                check(['price'], 'pricePerL'); check(['station'], 'station'); check(['amount'], 'amount');
                check(['category'], 'cat'); check(['status'], 'status'); check(['truck'], 'truck');
                check(['driver'], 'driver'); check(['weight'], 'weight'); check(['description'], 'desc');
                errors.push({ row: row._row, fields: badFields, messages: rowErrors, rawValues: Object.fromEntries(Object.entries(row).filter(([k]) => k !== '_row')) });
            } else {
                try { imported.push(schema.transform(row, data)); } catch (e) { errors.push({ row: row._row, fields: [], messages: [`Transform failed: ${e.message}`] }); }
            }
        }
    }

    if (imported.length > 0) setData(d => ({ ...d, [schema.collection]: [...d[schema.collection], ...imported] }));
    setImportResult({ entityType, schema: schema.label, imported, errors, totalRows: mappedRows.length });
    setShowImportPanel(true);
};
