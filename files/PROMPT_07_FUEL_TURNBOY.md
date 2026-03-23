-e ---
# SEGECHA — CURSOR SESSION 7 OF 8
# Previous: PROMPT_06_VERIFICATION.md
# Next: PROMPT_08_ROUTE_RATES.md
# Scope: src/App.jsx + driver-portal/src/App.jsx
# Rule: Complete every section and run the checklist before closing this session.
---

# Segecha — Fuel Photos, Turnboy & Mileage Allowance
# Cursor AI Prompt

This prompt adds three features:
1. **Mandatory fuel photos** — pump photo, receipt photo, odometer photo all required when logging fuel
2. **Turnboy management** — salaried turnboys in the system like drivers, casual turnboys as a name on the trip
3. **Mileage allowance** — per-km rate (driver and turnboy rates set separately), auto-calculated per trip, appears as expense + on payroll + on driver portal + on journey record

Apply after all previous prompts. All changes are additive.

---

## PART A — Data model changes

### A.1 — Add turnboy fields to the SEED data in `App.jsx`

Find the `SEED` constant. Inside `drivers`, each driver object already exists. Turnboys who are company-salaried will be stored in a new `turnboys` array. Casual turnboys are just a name on the journey.

Find the closing `};` of the SEED object and before it add a `turnboys` array:

```js
turnboys: [
    // Salaried turnboys added here. Casual turnboys are just a name field on the journey.
    // Example entry (uncomment and edit):
    // { id: "TB001", name: "John Otieno", phone: "0745 678 901", status: "Active", salary: 25000, mpesa: "0745678901", joined: "2024-01-15" },
],
mileageRates: {
    // Per-km rates in KES. Admin configures these in Settings.
    driverPerKm: 10,      // KES per km for main driver
    turnboyPerKm: 6,      // KES per km for turnboy/second driver
    // Route-specific overrides (optional) — keyed as "Origin→Dest"
    routeOverrides: {},
},
```

### A.2 — Add new fields to journey objects

Each journey in `SEED.journeys` needs new optional fields. These are already handled gracefully with `|| null` — existing journeys just won't have them. New journeys will get them from the form.

New fields added to journey records:
```js
{
  // ... existing fields ...
  turnboyId: "",          // TB001 for salaried turnboy, or "" if none
  turnboyName: "",        // Free-text name if casual (not in system)
  turnboyType: "",        // "salaried" | "casual" | ""
  driverMileage: 0,       // KES calculated for driver
  turnboyMileage: 0,      // KES calculated for turnboy
  mileageRateUsed: 0,     // KES/km rate used at time of journey
  turnboyMileageRateUsed: 0,
}
```

### A.3 — Add new fields to fuel entry objects

New fields added to fuel entries:
```js
{
  // ... existing fields ...
  pumpPhotoUrl: "",       // Cloudinary URL — fuel pump photo
  receiptPhotoUrl: "",    // Cloudinary URL — receipt photo
  odomPhotoUrl: "",       // Cloudinary URL — odometer photo at fuel stop
  verifiedByAdmin: false, // Admin has verified the fuel entry
}
```

---

## PART B — Settings page changes

### B.1 — Add mileage rate state variables to the Settings component

Find the last `useState` group inside the `Settings` component. After all existing state declarations, add:

```js
// ── Mileage rates ─────────────────────────────────────────────────────────
const [driverPerKm, setDriverPerKm] = useState(() => {
    try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}').driverPerKm || '10'; }
    catch { return '10'; }
});
const [turnboyPerKm, setTurnboyPerKm] = useState(() => {
    try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}').turnboyPerKm || '6'; }
    catch { return '6'; }
});
```

### B.2 — Add mileage rates to `saveSettings`

Find inside `saveSettings`, the `const s = { ... }` object. Add to it:

```js
driverPerKm, turnboyPerKm,
```

### B.3 — Add mileage rate card to Settings UI

Find the "Journey Defaults" card in the Settings component. After it, add a new card:

