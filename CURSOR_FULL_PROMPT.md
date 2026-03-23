# Segecha Internal Tracker — Full Cursor AI Prompt

You are editing a single file: `src/App.jsx` — a 1,130-line React application for Segecha Group Ltd, a road transport company in Nairobi, Kenya. The app manages trucks, drivers, journeys, fuel, expenses, invoices, payroll, tyre health, and P&L reporting.

**Ground rules — read before touching anything:**
- Edit only `src/App.jsx`. Do not create new files, do not split components, do not install packages except where explicitly stated.
- Do not remove any existing functionality. Every existing page, form, button, and data field must continue working exactly as before.
- After every major section below, run `npm run dev` and confirm the app loads before moving to the next section.
- Preserve all Kenyan localisation: KES currency, M-Pesa references, +254 phone format, 16% VAT, PSV licence format, Kenyan truck plate format (KCx NNNx).
- Work through sections in order. Each section builds on the previous.

---

## SECTION 1 — Replace hardcoded constants with settings-aware versions

Find these lines near the top of the file (around lines 69–73):

```js
const CATS = ["Fuel", "Maintenance", "Toll", "Permit", "Tyre", "Allowance", "Salary", "Insurance", "Other"];
const TRUCK_TYPES = ["Rigid", "Semi-Trailer", "Tipper", "Flatbed", "Tanker", "Box Body"];
const STATUSES_JOURNEY = ["Loading", "In Transit", "Completed", "Cancelled"];
const STATUSES_TRUCK = ["Active", "Maintenance", "Off Road"];
const TYRE_WARN_KM = 5000;
```

Replace them with:

```js
const _S = (() => { try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); } catch { return {}; } })();

const CATS = _S.expenseCategories?.length ? _S.expenseCategories : ["Fuel", "Maintenance", "Toll", "Permit", "Tyre", "Allowance", "Salary", "Insurance", "Other"];
const TRUCK_TYPES = _S.truckTypes?.length ? _S.truckTypes : ["Rigid", "Semi-Trailer", "Tipper", "Flatbed", "Tanker", "Box Body"];
const LICENCE_CLASSES = _S.licenceClasses?.length ? _S.licenceClasses : ["Class G", "Class CE", "Class C", "Class B"];
const COMMON_ROUTES = _S.commonRoutes?.length ? _S.commonRoutes : [
    { origin: "Nairobi", dest: "Mombasa", distance: 480 },
    { origin: "Nairobi", dest: "Kampala", distance: 680 },
    { origin: "Nairobi", dest: "Eldoret", distance: 315 },
    { origin: "Nairobi", dest: "Kisumu", distance: 350 },
    { origin: "Mombasa", dest: "Kampala", distance: 1100 },
    { origin: "Nairobi", dest: "Dar es Salaam", distance: 840 },
];
const CARGO_TYPES = _S.cargoTypes?.length ? _S.cargoTypes : ["Electronics", "FMCG Goods", "Spare Parts", "Machinery", "Cement", "Fertiliser", "Fuel", "Timber", "Other"];
const STATUSES_JOURNEY = ["Loading", "In Transit", "Completed", "Cancelled"];
const STATUSES_TRUCK = ["Active", "Maintenance", "Off Road"];
const TYRE_WARN_KM = _S.tyreWarnKm ? +_S.tyreWarnKm : 5000;
const DEFAULT_TYRE_INTERVAL = _S.defaultTyreInterval ? +_S.defaultTyreInterval : 60000;
const DEFAULT_FUEL_PRICE = _S.defaultFuelPrice ? +_S.defaultFuelPrice : 0;
const MAX_FUEL_LITRES = _S.maxFuelLitres ? +_S.maxFuelLitres : 2000;
const PAYMENT_TERMS_DAYS = _S.paymentTermsDays ? +_S.paymentTermsDays : 14;
const INVOICE_PREFIX = _S.invoicePrefix || 'INV';
const BANK_NAME = _S.bankName || '';
const BANK_ACCOUNT = _S.bankAccount || '';
const BANK_BRANCH = _S.bankBranch || '';
const STALE_TRANSIT_DAYS = _S.staleTransitDays ? +_S.staleTransitDays : 5;
const MAINTENANCE_OVERDUE_DAYS = _S.maintenanceOverdueDays ? +_S.maintenanceOverdueDays : 7;
const FLEET_ACTIVE_WARN_PCT = _S.fleetActiveWarnPct ? +_S.fleetActiveWarnPct : 50;
```

---

## SECTION 2 — Fix data persistence

**2a.** Find line 96:
```js
const [data, setData] = useState(SEED);
```
Replace with:
```js
const [data, setData] = useState(() => {
    try {
        const saved = localStorage.getItem('segecha_v2');
        return saved ? JSON.parse(saved) : SEED;
    } catch { return SEED; }
});
```

**2b.** Find the block of `useState` declarations (lines 97–109). After all the `useState` calls and before the theme block, add:
```js
useEffect(() => {
    try { localStorage.setItem('segecha_v2', JSON.stringify(data)); }
    catch (e) { console.error('Storage error:', e); }
}, [data]);
```

**2c.** Also add two new state variables after `const [dark, setDark] = useState(false);`:
```js
const [importResult, setImportResult] = useState(null);
const [showImportPanel, setShowImportPanel] = useState(false);
```

---

## SECTION 3 — Fix the delete function

Find line 172:
```js
const delItem = (col, id) => setData(d => ({ ...d, [col]: d[col].filter(x => x.id !== id) }));
```
Replace with:
```js
const delItem = (col, id, label = "this record") => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setData(d => ({ ...d, [col]: d[col].filter(x => x.id !== id) }));
};
```

Then update every `delItem` call in the file:

| Find | Replace with |
|---|---|
| `delItem("trucks", t.id)` | `delItem("trucks", t.id, t.reg)` |
| `delItem("drivers", d.id)` | `delItem("drivers", d.id, d.name)` |
| `delItem("journeys", j.id)` | `delItem("journeys", j.id, j.origin + "→" + j.dest)` |
| `delItem("fuel", f.id)` | `delItem("fuel", f.id, f.station + " " + f.date)` |
| `delItem("expenses", e.id)` | `delItem("expenses", e.id, e.desc)` |
| `delItem("invoices", inv.id)` | `delItem("invoices", inv.id, inv.id)` |
| `delItem("payroll", p.id)` | `delItem("payroll", p.id, drv?.name + " " + p.month)` |

---

## SECTION 4 — Add the import engine

Find the `driverName` helper function (around line 158). Before it, insert the entire import engine:

