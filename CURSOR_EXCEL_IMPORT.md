# Segecha — Excel Import from Trucking_2025.xlsx
# Cursor AI Prompt — File: src/App.jsx only

## What this builds

A full Excel import pipeline that reads `Trucking_2025.xlsx` and maps its sheets
to the tracker's data model. Every row that fails validation is shown in an editable
review table — the user can fix values inline and accept or discard each row
individually before committing the import.

---

## Excel file structure (already analysed — do not re-parse)

### Sheet: `Trips_2025`
**Headers (row 2, 0-indexed col 1 onward):**
```
Vehicle | Date | Origin | Destination | Start ODO | End ODO |
Distance covered | Standard Distance | Mileage (km) | Fuel(L) |
Fuel Price (Per Litre) | Gross Income | Deposit Received | Fuel Cost |
Driver Millage | Turn-Boy | Road Users fee | Other Expenses |
Total Expense | Net Income | Money Deposited at Bank | Date Deposited |
Difference | Gross Income2 | Progress Tracking | Cost per KMs |
Profit Margin | Fuel Efficiency
```
**Maps to:** `data.journeys` (trip records) + `data.fuel` (fuel entries) + `data.expenses` (driver mileage, road users fee, other expenses)

**Key column mappings:**
- `Vehicle` → journey.truck (match by reg plate)
- `Date` → journey.date
- `Origin` → journey.origin
- `Destination` → journey.dest
- `Standard Distance` → journey.distance (use this, not "Distance covered" which is odometer delta)
- `Gross Income` → journey.revenue
- `Progress Tracking` → journey.status (map: "Awaiting Payment"→"In Transit", "Pending Return"→"In Transit", "Deposit Only"→"In Transit", "Fully Paid"→"Completed", null→"Completed")
- `Fuel(L)` → fuel.litres
- `Fuel Price (Per Litre)` → fuel.pricePerL
- `Driver Millage` → expense entry (cat: "Allowance", desc: "Driver mileage allowance")
- `Turn-Boy` → expense entry (cat: "Allowance", desc: "Turnboy allowance") — if non-null
- `Road Users fee` → expense entry (cat: "Toll", desc: "Road users fee")
- `Other Expenses` → expense entry (cat: "Other", desc: "Other trip expenses")

**Required fields for a valid journey row:** `Vehicle`, `Date`, `Origin`, `Destination`, `Standard Distance`, `Gross Income`
**Required fields for a valid fuel row:** `Vehicle`, `Date`, `Fuel(L)`, `Fuel Price (Per Litre)`

---

### Sheet: `Fixed_Expenses`
**Headers (row 2):** `Expense Item | Cost | Frequency | Jan | Feb | Mar | Apr | ...`
**Maps to:** `data.expenses` — one expense entry per month per item (where monthly value > 0)

**Column mappings:**
- `Expense Item` → expense.desc
- Monthly value (Jan=col 3, Feb=col 4, etc.) → expense.amount
- Frequency → used only for display/notes, not stored
- Date → first day of the month column (e.g. Jan 2025 = 2025-01-01)
- Cat → "Insurance" for items containing "insurance", "Permit" for "licence/permits/COMESA/NTSA", "Salary" for "salaries", else "Other"

**Required:** Expense Item name + at least one month with a value > 0

---

### Sheet: `Maintenance`
**Headers (row 3):** `Vehicle Reg | Vehicle Type | Task | Frequency | Qty | Cost | Date Undertaken | Next Due | Odometer Reading | Notes | Additional Notes`
**Maps to:** `data.expenses` (cat: "Maintenance") with `_maintenanceDetails`

**Column mappings:**
- `Vehicle Reg` → expense.truck (match by reg plate)
- `Task` → expense.desc + `_maintenanceTask`
- `Cost` → expense.amount (skip rows where Cost is null, "???" or 0)
- `Date Undertaken` → expense.date
- `Odometer Reading` → `_maintenanceDetails.odomReading`
- `Notes` + `Additional Notes` → `_maintenanceDetails.notes`

**Required:** Vehicle Reg + Cost (numeric, > 0) + Date Undertaken

---

## PART A — Import Engine (pure JS, runs in the browser)

### A.1 — Install SheetJS (already available in the app via CDN)

Add to the `<head>` equivalent — inject once via useEffect:
```js
useEffect(() => {
    if (window.XLSX) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => console.log('SheetJS loaded');
    document.head.appendChild(script);
}, []);
```

### A.2 — Add import state variables

After the existing state declarations, add:
```js
const [importSession, setImportSession] = useState(null);
// importSession shape:
// {
//   fileName: string,
//   parsedAt: string (ISO),
//   sheets: {
//     trips:    { valid: [], errors: [] },
//     expenses: { valid: [], errors: [] },
//     maintenance: { valid: [], errors: [] },
//   },
//   committed: false,
// }
```

### A.3 — Add the import engine function

Find the `driverName` helper. Before it, add:

```js
// ─── EXCEL IMPORT ENGINE ─────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9).toUpperCase();

const parseExcelDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number') {
        // Excel serial date
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
    return null;
};

const findTruckByReg = (reg) => {
    if (!reg) return null;
    const clean = String(reg).trim().toUpperCase().replace(/\s+/g, ' ');
    return data.trucks.find(t =>
        t.reg.toUpperCase().replace(/\s+/g, ' ') === clean
    ) || null;
};

const parseNumeric = (val) => {
    if (val === null || val === undefined || val === '' || val === '???') return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? null : n;
};

const tripStatusMap = (progressTracking) => {
    if (!progressTracking) return 'Completed';
    const pt = String(progressTracking).toLowerCase();
    if (pt.includes('awaiting') || pt.includes('pending') || pt.includes('deposit only')) return 'In Transit';
    if (pt.includes('fully paid') || pt.includes('complete')) return 'Completed';
    return 'Completed';
};

const expenseCatFromDesc = (desc) => {
    if (!desc) return 'Other';
    const d = String(desc).toLowerCase();
    if (d.includes('insurance') || d.includes('insuarance')) return 'Insurance';
    if (d.includes('licence') || d.includes('license') || d.includes('permit') || d.includes('comesa') || d.includes('ntsa')) return 'Permit';
    if (d.includes('salary') || d.includes('salaries')) return 'Salary';
    if (d.includes('maintenance')) return 'Maintenance';
    return 'Other';
};

const runExcelImport = async (file) => {
    return new Promise((resolve, reject) => {
        if (!window.XLSX) { reject(new Error('SheetJS not loaded yet — wait a moment and try again')); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = window.XLSX.read(e.target.result, { type: 'array', cellDates: true });

                const session = {
                    fileName: file.name,
                    parsedAt: new Date().toISOString(),
                    sheets: {
                        trips:       { valid: [], errors: [] },
                        expenses:    { valid: [], errors: [] },
                        maintenance: { valid: [], errors: [] },
                    },
                    committed: false,
                };

                // ── SHEET 1: Trips_2025 ───────────────────────────────
                const tripsSheet = wb.Sheets['Trips_2025'];
                if (tripsSheet) {
                    const rows = window.XLSX.utils.sheet_to_json(tripsSheet, {
                        header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd'
                    });
                    // Row 1 (index 1) is the real header
                    const dataRows = rows.slice(2).filter(r => r.some(v => v !== null));

                    dataRows.forEach((row, idx) => {
                        const rawRow = {
                            vehicle:       row[1],
                            date:          row[2],
                            origin:        row[3],
                            destination:   row[4],
                            startOdo:      row[5],
                            endOdo:        row[6],
                            standardDist:  row[8],
                            mileageKm:     row[9],
                            fuelLitres:    row[10],
                            fuelPrice:     row[11],
                            grossIncome:   row[12],
                            depositRecvd:  row[13],
                            fuelCost:      row[14],
                            driverMileage: row[15],
                            turnboy:       row[16],
                            roadUsers:     row[17],
                            otherExp:      row[18],
                            totalExpense:  row[19],
                            netIncome:     row[20],
                            bankDeposit:   row[21],
                            dateDeposited: row[22],
                            progressTrack: row[25],
                        };

                        const errors = [];
                        const warnings = [];

                        // Resolve truck
                        const truck = findTruckByReg(rawRow.vehicle);
                        if (!rawRow.vehicle) errors.push({ field: 'Vehicle', msg: 'Vehicle registration is missing' });
                        else if (!truck) warnings.push({ field: 'Vehicle', msg: `Truck "${rawRow.vehicle}" not found in fleet — will skip truck linking` });

                        // Date
                        const date = parseExcelDate(rawRow.date);
                        if (!date) errors.push({ field: 'Date', msg: 'Date is missing or invalid' });

                        // Route
                        if (!rawRow.origin) errors.push({ field: 'Origin', msg: 'Origin is missing' });
                        if (!rawRow.destination) errors.push({ field: 'Destination', msg: 'Destination is missing' });

                        // Distance
                        const distance = parseNumeric(rawRow.standardDist);
                        if (!distance || distance <= 0) errors.push({ field: 'Standard Distance', msg: 'Standard distance is missing or zero' });

                        // Revenue
                        const revenue = parseNumeric(rawRow.grossIncome);
                        if (!revenue || revenue <= 0) errors.push({ field: 'Gross Income', msg: 'Gross income is missing or zero' });

                        // Fuel
                        const fuelLitres = parseNumeric(rawRow.fuelLitres);
                        const fuelPrice  = parseNumeric(rawRow.fuelPrice);
                        if (fuelLitres && !fuelPrice) warnings.push({ field: 'Fuel Price', msg: 'Fuel litres present but price missing — fuel entry will be skipped' });

                        // Build the mapped record
                        const mapped = {
                            _rowNum:      idx + 3,  // 1-indexed, accounting for 2 header rows
                            _sheetName:   'Trips_2025',
                            _rawVehicle:  rawRow.vehicle,

                            // Journey
                            journeyId:   uid(),
                            truck:       truck?.id || '',
                            date:        date || '',
                            origin:      rawRow.origin || '',
                            dest:        rawRow.destination || '',
                            distance:    distance || 0,
                            revenue:     revenue || 0,
                            status:      tripStatusMap(rawRow.progressTrack),
                            startOdom:   parseNumeric(rawRow.startOdo),
                            endOdom:     parseNumeric(rawRow.endOdo),

                            // Fuel
                            hasFuel:     !!(fuelLitres && fuelPrice),
                            fuelLitres:  fuelLitres || 0,
                            fuelPrice:   fuelPrice || 0,

                            // Allowances / expenses
                            driverMileage: parseNumeric(rawRow.driverMileage) || 0,
                            turnboy:       parseNumeric(rawRow.turnboy) || 0,
                            roadUsers:     parseNumeric(rawRow.roadUsers) || 0,
                            otherExp:      parseNumeric(rawRow.otherExp) || 0,

                            errors,
                            warnings,
                            accepted: errors.length === 0,  // auto-accept if no hard errors
                            edited: false,
                        };

                        if (errors.length > 0) {
                            session.sheets.trips.errors.push(mapped);
                        } else {
                            session.sheets.trips.valid.push(mapped);
                        }
                    });
                }

                // ── SHEET 2: Fixed_Expenses ───────────────────────────
                const fixedSheet = wb.Sheets['Fixed_Expenses'];
                if (fixedSheet) {
                    const rows = window.XLSX.utils.sheet_to_json(fixedSheet, { header: 1, defval: null, raw: true });
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const monthDates = months.map((_, i) => `2025-${String(i+1).padStart(2,'0')}-01`);

                    const dataRows = rows.slice(2).filter(r => r[0] !== null);

                    dataRows.forEach((row, idx) => {
                        const itemName = row[0];
                        if (!itemName) return;

                        months.forEach((month, mIdx) => {
                            const amount = parseNumeric(row[3 + mIdx]);
                            if (!amount || amount <= 0) return;

                            const errors = [];
                            const mapped = {
                                _rowNum:    idx + 3,
                                _sheetName: 'Fixed_Expenses',
                                _monthName: month,

                                expenseId:  uid(),
                                truck:      '',  // fixed expenses are company-wide
                                date:       monthDates[mIdx],
                                cat:        expenseCatFromDesc(itemName),
                                amount:     Math.round(amount),
                                desc:       `${itemName} (${month} 2025)`,

                                errors,
                                warnings: [],
                                accepted: true,
                                edited:   false,
                            };

                            if (errors.length > 0) session.sheets.expenses.errors.push(mapped);
                            else session.sheets.expenses.valid.push(mapped);
                        });
                    });
                }

                // ── SHEET 3: Maintenance ──────────────────────────────
                const maintSheet = wb.Sheets['Maintenance'];
                if (maintSheet) {
                    const rows = window.XLSX.utils.sheet_to_json(maintSheet, {
                        header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd'
                    });
                    const dataRows = rows.slice(3).filter(r => r.some(v => v !== null));

                    dataRows.forEach((row, idx) => {
                        const rawRow = {
                            vehicleReg:  row[1],
                            vehicleType: row[2],
                            task:        row[3],
                            frequency:   row[4],
                            qty:         row[5],
                            cost:        row[6],
                            dateUnder:   row[7],
                            nextDue:     row[8],
                            odomReading: row[9],
                            notes:       row[10],
                            addlNotes:   row[11],
                        };

                        const errors = [];
                        const warnings = [];

                        const truck = findTruckByReg(rawRow.vehicleReg);
                        if (!rawRow.vehicleReg) errors.push({ field: 'Vehicle Reg', msg: 'Vehicle registration is missing' });
                        else if (!truck) warnings.push({ field: 'Vehicle Reg', msg: `Truck "${rawRow.vehicleReg}" not found in fleet` });

                        const cost = parseNumeric(rawRow.cost);
                        if (!cost || cost <= 0) errors.push({ field: 'Cost', msg: 'Cost is missing, zero, or "???"' });

                        const date = parseExcelDate(rawRow.dateUnder);
                        if (!date) errors.push({ field: 'Date Undertaken', msg: 'Date undertaken is missing or invalid' });

                        const task = rawRow.task || 'Other';
                        const allNotes = [rawRow.notes, rawRow.addlNotes].filter(Boolean).join(' · ');

                        const mapped = {
                            _rowNum:    idx + 4,
                            _sheetName: 'Maintenance',
                            _rawVehicle: rawRow.vehicleReg,

                            expenseId:  uid(),
                            truck:      truck?.id || '',
                            date:       date || '',
                            cat:        'Maintenance',
                            amount:     cost || 0,
                            desc:       `${task}${allNotes ? ' — ' + allNotes : ''}`,
                            odom:       parseNumeric(rawRow.odomReading) || 0,
                            _maintenanceTask: task,
                            _maintenanceDetails: {
                                task,
                                notes: allNotes,
                                odomReading: parseNumeric(rawRow.odomReading) || 0,
                                cost: cost || 0,
                            },

                            errors,
                            warnings,
                            accepted: errors.length === 0,
                            edited:   false,
                        };

                        if (errors.length > 0) session.sheets.maintenance.errors.push(mapped);
                        else session.sheets.maintenance.valid.push(mapped);
                    });
                }

                resolve(session);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
};

const commitImport = (session) => {
    // Collect all accepted rows across all sheets
    const allTrips     = [...session.sheets.trips.valid, ...session.sheets.trips.errors].filter(r => r.accepted);
    const allExpenses  = [...session.sheets.expenses.valid, ...session.sheets.expenses.errors].filter(r => r.accepted);
    const allMaint     = [...session.sheets.maintenance.valid, ...session.sheets.maintenance.errors].filter(r => r.accepted);

    const newJourneys  = [];
    const newFuel      = [];
    const newExpenses  = [...allExpenses, ...allMaint];

    allTrips.forEach(row => {
        // Journey
        newJourneys.push({
            id:       row.journeyId,
            truck:    row.truck,
            date:     row.date,
            origin:   row.origin,
            dest:     row.dest,
            distance: row.distance,
            revenue:  row.revenue,
            status:   row.status,
            startOdom: row.startOdom,
            endOdom:   row.endOdom,
            cargo:    '',
            weight:   '',
            notes:    `Imported from ${session.fileName}`,
        });

        // Fuel entry
        if (row.hasFuel && row.fuelLitres > 0 && row.fuelPrice > 0) {
            newFuel.push({
                id:        uid(),
                truck:     row.truck,
                date:      row.date,
                litres:    row.fuelLitres,
                pricePerL: row.fuelPrice,
                station:   'Imported',
                journey:   row.journeyId,
                odom:      row.endOdom || 0,
            });
        }

        // Driver mileage allowance
        if (row.driverMileage > 0) {
            newExpenses.push({
                id:    uid(), truck: row.truck, date: row.date,
                cat:   'Allowance', amount: row.driverMileage,
                desc:  `Driver mileage allowance — ${row.origin} → ${row.dest}`,
                journey: row.journeyId, _mileageAllowance: true,
            });
        }

        // Turnboy
        if (row.turnboy > 0) {
            newExpenses.push({
                id:    uid(), truck: row.truck, date: row.date,
                cat:   'Allowance', amount: row.turnboy,
                desc:  `Turnboy allowance — ${row.origin} → ${row.dest}`,
                journey: row.journeyId,
            });
        }

        // Road users fee
        if (row.roadUsers > 0) {
            newExpenses.push({
                id:    uid(), truck: row.truck, date: row.date,
                cat:   'Toll', amount: row.roadUsers,
                desc:  `Road users fee — ${row.origin} → ${row.dest}`,
                journey: row.journeyId,
            });
        }

        // Other expenses
        if (row.otherExp > 0) {
            newExpenses.push({
                id:    uid(), truck: row.truck, date: row.date,
                cat:   'Other', amount: row.otherExp,
                desc:  `Other trip expenses — ${row.origin} → ${row.dest}`,
                journey: row.journeyId,
            });
        }
    });

    setData(d => ({
        ...d,
        journeys: [...d.journeys, ...newJourneys],
        fuel:     [...d.fuel,     ...newFuel],
        expenses: [...d.expenses, ...newExpenses],
    }));

    setImportSession(s => ({ ...s, committed: true }));
};
```