```jsx
{/* ── Mileage Allowance Rates ── */}
<div style={S.card()}>
    {sectionTitle('🛣️ Driver Mileage Allowance Rates')}
    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
        Set the KES per km rate paid to drivers and turnboys for each trip.
        The system auto-calculates the allowance when a journey is logged.
    </div>
    {settingRow(
        'Driver Rate (KES per km)',
        'Paid to the main assigned driver per km of the journey',
        <input style={S.inp} type="number" value={driverPerKm} placeholder="10"
            onChange={e => setDriverPerKm(e.target.value)} />
    )}
    {settingRow(
        'Turnboy Rate (KES per km)',
        'Paid to the turnboy / second driver per km of the journey',
        <input style={S.inp} type="number" value={turnboyPerKm} placeholder="6"
            onChange={e => setTurnboyPerKm(e.target.value)} />
    )}
    <div style={{ marginTop: 14, background: dark ? '#0c0e14' : '#f8fafc', borderRadius: 8, padding: '12px 14px', border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 6 }}>Example calculation</div>
        <div style={{ fontSize: 13, color: T.text }}>
            Nairobi → Mombasa (480 km)<br />
            Driver: <b style={{ color: '#10b981' }}>KES {(+driverPerKm * 480).toLocaleString('en-KE')}</b>
            {+turnboyPerKm > 0 && <> · Turnboy: <b style={{ color: '#3b82f6' }}>KES {(+turnboyPerKm * 480).toLocaleString('en-KE')}</b></>}
        </div>
    </div>
</div>

{/* ── Turnboy Management ── */}
<div style={{ ...S.card(), gridColumn: isMobile ? '1' : '1 / -1' }}>
    {sectionTitle('👤 Salaried Turnboys')}
    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
        Add turnboys who are on the company payroll. They will appear in the journey form as assignable.
        Casual (one-off) turnboys are added by name directly on the journey — no record needed here.
    </div>
    <div style={{ ...S.card(), marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 12, fontSize: 13 }}>+ Add Salaried Turnboy</div>
        <AddTurnboyForm />
    </div>
    {data.turnboys?.length > 0 ? (
        <table style={S.tbl}>
            <thead><tr>{['Name', 'Phone', 'M-Pesa', 'Salary', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
                {data.turnboys.map(tb => (
                    <tr key={tb.id}>
                        <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{tb.name}</td>
                        <td style={S.td}>{tb.phone}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#10b981' }}>💚 {tb.mpesa}</td>
                        <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>{fmt(tb.salary)}/mo</td>
                        <td style={S.td}><span style={S.badge(tb.status)}>{tb.status}</span></td>
                        <td style={S.td}>
                            <button style={S.btn('del')} onClick={() => delItem('turnboys', tb.id, tb.name)}>✕</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    ) : (
        <div style={{ fontSize: 13, color: T.textFaint, padding: 12 }}>No salaried turnboys added yet.</div>
    )}
</div>
```

### B.4 — Add the `AddTurnboyForm` component

Find the `DriverPINRow` component inside Settings. Before it, add:

```jsx
const AddTurnboyForm = () => {
    const [form, setForm] = useState({ status: 'Active' });
    const [msg, setMsg] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const save = () => {
        if (!form.name || !form.phone) { setMsg('❌ Name and phone are required'); return; }
        const newTurnboy = {
            id: 'TB' + uid().slice(0, 4),
            name: form.name,
            phone: form.phone,
            status: form.status || 'Active',
            salary: +form.salary || 0,
            mpesa: form.mpesa || form.phone.replace(/\s/g, ''),
            joined: today(),
        };
        setData(d => ({ ...d, turnboys: [...(d.turnboys || []), newTurnboy] }));
        setForm({ status: 'Active' });
        setMsg('✅ Turnboy added');
        setTimeout(() => setMsg(''), 2500);
    };

    return (
        <>
            <div style={S.fgg(2)}>
                <div style={S.fg}>
                    <label style={S.lbl}>Full Name</label>
                    <input style={S.inp} placeholder="e.g. John Otieno" value={form.name || ''}
                        onChange={e => set('name', e.target.value)} />
                </div>
                <div style={S.fg}>
                    <label style={S.lbl}>Phone</label>
                    <input style={S.inp} placeholder="07XX XXX XXX" value={form.phone || ''}
                        onChange={e => set('phone', e.target.value)} />
                </div>
                <div style={S.fg}>
                    <label style={S.lbl}>M-Pesa Number</label>
                    <input style={S.inp} placeholder="07XXXXXXXX" value={form.mpesa || ''}
                        onChange={e => set('mpesa', e.target.value)} />
                </div>
                <div style={S.fg}>
                    <label style={S.lbl}>Monthly Salary (KES)</label>
                    <input style={S.inp} type="number" placeholder="e.g. 25000" value={form.salary || ''}
                        onChange={e => set('salary', e.target.value)} />
                </div>
                <div style={S.fg}>
                    <label style={S.lbl}>Status</label>
                    <select style={S.inp} value={form.status || 'Active'} onChange={e => set('status', e.target.value)}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
            </div>
            {msg && <div style={{ fontSize: 12, color: msg.startsWith('✅') ? '#10b981' : '#ef4444', marginBottom: 10 }}>{msg}</div>}
            <button style={S.btn()} onClick={save}>+ Add Turnboy</button>
        </>
    );
};
```