```js
// ─── Import Engine ─────────────────────────────────────────────────────────
const IMPORT_SCHEMAS = {
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
            return { id: uid(), truck: truck?.id || row.truck,
                date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0],
                litres: +row.litres, pricePerL: +row.pricePerL, station: String(row.station).trim(),
                odom: row.odom ? +row.odom : 0, journey: row.journey || '' };
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
            return { id: uid(), truck: truck?.id || row.truck,
                date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0],
                cat: row.cat, amount: +row.amount, desc: String(row.desc).trim(), journey: row.journey || '' };
        },
        collection: 'expenses',
    },
};

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

const runImport = async (file, entityType) => {
    const schema = IMPORT_SCHEMAS[entityType];
    if (!schema) return;
    let rawRows = [];
    try {
        if (file.name.endsWith('.csv')) {
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            rawRows = lines.slice(1).map((line, i) => {
                const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
                const obj = {};
                headers.forEach((h, j) => { obj[h] = vals[j] ?? ''; });
                obj._row = i + 2;
                return obj;
            });
        } else {
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            let headerRowIndex = 0;
            for (let i = 0; i < Math.min(10, rows.length); i++) {
                if (rows[i].filter(c => c !== '').length >= 3) { headerRowIndex = i; break; }
            }
            const headers = rows[headerRowIndex].map(h => String(h || '').trim());
            rawRows = rows.slice(headerRowIndex + 1).filter(row => row.some(c => c !== '')).map((row, i) => {
                const obj = {};
                headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
                obj._row = headerRowIndex + i + 2;
                return obj;
            });
        }
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
        errors.push({ row: 'File Header', fields: missingColumns, messages: [
            `Required columns not found: ${missingColumns.join(', ')}`,
            `Columns detected: ${allHeaders.join(', ')}`,
            `Expected aliases: ${missingColumns.map(f => schema.fieldAliases[f]?.join(' / ')).join(' | ')}`,
        ]});
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
```

---

## SECTION 5 — Wire defaults into existing modals

**5a.** Find the Add Truck button:
```jsx
openModal("truck", { status: "Active", tyreLimit: 60000 })
```
Replace with:
```jsx
openModal("truck", { status: "Active", tyreLimit: DEFAULT_TYRE_INTERVAL })
```

**5b.** Find the Add Fuel button:
```jsx
openModal("fuel", { date: today() })
```
Replace with:
```jsx
openModal("fuel", { date: today(), pricePerL: DEFAULT_FUEL_PRICE || '' })
```

**5c.** Find the New Invoice button:
```jsx
openModal("invoice", { issued: today(), due: today(), status: "Pending" })
```
Replace with:
```jsx
openModal("invoice", { issued: today(), due: (() => { const d = new Date(); d.setDate(d.getDate() + PAYMENT_TERMS_DAYS); return d.toISOString().split('T')[0]; })(), status: "Pending" })
```

**5d.** Find the invoice save handler:
```jsx
if (!form.id) form.id = "INV-" + uid().slice(0, 5);
```
Replace with:
```jsx
if (!form.id) form.id = INVOICE_PREFIX + "-" + uid().slice(0, 5);
```

**5e.** Find the driver modal licence class field:
```jsx
<F label="License Class" k="class" options={["Class G", "Class CE", "Class C", "Class B"]} />
```
Replace with:
```jsx
<F label="License Class" k="class" options={LICENCE_CLASSES} />
```

---

## SECTION 6 — Dashboard improvements

**6a. Add dynamic payroll month.** Find inside `Dashboard`:
```js
const paySlip = data.payroll.find(p => p.driver === d.id && p.month === "2025-03");
```
Before the `data.drivers.map` block, add:
```js
const latestMonth = data.payroll.sort((a, b) => b.month.localeCompare(a.month))[0]?.month || today().slice(0, 7);
```
Then replace the find with:
```js
const paySlip = data.payroll.find(p => p.driver === d.id && p.month === latestMonth);
```
And find the hardcoded label `Payroll — March 2025` and replace with:
```jsx
Payroll — {monthLabel(latestMonth)}
```

**6b. Add stale journey, maintenance overdue, and fleet active alerts.** Find inside `Dashboard`:
```js
const overdueInv = data.invoices.filter(i => i.status === "Overdue");
```
After it, add:
```js
const staleJourneys = data.journeys.filter(j => {
    if (j.status !== "In Transit" || !j.date) return false;
    return (Date.now() - new Date(j.date).getTime()) / 86400000 > STALE_TRANSIT_DAYS;
});
const maintenanceOverdue = data.trucks.filter(t => {
    if (t.status !== "Maintenance") return false;
    const maintExpenses = data.expenses.filter(e => e.truck === t.id && e.cat === "Maintenance");
    if (maintExpenses.length === 0) return true;
    const latestDate = maintExpenses.map(e => e.date).sort().reverse()[0];
    return (Date.now() - new Date(latestDate).getTime()) / 86400000 > MAINTENANCE_OVERDUE_DAYS;
});
const activeTrucks = data.trucks.filter(t => t.status === "Active").length;
const fleetActivePct = data.trucks.length > 0 ? (activeTrucks / data.trucks.length) * 100 : 100;
const fleetActiveWarning = data.trucks.length > 0 && fleetActivePct < FLEET_ACTIVE_WARN_PCT;
```

Then find the alert rendering block (the `<div style={{ marginBottom: 20 }}>` containing `tyreAlerts.map` and `overdueInv.map`). Add these inside it after `overdueInv.map(...)`:

```jsx
{staleJourneys.map(j => (
    <div key={j.id} style={S.alertBox("#f59e0b")}>
        <span style={{ fontSize: 18 }}>🚛</span>
        <div>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>Journey Overdue — {j.origin} → {j.dest}</div>
            <div style={{ fontSize: 12, color: T.textDim }}>{truckReg(j.truck)} · {driverName(j.driver)} · Departed {j.date} · No arrival recorded</div>
        </div>
    </div>
))}
{maintenanceOverdue.map(t => (
    <div key={t.id} style={S.alertBox("#f59e0b")}>
        <span style={{ fontSize: 18 }}>🔧</span>
        <div>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>Extended Maintenance — {t.reg}</div>
            <div style={{ fontSize: 12, color: T.textDim }}>{t.make} has been in Maintenance for over {MAINTENANCE_OVERDUE_DAYS} days. Update its status or log a maintenance expense.</div>
        </div>
    </div>
))}
{fleetActiveWarning && (
    <div style={S.alertBox("#ef4444")}>
        <span style={{ fontSize: 18 }}>🚨</span>
        <div>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>Low Fleet Availability — {Math.round(fleetActivePct)}% Active</div>
            <div style={{ fontSize: 12, color: T.textDim }}>Only {activeTrucks} of {data.trucks.length} trucks are Active. Fleet availability has dropped below the {FLEET_ACTIVE_WARN_PCT}% threshold.</div>
        </div>
    </div>
)}
```

Also update the alert condition at the top of the block:
```jsx
{(tyreAlerts.length > 0 || overdueInv.length > 0) && (
```
Replace with:
```jsx
{(tyreAlerts.length > 0 || overdueInv.length > 0 || staleJourneys.length > 0 || maintenanceOverdue.length > 0 || fleetActiveWarning) && (
```

---

## SECTION 7 — Form UX improvements