---

## PART B — Import Review UI

### B.1 — Add ImportReview page component

Place this component before the `PAGES` map:

```jsx
// ══════════════════════════════════════════════════════════════════════════
// IMPORT REVIEW
// ══════════════════════════════════════════════════════════════════════════
const ImportReview = () => {
    const session = importSession;
    const [activeSheet, setActiveSheet] = useState('trips');
    const [showValidRows, setShowValidRows] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState('');

    if (!session) {
        return (
            <div>
                <div style={S.ph}>Import Data</div>
                <div style={{ textAlign: 'center', padding: '60px 0', color: T.textFaint }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📊</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: T.textDim, marginBottom: 8 }}>No import session active</div>
                    <div style={{ fontSize: 13, marginBottom: 24 }}>Upload a Trucking_2025.xlsx file to begin</div>
                    <ImportUploadButton />
                </div>
            </div>
        );
    }

    const sheets = {
        trips:       { label: 'Trips',           data: session.sheets.trips },
        expenses:    { label: 'Fixed Expenses',   data: session.sheets.expenses },
        maintenance: { label: 'Maintenance',      data: session.sheets.maintenance },
    };

    const currentSheet = sheets[activeSheet].data;
    const errorRows    = currentSheet.errors;
    const validRows    = currentSheet.valid;
    const allRows      = [...errorRows, ...(showValidRows ? validRows : [])];

    const totalAccepted = Object.values(session.sheets).reduce((s, sh) =>
        s + [...sh.valid, ...sh.errors].filter(r => r.accepted).length, 0);
    const totalErrors   = Object.values(session.sheets).reduce((s, sh) => s + sh.errors.length, 0);
    const totalValid    = Object.values(session.sheets).reduce((s, sh) => s + sh.valid.length, 0);

    const updateRow = (sheetKey, rowNum, field, value) => {
        setImportSession(prev => {
            const updated = { ...prev };
            const sheet = updated.sheets[sheetKey];
            ['valid', 'errors'].forEach(list => {
                const idx = sheet[list].findIndex(r => r._rowNum === rowNum);
                if (idx >= 0) {
                    sheet[list][idx] = {
                        ...sheet[list][idx],
                        [field]: value,
                        edited: true,
                    };
                    // Re-validate after edit
                    const row = sheet[list][idx];
                    const stillHasErrors = row.errors.filter(e => {
                        if (e.field === 'Vehicle' && row.truck) return false;
                        if (e.field === 'Date' && row.date) return false;
                        if (e.field === 'Origin' && row.origin) return false;
                        if (e.field === 'Destination' && row.dest) return false;
                        if (e.field === 'Standard Distance' && row.distance > 0) return false;
                        if (e.field === 'Gross Income' && row.revenue > 0) return false;
                        if (e.field === 'Cost' && row.amount > 0) return false;
                        if (e.field === 'Date Undertaken' && row.date) return false;
                        if (e.field === 'Vehicle Reg' && row.truck) return false;
                        return true;
                    });
                    row.errors = stillHasErrors;
                    if (stillHasErrors.length === 0 && !row.accepted) row.accepted = true;
                }
            });
            return updated;
        });
    };

    const toggleAccept = (sheetKey, rowNum, value) => {
        setImportSession(prev => {
            const updated = { ...prev };
            ['valid', 'errors'].forEach(list => {
                const idx = updated.sheets[sheetKey][list].findIndex(r => r._rowNum === rowNum);
                if (idx >= 0) updated.sheets[sheetKey][list][idx].accepted = value;
            });
            return updated;
        });
    };

    const acceptAll = (sheetKey) => {
        setImportSession(prev => {
            const updated = { ...prev };
            ['valid', 'errors'].forEach(list => {
                updated.sheets[sheetKey][list].forEach(r => { r.accepted = true; });
            });
            return updated;
        });
    };

    const discardAll = (sheetKey) => {
        setImportSession(prev => {
            const updated = { ...prev };
            ['valid', 'errors'].forEach(list => {
                updated.sheets[sheetKey][list].forEach(r => { r.accepted = false; });
            });
            return updated;
        });
    };

    const handleCommit = () => {
        if (!window.confirm(`Import ${totalAccepted} rows into the tracker? This cannot be undone.`)) return;
        setImporting(true);
        try {
            commitImport(session);
            setImportMsg(`✅ Successfully imported ${totalAccepted} rows.`);
        } catch (err) {
            setImportMsg('❌ Import failed: ' + err.message);
        }
        setImporting(false);
    };

    // ── Row renderer for trips sheet
    const TripRow = ({ row }) => {
        const hasError = row.errors.length > 0;
        return (
            <tr style={{ background: !row.accepted ? T.surface2 : hasError ? T.redBg + '40' : T.surface, opacity: row.accepted ? 1 : 0.5 }}>
                {/* Row number */}
                <td style={{ ...S.td, fontSize: 11, color: T.textFaint, fontFamily: "'DM Mono', monospace", width: 50 }}>
                    {row._rowNum}
                    {row.edited && <span style={{ color: T.amber, marginLeft: 4, fontSize: 10 }}>✎</span>}
                </td>
                {/* Errors / warnings */}
                <td style={{ ...S.td, width: 200 }}>
                    {row.errors.map((e, i) => (
                        <div key={i} style={{ fontSize: 10, color: T.red, marginBottom: 2 }}>
                            <b>{e.field}:</b> {e.msg}
                        </div>
                    ))}
                    {row.warnings.map((w, i) => (
                        <div key={i} style={{ fontSize: 10, color: T.amber, marginBottom: 2 }}>
                            <b>{w.field}:</b> {w.msg}
                        </div>
                    ))}
                    {row.errors.length === 0 && row.warnings.length === 0 && (
                        <span style={{ fontSize: 10, color: T.green }}>✓ Valid</span>
                    )}
                </td>
                {/* Editable fields */}
                <td style={S.td}>
                    <select style={{ ...S.inp, marginBottom: 0, fontSize: 11, border: row.errors.some(e=>e.field==='Vehicle') ? `1px solid ${T.red}` : undefined }}
                        value={row.truck || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'truck', e.target.value)}>
                        <option value="">{row._rawVehicle || 'Select truck…'}</option>
                        {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                </td>
                <td style={S.td}>
                    <input type="date" style={{ ...S.inp, marginBottom: 0, fontSize: 11, border: row.errors.some(e=>e.field==='Date') ? `1px solid ${T.red}` : undefined }}
                        value={row.date || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'date', e.target.value)} />
                </td>
                <td style={S.td}>
                    <input style={{ ...S.inp, marginBottom: 0, fontSize: 11, border: row.errors.some(e=>e.field==='Origin') ? `1px solid ${T.red}` : undefined }}
                        value={row.origin || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'origin', e.target.value)} />
                </td>
                <td style={S.td}>
                    <input style={{ ...S.inp, marginBottom: 0, fontSize: 11, border: row.errors.some(e=>e.field==='Destination') ? `1px solid ${T.red}` : undefined }}
                        value={row.dest || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'dest', e.target.value)} />
                </td>
                <td style={S.td}>
                    <input type="number" style={{ ...S.inp, marginBottom: 0, fontSize: 11, width: 80, border: row.errors.some(e=>e.field==='Standard Distance') ? `1px solid ${T.red}` : undefined }}
                        value={row.distance || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'distance', +e.target.value)} />
                </td>
                <td style={S.td}>
                    <input type="number" style={{ ...S.inp, marginBottom: 0, fontSize: 11, width: 100, border: row.errors.some(e=>e.field==='Gross Income') ? `1px solid ${T.red}` : undefined }}
                        value={row.revenue || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'revenue', +e.target.value)} />
                </td>
                <td style={{ ...S.td, fontSize: 11, color: T.textFaint }}>
                    {row.hasFuel ? `${row.fuelLitres}L @ ${row.fuelPrice}` : '—'}
                </td>
                <td style={S.td}>
                    <select style={{ ...S.inp, marginBottom: 0, fontSize: 11 }}
                        value={row.status}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'status', e.target.value)}>
                        {['Completed', 'In Transit', 'Loading', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                    </select>
                </td>
                {/* Accept / discard toggle */}
                <td style={{ ...S.td, textAlign: 'center' }}>
                    <button
                        style={{ ...S.btn(row.accepted ? 'green' : 'ghost'), fontSize: 11, padding: '4px 10px' }}
                        onClick={() => toggleAccept(activeSheet, row._rowNum, !row.accepted)}>
                        {row.accepted ? '✓ Accept' : 'Skipped'}
                    </button>
                </td>
            </tr>
        );
    };

    // ── Row renderer for expenses + maintenance sheets
    const ExpenseRow = ({ row }) => {
        const hasError = row.errors.length > 0;
        return (
            <tr style={{ background: !row.accepted ? T.surface2 : hasError ? T.redBg + '40' : T.surface, opacity: row.accepted ? 1 : 0.5 }}>
                <td style={{ ...S.td, fontSize: 11, color: T.textFaint, fontFamily: "'DM Mono', monospace", width: 50 }}>
                    {row._rowNum}
                    {row._monthName && <span style={{ color: T.blue, marginLeft: 4 }}>{row._monthName}</span>}
                    {row.edited && <span style={{ color: T.amber, marginLeft: 4, fontSize: 10 }}>✎</span>}
                </td>
                <td style={{ ...S.td, width: 200 }}>
                    {row.errors.map((e, i) => (
                        <div key={i} style={{ fontSize: 10, color: T.red, marginBottom: 2 }}>
                            <b>{e.field}:</b> {e.msg}
                        </div>
                    ))}
                    {row.errors.length === 0 && <span style={{ fontSize: 10, color: T.green }}>✓ Valid</span>}
                </td>
                <td style={S.td}>
                    <select style={{ ...S.inp, marginBottom: 0, fontSize: 11 }}
                        value={row.truck || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum + (row._monthName || ''), 'truck', e.target.value)}>
                        <option value="">{row._rawVehicle || 'Company-wide'}</option>
                        {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                </td>
                <td style={S.td}>
                    <input type="date" style={{ ...S.inp, marginBottom: 0, fontSize: 11, border: row.errors.some(e=>e.field==='Date Undertaken'||e.field==='Date') ? `1px solid ${T.red}` : undefined }}
                        value={row.date || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'date', e.target.value)} />
                </td>
                <td style={S.td}>
                    <input style={{ ...S.inp, marginBottom: 0, fontSize: 11 }}
                        value={row.desc || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'desc', e.target.value)} />
                </td>
                <td style={{ ...S.td }}>
                    <span style={S.badge(row.cat)}>{row.cat}</span>
                </td>
                <td style={S.td}>
                    <input type="number" style={{ ...S.inp, marginBottom: 0, fontSize: 11, width: 100, fontFamily: "'DM Mono', monospace", border: row.errors.some(e=>e.field==='Cost') ? `1px solid ${T.red}` : undefined }}
                        value={row.amount || ''}
                        onChange={e => updateRow(activeSheet, row._rowNum, 'amount', +e.target.value)} />
                </td>
                <td style={{ ...S.td, textAlign: 'center' }}>
                    <button
                        style={{ ...S.btn(row.accepted ? 'green' : 'ghost'), fontSize: 11, padding: '4px 10px' }}
                        onClick={() => toggleAccept(activeSheet, row._rowNum, !row.accepted)}>
                        {row.accepted ? '✓ Accept' : 'Skipped'}
                    </button>
                </td>
            </tr>
        );
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div>
                    <div style={S.ph}>Import Review</div>
                    <div style={{ fontSize: 12, color: T.textFaint }}>
                        {session.fileName} · parsed {new Date(session.parsedAt).toLocaleTimeString('en-KE')}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <ImportUploadButton label="Re-import file" />
                    <button style={{ ...S.btn('ghost'), fontSize: 12 }} onClick={() => setImportSession(null)}>Clear session</button>
                    <button
                        style={{ ...S.btn('primary'), fontSize: 13 }}
                        onClick={handleCommit}
                        disabled={importing || session.committed || totalAccepted === 0}>
                        {session.committed ? `✓ Imported ${totalAccepted} rows` : importing ? 'Importing…' : `Import ${totalAccepted} rows`}
                    </button>
                </div>
            </div>

            {/* Success message */}
            {importMsg && (
                <div style={{ background: importMsg.startsWith('✅') ? T.greenBg : T.redBg, border: `1px solid ${importMsg.startsWith('✅') ? T.green : T.red}44`, borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 500, color: importMsg.startsWith('✅') ? T.green : T.red }}>
                    {importMsg}
                    {session.committed && (
                        <button style={{ ...S.btn('ghost'), fontSize: 11, marginLeft: 14 }} onClick={() => { setPage('journeys'); setImportSession(null); }}>
                            View imported journeys →
                        </button>
                    )}
                </div>
            )}

            {/* KPI summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                    { label: 'Total rows found',  val: totalValid + totalErrors, c: T.blue },
                    { label: 'Ready to import',   val: totalValid,               c: T.green },
                    { label: 'Rows with errors',  val: totalErrors,              c: T.red },
                    { label: 'Will be imported',  val: totalAccepted,            c: T.accent },
                ].map(k => (
                    <div key={k.label} style={S.kpiCard}>
                        <div style={S.kpi}>{k.label}</div>
                        <div style={S.val(k.c)}>{k.val}</div>
                    </div>
                ))}
            </div>

            {/* Sheet tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 0 }}>
                {Object.entries(sheets).map(([key, sh]) => {
                    const errCount = sh.data.errors.length;
                    const valCount = sh.data.valid.length;
                    const accCount = [...sh.data.valid, ...sh.data.errors].filter(r => r.accepted).length;
                    return (
                        <button key={key}
                            style={{ padding: '10px 18px', border: 'none', borderBottom: activeSheet === key ? `2px solid ${T.accent}` : '2px solid transparent', background: 'none', fontSize: 13, cursor: 'pointer', color: activeSheet === key ? T.accent : T.textFaint, fontWeight: activeSheet === key ? 600 : 400, marginBottom: -1 }}
                            onClick={() => setActiveSheet(key)}>
                            {sh.label}
                            {errCount > 0 && <span style={{ ...S.navBadge, marginLeft: 8, fontSize: 10, padding: '1px 6px', background: T.red }}>{errCount} errors</span>}
                            <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 6 }}>{accCount}/{valCount + errCount}</span>
                        </button>
                    );
                })}
            </div>

            {/* Toolbar for current sheet */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', flexWrap: 'wrap' }}>
                <button style={{ ...S.btn('sm'), fontSize: 11 }} onClick={() => acceptAll(activeSheet)}>Accept all in this sheet</button>
                <button style={{ ...S.btn('sm'), fontSize: 11 }} onClick={() => discardAll(activeSheet)}>Discard all</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textDim, cursor: 'pointer', marginLeft: 8 }}>
                    <input type="checkbox" checked={showValidRows} onChange={e => setShowValidRows(e.target.checked)} />
                    Show valid rows ({validRows.length})
                </label>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textFaint }}>
                    {errorRows.length} error row{errorRows.length !== 1 ? 's' : ''} shown
                    {showValidRows ? ` · ${validRows.length} valid rows shown` : ' · valid rows hidden'}
                </span>
            </div>

            {/* Error rows first, then valid rows if checkbox enabled */}
            {allRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: T.textFaint }}>
                    <div style={{ marginBottom: 8, fontSize: 28, opacity: 0.3 }}>✓</div>
                    <div style={{ fontWeight: 600, color: T.textDim }}>
                        {errorRows.length === 0 ? 'No errors in this sheet — all rows are valid.' : 'No rows to show with current filters.'}
                    </div>
                    {!showValidRows && validRows.length > 0 && (
                        <div style={{ fontSize: 12, marginTop: 8 }}>
                            {validRows.length} valid rows hidden — check "Show valid rows" to see them.
                        </div>
                    )}
                </div>
            ) : (
                <div style={S.tableWrap}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ ...S.tbl, minWidth: activeSheet === 'trips' ? 1000 : 700 }} className="segecha-table">
                            <thead>
                                {activeSheet === 'trips' ? (
                                    <tr>
                                        {['Row', 'Validation', 'Truck', 'Date', 'Origin', 'Destination', 'Distance (km)', 'Revenue (KES)', 'Fuel', 'Status', ''].map(h => (
                                            <th key={h} style={S.th}>{h}</th>
                                        ))}
                                    </tr>
                                ) : (
                                    <tr>
                                        {['Row', 'Validation', 'Truck', 'Date', 'Description', 'Category', 'Amount (KES)', ''].map(h => (
                                            <th key={h} style={S.th}>{h}</th>
                                        ))}
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {/* Error rows first — highlighted */}
                                {errorRows.map(row => activeSheet === 'trips'
                                    ? <TripRow key={row._rowNum} row={row} />
                                    : <ExpenseRow key={row._rowNum + (row._monthName || '')} row={row} />
                                )}
                                {/* Valid rows (if shown) — separator */}
                                {showValidRows && errorRows.length > 0 && validRows.length > 0 && (
                                    <tr><td colSpan={12} style={{ padding: '6px 14px', background: T.greenBg, fontSize: 11, color: T.green, fontWeight: 600 }}>
                                        ✓ {validRows.length} valid row{validRows.length !== 1 ? 's' : ''} below — no errors
                                    </td></tr>
                                )}
                                {showValidRows && validRows.map(row => activeSheet === 'trips'
                                    ? <TripRow key={row._rowNum} row={row} />
                                    : <ExpenseRow key={row._rowNum + (row._monthName || '')} row={row} />
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Sticky bottom commit bar */}
            {!session.committed && totalAccepted > 0 && (
                <div style={{ position: 'sticky', bottom: 0, marginTop: 12, padding: '14px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 14, boxShadow: dark ? '0 -4px 20px rgba(0,0,0,0.4)' : '0 -4px 20px rgba(0,0,0,0.08)' }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{totalAccepted} rows selected for import</div>
                        <div style={{ fontSize: 11, color: T.textFaint }}>
                            {[...session.sheets.trips.valid, ...session.sheets.trips.errors].filter(r=>r.accepted).length} journeys · {[...session.sheets.expenses.valid, ...session.sheets.expenses.errors].filter(r=>r.accepted).length} fixed expenses · {[...session.sheets.maintenance.valid, ...session.sheets.maintenance.errors].filter(r=>r.accepted).length} maintenance records
                        </div>
                    </div>
                    <button style={{ ...S.btn('primary'), marginLeft: 'auto', padding: '10px 24px', fontSize: 14 }}
                        onClick={handleCommit} disabled={importing}>
                        {importing ? 'Importing…' : 'Confirm import →'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Upload button (reusable) ─────────────────────────────────────────────
const ImportUploadButton = ({ label = 'Import from Excel' }) => {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const handleFile = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true); setErr('');
        try {
            const session = await runExcelImport(file);
            setImportSession(session);
            setPage('import');
        } catch (error) {
            setErr(error.message);
        }
        setLoading(false);
        e.target.value = '';
    };

    return (
        <div>
            <label style={{ ...S.btn('primary'), display: 'inline-flex', cursor: 'pointer', alignItems: 'center', gap: 8 }}>
                {loading ? '⏳ Parsing…' : label}
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} disabled={loading} />
            </label>
            {err && <div style={{ fontSize: 11, color: T.red, marginTop: 6 }}>{err}</div>}
        </div>
    );
};
```