### B.5 — Add `turnboys` to `delItem` support

The `delItem` function already works generically, but confirm `data.turnboys` is initialized. Find the `SEED` constant — the `turnboys: []` array was added in A.1 above. The `delItem` function will work automatically.

---

## PART C — Journey form changes

### C.1 — Load mileage rates from settings at the top of the file

Find the settings loader block at the top of `App.jsx` (the `const _S = ...` block). Add:

```js
const DRIVER_PER_KM = _S.driverPerKm ? +_S.driverPerKm : 10;
const TURNBOY_PER_KM = _S.turnboyPerKm ? +_S.turnboyPerKm : 6;
```

### C.2 — Replace the journey modal form

Find the journey modal (around the `modal === "journey"` block). Replace the entire modal content with the expanded version:

```jsx
{modal === "journey" && (
    <Modal title={form.id ? "Edit Journey" : "Log Journey"}
        onSave={() => {
            // Auto-calculate mileage allowances before saving
            const dist = +form.distance || 0;
            const driverMileage = Math.round(dist * DRIVER_PER_KM);
            const turnboyMileage = form.turnboyId || form.turnboyName
                ? Math.round(dist * TURNBOY_PER_KM)
                : 0;
            const enrichedForm = {
                ...form,
                driverMileage,
                turnboyMileage,
                mileageRateUsed: DRIVER_PER_KM,
                turnboyMileageRateUsed: TURNBOY_PER_KM,
            };
            saveItem("journeys", enrichedForm);

            // Auto-create expense entries for mileage allowances
            if (driverMileage > 0 && !form.id) {
                // New journey only — don't duplicate on edit
                const driverAllowanceExp = {
                    truck: form.truck,
                    date: form.date || today(),
                    cat: 'Allowance',
                    amount: driverMileage,
                    desc: `Driver mileage allowance — ${form.origin} → ${form.dest} (${dist} km @ KES ${DRIVER_PER_KM}/km)`,
                    journey: form.id || '',
                    _mileageAllowance: true,
                    _forDriver: form.driver,
                };
                saveItem("expenses", driverAllowanceExp);
            }
            if (turnboyMileage > 0 && !form.id && (form.turnboyId || form.turnboyName)) {
                const tbName = form.turnboyId
                    ? (data.turnboys?.find(t => t.id === form.turnboyId)?.name || form.turnboyId)
                    : form.turnboyName;
                const turnboyAllowanceExp = {
                    truck: form.truck,
                    date: form.date || today(),
                    cat: 'Allowance',
                    amount: turnboyMileage,
                    desc: `Turnboy mileage allowance (${tbName}) — ${form.origin} → ${form.dest} (${dist} km @ KES ${TURNBOY_PER_KM}/km)`,
                    journey: form.id || '',
                    _mileageAllowance: true,
                    _forTurnboy: form.turnboyId || form.turnboyName,
                };
                saveItem("expenses", turnboyAllowanceExp);
            }
        }}
    >
        <div style={S.fgg(2)}>
            {/* Quick route selector */}
            <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                <label style={S.lbl}>Quick Route</label>
                <select style={S.inp} onChange={e => {
                    const route = COMMON_ROUTES.find(r => `${r.origin}→${r.dest}` === e.target.value);
                    if (route) setForm(f => ({ ...f, origin: route.origin, dest: route.dest, distance: route.distance }));
                }} defaultValue="">
                    <option value="">— Select a common route or fill in manually below —</option>
                    {COMMON_ROUTES.map(r => (
                        <option key={`${r.origin}→${r.dest}`} value={`${r.origin}→${r.dest}`}>
                            {r.origin} → {r.dest} ({r.distance} km)
                        </option>
                    ))}
                </select>
            </div>

            <F label="Origin" k="origin" />
            <F label="Destination" k="dest" />

            {/* Truck — auto-fills driver */}
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

            <F label="Driver" k="driver" options={data.drivers.map(d => ({ v: d.id, l: d.name }))} />

            <F label="Departure Date" k="date" type="date" />
            <F label="Arrival Date" k="endDate" type="date" />

            <F label="Distance (km)" k="distance" type="number" />
            <F label="Revenue (KES)" k="revenue" type="number" />

            {/* Cargo with datalist */}
            <div style={S.fg}>
                <label style={S.lbl}>Cargo Description</label>
                <input style={S.inp} list="cargo-types-list" value={form.cargo || ''}
                    placeholder="Type or select cargo type"
                    onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
                <datalist id="cargo-types-list">
                    {CARGO_TYPES.map(c => <option key={c} value={c} />)}
                </datalist>
            </div>

            <F label="Weight (Tonnes)" k="weight" type="number" />

            {/* Capacity warning */}
            {form.truck && form.weight && (() => {
                const truck = data.trucks.find(t => t.id === form.truck);
                return truck && +form.weight > +truck.capacity ? (
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ background: "#ef444412", border: "1px solid #ef444433", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444", fontWeight: 700 }}>
                            ⚠️ {form.weight}T exceeds {truck.reg} capacity of {truck.capacity}T
                        </div>
                    </div>
                ) : null;
            })()}

            <F label="Status" k="status" options={STATUSES_JOURNEY} />
            <F label="Notes" k="notes" />

            {/* ── Turnboy section ── */}
            <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                <div style={{ fontWeight: 700, color: T.text, fontSize: 13, marginBottom: 10, paddingTop: 8, borderTop: `1px solid ${T.border2}` }}>
                    👤 Turnboy / Second Driver (optional)
                </div>

                <label style={S.lbl}>Turnboy Type</label>
                <select style={S.inp} value={form.turnboyType || ''} onChange={e => {
                    setForm(f => ({ ...f, turnboyType: e.target.value, turnboyId: '', turnboyName: '' }));
                }}>
                    <option value="">None — solo driver</option>
                    <option value="salaried">Salaried turnboy (from company list)</option>
                    <option value="casual">Casual / one-off turnboy</option>
                </select>

                {form.turnboyType === 'salaried' && (
                    <div style={{ marginTop: 10 }}>
                        <label style={S.lbl}>Select Turnboy</label>
                        {(data.turnboys || []).length === 0 ? (
                            <div style={{ fontSize: 12, color: '#f59e0b', padding: '8px 0' }}>
                                No salaried turnboys added yet. Go to Settings → Turnboys to add them.
                            </div>
                        ) : (
                            <select style={S.inp} value={form.turnboyId || ''} onChange={e => setForm(f => ({ ...f, turnboyId: e.target.value }))}>
                                <option value="">Select…</option>
                                {(data.turnboys || []).filter(tb => tb.status === 'Active').map(tb => (
                                    <option key={tb.id} value={tb.id}>{tb.name} — {tb.phone}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {form.turnboyType === 'casual' && (
                    <div style={{ marginTop: 10 }}>
                        <label style={S.lbl}>Turnboy Name</label>
                        <input style={S.inp} placeholder="e.g. John Otieno" value={form.turnboyName || ''}
                            onChange={e => setForm(f => ({ ...f, turnboyName: e.target.value }))} />
                    </div>
                )}
            </div>

            {/* ── Mileage allowance preview ── */}
            {form.distance && (
                <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                    <div style={{ background: dark ? '#10b98108' : '#f0fdf4', border: '1px solid #10b98133', borderRadius: 8, padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: T.text, fontSize: 12, marginBottom: 8 }}>
                            🛣️ Mileage Allowance Preview ({+form.distance || 0} km)
                        </div>
                        <div style={{ display: 'flex', gap: 20, fontSize: 13, flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ color: T.textFaint }}>Driver: </span>
                                <b style={{ color: '#10b981' }}>{fmt(Math.round((+form.distance || 0) * DRIVER_PER_KM))}</b>
                                <span style={{ color: T.textFaint, fontSize: 11 }}> @ KES {DRIVER_PER_KM}/km</span>
                            </div>
                            {(form.turnboyId || form.turnboyName) && (
                                <div>
                                    <span style={{ color: T.textFaint }}>Turnboy: </span>
                                    <b style={{ color: '#3b82f6' }}>{fmt(Math.round((+form.distance || 0) * TURNBOY_PER_KM))}</b>
                                    <span style={{ color: T.textFaint, fontSize: 11 }}> @ KES {TURNBOY_PER_KM}/km</span>
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>
                            These will be auto-created as Allowance expense entries when you save.
                        </div>
                    </div>
                </div>
            )}
        </div>
    </Modal>
)}
```