**7a. Auto-fill driver when truck is selected in journey modal.**
Find inside journey modal:
```jsx
<F label="Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} />
```
Replace with:
```jsx
<div style={S.fg}>
    <label style={S.lbl}>Truck</label>
    <select style={S.inp} value={form.truck || ""} onChange={e => {
        const truck = data.trucks.find(t => t.id === e.target.value);
        setForm(f => ({ ...f, truck: e.target.value, driver: truck?.driver || f.driver }));
    }}>
        <option value="">Select…</option>
        {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
    </select>
</div>
```

**7b. Add common route quick-select in journey modal.**
Find inside journey modal:
```jsx
<F label="Origin" k="origin" /><F label="Destination" k="dest" />
```
Replace with:
```jsx
<div style={{ ...S.fg, gridColumn: "1/-1" }}>
    <label style={S.lbl}>Quick Route</label>
    <select style={S.inp} onChange={e => {
        const route = COMMON_ROUTES.find(r => `${r.origin}→${r.dest}` === e.target.value);
        if (route) setForm(f => ({ ...f, origin: route.origin, dest: route.dest, distance: route.distance }));
    }} defaultValue="">
        <option value="">— Select a common route or fill in manually below —</option>
        {COMMON_ROUTES.map(r => <option key={`${r.origin}→${r.dest}`} value={`${r.origin}→${r.dest}`}>{r.origin} → {r.dest} ({r.distance} km)</option>)}
    </select>
</div>
<F label="Origin" k="origin" /><F label="Destination" k="dest" />
```

**7c. Add cargo type datalist in journey modal.**
Find:
```jsx
<F label="Cargo Description" k="cargo" />
```
Replace with:
```jsx
<div style={S.fg}>
    <label style={S.lbl}>Cargo Description</label>
    <input style={S.inp} list="cargo-types-list" value={form.cargo || ''} placeholder="Type or select cargo type"
        onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
    <datalist id="cargo-types-list">
        {CARGO_TYPES.map(c => <option key={c} value={c} />)}
    </datalist>
</div>
```

**7d. Add capacity overload warning in journey modal.**
Find inside journey modal after the Weight field:
```jsx
<F label="Status" k="status" options={STATUSES_JOURNEY} />
```
Before it, add:
```jsx
{form.truck && form.weight && (() => {
    const truck = data.trucks.find(t => t.id === form.truck);
    return truck && +form.weight > +truck.capacity ? (
        <div style={{ ...S.fg, gridColumn: "1/-1" }}>
            <div style={{ background: "#ef444412", border: "1px solid #ef444433", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444", fontWeight: 700 }}>
                ⚠️ Warning: {form.weight}T exceeds {truck.reg} capacity of {truck.capacity}T
            </div>
        </div>
    ) : null;
})()}
```

**7e. Live fuel cost estimate in fuel modal.**
Find inside fuel modal after `<F label="Price per Litre (KES)"`:
```jsx
<F label="Station Name" k="station" />
```
Before it, add:
```jsx
{form.litres && form.pricePerL && (
    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
        <div style={{ background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f97316", fontWeight: 700 }}>
            ⛽ Estimated Cost: {fmt(+form.litres * +form.pricePerL)}
        </div>
    </div>
)}
```

**7f. Live net pay in payroll modal.**
Find inside payroll modal after `<F label="Deductions`:
```jsx
<F label="Status" k="status" options={["Pending", "Paid"]} />
```
Before it, add:
```jsx
{(form.baseSalary || form.allowance || form.deductions) && (
    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
        <div style={{ background: "#10b98112", border: "1px solid #10b98133", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#10b981", fontWeight: 700 }}>
            💚 Net Pay: {fmt((+form.baseSalary || 0) + (+form.allowance || 0) - (+form.deductions || 0))}
        </div>
    </div>
)}
```

**7g. Fix payroll month field — use `<input type="month">` instead of text.**
Find:
```jsx
<F label="Month (YYYY-MM)" k="month" placeholder="2025-03" />
```
Replace with:
```jsx
<div style={S.fg}>
    <label style={S.lbl}>Month</label>
    <input type="month" style={S.inp} value={form.month || ""} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
</div>
```

**7h. Live VAT breakdown in invoice modal.**
Find inside invoice modal after `<F label="Amount (KES)"`:
```jsx
<F label="Date Issued" k="issued" type="date" />
```
Before it, add:
```jsx
{form.amount && (
    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
        <div style={{ background: "#38bdf812", border: "1px solid #38bdf833", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.textDim }}>
            <span style={{ color: T.textFaint }}>Subtotal (ex-VAT): </span><b style={{ color: "#38bdf8" }}>{fmt(Math.round(+form.amount / 1.16))}</b>
            <span style={{ margin: "0 10px", color: T.textGhost }}>|</span>
            <span style={{ color: T.textFaint }}>VAT 16%: </span><b style={{ color: "#f59e0b" }}>{fmt(+form.amount - Math.round(+form.amount / 1.16))}</b>
            <span style={{ margin: "0 10px", color: T.textGhost }}>|</span>
            <span style={{ color: T.textFaint }}>Total: </span><b style={{ color: "#10b981" }}>{fmt(+form.amount)}</b>
        </div>
    </div>
)}
```

---

## SECTION 8 — Table improvements

**8a. Add status filter to Journeys page.**
Find inside `Journeys`:
```js
const filtered = filterTruck === "ALL" ? data.journeys : data.journeys.filter(j => j.truck === filterTruck);
```
Replace with:
```js
const jStatusFilter = form._jStatusFilter || "ALL";
const filtered = data.journeys
    .filter(j => filterTruck === "ALL" || j.truck === filterTruck)
    .filter(j => jStatusFilter === "ALL" || j.status === jStatusFilter);
```
In the journeys filter bar, add a status select between the truck select and Add button:
```jsx
<select style={{ ...S.inp, width: 140 }} value={form._jStatusFilter || "ALL"}
    onChange={e => setForm(f => ({ ...f, _jStatusFilter: e.target.value }))}>
    <option value="ALL">All Statuses</option>
    {STATUSES_JOURNEY.map(s => <option key={s} value={s}>{s}</option>)}
</select>
```

**8b. Add category filter to Expenses page.**
Find inside `Expenses`:
```js
const filtered = filterTruck === "ALL" ? data.expenses : data.expenses.filter(e => e.truck === filterTruck);
```
Replace with:
```js
const expCatFilter = form._expCatFilter || "ALL";
const filtered = data.expenses
    .filter(e => filterTruck === "ALL" || e.truck === filterTruck)
    .filter(e => expCatFilter === "ALL" || e.cat === expCatFilter);
```
In the expenses filter bar, add a category select between the truck select and Add button:
```jsx
<select style={{ ...S.inp, width: 150 }} value={form._expCatFilter || "ALL"}
    onChange={e => setForm(f => ({ ...f, _expCatFilter: e.target.value }))}>
    <option value="ALL">All Categories</option>
    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
</select>
```