### B.2 — Add Import to PAGES and NAV

Find the PAGES map and add:
```js
import: ImportReview,
```

Find the NAV_GROUPS in the sidebar or NAV array. Under the Data/Admin group, add:
```js
{ id: 'import', icon: DownloadIcon, label: 'Import',
  badge: importSession && !importSession.committed
    ? Object.values(importSession.sheets).reduce((s, sh) => s + sh.errors.length, 0) || null
    : null
},
```

### B.3 — Add Import trigger to Settings → Backup & Import section

In the `backup` panel inside Settings, find the Import from CSV/Excel section.
Replace the three individual file pickers with a single unified importer:

```jsx
<div style={{ fontWeight: 600, fontSize: 14, color: T.text, margin: '8px 0 12px' }}>Import from Trucking_2025.xlsx</div>
<div style={{ fontSize: 13, color: T.textDim, marginBottom: 16, lineHeight: 1.6 }}>
    Upload your <code style={{ background: T.surface2, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>Trucking_2025.xlsx</code> file.
    The system reads the <b>Trips_2025</b>, <b>Fixed_Expenses</b>, and <b>Maintenance</b> sheets automatically.
    You review and fix any errors row-by-row before confirming the import.
</div>
<ImportUploadButton label="Upload Trucking_2025.xlsx" />
{importSession && !importSession.committed && (
    <div style={{ marginTop: 12, background: T.amberBg, border: `1px solid ${T.amber}44`, borderRadius: 6, padding: '10px 14px', fontSize: 13, color: T.amber, fontWeight: 500 }}>
        Import session active — {Object.values(importSession.sheets).reduce((s, sh) => s + sh.errors.length, 0)} rows need review.
        <button style={{ ...S.btn('ghost'), fontSize: 11, marginLeft: 14, color: T.amber, borderColor: T.amber + '44' }}
            onClick={() => setPage('import')}>
            Review now →
        </button>
    </div>
)}
```