---

## PART D — Journeys table — show turnboy and mileage

### D.1 — Add turnboy and mileage columns to the journey table

Find the journey table header array:
```js
["Route", "Truck", "Driver", "Date", "Cargo", "Weight", "Distance", "Revenue", "Status", "Notes", ""]
```

Replace with:
```js
["Route", "Truck", "Driver", "Turnboy", "Date", "Cargo", "Distance", "Revenue", "Mileage", "Status", "Notes", ""]
```

Find the journey table row. After the Driver `<td>`, add a Turnboy column:

```jsx
<td style={S.td}>
    {j.turnboyId
        ? <span style={{ color: '#3b82f6', fontWeight: 600 }}>{data.turnboys?.find(t => t.id === j.turnboyId)?.name || j.turnboyId}</span>
        : j.turnboyName
        ? <span style={{ color: '#3b82f6' }}>{j.turnboyName} <span style={{ fontSize: 10, color: T.textFaint }}>(casual)</span></span>
        : <span style={{ color: T.textFaint }}>—</span>
    }
</td>
```

After the Revenue `<td>`, add a Mileage column:

```jsx
<td style={S.td}>
    {j.driverMileage ? (
        <div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>D: {fmt(j.driverMileage)}</div>
            {j.turnboyMileage > 0 && <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>T: {fmt(j.turnboyMileage)}</div>}
        </div>
    ) : <span style={{ color: T.textFaint }}>—</span>}
</td>
```