**8c. Add totals footer to Expenses table.**
Find the closing `</tbody>` of the expenses table. Before `</table>`, add:
```jsx
<tfoot>
    <tr style={{ background: T.border2 }}>
        <td colSpan={4} style={{ ...S.td, fontWeight: 800, color: T.text, textAlign: "right" }}>Total ({filtered.length} records)</td>
        <td style={{ ...S.td, fontWeight: 800, color: "#f59e0b", fontSize: 14 }}>{fmt(filtered.reduce((s, e) => s + +e.amount, 0))}</td>
        <td style={S.td}></td>
    </tr>
</tfoot>
```

**8d. Add totals footer to Fuel table.**
Find the closing `</tbody>` of the fuel log table. Before `</table>`, add:
```jsx
<tfoot>
    <tr style={{ background: T.border2 }}>
        <td colSpan={3} style={{ ...S.td, fontWeight: 800, color: T.text, textAlign: "right" }}>Total ({filtered.length} fill-ups)</td>
        <td style={{ ...S.td, fontWeight: 800, color: "#f59e0b" }}>{filtered.reduce((s, f) => s + f.litres, 0).toLocaleString()} L</td>
        <td style={S.td}></td>
        <td style={{ ...S.td, fontWeight: 800, color: "#f97316", fontSize: 14 }}>{fmt(filtered.reduce((s, f) => s + f.litres * f.pricePerL, 0))}</td>
        <td colSpan={2} style={S.td}></td>
    </tr>
</tfoot>
```

**8e. Show journey notes in the journeys table.**
Find the journey table header array:
```js
["Route", "Truck", "Driver", "Date", "Cargo", "Weight", "Distance", "Revenue", "Status", ""]
```
Replace with:
```js
["Route", "Truck", "Driver", "Date", "Cargo", "Weight", "Distance", "Revenue", "Status", "Notes", ""]
```
In the journey table row, after the Status `<td>` and before the actions `<td>`, add:
```jsx
<td style={{ ...S.td, fontSize: 11, color: T.textFaint, fontStyle: "italic", maxWidth: 120 }} title={j.notes || ""}>
    {j.notes ? (j.notes.length > 30 ? j.notes.slice(0, 30) + "…" : j.notes) : "—"}
</td>
```

**8f. Fuel log per-truck cards respect truck filter.**
Find inside `FuelLog`:
```js
{data.trucks.map(t => {
```
Replace with:
```js
{data.trucks.filter(t => filterTruck === "ALL" || t.id === filterTruck).map(t => {
```

**8g. Suspended driver warning badge in Drivers table.**
Find:
```jsx
<td style={S.td}><span style={S.badge(d.status)}>{d.status}</span></td>
```
Replace with:
```jsx
<td style={S.td}>
    <span style={S.badge(d.status)}>{d.status}</span>
    {d.status === "Suspended" && d.truck && (
        <span style={{ ...S.pill("#ef4444"), marginLeft: 6, fontSize: 9 }}>⚠️ Truck assigned</span>
    )}
</td>
```

---

## SECTION 9 — Topbar and sidebar improvements

**9a. Add Reset button to topbar.**
Find `<div style={S.meta}>` in the topbar. After the dark mode toggle button, add:
```jsx
<button
    onClick={() => { if (window.confirm('Reset all data to demo data? All changes will be lost.')) { localStorage.removeItem('segecha_v2'); window.location.reload(); }}}
    title="Reset to demo data"
    style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: T.textFaint, fontWeight: 700 }}
>↺ Reset</button>
```

**9b. Add live summary to sidebar footer.**
Find:
```jsx
<div style={{ padding: "12px 16px", borderTop: "1px solid #1c2235", fontSize: 11, color: T.textGhost }}>Segecha Group v2.0</div>
```
Replace with:
```jsx
<div style={{ padding: "12px 16px", borderTop: "1px solid #1c2235", fontSize: 11, color: T.textGhost }}>
    <div style={{ fontWeight: 700, marginBottom: 3 }}>Segecha Group v2.0</div>
    <div>{data.trucks.filter(t => t.status === "Active").length} active · {data.journeys.filter(j => j.status === "In Transit").length} in transit</div>
</div>
```

**9c. Add Settings to NAV.**
Find the NAV array. Add before the closing `]`:
```js
{ id: "settings", icon: "⚙", label: "Settings" },
```

---

## SECTION 10 — Tyre monitor UX

Find inside `TyreMonitor`:
```jsx
<button style={{ ...S.btn("sm"), marginTop: 12 }} onClick={() => openModal("truck", t)}>Update Odometer / Tyre Info</button>
```
Replace with:
```jsx
<button style={{ ...S.btn("sm"), marginTop: 12 }} onClick={() => openModal("truck", { ...t, _tyreMode: true })}>Update Odometer / Tyre Info</button>
```

Find the truck modal. At the very top inside `<Modal>`, before `<div style={S.fgg(2)}>`, add:
```jsx
{form._tyreMode && (
    <div style={{ background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#f97316" }}>
        ⬇️ Scroll to update Odometer and Tyre fields below
    </div>
)}
```

---

## SECTION 11 — Invoice footer reads live settings

Find inside `InvoiceView` the payment footer div:
```jsx
<div style={{ fontSize: 11, color: T.textDim, textAlign: "center", borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
    Payment via M-Pesa Paybill · Bank Transfer · Cheque · Thank you for your business!
</div>
```
Replace with:
```jsx
<div style={{ fontSize: 11, color: T.textDim, textAlign: "center", borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
    {(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            let footer = 'Payment via M-Pesa Paybill';
            if (s.paybillNumber) footer += ` (Paybill: ${s.paybillNumber}, Acc: ${s.paybillAccount || 'Invoice No.'})`;
            if (s.bankName) footer += ` · Bank Transfer: ${s.bankName}, A/C ${s.bankAccount || ''}${s.bankBranch ? ', ' + s.bankBranch : ''}`;
            footer += ` · ${s.mpesaConfirmationNote || 'Thank you for your business!'}`;
            return footer;
        } catch { return 'Payment via M-Pesa Paybill · Bank Transfer · Cheque · Thank you for your business!'; }
    })()}
</div>
```

---

## SECTION 12 — Payroll page reads live M-Pesa settings

Find inside `Payroll` the M-Pesa hint banner:
```jsx
<div style={{ marginTop: 16, padding: 14, background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, fontSize: 13, color: "#f97316" }}>
    💡 <b>M-Pesa Integration:</b> To send salaries via M-Pesa, use Safaricom Business Pay Bill or M-Pesa Business API. Each driver's M-Pesa number is shown above. Mark payments as paid after confirmation.
</div>
```
Replace with:
```jsx
<div style={{ marginTop: 16, padding: 14, background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, fontSize: 13, color: "#f97316" }}>
    {(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            if (s.b2cShortcode) return <span>💡 <b>M-Pesa B2C:</b> Use shortcode <b style={{ fontFamily: 'monospace' }}>{s.b2cShortcode}</b> ({s.mpesaBusinessName || 'Segecha Group Ltd'}) to disburse salaries. Mark payments as paid after M-Pesa confirmation.</span>;
        } catch {}
        return <span>💡 <b>M-Pesa Integration:</b> Configure your M-Pesa shortcode in <b>Settings → M-Pesa</b> to see payment instructions here.</span>;
    })()}
</div>
```