---

## PART C — Checklist

- [ ] SheetJS loads from CDN (check Network tab — no 404 on xlsx.full.min.js)
- [ ] Uploading Trucking_2025.xlsx navigates to Import Review page automatically
- [ ] KPI row shows: Total rows found / Ready to import / Rows with errors / Will be imported
- [ ] Three tabs: Trips (Trips_2025) / Fixed Expenses / Maintenance
- [ ] Error rows appear first with red-highlighted fields
- [ ] Each error row shows: field name + specific error message (e.g. "Gross Income: missing or zero")
- [ ] Error fields have a red border on the input
- [ ] Valid rows are hidden by default — checkbox reveals them
- [ ] Valid rows show a green separator row before them
- [ ] All fields in error rows are editable inline
- [ ] Editing a field re-validates — error messages disappear as fields are fixed
- [ ] Truck dropdown shows all trucks in the fleet
- [ ] Accept / Skipped toggle button works per row
- [ ] "Accept all in this sheet" button accepts every row in current tab
- [ ] "Discard all" discards every row in current tab
- [ ] Sticky bottom bar shows "X rows selected for import" with breakdown
- [ ] "Confirm import →" calls commitImport and shows success message
- [ ] After import: journeys appear in Journeys page
- [ ] After import: fuel entries appear in Fuel Log page
- [ ] After import: expenses (allowances, tolls, other) appear in Expenses page
- [ ] After import: maintenance entries appear in Maintenance history
- [ ] After import: fixed expenses appear in Expenses page
- [ ] Import button on Settings → Backup & Import shows active session badge
- [ ] Import nav item shows a badge with the count of error rows
- [ ] "View imported journeys →" link after success takes user to Journeys page
- [ ] Re-uploading a new file replaces the current session
- [ ] "Clear session" removes the import session and returns to empty state
- [ ] Committed sessions cannot be re-committed (button is disabled)
- [ ] KDR 381K trips map correctly to the truck with reg "KDR 381K" in fleet
- [ ] Trips with null Standard Distance are flagged as errors (not 0 distance)
- [ ] Maintenance rows with cost "???" are flagged as errors
- [ ] Fixed expenses with 0 value for a month are skipped silently
- [ ] Driver mileage (Turn-Boy column) creates separate Allowance expense entries
- [ ] Road users fee creates Toll expense entries linked to the journey