---

## PART E — Fuel log changes (mandatory photos)

### E.1 — Add mandatory photo state to the fuel modal

The fuel modal currently uses the `F` component which doesn't handle file uploads. We need to replace the fuel modal with an expanded version that includes photo uploads with mandatory validation.

Find the fuel modal block (`modal === "fuel"`). Replace its `<Modal>` content entirely:

```jsx
{modal === "fuel" && (() => {
    // Track photo URLs in form state
    const pumpUrl = form.pumpPhotoUrl || '';
    const receiptUrl = form.receiptPhotoUrl || '';
    const odomUrl = form.odomPhotoUrl || '';
    const allPhotosUploaded = pumpUrl && receiptUrl && odomUrl;

    const FuelPhotoField = ({ label, hint, fieldKey, mandatory = true }) => {
        const url = form[fieldKey] || '';
        const [uploading, setUploading] = useState(false);
        const [err, setErr] = useState('');

        const handleFile = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setUploading(true); setErr('');
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'fuel_photos');
                formData.append('filename', `${fieldKey}_${Date.now()}`);
                const res = await fetch(`${PAYMENT_API}/api/driver/upload`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) setForm(f => ({ ...f, [fieldKey]: data.url }));
                else setErr(data.error || 'Upload failed');
            } catch { setErr('Upload failed — is the server running?'); }
            setUploading(false);
        };

        return (
            <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                <label style={S.lbl}>
                    {label}
                    {mandatory && <span style={{ color: '#ef4444', marginLeft: 4 }}>* Required</span>}
                </label>
                <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 6 }}>{hint}</div>
                {url ? (
                    <div style={{ position: 'relative', marginBottom: 6 }}>
                        <img src={url} alt={label} style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, border: `1px solid #10b98144` }} />
                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 4 }}>✅ Photo uploaded</div>
                        <button style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
                            onClick={() => setForm(f => ({ ...f, [fieldKey]: '' }))}>✕ Retake</button>
                    </div>
                ) : (
                    <label style={{ display: 'block', background: dark ? T.bg : '#f8fafc', border: `1.5px dashed ${err ? '#ef4444' : T.border}`, borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: 13, color: uploading ? T.textFaint : T.textDim }}>
                        {uploading ? '⏳ Uploading…' : '📷 Click to upload photo'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} disabled={uploading} />
                    </label>
                )}
                {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{err}</div>}
            </div>
        );
    };

    return (
        <Modal
            title={form.id ? "Edit Fuel Entry" : "Log Fuel Fill-up"}
            onSave={() => {
                if (!allPhotosUploaded) {
                    alert('All three photos are required: fuel pump, receipt, and odometer. Please upload all before saving.');
                    return;
                }
                saveItem("fuel", form);
            }}
        >
            <div style={S.fgg(2)}>
                <F label="Truck" k="truck" options={data.trucks.map(t => ({ v: t.id, l: t.reg }))} />
                <F label="Date" k="date" type="date" />
                <F label="Litres" k="litres" type="number" />
                <F label="Price per Litre (KES)" k="pricePerL" type="number" />

                {/* Live cost estimate */}
                {form.litres && form.pricePerL && (
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f97316", fontWeight: 700 }}>
                            ⛽ Estimated Cost: {fmt(+form.litres * +form.pricePerL)}
                        </div>
                    </div>
                )}

                <F label="Station Name" k="station" />
                <F label="Odometer Reading (km)" k="odom" type="number" />
                <F label="Linked Journey" k="journey" options={[{ v: "", l: "None" }, ...data.journeys.map(j => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} full />

                {/* Mandatory photos */}
                <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                    <div style={{ fontWeight: 700, color: T.text, fontSize: 13, marginBottom: 12, paddingTop: 8, borderTop: `1px solid ${T.border2}` }}>
                        📸 Required Photos — All three must be uploaded
                    </div>
                    {!allPhotosUploaded && (
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                            ⚠️ Upload all three photos before you can save this fuel entry.
                            {pumpUrl ? ' ✅ Pump' : ' ❌ Pump'} ·
                            {receiptUrl ? ' ✅ Receipt' : ' ❌ Receipt'} ·
                            {odomUrl ? ' ✅ Odometer' : ' ❌ Odometer'}
                        </div>
                    )}
                </div>

                <FuelPhotoField
                    label="📷 Fuel Pump Photo"
                    hint="Photo of the fuel pump display showing litres and amount dispensed"
                    fieldKey="pumpPhotoUrl"
                    mandatory />

                <FuelPhotoField
                    label="🧾 Receipt Photo"
                    hint="Photo of the printed receipt from the fuel station"
                    fieldKey="receiptPhotoUrl"
                    mandatory />

                <FuelPhotoField
                    label="🛣️ Odometer Photo"
                    hint="Photo of the dashboard odometer at the time of fueling"
                    fieldKey="odomPhotoUrl"
                    mandatory />

                {allPhotosUploaded && (
                    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                            ✅ All photos uploaded — you can now save this fuel entry.
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
})()}
```

### E.2 — Show photo verification status in fuel log table

Find the fuel log table header:
```js
["Date", "Truck", "Station", "Litres", "Price/L", "Total Cost", "Odometer", ""]
```

Replace with:
```js
["Date", "Truck", "Station", "Litres", "Price/L", "Total Cost", "Odometer", "Photos", ""]
```

Find the fuel table row. Before the actions `<td>`, add:

```jsx
<td style={S.td}>
    <div style={{ display: 'flex', gap: 4, fontSize: 11 }}>
        <span title="Fuel pump photo" style={{ color: f.pumpPhotoUrl ? '#10b981' : '#ef4444' }}>
            {f.pumpPhotoUrl ? '✅' : '❌'}⛽
        </span>
        <span title="Receipt photo" style={{ color: f.receiptPhotoUrl ? '#10b981' : '#ef4444' }}>
            {f.receiptPhotoUrl ? '✅' : '❌'}🧾
        </span>
        <span title="Odometer photo" style={{ color: f.odomPhotoUrl ? '#10b981' : '#ef4444' }}>
            {f.odomPhotoUrl ? '✅' : '❌'}🛣️
        </span>
    </div>
</td>
```

### E.3 — Add photo view links when hovering fuel rows

Find the fuel table row `<tr key={f.id}>`. Update it to show photo links on click:

```jsx
<tr key={f.id} style={{ cursor: (f.pumpPhotoUrl || f.receiptPhotoUrl || f.odomPhotoUrl) ? 'pointer' : 'default' }}
    onClick={() => {
        if (f.pumpPhotoUrl || f.receiptPhotoUrl || f.odomPhotoUrl) {
            const photos = [
                f.pumpPhotoUrl && `<a href="${f.pumpPhotoUrl}" target="_blank" style="display:block;margin-bottom:10px">📷 View Fuel Pump Photo</a>`,
                f.receiptPhotoUrl && `<a href="${f.receiptPhotoUrl}" target="_blank" style="display:block;margin-bottom:10px">🧾 View Receipt Photo</a>`,
                f.odomPhotoUrl && `<a href="${f.odomPhotoUrl}" target="_blank" style="display:block">🛣️ View Odometer Photo</a>`,
            ].filter(Boolean).join('');
            const w = window.open('', '_blank', 'width=400,height=300');
            w.document.write(`<html><body style="font-family:Arial;padding:20px"><h3>Fuel Entry Photos — ${f.station} ${f.date}</h3>${photos}</body></html>`);
            w.document.close();
        }
    }}>
```

---

## PART F — Driver portal fuel submission changes

### F.1 — Update fuel submission in driver portal to require all three photos

Find the fuel section inside `SubmitTab` in `driver-portal/src/App.jsx`. Replace the two existing `PhotoField` calls for fuel with three mandatory ones and add validation:

After the odometer reading input, replace the existing photo fields with:

```jsx
<PhotoField
    label="📷 Fuel Pump Photo *REQUIRED*"
    hint="Take a clear photo of the pump display showing litres and total cost"
    token={token} folder="fuel_photos" filename={`pump_${Date.now()}`}
    onUploaded={url => set('pumpPhotoUrl', url)} />

<PhotoField
    label="🧾 Receipt Photo *REQUIRED*"
    hint="Take a photo of the printed station receipt"
    token={token} folder="fuel_photos" filename={`receipt_${Date.now()}`}
    onUploaded={url => set('receiptPhotoUrl', url)} />

<PhotoField
    label="🛣️ Odometer Photo *REQUIRED*"
    hint="Take a photo of your dashboard odometer reading right now"
    token={token} folder="fuel_photos" filename={`odom_${Date.now()}`}
    onUploaded={url => set('odomPhotoUrl', url)} />

{/* Photo completion status */}
{!(form.pumpPhotoUrl && form.receiptPhotoUrl && form.odomPhotoUrl) && (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
        Upload all 3 photos to submit:
        {form.pumpPhotoUrl ? ' ✅' : ' ❌'} Pump ·
        {form.receiptPhotoUrl ? ' ✅' : ' ❌'} Receipt ·
        {form.odomPhotoUrl ? ' ✅' : ' ❌'} Odometer
    </div>
)}
```

Find the submit function inside `SubmitTab`. Find the `subType === 'fuel'` submit path and add validation before the API call:

```js
// At the top of submit(), before the API call:
if (subType === 'fuel') {
    if (!form.pumpPhotoUrl || !form.receiptPhotoUrl || !form.odomPhotoUrl) {
        setMsg('❌ All three photos are required: fuel pump, receipt, and odometer');
        setSubmitting(false);
        return;
    }
}
```

---

## PART G — Driver portal — show mileage allowance on journeys

### G.1 — Show mileage allowance on each journey card in driver portal

Find the expanded journey details block inside `JourneyCard` in `driver-portal/src/App.jsx`. After the `Revenue` info row, add:

```jsx
{j.driverMileage > 0 && (
    <div style={S.infoRow}>
        <span style={{ color: COLORS.textFaint }}>Your Mileage Allowance</span>
        <span style={{ color: COLORS.green, fontWeight: 700 }}>
            {`KES ${Number(j.driverMileage).toLocaleString('en-KE')}`}
            <span style={{ fontSize: 11, color: COLORS.textFaint, fontWeight: 400, marginLeft: 4 }}>
                ({j.distance} km @ KES {j.mileageRateUsed}/km)
            </span>
        </span>
    </div>
)}
{j.turnboyMileage > 0 && (j.turnboyId || j.turnboyName) && (
    <div style={S.infoRow}>
        <span style={{ color: COLORS.textFaint }}>Turnboy Mileage</span>
        <span style={{ color: COLORS.blue, fontWeight: 700 }}>
            {`KES ${Number(j.turnboyMileage).toLocaleString('en-KE')}`}
        </span>
    </div>
)}
```

---

## PART H — P&L and Expenses impact

The mileage allowances are auto-created as `Allowance` category expenses when a journey is saved (Part C.2 above). This means they:
- Automatically appear in the **Expenses page** as `Allowance` entries linked to the journey
- Are included in **P&L cost breakdown** under the Allowance category
- Show in **per-truck P&L** as an operational expense
- Are captured in the **expense category totals** on the Expenses KPI cards

No additional changes needed — the existing expense system handles them automatically.

---

## PART I — Payroll — show trip mileage allowances per driver

### I.1 — Add mileage summary to Payroll page

Find the Payroll component. Find the table that shows driver rows. After the existing `monthPayroll.map(...)` table body, add a mileage summary section:

```jsx
{/* Trip mileage allowances for the selected month */}
{(() => {
    const monthJourneys = data.journeys.filter(j => {
        const jMonth = j.date?.slice(0, 7);
        return jMonth === selMonth && j.status === 'Completed' && j.driverMileage > 0;
    });

    if (monthJourneys.length === 0) return null;

    return (
        <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, color: T.text, marginBottom: 12, fontSize: 14 }}>
                🛣️ Trip Mileage Allowances — {monthLabel(selMonth)}
            </div>
            <table style={S.tbl}>
                <thead>
                    <tr>{['Route', 'Driver', 'Turnboy', 'Distance', 'Driver Allowance', 'Turnboy Allowance', 'Date'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                    {monthJourneys.map(j => {
                        const tbName = j.turnboyId
                            ? (data.turnboys?.find(t => t.id === j.turnboyId)?.name || j.turnboyId)
                            : j.turnboyName || '—';
                        return (
                            <tr key={j.id}>
                                <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{j.origin} → {j.dest}</td>
                                <td style={S.td}>{driverName(j.driver)}</td>
                                <td style={{ ...S.td, color: '#3b82f6' }}>{tbName}</td>
                                <td style={S.td}>{j.distance} km</td>
                                <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>{fmt(j.driverMileage)}</td>
                                <td style={{ ...S.td, color: '#3b82f6', fontWeight: 700 }}>{j.turnboyMileage > 0 ? fmt(j.turnboyMileage) : '—'}</td>
                                <td style={S.td}>{j.date}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr style={{ background: T.border2 }}>
                        <td colSpan={4} style={{ ...S.td, fontWeight: 800, color: T.text, textAlign: 'right' }}>Total Mileage Allowances</td>
                        <td style={{ ...S.td, fontWeight: 800, color: '#10b981', fontSize: 14 }}>
                            {fmt(monthJourneys.reduce((s, j) => s + (j.driverMileage || 0), 0))}
                        </td>
                        <td style={{ ...S.td, fontWeight: 800, color: '#3b82f6', fontSize: 14 }}>
                            {fmt(monthJourneys.reduce((s, j) => s + (j.turnboyMileage || 0), 0))}
                        </td>
                        <td style={S.td}></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
})()}
```

---

## PART J — Dashboard quick summary

### J.1 — Add mileage and turnboy counts to Dashboard KPI section

Find the Dashboard second KPI grid (the Per-Truck Summary and Invoice & Payroll Status cards). Add a third card after them:

```jsx
<div style={S.card()}>
    <div style={{ fontWeight: 700, marginBottom: 16, color: T.text, fontSize: 14 }}>🛣️ Mileage & Turnboys</div>
    {(() => {
        const completedWithMileage = data.journeys.filter(j => j.status === 'Completed' && j.driverMileage > 0);
        const totalDriverMileage = completedWithMileage.reduce((s, j) => s + (j.driverMileage || 0), 0);
        const totalTurnboyMileage = completedWithMileage.reduce((s, j) => s + (j.turnboyMileage || 0), 0);
        const tripsWithTurnboy = data.journeys.filter(j => j.turnboyId || j.turnboyName).length;
        return (
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 12 }}>
                    <span style={{ color: T.textFaint }}>Total Driver Mileage Paid</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>{fmt(totalDriverMileage)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 12 }}>
                    <span style={{ color: T.textFaint }}>Total Turnboy Mileage Paid</span>
                    <span style={{ fontWeight: 700, color: '#3b82f6' }}>{fmt(totalTurnboyMileage)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 12 }}>
                    <span style={{ color: T.textFaint }}>Trips with Turnboy</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{tripsWithTurnboy}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 12 }}>
                    <span style={{ color: T.textFaint }}>Salaried Turnboys</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{(data.turnboys || []).filter(t => t.status === 'Active').length}</span>
                </div>
            </>
        );
    })()}
</div>
```

---

## Summary

| Feature | Where it appears |
|---|---|
| **Fuel pump photo** | Required in fuel modal (main tracker) + driver portal fuel submission |
| **Fuel receipt photo** | Required in both — save blocked until uploaded |
| **Fuel odometer photo** | Required in both — save blocked until uploaded |
| **Photo status indicators** | Fuel log table shows ✅/❌ per photo per entry |
| **Turnboy (salaried)** | Added in Settings → Turnboys, appears in journey dropdown |
| **Turnboy (casual)** | Free-text name field on journey form — no record needed |
| **Turnboy on journey table** | Shown as a column, casual labelled as *(casual)* |
| **Driver mileage allowance** | Auto-calculated on journey save (distance × KES/km rate) |
| **Turnboy mileage allowance** | Auto-calculated if turnboy is assigned |
| **Mileage auto-expense** | Created as Allowance expense entry linked to journey |
| **Mileage on journey record** | `driverMileage`, `turnboyMileage`, `mileageRateUsed` fields |
| **Mileage on driver portal** | Shown per journey in the Trips tab |
| **Mileage on Payroll page** | Monthly mileage table with driver + turnboy totals |
| **Mileage on Dashboard** | Summary card — total paid, turnboy count |
| **Rates configurable** | Settings → Mileage Allowance Rates (driver KES/km, turnboy KES/km) |

## Final checklist

- [ ] `SEED` has `turnboys: []` and `mileageRates` object
- [ ] `DRIVER_PER_KM` and `TURNBOY_PER_KM` constants read from settings at top of file
- [ ] Settings page has Mileage Rates card with live example calculation
- [ ] Settings page has Salaried Turnboys management table + add form
- [ ] Journey modal has Turnboy section (salaried dropdown + casual text field)
- [ ] Journey modal shows live mileage preview as distance is entered
- [ ] Saving a journey auto-creates Allowance expense entries for driver and turnboy
- [ ] Journey table has Turnboy and Mileage columns
- [ ] Fuel modal requires all three photos before Save is enabled
- [ ] Fuel modal shows photo upload status: ✅ Pump · ✅ Receipt · ✅ Odometer
- [ ] Fuel log table shows photo status per row
- [ ] Driver portal fuel submission requires all three photos with validation
- [ ] Driver portal Trips tab shows mileage allowance per journey
- [ ] Payroll page shows monthly mileage allowance table
- [ ] Dashboard has mileage summary card