---

## SECTION 13 — Add the full Settings page component

Find the `PAGES` map line (around line 1074):
```js
const PAGES = { dashboard: Dashboard, trucks: Fleet, ... pnl: PnL };
```

**Directly before that line**, insert the entire Settings component:

```jsx
// ══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════
const Settings = () => {
    const [saved, setSaved] = useState(false);
    const loadSetting = (key, fallback) => { try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}')[key] || fallback; } catch { return fallback; } };

    const [companyName, setCompanyName] = useState(() => loadSetting('companyName', 'Segecha Group Ltd'));
    const [companyPhone, setCompanyPhone] = useState(() => loadSetting('companyPhone', '+254 700 000 000'));
    const [vatRate, setVatRate] = useState(() => loadSetting('vatRate', '16'));
    const [paybillNumber, setPaybillNumber] = useState(() => loadSetting('paybillNumber', ''));
    const [paybillAccount, setPaybillAccount] = useState(() => loadSetting('paybillAccount', ''));
    const [b2cShortcode, setB2cShortcode] = useState(() => loadSetting('b2cShortcode', ''));
    const [mpesaBusinessName, setMpesaBusinessName] = useState(() => loadSetting('mpesaBusinessName', 'Segecha Group Ltd'));
    const [mpesaConfirmationNote, setMpesaConfirmationNote] = useState(() => loadSetting('mpesaConfirmationNote', 'Payment via M-Pesa Paybill · Thank you for your business!'));
    const [defaultFuelPrice, setDefaultFuelPrice] = useState(() => loadSetting('defaultFuelPrice', ''));
    const [maxFuelLitres, setMaxFuelLitres] = useState(() => loadSetting('maxFuelLitres', '2000'));
    const [defaultTyreInterval, setDefaultTyreInterval] = useState(() => loadSetting('defaultTyreInterval', '60000'));
    const [paymentTermsDays, setPaymentTermsDays] = useState(() => loadSetting('paymentTermsDays', '14'));
    const [invoicePrefix, setInvoicePrefix] = useState(() => loadSetting('invoicePrefix', 'INV'));
    const [bankName, setBankName] = useState(() => loadSetting('bankName', ''));
    const [bankAccount, setBankAccount] = useState(() => loadSetting('bankAccount', ''));
    const [bankBranch, setBankBranch] = useState(() => loadSetting('bankBranch', ''));
    const [tyreWarnKm, setTyreWarnKm] = useState(() => loadSetting('tyreWarnKm', '5000'));
    const [invoiceOverdueDays, setInvoiceOverdueDays] = useState(() => loadSetting('invoiceOverdueDays', '30'));
    const [staleTransitDays, setStaleTransitDays] = useState(() => loadSetting('staleTransitDays', '5'));
    const [maintenanceOverdueDays, setMaintenanceOverdueDays] = useState(() => loadSetting('maintenanceOverdueDays', '7'));
    const [fleetActiveWarnPct, setFleetActiveWarnPct] = useState(() => loadSetting('fleetActiveWarnPct', '50'));
    const [dateFormat, setDateFormat] = useState(() => loadSetting('dateFormat', 'YYYY-MM-DD'));
    const [defaultDarkMode, setDefaultDarkMode] = useState(() => loadSetting('defaultDarkMode', 'light'));
    const [commonRoutes, setCommonRoutes] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            return s.commonRoutes ? s.commonRoutes.map(r => `${r.origin},${r.dest},${r.distance}`).join('\n') : 'Nairobi,Mombasa,480\nNairobi,Kampala,680\nNairobi,Eldoret,315\nNairobi,Kisumu,350\nMombasa,Kampala,1100\nNairobi,Dar es Salaam,840';
        } catch { return 'Nairobi,Mombasa,480\nNairobi,Kampala,680'; }
    });
    const [cargoTypesText, setCargoTypesText] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            return s.cargoTypes ? s.cargoTypes.join('\n') : 'Electronics\nFMCG Goods\nSpare Parts\nMachinery\nCement\nFertiliser\nFuel\nTimber\nOther';
        } catch { return 'Electronics\nFMCG Goods\nSpare Parts'; }
    });
    const [expCategoriesText, setExpCategoriesText] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            return s.expenseCategories ? s.expenseCategories.join('\n') : 'Fuel\nMaintenance\nToll\nPermit\nTyre\nAllowance\nSalary\nInsurance\nOther';
        } catch { return 'Fuel\nMaintenance\nToll\nPermit\nTyre\nAllowance\nSalary\nInsurance\nOther'; }
    });
    const [truckTypesText, setTruckTypesText] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            return s.truckTypes ? s.truckTypes.join('\n') : 'Rigid\nSemi-Trailer\nTipper\nFlatbed\nTanker\nBox Body';
        } catch { return 'Rigid\nSemi-Trailer\nTipper\nFlatbed\nTanker\nBox Body'; }
    });
    const [licenceClassesText, setLicenceClassesText] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            return s.licenceClasses ? s.licenceClasses.join('\n') : 'Class G\nClass CE\nClass C\nClass B';
        } catch { return 'Class G\nClass CE\nClass C\nClass B'; }
    });

    const parseLines = (text) => text.split('\n').map(l => l.trim()).filter(Boolean);
    const parseRoutes = (text) => text.split('\n').map(l => {
        const parts = l.split(',').map(p => p.trim());
        return parts.length >= 2 ? { origin: parts[0], dest: parts[1], distance: +parts[2] || 0 } : null;
    }).filter(Boolean);

    const saveSettings = () => {
        const s = {
            companyName, companyPhone, vatRate,
            paybillNumber, paybillAccount, b2cShortcode, mpesaBusinessName, mpesaConfirmationNote,
            defaultFuelPrice, maxFuelLitres, defaultTyreInterval,
            paymentTermsDays, invoicePrefix, bankName, bankAccount, bankBranch,
            tyreWarnKm, invoiceOverdueDays, staleTransitDays, maintenanceOverdueDays, fleetActiveWarnPct,
            dateFormat, defaultDarkMode,
            commonRoutes: parseRoutes(commonRoutes),
            cargoTypes: parseLines(cargoTypesText),
            expenseCategories: parseLines(expCategoriesText),
            truckTypes: parseLines(truckTypesText),
            licenceClasses: parseLines(licenceClassesText),
        };
        localStorage.setItem('segecha_settings', JSON.stringify(s));
        setSaved(true);
        setTimeout(() => { setSaved(false); window.location.reload(); }, 1200);
    };

    const storageSize = (() => { try { const s = localStorage.getItem('segecha_v2'); return s ? (new Blob([s]).size / 1024).toFixed(1) + ' KB' : '0 KB'; } catch { return 'N/A'; } })();

    const sectionTitle = (label) => (
        <div style={{ fontWeight: 800, fontSize: 14, color: T.text, marginBottom: 16, paddingBottom: 8, borderBottom: `2px solid #f97316`, display: 'flex', alignItems: 'center', gap: 8 }}>{label}</div>
    );
    const settingRow = (label, hint, input) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: `1px solid ${T.border2}`, gap: 20 }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3 }}>{label}</div>
                {hint && <div style={{ fontSize: 11, color: T.textFaint }}>{hint}</div>}
            </div>
            <div style={{ flex: 1, maxWidth: 280 }}>{input}</div>
        </div>
    );

    return (
        <div>
            <div style={S.ph}>⚙ Settings</div>
            <div style={S.grid(2, 1, 1)}>

                {/* Company */}
                <div style={S.card()}>
                    {sectionTitle('🏢 Company Information')}
                    {settingRow('Company Name', 'Shown on invoices and reports', <input style={S.inp} value={companyName} onChange={e => setCompanyName(e.target.value)} />)}
                    {settingRow('Company Phone', 'Shown on invoice footer', <input style={S.inp} value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} />)}
                    {settingRow('VAT Rate (%)', 'Kenya standard is 16% (KRA)', <input style={S.inp} type="number" value={vatRate} onChange={e => setVatRate(e.target.value)} />)}
                </div>

                {/* Fuel & Operations */}
                <div style={S.card()}>
                    {sectionTitle('⛽ Fuel & Operations')}
                    {settingRow('Default Fuel Price (KES/L)', 'Pre-fills price when logging a fuel entry', <input style={S.inp} type="number" value={defaultFuelPrice} placeholder="e.g. 176" onChange={e => setDefaultFuelPrice(e.target.value)} />)}
                    {settingRow('Max Litres Per Fill-up', 'Validation cap per fuel entry', <input style={S.inp} type="number" value={maxFuelLitres} placeholder="2000" onChange={e => setMaxFuelLitres(e.target.value)} />)}
                    {settingRow('Default Tyre Change Interval (km)', 'Pre-filled when adding a new truck', <input style={S.inp} type="number" value={defaultTyreInterval} placeholder="60000" onChange={e => setDefaultTyreInterval(e.target.value)} />)}
                </div>

                {/* Invoice & Finance */}
                <div style={S.card()}>
                    {sectionTitle('🧾 Invoice & Finance')}
                    {settingRow('Invoice Number Prefix', 'e.g. SGR → SGR-00XY', <input style={S.inp} value={invoicePrefix} placeholder="INV" onChange={e => setInvoicePrefix(e.target.value.toUpperCase())} />)}
                    {settingRow('Default Payment Terms (days)', 'Due date auto-set from issue date', <input style={S.inp} type="number" value={paymentTermsDays} placeholder="14" onChange={e => setPaymentTermsDays(e.target.value)} />)}
                    {settingRow('Bank Name', 'Shown on invoice payment footer', <input style={S.inp} value={bankName} placeholder="e.g. Equity Bank" onChange={e => setBankName(e.target.value)} />)}
                    {settingRow('Bank Account Number', '', <input style={S.inp} value={bankAccount} placeholder="e.g. 0123456789" onChange={e => setBankAccount(e.target.value)} />)}
                    {settingRow('Bank Branch', '', <input style={S.inp} value={bankBranch} placeholder="e.g. Westlands, Nairobi" onChange={e => setBankBranch(e.target.value)} />)}
                </div>

                {/* Alerts */}
                <div style={S.card()}>
                    {sectionTitle('🔔 Alert Thresholds')}
                    {settingRow('Tyre Warning (km)', 'Warn when this many km remain before change is due', <input style={S.inp} type="number" value={tyreWarnKm} onChange={e => setTyreWarnKm(e.target.value)} />)}
                    {settingRow('Invoice Overdue (days)', 'Mark unpaid invoices overdue after this many days', <input style={S.inp} type="number" value={invoiceOverdueDays} onChange={e => setInvoiceOverdueDays(e.target.value)} />)}
                    {settingRow('Stale "In Transit" Alert (days)', 'Alert if journey stays In Transit longer than this', <input style={S.inp} type="number" value={staleTransitDays} onChange={e => setStaleTransitDays(e.target.value)} />)}
                    {settingRow('Maintenance Overdue Alert (days)', 'Alert if truck stays in Maintenance longer than this', <input style={S.inp} type="number" value={maintenanceOverdueDays} onChange={e => setMaintenanceOverdueDays(e.target.value)} />)}
                    {settingRow('Low Fleet Active Warning (%)',
                        `Alert when active fleet drops below this. Currently: ${data.trucks.length > 0 ? Math.round((data.trucks.filter(t => t.status === 'Active').length / data.trucks.length) * 100) : 100}% active`,
                        <input style={S.inp} type="number" min="0" max="100" value={fleetActiveWarnPct} onChange={e => setFleetActiveWarnPct(e.target.value)} />
                    )}
                </div>

                {/* Appearance */}
                <div style={S.card()}>
                    {sectionTitle('🎨 Appearance')}
                    {settingRow('Default Theme', 'Applied when the app first loads',
                        <select style={S.inp} value={defaultDarkMode} onChange={e => setDefaultDarkMode(e.target.value)}>
                            <option value="light">☀️ Light Mode</option>
                            <option value="dark">🌙 Dark Mode</option>
                        </select>
                    )}
                    {settingRow('Date Display Format', 'How dates appear in tables and reports',
                        <select style={S.inp} value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                            <option value="YYYY-MM-DD">2025-03-21 (ISO — default)</option>
                            <option value="DD/MM/YYYY">21/03/2025 (Kenyan standard)</option>
                            <option value="DD MMM YYYY">21 Mar 2025 (readable)</option>
                        </select>
                    )}
                </div>

                {/* M-Pesa */}
                <div style={S.card()}>
                    {sectionTitle('💚 M-Pesa Configuration')}
                    <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Invoice Payments (Clients pay you)</div>
                    {settingRow('Paybill Number', 'Your Safaricom Business Paybill — shown on all invoices', <input style={S.inp} value={paybillNumber} placeholder="e.g. 522522" onChange={e => setPaybillNumber(e.target.value)} />)}
                    {settingRow('Account Number', 'What clients enter on M-Pesa', <input style={S.inp} value={paybillAccount} placeholder="e.g. SEGECHA or Invoice No." onChange={e => setPaybillAccount(e.target.value)} />)}
                    {settingRow('Business Name on M-Pesa', 'Name on client\'s M-Pesa receipt', <input style={S.inp} value={mpesaBusinessName} placeholder="Segecha Group Ltd" onChange={e => setMpesaBusinessName(e.target.value)} />)}
                    {settingRow('Invoice Payment Footer', 'Text shown at the bottom of every invoice', <textarea style={{ ...S.inp, height: 60, resize: 'vertical', fontFamily: 'inherit' }} value={mpesaConfirmationNote} onChange={e => setMpesaConfirmationNote(e.target.value)} />)}
                    <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 10 }}>Driver Salary Payments (You pay drivers)</div>
                    {settingRow('B2C Shortcode / Till Number', 'Your M-Pesa Business shortcode for paying drivers', <input style={S.inp} value={b2cShortcode} placeholder="e.g. 600000" onChange={e => setB2cShortcode(e.target.value)} />)}
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, marginBottom: 8 }}>Registered Driver M-Pesa Numbers</div>
                        <table style={S.tbl}>
                            <thead><tr>{['Driver', 'M-Pesa', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {data.drivers.map(d => (
                                    <tr key={d.id}>
                                        <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{d.name}</td>
                                        <td style={{ ...S.td, fontFamily: 'monospace', color: d.mpesa ? '#10b981' : '#ef4444' }}>{d.mpesa ? `💚 ${d.mpesa}` : '⚠ Not set'}</td>
                                        <td style={S.td}><span style={S.badge(d.status)}>{d.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {data.drivers.some(d => !d.mpesa) && (
                            <div style={{ marginTop: 8, background: '#f9731612', border: '1px solid #f9731633', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#f97316' }}>
                                ⚠️ {data.drivers.filter(d => !d.mpesa).length} driver(s) missing M-Pesa number — edit on the Drivers page.
                            </div>
                        )}
                    </div>
                </div>

                {/* Journey Defaults */}
                <div style={S.card()}>
                    {sectionTitle('🗺️ Journey Defaults')}
                    <div style={S.fg}>
                        <label style={S.lbl}>Common Routes</label>
                        <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 6 }}>One per line: <b>Origin, Destination, Distance(km)</b></div>
                        <textarea style={{ ...S.inp, height: 150, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={commonRoutes} onChange={e => setCommonRoutes(e.target.value)} />
                    </div>
                    <div style={S.fg}>
                        <label style={S.lbl}>Cargo Types</label>
                        <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 6 }}>One per line — shown as suggestions in journey form</div>
                        <textarea style={{ ...S.inp, height: 110, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={cargoTypesText} onChange={e => setCargoTypesText(e.target.value)} />
                    </div>
                </div>

                {/* Dropdown Lists */}
                <div style={S.card()}>
                    {sectionTitle('📋 Customise Dropdown Lists')}
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>One item per line. Changes apply after saving.</div>
                    <div style={S.fg}>
                        <label style={S.lbl}>Expense Categories</label>
                        <textarea style={{ ...S.inp, height: 110, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={expCategoriesText} onChange={e => setExpCategoriesText(e.target.value)} />
                    </div>
                    <div style={S.fg}>
                        <label style={S.lbl}>Truck Types</label>
                        <textarea style={{ ...S.inp, height: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={truckTypesText} onChange={e => setTruckTypesText(e.target.value)} />
                    </div>
                    <div style={S.fg}>
                        <label style={S.lbl}>Driver Licence Classes</label>
                        <textarea style={{ ...S.inp, height: 72, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={licenceClassesText} onChange={e => setLicenceClassesText(e.target.value)} />
                    </div>
                </div>

                {/* Data Summary */}
                <div style={S.card()}>
                    {sectionTitle('📊 Data Summary')}
                    {[['Trucks', data.trucks.length], ['Drivers', data.drivers.length], ['Journeys', data.journeys.length], ['Fuel Entries', data.fuel.length], ['Expenses', data.expenses.length], ['Invoices', data.invoices.length], ['Payroll Records', data.payroll.length], ['Storage Used', storageSize]].map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 13 }}>
                            <span style={{ color: T.textDim }}>{label}</span>
                            <span style={{ fontWeight: 700, color: T.text }}>{val}</span>
                        </div>
                    ))}
                </div>

                {/* Data Backup */}
                <div style={{ ...S.card(), gridColumn: isMobile ? '1' : '1 / -1' }}>
                    {sectionTitle('💾 Data Backup & Restore')}
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>Export your entire tracker data and settings as a single JSON file. Restore it on any device.</div>
                    <div style={S.grid(2, 1, 1)}>
                        <div style={{ ...S.card('#10b981'), padding: 20 }}>
                            <div style={{ fontWeight: 700, color: T.text, marginBottom: 8 }}>⬇️ Export Backup</div>
                            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>Downloads all data + settings as a dated <code>.json</code> file.</div>
                            <button style={S.btn('green')} onClick={() => {
                                const backup = {
                                    exportedAt: new Date().toISOString(),
                                    version: '2.0',
                                    data,
                                    settings: (() => { try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); } catch { return {}; } })(),
                                };
                                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `segecha_backup_${today()}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}>⬇️ Download Backup ({today()})</button>
                        </div>
                        <div style={{ ...S.card('#3b82f6'), padding: 20 }}>
                            <div style={{ fontWeight: 700, color: T.text, marginBottom: 8 }}>⬆️ Restore from Backup</div>
                            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}><b>Overwrites all current data and settings.</b> Use a file exported from this tracker.</div>
                            <label style={{ ...S.btn(), display: 'inline-block', cursor: 'pointer' }}>
                                📂 Choose Backup File
                                <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    if (!window.confirm('Restore from this backup? All current data and settings will be replaced.')) { e.target.value = ''; return; }
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                        try {
                                            const backup = JSON.parse(ev.target.result);
                                            if (!backup.data?.trucks) { alert('Invalid backup file.'); return; }
                                            setData(backup.data);
                                            if (backup.settings) localStorage.setItem('segecha_settings', JSON.stringify(backup.settings));
                                            alert(`✅ Restored successfully.\nExported: ${backup.exportedAt || 'unknown'}${backup.settings ? '\nSettings also restored.' : ''}`);
                                            window.location.reload();
                                        } catch { alert('❌ Could not read backup file.'); }
                                    };
                                    reader.readAsText(file);
                                    e.target.value = '';
                                }} />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Import Data */}
                <div style={{ ...S.card(), gridColumn: isMobile ? '1' : '1 / -1' }}>
                    {sectionTitle('📥 Import Data from CSV / Excel')}
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>Import records from a <b>.csv</b> or <b>.xlsx</b> file. Successfully imported rows are added immediately. Every failed row is shown in the error report below with the exact reason — nothing is skipped silently.</div>
                    <div style={S.grid(3, 2, 1)}>
                        {Object.entries(IMPORT_SCHEMAS).map(([key, schema]) => (
                            <div key={key} style={{ ...S.card('#f97316'), padding: 16 }}>
                                <div style={{ fontWeight: 700, color: T.text, marginBottom: 6, fontSize: 13 }}>{schema.label}</div>
                                <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 12 }}>Required: {schema.requiredFields.join(', ')}</div>
                                <label style={{ ...S.btn(), display: 'inline-block', cursor: 'pointer', fontSize: 12 }}>
                                    📂 Choose File
                                    <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={e => { const file = e.target.files[0]; if (file) runImport(file, key); e.target.value = ''; }} />
                                </label>
                            </div>
                        ))}
                    </div>
                    {showImportPanel && importResult && (
                        <div style={{ marginTop: 20, border: `1px solid ${importResult.errors.length > 0 ? '#ef4444' : '#10b981'}44`, borderRadius: 12, padding: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: T.text }}>📋 Import Report — {importResult.schema}</div>
                                <button style={S.btn('ghost')} onClick={() => setShowImportPanel(false)}>✕ Close</button>
                            </div>
                            <div style={S.grid(3, 3, 1)}>
                                {[['✅ Imported', importResult.imported.length, '#10b981', 'rows added'], ['❌ Failed', importResult.errors.length, '#ef4444', 'rows had errors'], ['📄 Total', importResult.totalRows || 0, '#38bdf8', 'rows in file']].map(([label, val, c, sub]) => (
                                    <div key={label} style={{ ...S.card(c), padding: 14 }}>
                                        <div style={S.kpi}>{label}</div>
                                        <div style={S.val(c)}>{val}</div>
                                        <div style={S.sub}>{sub}</div>
                                    </div>
                                ))}
                            </div>
                            {importResult.imported.length > 0 && (
                                <div style={{ background: '#10b98112', border: '1px solid #10b98133', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                                    ✅ {importResult.imported.length} record{importResult.imported.length !== 1 ? 's' : ''} imported and saved.
                                </div>
                            )}
                            {importResult.errors.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 12, fontSize: 13 }}>❌ Rows That Could Not Be Imported</div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ ...S.tbl, minWidth: 600 }}>
                                            <thead><tr>{['Row #', 'Problem Fields', 'Error Details', 'Raw Values in File'].map(h => <th key={h} style={{ ...S.th, background: '#ef444412', color: '#ef4444' }}>{h}</th>)}</tr></thead>
                                            <tbody>
                                                {importResult.errors.map((err, i) => (
                                                    <tr key={i} style={{ background: i % 2 === 0 ? T.surface : (dark ? '#ef444408' : '#fff5f5') }}>
                                                        <td style={{ ...S.td, fontWeight: 800, color: '#ef4444', whiteSpace: 'nowrap' }}>Row {err.row}</td>
                                                        <td style={S.td}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                {err.fields.map(f => <span key={f} style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>{f}</span>)}
                                                                {err.fields.length === 0 && <span style={{ color: T.textFaint, fontSize: 11 }}>—</span>}
                                                            </div>
                                                        </td>
                                                        <td style={S.td}>
                                                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: T.textDim }}>
                                                                {err.messages.map((m, j) => <li key={j} style={{ marginBottom: 3, color: j === 0 ? T.text : T.textDim }}>{m}</li>)}
                                                            </ul>
                                                        </td>
                                                        <td style={S.td}>
                                                            {err.rawValues ? (
                                                                <div style={{ fontSize: 10, fontFamily: 'monospace', color: T.textFaint, maxWidth: 260, wordBreak: 'break-all' }}>
                                                                    {Object.entries(err.rawValues).filter(([, v]) => v !== '' && v !== undefined && v !== null).map(([k, v]) => (
                                                                        <div key={k} style={{ marginBottom: 2 }}><span style={{ color: '#f97316' }}>{k}</span>: {String(v).slice(0, 50)}{String(v).length > 50 ? '…' : ''}</div>
                                                                    ))}
                                                                </div>
                                                            ) : <span style={{ color: T.textFaint, fontSize: 11 }}>—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ marginTop: 14 }}>
                                        <button style={S.btn('ghost')} onClick={() => {
                                            const lines = [['Row', 'Problem Fields', 'Error Details', 'Raw Values'].join(','), ...importResult.errors.map(e => [e.row, `"${e.fields.join('; ')}"`, `"${e.messages.join('; ')}"`, `"${e.rawValues ? Object.entries(e.rawValues).map(([k, v]) => `${k}=${v}`).join('; ') : ''}"`].join(','))];
                                            const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `import_errors_${today()}.csv`;
                                            a.click();
                                        }}>⬇️ Download Error Report as CSV</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Danger Zone */}
                <div style={{ ...S.card('#ef4444'), gridColumn: isMobile ? '1' : '1 / -1' }}>
                    {sectionTitle('⚠️ Data Management')}
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>These actions cannot be undone.</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button style={{ ...S.btn('del'), padding: '10px 18px' }} onClick={() => { if (window.confirm('Reset ALL data back to demo data? Everything you have entered will be lost.')) { localStorage.removeItem('segecha_v2'); window.location.reload(); } }}>↺ Reset to Demo Data</button>
                        <button style={{ ...S.btn('del'), padding: '10px 18px' }} onClick={() => { if (window.confirm('Clear ALL data? This removes all trucks, drivers, journeys, fuel, expenses, invoices, and payroll. Cannot be undone.')) { setData({ trucks: [], drivers: [], journeys: [], fuel: [], expenses: [], invoices: [], payroll: [] }); } }}>🗑️ Clear All Data</button>
                    </div>
                </div>

            </div>

            {/* Save button */}
            <div style={{ position: 'sticky', bottom: 0, background: T.surface, borderTop: `1px solid ${T.border}`, padding: '16px 0', marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <button style={{ ...S.btn('green'), padding: '12px 32px', fontSize: 15 }} onClick={saveSettings}>
                    {saved ? '✅ Saved! Reloading…' : '💾 Save All Settings'}
                </button>
                <span style={{ fontSize: 12, color: T.textFaint }}>Settings are stored locally on this device. Page reloads after saving to apply changes.</span>
            </div>
        </div>
    );
};
```

---

## SECTION 14 — Register Settings in PAGES map

Find:
```js
const PAGES = { dashboard: Dashboard, trucks: Fleet, drivers: Drivers, journeys: Journeys, fuel: FuelLog, expenses: Expenses, invoices: Invoices, payroll: Payroll, tyres: TyreMonitor, pnl: PnL };
```
Replace with:
```js
const PAGES = { dashboard: Dashboard, trucks: Fleet, drivers: Drivers, journeys: Journeys, fuel: FuelLog, expenses: Expenses, invoices: Invoices, payroll: Payroll, tyres: TyreMonitor, pnl: PnL, settings: Settings };
```

---

## Final check

Run `npm run dev`. Verify:
- [ ] App loads and all 11 nav items appear including Settings
- [ ] Refresh the page — all data is still there (localStorage working)
- [ ] Add a truck — default tyre interval pre-fills from settings
- [ ] Add a fuel entry — default price pre-fills from settings
- [ ] Add a new invoice — due date auto-sets 14 days from today
- [ ] Journey modal — selecting a truck auto-fills the driver; quick route dropdown appears
- [ ] Dashboard — all 5 alert types render when triggered
- [ ] Settings page — all sections display, Save button reloads the page
- [ ] Backup — downloads a dated .json file containing data + settings
- [ ] Restore — accepts the backup file and reloads with restored data
- [ ] Import — uploading a CSV shows the error report table for bad rows
- [ ] Delete any record — confirm dialog appears before deletion
