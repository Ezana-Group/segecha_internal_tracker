# Segecha — Road Freight Waybill Generator
# Cursor AI Prompt — File: src/App.jsx only
#
# Builds:
#   1. Waybill generator — creates a print-ready waybill from a journey record
#   2. Waybill template settings — admin pre-fills carrier, vehicle, and driver defaults
#   3. Cross-border mode — unlocks HS codes, border crossing, T1/bond fields
#   4. Print / PDF view — clean A4 layout that hides all app chrome on print
#   5. Waybill history — every generated waybill stored against its journey

---

## Context (do not change any of these)

- Currency: KES — never change
- VAT: 16% KRA — never change
- Phone format: +254 — never change
- Company: Segecha Group Ltd, Nairobi, Kenya
- Routes in use: Mombasa↔Kampala, Mombasa↔Jinja, Mombasa↔Dar es Salaam,
  Nairobi↔Kampala, Nairobi↔Mombasa, Nairobi↔Eldoret (domestic)
- Legal basis: Traffic Act Cap. 403 (Kenya), EAC Customs Management Act 2004,
  COMESA Transit Trade Regulations

---

## PART 1 — Data model additions

### 1.1 — Add waybill fields to the journey object

In SEED.journeys, ensure each journey has these optional fields (add if missing):
```js
waybillNo:        null,   // e.g. "WB-2025-00001" — auto-generated on first print
waybillGenerated: false,
waybillData:      null,   // stores the full waybill snapshot (see shape below)
```

### 1.2 — Waybill data shape (stored on the journey)

When a waybill is generated, store this snapshot:
```js
{
  // Auto-generated
  waybillNo:      string,   // "WB-YYYY-NNNNN"
  generatedAt:    string,   // ISO date
  generatedBy:    string,   // "Admin"

  // Trip type
  isCrossBorder:  boolean,  // true = cross-border mode, shows extra fields

  // Carrier (pre-filled from Settings → Waybill Defaults)
  carrierName:    string,
  carrierKraPin:  string,
  carrierNtsa:    string,
  carrierAddress: string,
  carrierPhone:   string,
  carrierEmail:   string,

  // Vehicle (pre-filled from fleet data)
  vehicleReg:     string,
  trailerReg:     string,
  vehicleType:    string,
  maxPayload:     string,

  // Driver (pre-filled from driver data)
  driverName:     string,
  driverIdNo:     string,
  driverLicence:  string,
  driverPhone:    string,

  // Consignor (pre-filled from journey client / invoice, editable)
  consignorName:  string,
  consignorKraPin: string,
  consignorAddress: string,
  consignorPhone: string,
  loadingDateTime: string,

  // Consignee (editable)
  consigneeName:  string,
  consigneeKraPin: string,
  consigneeAddress: string,
  consigneePhone: string,
  expectedDelivery: string,

  // Route (pre-filled from journey)
  origin:         string,
  destination:    string,
  borderPoint:    string,   // cross-border only
  transitRoute:   string,   // cross-border only
  estDistance:    number,
  odomAtLoading:  string,
  odomAtDelivery: string,

  // Cargo (editable, supports multiple lines)
  cargo: [
    {
      id:          string,
      description: string,
      hsCode:      string,   // cross-border only
      packages:    string,
      grossKg:     string,
      netKg:       string,
      volumeM3:    string,
      declaredValue: string,
    }
  ],
  cargoNature:         string,   // "Perishable / Hazardous / Restricted / General"
  specialHandling:     string,
  sealNo:              string,
  conditionAtLoading:  string,
  exceptionsAtLoading: string,

  // Freight
  agreedFreight:    string,
  paymentTerms:     string,   // "Prepaid" | "Collect" | "Third Party"
  advancePaid:      string,
  balanceDue:       string,

  // Accompanying documents (checkboxes)
  docs: {
    commercialInvoice:    boolean,
    packingList:          boolean,
    kraCustomsEntry:      boolean,
    certOfOrigin:         boolean,
    comesaLicence:        boolean,
    transitBond:          boolean,
    phytoSanitary:        boolean,
    kebsCertificate:      boolean,
    t1Document:           boolean,
    dangerousGoodsDecl:   boolean,
    insuranceCert:        boolean,
    other:                string,
  },

  // Delivery receipt (filled in after delivery)
  deliveryDateTime:     string,
  odomAtDeliveryFinal:  string,
  conditionOnArrival:   string,
  exceptionsOnDelivery: string,
  balanceReceived:      string,
}
```

### 1.3 — Add waybill counter to Settings

In `getSettings()` / `saveSettings()`, add:
```js
waybillCounter: 1,   // increments with each generated waybill
waybillPrefix:  'WB', // e.g. WB-2025-00001
```

### 1.4 — Add waybill defaults to Settings

These are the carrier / company fields that pre-fill on every waybill:
```js
wbCarrierName:    '',   // defaults to companyName
wbCarrierKraPin:  '',
wbCarrierNtsa:    '',
wbCarrierAddress: '',
wbCarrierPhone:   '',   // defaults to companyPhone
wbCarrierEmail:   '',
wbTrailerReg:     '',   // company's default trailer registration
```

---

## PART 2 — Waybill generator (main modal)

### 2.1 — Add "Generate Waybill" button to journey table

In the Journeys page, find the action buttons column for each journey row.
After saving a new journey (status = "Loading"), immediately prompt:
"Generate waybill for this journey?" with a Yes / Later choice.
"Yes" opens the WaybillModal pre-filled.
"Later" saves the journey normally — the Waybill button on the row lets admin generate it any time before departure.
Journeys with status "Completed" or "Awaiting Verification" show "View Waybill" (read-only) instead of "Generate".:

```jsx
<button
  style={{ ...S.btn('sm'), fontSize: 11 }}
  onClick={() => openWaybillGenerator(journey)}>
  {journey.waybillGenerated ? 'View Waybill' : 'Waybill'}
</button>
```

### 2.2 — Add state

```js
const [waybillModal, setWaybillModal]     = useState(null); // journey object
const [waybillForm, setWaybillForm]       = useState(null); // waybillData shape
const [waybillPrinting, setWaybillPrinting] = useState(false);
```

### 2.3 — Add the openWaybillGenerator function

```js
const openWaybillGenerator = (journey) => {
    const s  = getSettings();
    const truck  = data.trucks.find(t => t.id === journey.truck) || {};
    const driver = data.drivers.find(d => d.id === journey.driver) || {};

    // If waybill already generated, load the stored data
    if (journey.waybillData) {
        setWaybillForm(journey.waybillData);
        setWaybillModal(journey);
        return;
    }

    // Auto-generate waybill number
    const counter   = s.waybillCounter || 1;
    const prefix    = s.wbCarrierPrefix || 'WB';
    const year      = new Date().getFullYear();
    const waybillNo = `${prefix}-${year}-${String(counter).padStart(5, '0')}`;

    // Detect cross-border: destination outside Kenya
    const crossBorderDestinations = ['kampala', 'jinja', 'entebbe', 'dar es salaam',
        'dodoma', 'mwanza', 'kigali', 'bujumbura', 'kinshasa', 'goma', 'lusaka'];
    const isCrossBorder = crossBorderDestinations.some(d =>
        (journey.dest || '').toLowerCase().includes(d)
    );

    // Border crossing logic
    const borderMap = {
        'kampala': 'Malaba / Busia', 'jinja': 'Malaba / Busia',
        'entebbe': 'Malaba / Busia', 'dar es salaam': 'Namanga / Lunga Lunga',
        'dodoma': 'Namanga', 'mwanza': 'Isebania',
        'kigali': 'Malaba then Gatuna', 'bujumbura': 'Malaba then Kobero',
    };
    const destLower = (journey.dest || '').toLowerCase();
    const borderPoint = Object.entries(borderMap).find(([k]) => destLower.includes(k))?.[1] || '';

    const form = {
        waybillNo,
        generatedAt:  new Date().toISOString(),
        generatedBy:  'Admin',
        isCrossBorder,

        // Carrier — from settings defaults
        carrierName:    s.wbCarrierName    || s.companyName || 'Segecha Group Ltd',
        carrierKraPin:  s.wbCarrierKraPin  || '',
        carrierNtsa:    s.wbCarrierNtsa    || '',
        carrierAddress: s.wbCarrierAddress || '',
        carrierPhone:   s.wbCarrierPhone   || s.companyPhone || '',
        carrierEmail:   s.wbCarrierEmail   || '',

        // Vehicle — from fleet
        vehicleReg:  truck.reg        || '',
        trailerReg:  s.wbTrailerReg   || truck.trailerReg || '',
        vehicleType: truck.type       || '',
        maxPayload:  truck.capacity   ? String(truck.capacity) : '',

        // Driver — from drivers list
        driverName:    driver.name    || '',
        driverIdNo:    driver.idNo    || driver.id || '',
        driverLicence: driver.license || '',
        driverPhone:   driver.phone   || '',

        // Consignor — from invoice client if available
        consignorName:    (() => {
            const inv = data.invoices.find(i => i.journeyId === journey.id);
            return inv?.client || '';
        })(),
        consignorKraPin:    '',
        consignorAddress:   journey.origin || '',
        consignorPhone:     '',
        loadingDateTime:    journey.date ? journey.date + ' 08:00' : '',

        // Consignee — empty by default (must be entered)
        consigneeName:    '',
        consigneeKraPin:  '',
        consigneeAddress: journey.dest || '',
        consigneePhone:   '',
        expectedDelivery: '',

        // Route
        origin:        journey.origin || '',
        destination:   journey.dest   || '',
        borderPoint,
        transitRoute:  isCrossBorder ? 'Northern Corridor — A109 Mombasa–Nairobi–Malaba' : '',
        estDistance:   journey.distance || 0,
        odomAtLoading:  journey.startOdom ? String(journey.startOdom) : '',
        odomAtDelivery: journey.endOdom   ? String(journey.endOdom)   : '',

        // Cargo — pre-fill from journey cargo field
        cargo: [{
            id: 'c1',
            description: journey.cargo || '',
            hsCode:       '',
            packages:     '',
            grossKg:      journey.weight ? String(journey.weight * 1000) : '',
            netKg:        '',
            volumeM3:     '',
            declaredValue: '',
        }],
        cargoNature:         'General',
        specialHandling:     '',
        sealNo:              '',
        conditionAtLoading:  'Good condition',
        exceptionsAtLoading: 'NIL',

        // Freight
        agreedFreight: journey.revenue ? String(journey.revenue) : '',
        paymentTerms:  'Collect',
        advancePaid:   '',
        balanceDue:    journey.revenue ? String(journey.revenue) : '',

        // Docs — default cross-border checklist
        docs: {
            commercialInvoice:  isCrossBorder,
            packingList:        isCrossBorder,
            kraCustomsEntry:    isCrossBorder,
            certOfOrigin:       false,
            comesaLicence:      isCrossBorder,
            transitBond:        isCrossBorder,
            phytoSanitary:      false,
            kebsCertificate:    false,
            t1Document:         isCrossBorder,
            dangerousGoodsDecl: false,
            insuranceCert:      true,
            other:              '',
        },

        // Delivery — blank, filled after
        deliveryDateTime:    '',
        odomAtDeliveryFinal: '',
        conditionOnArrival:  '',
        exceptionsOnDelivery:'',
        balanceReceived:     '',
    };

    setWaybillForm(form);
    setWaybillModal(journey);
};
```

### 2.4 — Waybill generator component

Add this component before the PAGES map:

```jsx
// ══════════════════════════════════════════════════════════════════════════
// WAYBILL GENERATOR MODAL
// ══════════════════════════════════════════════════════════════════════════
const WaybillModal = () => {
    if (!waybillModal || !waybillForm) return null;
    const f = waybillForm;
    const set = (key, val) => setWaybillForm(prev => ({ ...prev, [key]: val }));
    const setDoc = (key, val) => setWaybillForm(prev => ({ ...prev, docs: { ...prev.docs, [key]: val } }));
    const setCargo = (idx, key, val) => setWaybillForm(prev => {
        const cargo = [...prev.cargo];
        cargo[idx] = { ...cargo[idx], [key]: val };
        return { ...prev, cargo };
    });
    const addCargoRow = () => setWaybillForm(prev => ({
        ...prev,
        cargo: [...prev.cargo, { id: uid(), description: '', hsCode: '', packages: '', grossKg: '', netKg: '', volumeM3: '', declaredValue: '' }]
    }));
    const removeCargoRow = (idx) => setWaybillForm(prev => ({
        ...prev,
        cargo: prev.cargo.filter((_, i) => i !== idx)
    }));

    const saveAndPrint = () => {
        // Save waybill data to journey
        const s = getSettings();
        const newCounter = (s.waybillCounter || 1) + 1;
        localStorage.setItem('segecha_settings', JSON.stringify({ ...s, waybillCounter: newCounter }));

        setData(d => ({
            ...d,
            journeys: d.journeys.map(j => j.id === waybillModal.id
                ? { ...j, waybillGenerated: true, waybillNo: f.waybillNo, waybillData: waybillForm }
                : j
            )
        }));

        // Trigger print
        setWaybillPrinting(true);
        setTimeout(() => {
            window.print();
            setWaybillPrinting(false);
        }, 200);
    };

    const saveOnly = () => {
        const s = getSettings();
        const newCounter = (s.waybillCounter || 1) + 1;
        localStorage.setItem('segecha_settings', JSON.stringify({ ...s, waybillCounter: newCounter }));

        setData(d => ({
            ...d,
            journeys: d.journeys.map(j => j.id === waybillModal.id
                ? { ...j, waybillGenerated: true, waybillNo: f.waybillNo, waybillData: waybillForm }
                : j
            )
        }));
        setWaybillModal(null);
        setWaybillForm(null);
    };

    // Section label style
    const sectionTitle = (label) => (
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: T.textFaint, padding: '6px 12px 4px', background: T.surface2, borderBottom: `0.5px solid ${T.border}`, borderTop: `1px solid ${T.border}` }}>
            {label}
        </div>
    );

    const row = (cols) => (
        <div style={{ display: 'grid', gridTemplateColumns: cols || '1fr 1fr', gap: 0, borderBottom: `0.5px solid ${T.border2}` }}>
        </div>
    );

    const fieldCell = (label, value, onChange, opts = {}) => (
        <div style={{ padding: '8px 12px', borderRight: `0.5px solid ${T.border2}`, flex: 1 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.6px', color: T.textFaint, marginBottom: 3 }}>
                {label}
                {opts.required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
                {opts.crossBorderOnly && !f.isCrossBorder && <span style={{ color: T.amber, fontSize: 8, marginLeft: 4 }}>cross-border</span>}
            </div>
            {opts.select ? (
                <select style={{ ...S.inp, marginBottom: 0, fontSize: 12, opacity: opts.crossBorderOnly && !f.isCrossBorder ? 0.4 : 1 }}
                    value={value} onChange={e => onChange(e.target.value)}>
                    {opts.select.map(o => <option key={o}>{o}</option>)}
                </select>
            ) : opts.textarea ? (
                <textarea style={{ ...S.inp, marginBottom: 0, fontSize: 12, height: 44, resize: 'none', opacity: opts.crossBorderOnly && !f.isCrossBorder ? 0.4 : 1 }}
                    value={value} onChange={e => onChange(e.target.value)} />
            ) : (
                <input
                    style={{ ...S.inp, marginBottom: 0, fontSize: 12, fontFamily: opts.mono ? "'DM Mono', monospace" : undefined, opacity: opts.crossBorderOnly && !f.isCrossBorder ? 0.4 : 1, borderColor: opts.required && !value ? T.red + '88' : undefined }}
                    type={opts.type || 'text'}
                    placeholder={opts.placeholder || ''}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    readOnly={opts.readOnly} />
            )}
        </div>
    );

    return (
        <div style={{ ...S.ovl, alignItems: 'flex-start', padding: '20px', overflowY: 'auto' }} onClick={() => { setWaybillModal(null); setWaybillForm(null); }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, width: 'min(900px,98vw)', maxHeight: '95vh', overflowY: 'auto', boxShadow: dark ? '0 24px 64px rgba(0,0,0,0.7)' : '0 24px 64px rgba(0,0,0,0.18)' }}
                onClick={e => e.stopPropagation()}>

                {/* ── MODAL HEADER ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${T.border}`, background: T.surface2, position: 'sticky', top: 0, zIndex: 10 }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: "'Syne', sans-serif" }}>
                            Road Freight Waybill — {f.waybillNo}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                            {waybillModal.origin} → {waybillModal.dest} · {waybillModal.date}
                            {f.isCrossBorder && <span style={{ marginLeft: 8, background: T.blueBg, color: T.blue, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4 }}>Cross-border</span>}
                            {!f.isCrossBorder && <span style={{ marginLeft: 8, background: T.greenBg, color: T.green, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4 }}>Domestic</span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Cross-border toggle */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textDim, cursor: 'pointer', padding: '5px 10px', border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface }}>
                            <input type="checkbox" checked={f.isCrossBorder} onChange={e => set('isCrossBorder', e.target.checked)} />
                            Cross-border mode
                        </label>
                        <button style={S.btn('ghost')} onClick={() => { setWaybillModal(null); setWaybillForm(null); }}>Cancel</button>
                        <button style={S.btn('ghost')} onClick={saveOnly}>Save</button>
                        <button style={S.btn('primary')} onClick={saveAndPrint}>Save & Print</button>
                    </div>
                </div>

                {/* ── FORM BODY ── */}
                <div style={{ padding: 0 }}>

                    {/* Note about pre-filled sections */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: T.amberBg, borderBottom: `1px solid ${T.amber}33`, fontSize: 11, color: T.amber }}>
                        <span style={{ fontWeight: 600 }}>Fields marked</span>
                        <span style={{ color: T.red, fontWeight: 700 }}>*</span>
                        <span>are required. Pre-filled sections come from your fleet data and Settings → Waybill Defaults. Cross-border fields are highlighted</span>
                        <span style={{ background: T.blueBg, color: T.blue, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3 }}>CB</span>
                        <span>— enable "Cross-border mode" to unlock them.</span>
                    </div>

                    {/* ── SECTION 1: Carrier ── */}
                    {sectionTitle('1 · Carrier (transporter) — pre-filled from Settings → Waybill Defaults')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `0.5px solid ${T.border2}` }}>
                        {fieldCell('Company name', f.carrierName, v => set('carrierName', v), { required: true })}
                        {fieldCell('KRA PIN', f.carrierKraPin, v => set('carrierKraPin', v), { required: true, mono: true, placeholder: 'P000000000A' })}
                        {fieldCell('NTSA transport licence no.', f.carrierNtsa, v => set('carrierNtsa', v), { mono: true })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Physical address', f.carrierAddress, v => set('carrierAddress', v))}
                        {fieldCell('Phone / WhatsApp', f.carrierPhone, v => set('carrierPhone', v), { mono: true, placeholder: '+254700000000' })}
                        {fieldCell('Email', f.carrierEmail, v => set('carrierEmail', v))}
                    </div>

                    {/* ── SECTION 2: Vehicle & Driver ── */}
                    {sectionTitle('2 · Vehicle & driver — pre-filled from fleet data')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: `0.5px solid ${T.border2}` }}>
                        {fieldCell('Vehicle registration', f.vehicleReg, v => set('vehicleReg', v), { required: true, mono: true })}
                        {fieldCell('Trailer / chassis reg.', f.trailerReg, v => set('trailerReg', v), { mono: true })}
                        {fieldCell('Vehicle type', f.vehicleType, v => set('vehicleType', v))}
                        {fieldCell('Max payload (tonnes)', f.maxPayload, v => set('maxPayload', v), { mono: true })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Driver full name', f.driverName, v => set('driverName', v), { required: true })}
                        {fieldCell('ID / Passport no.', f.driverIdNo, v => set('driverIdNo', v), { required: true, mono: true })}
                        {fieldCell('PSV / DL licence no.', f.driverLicence, v => set('driverLicence', v), { mono: true })}
                        {fieldCell('Driver phone', f.driverPhone, v => set('driverPhone', v), { mono: true })}
                    </div>

                    {/* ── SECTION 3: Consignor ── */}
                    {sectionTitle('3 · Consignor (shipper / sender) — enter manually')}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `0.5px solid ${T.border2}` }}>
                        {fieldCell('Full name / company', f.consignorName, v => set('consignorName', v), { required: true })}
                        {fieldCell('KRA PIN', f.consignorKraPin, v => set('consignorKraPin', v), { mono: true, placeholder: 'P000000000A' })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Physical address / loading point', f.consignorAddress, v => set('consignorAddress', v), { required: true })}
                        {fieldCell('Phone', f.consignorPhone, v => set('consignorPhone', v), { mono: true })}
                        {fieldCell('Date & time of loading', f.loadingDateTime, v => set('loadingDateTime', v), { type: 'datetime-local' })}
                    </div>

                    {/* ── SECTION 4: Consignee ── */}
                    {sectionTitle('4 · Consignee (receiver) — enter manually')}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: `0.5px solid ${T.border2}` }}>
                        {fieldCell('Full name / company', f.consigneeName, v => set('consigneeName', v), { required: true })}
                        {fieldCell('KRA PIN (required cross-border)', f.consigneeKraPin, v => set('consigneeKraPin', v), { mono: true, crossBorderOnly: true })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Delivery address / off-loading point', f.consigneeAddress, v => set('consigneeAddress', v), { required: true })}
                        {fieldCell('Phone', f.consigneePhone, v => set('consigneePhone', v), { mono: true })}
                        {fieldCell('Expected delivery date', f.expectedDelivery, v => set('expectedDelivery', v), { type: 'date' })}
                    </div>

                    {/* ── SECTION 5: Route ── */}
                    {sectionTitle('5 · Route — pre-filled from journey')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: `0.5px solid ${T.border2}` }}>
                        {fieldCell('Origin county / town', f.origin, v => set('origin', v), { required: true })}
                        {fieldCell('Destination country / town', f.destination, v => set('destination', v), { required: true })}
                        {fieldCell('Border crossing point', f.borderPoint, v => set('borderPoint', v), { crossBorderOnly: true, placeholder: 'e.g. Malaba / Busia' })}
                        {fieldCell('Est. distance (km)', String(f.estDistance), v => set('estDistance', +v), { mono: true })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Approved transit route', f.transitRoute, v => set('transitRoute', v), { crossBorderOnly: true, placeholder: 'e.g. Northern Corridor — A109' })}
                        {fieldCell('Odometer at loading (km)', f.odomAtLoading, v => set('odomAtLoading', v), { mono: true })}
                        {fieldCell('Odometer at delivery (km)', f.odomAtDelivery, v => set('odomAtDelivery', v), { mono: true })}
                    </div>

                    {/* ── SECTION 6: Cargo ── */}
                    {sectionTitle('6 · Cargo description — enter manually' + (f.isCrossBorder ? ' · HS codes required for cross-border' : ''))}
                    <div style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                        <table style={{ ...S.tbl, minWidth: '100%' }}>
                            <thead>
                                <tr>
                                    {['#', 'Description of goods', f.isCrossBorder ? 'HS code' : null, 'Packages', 'Gross kg', 'Net kg', 'Vol m³', 'Declared value (KES)', ''].filter(Boolean).map(h => (
                                        <th key={h} style={{ ...S.th, padding: '6px 8px', fontSize: 9 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {f.cargo.map((c, i) => (
                                    <tr key={c.id}>
                                        <td style={{ ...S.td, fontSize: 11, color: T.textFaint, textAlign: 'center', width: 28 }}>{i + 1}</td>
                                        <td style={S.td}><input style={{ ...S.inp, marginBottom: 0, fontSize: 12 }} value={c.description} onChange={e => setCargo(i, 'description', e.target.value)} placeholder="e.g. Maize flour, 50kg bags" /></td>
                                        {f.isCrossBorder && <td style={S.td}><input style={{ ...S.inp, marginBottom: 0, fontSize: 12, fontFamily: "'DM Mono', monospace", width: 80 }} value={c.hsCode} onChange={e => setCargo(i, 'hsCode', e.target.value)} placeholder="1101.00" /></td>}
                                        <td style={S.td}><input style={{ ...S.inp, marginBottom: 0, fontSize: 12, width: 70 }} value={c.packages} onChange={e => setCargo(i, 'packages', e.target.value)} /></td>
                                        <td style={S.td}><input style={{ ...S.inp, marginBottom: 0, fontSize: 12, fontFamily: "'DM Mono', monospace", width: 80 }} value={c.grossKg} onChange={e => setCargo(i, 'grossKg', e.target.value)} /></td>
                                        <td style={S.td}><input style={{ ...S.inp, marginBottom: 0, fontSize: 12, fontFamily: "'DM Mono', monospace", width: 80 }} value={c.netKg} onChange={e => setCargo(i, 'netKg', e.target.value)} /></td>
                                        <td style={S.td}><input style={{ ...S.inp, marginBottom: 0, fontSize: 12, width: 70 }} value={c.volumeM3} onChange={e => setCargo(i, 'volumeM3', e.target.value)} /></td>
                                        <td style={S.td}><input style={{ ...S.inp, marginBottom: 0, fontSize: 12, fontFamily: "'DM Mono', monospace", width: 110 }} value={c.declaredValue} onChange={e => setCargo(i, 'declaredValue', e.target.value)} /></td>
                                        <td style={S.td}>{f.cargo.length > 1 && <button style={S.btn('del')} onClick={() => removeCargoRow(i)}>✕</button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button style={{ ...S.btn('ghost'), fontSize: 11, margin: '8px 12px' }} onClick={addCargoRow}>+ Add cargo line</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Nature of goods', f.cargoNature, v => set('cargoNature', v), { select: ['General', 'Perishable', 'Hazardous', 'Restricted', 'Perishable + Hazardous'] })}
                        {fieldCell('Special handling instructions', f.specialHandling, v => set('specialHandling', v), { placeholder: 'e.g. Keep dry, do not stack' })}
                    </div>

                    {/* ── SECTION 7: Freight ── */}
                    {sectionTitle('7 · Freight charges')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Agreed freight (KES)', f.agreedFreight, v => set('agreedFreight', v), { mono: true })}
                        {fieldCell('Payment terms', f.paymentTerms, v => set('paymentTerms', v), { select: ['Collect', 'Prepaid', 'Third Party'] })}
                        {fieldCell('Advance / deposit paid (KES)', f.advancePaid, v => set('advancePaid', v), { mono: true })}
                        {fieldCell('Balance due on delivery (KES)', f.balanceDue, v => set('balanceDue', v), { mono: true })}
                    </div>

                    {/* ── SECTION 8: Documents ── */}
                    {sectionTitle('8 · Documents accompanying consignment')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 12px', gap: '4px 0', borderBottom: `1px solid ${T.border}` }}>
                        {[
                            ['commercialInvoice',  'Commercial invoice',               false],
                            ['packingList',         'Packing list',                    false],
                            ['kraCustomsEntry',     'KRA customs entry / IDF',         true],
                            ['certOfOrigin',        'Certificate of origin (COMESA/EAC)', true],
                            ['comesaLicence',       'COMESA carrier licence',          true],
                            ['transitBond',         'Goods in transit bond',           true],
                            ['phytoSanitary',       'Phytosanitary / health cert.',    false],
                            ['kebsCertificate',     'KEBS certificate of conformity',  false],
                            ['t1Document',          'T1 transit document',             true],
                            ['dangerousGoodsDecl',  'Dangerous goods declaration',     false],
                            ['insuranceCert',       'Insurance certificate',           false],
                        ].map(([key, label, cbOnly]) => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: cbOnly && !f.isCrossBorder ? T.textFaint : T.textDim, cursor: 'pointer', padding: '3px 0', opacity: cbOnly && !f.isCrossBorder ? 0.5 : 1 }}>
                                <input type="checkbox" checked={f.docs[key]} onChange={e => setDoc(key, e.target.checked)} disabled={cbOnly && !f.isCrossBorder} />
                                {label}
                                {cbOnly && <span style={{ fontSize: 9, color: T.blue, fontWeight: 600, padding: '0 4px', background: T.blueBg, borderRadius: 2 }}>CB</span>}
                            </label>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, gridColumn: '1/-1' }}>
                            <input type="checkbox" checked={!!f.docs.other} onChange={e => setDoc('other', e.target.checked ? 'Other' : '')} />
                            <span style={{ fontSize: 12, color: T.textDim }}>Other:</span>
                            <input style={{ ...S.inp, marginBottom: 0, fontSize: 12, flex: 1, maxWidth: 280 }} value={typeof f.docs.other === 'string' ? f.docs.other : ''} onChange={e => setDoc('other', e.target.value)} placeholder="Specify…" />
                        </div>
                    </div>

                    {/* ── SECTION 9: Condition ── */}
                    {sectionTitle('9 · Condition of goods & seal')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Condition at loading', f.conditionAtLoading, v => set('conditionAtLoading', v))}
                        {fieldCell('Seal number(s) / container no.', f.sealNo, v => set('sealNo', v), { mono: true, crossBorderOnly: true })}
                        {fieldCell('Exceptions at loading (NIL if none)', f.exceptionsAtLoading, v => set('exceptionsAtLoading', v))}
                    </div>

                    {/* ── SECTION 10: Delivery receipt ── */}
                    {sectionTitle('10 · Delivery receipt — completed on delivery')}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `0.5px solid ${T.border2}` }}>
                        {fieldCell('Date & time of delivery', f.deliveryDateTime, v => set('deliveryDateTime', v), { type: 'datetime-local', placeholder: 'Fill on delivery' })}
                        {fieldCell('Odometer at delivery (km)', f.odomAtDeliveryFinal, v => set('odomAtDeliveryFinal', v), { mono: true })}
                        {fieldCell('Condition of goods on arrival', f.conditionOnArrival, v => set('conditionOnArrival', v))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${T.border}` }}>
                        {fieldCell('Exceptions / damage on delivery (NIL if none)', f.exceptionsOnDelivery, v => set('exceptionsOnDelivery', v))}
                        {fieldCell('Balance freight received (KES)', f.balanceReceived, v => set('balanceReceived', v), { mono: true })}
                    </div>

                    {/* ── BOTTOM ACTIONS ── */}
                    <div style={{ display: 'flex', gap: 10, padding: '16px 18px', justifyContent: 'flex-end', borderTop: `1px solid ${T.border}`, background: T.surface2 }}>
                        <div style={{ fontSize: 11, color: T.textFaint, marginRight: 'auto', alignSelf: 'center' }}>
                            Waybill no. <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.text }}>{f.waybillNo}</span>
                            {f.isCrossBorder
                                ? <span style={{ color: T.blue, marginLeft: 8 }}>Cross-border · 4 copies required · KRA PIN mandatory</span>
                                : <span style={{ color: T.green, marginLeft: 8 }}>Domestic · 4 copies required</span>
                            }
                        </div>
                        <button style={S.btn('ghost')} onClick={() => { setWaybillModal(null); setWaybillForm(null); }}>Cancel</button>
                        <button style={S.btn('ghost')} onClick={saveOnly}>Save without printing</button>
                        <button style={{ ...S.btn('primary'), padding: '8px 20px' }} onClick={saveAndPrint}>Save & Print waybill</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
```

### 2.5 — Render the modal

After `{paymentRecordModal && <RecordPaymentModal inv={paymentRecordModal} />}` add:
```jsx
{waybillModal && <WaybillModal />}
```

---

## PART 3 — Print stylesheet (A4, hides app chrome)

In the global CSS injection `useEffect` (from the UI redesign), append this to the style content:

```css
@media print {
    @page {
        size: A4 portrait;
        margin: 10mm 12mm;
    }

    /* Hide everything except the waybill print view */
    body > * { display: none !important; }
    #waybill-print-root { display: block !important; }

    /* Reset all colours to print-safe */
    #waybill-print-root * {
        color: #000 !important;
        background: #fff !important;
        border-color: #999 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* Tables don't break across pages mid-row */
    #waybill-print-root tr { page-break-inside: avoid; }

    /* Section titles are dark */
    #waybill-print-root .wb-section-title {
        background: #f0f0f0 !important;
        font-weight: 600 !important;
    }
}
```

### 3.1 — Print view component (renders into #waybill-print-root)

Add a `<div id="waybill-print-root" style={{ display: 'none' }}>` near the top of the App JSX (inside the main container but outside all page content). When printing is triggered, populate it with the waybill HTML and show it.

Add this helper function alongside `saveAndPrint`:

```js
const renderPrintView = (f, companyName, logoUrl) => {
    const el = document.getElementById('waybill-print-root');
    if (!el) return;

    const fmtKes = (v) => v ? `KES ${Number(v).toLocaleString('en-KE')}` : '—';
    const fmtLine = (v) => v || '&nbsp;';

    const totalGrossKg  = f.cargo.reduce((s, c) => s + (+c.grossKg  || 0), 0);
    const totalNetKg    = f.cargo.reduce((s, c) => s + (+c.netKg    || 0), 0);
    const totalPackages = f.cargo.reduce((s, c) => s + (+c.packages || 0), 0);
    const totalValue    = f.cargo.reduce((s, c) => s + (+c.declaredValue || 0), 0);

    const docList = Object.entries({
        'Commercial invoice':           f.docs.commercialInvoice,
        'Packing list':                 f.docs.packingList,
        'KRA customs entry / IDF':      f.docs.kraCustomsEntry,
        'Certificate of origin':        f.docs.certOfOrigin,
        'COMESA carrier licence':       f.docs.comesaLicence,
        'Goods in transit bond':        f.docs.transitBond,
        'Phytosanitary certificate':    f.docs.phytoSanitary,
        'KEBS certificate':             f.docs.kebsCertificate,
        'T1 transit document':          f.docs.t1Document,
        'Dangerous goods declaration':  f.docs.dangerousGoodsDecl,
        'Insurance certificate':        f.docs.insuranceCert,
    }).filter(([, v]) => v).map(([k]) => k);
    if (f.docs.other) docList.push(f.docs.other);

    el.style.display = 'block';
    el.innerHTML = `
    <style>
        #waybill-print-root { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #000; }
        .wb-outer { border: 1.5px solid #000; max-width: 100%; }
        .wb-hdr { display: flex; align-items: flex-start; gap: 14px; padding: 10px 14px; border-bottom: 1.5px solid #000; }
        .wb-hdr-logo { width: 56px; height: 56px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 9px; text-align: center; flex-shrink: 0; }
        .wb-hdr-title { font-size: 18px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .wb-hdr-sub { font-size: 9px; color: #555; }
        .wb-num { text-align: right; margin-left: auto; }
        .wb-num-val { font-size: 15px; font-weight: 700; font-family: monospace; border: 1px solid #000; padding: 3px 8px; display: inline-block; }
        .wb-notice { background: #f0f0f0; padding: 4px 12px; font-size: 9px; border-bottom: 1px solid #999; }
        .wb-sec { border-bottom: 1px solid #000; }
        .wb-sec-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; background: #f0f0f0; border-bottom: 1px solid #ccc; }
        .wb-fields { display: grid; }
        .wb-field { padding: 5px 8px; border-right: 0.5px solid #ccc; border-bottom: 0.5px solid #eee; }
        .wb-field:last-child { border-right: none; }
        .wb-flabel { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 2px; }
        .wb-fval { font-size: 10px; border-bottom: 0.5px solid #999; min-height: 16px; padding-bottom: 1px; }
        .wb-fval.large { font-size: 12px; font-weight: 700; }
        .wb-fval.mono { font-family: monospace; }
        table.cargo { width: 100%; border-collapse: collapse; }
        table.cargo th { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 6px; border-bottom: 1px solid #000; border-right: 0.5px solid #ccc; background: #f0f0f0; text-align: left; }
        table.cargo td { font-size: 10px; padding: 4px 6px; border-bottom: 0.5px solid #eee; border-right: 0.5px solid #ccc; height: 18px; }
        table.cargo tr.total td { border-top: 1px solid #000; font-weight: 700; background: #f0f0f0; }
        .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; }
        .sig-box { padding: 8px 10px; border-right: 0.5px solid #ccc; }
        .sig-box:last-child { border-right: none; }
        .sig-line { border-bottom: 1px solid #000; margin: 24px 0 3px; }
        .sig-label { font-size: 8px; color: #666; text-transform: uppercase; }
        .stamp { width: 70px; height: 70px; border: 1px dashed #999; float: right; margin: 4px 0 0 8px; display: flex; align-items: center; justify-content: center; font-size: 8px; text-align: center; color: #aaa; }
        .copy-bar { display: flex; gap: 12px; padding: 4px 12px; background: #f8f8f8; border-top: 1px solid #ccc; font-size: 9px; flex-wrap: wrap; }
        .copy-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
    </style>
    <div class="wb-outer">
        <div class="wb-hdr">
            ${logoUrl ? `<img src="${logoUrl}" style="height:52px;max-width:160px;object-fit:contain;" />` : `<div class="wb-hdr-logo">${companyName.charAt(0)}</div>`}
            <div>
                <div class="wb-hdr-title">Road Freight Waybill</div>
                <div class="wb-hdr-sub">Consignment Note / Goods Received Note · ${f.isCrossBorder ? 'Cross-Border' : 'Domestic'}</div>
                <div style="margin-top:4px;font-size:8px;color:#444;">
                    Traffic Act Cap. 403 (Kenya) · EAC Customs Management Act 2004 · COMESA Transit Trade Regulations
                </div>
            </div>
            <div class="wb-num">
                <div style="font-size:8px;color:#666;text-transform:uppercase;letter-spacing:0.5px">Waybill no.</div>
                <div class="wb-num-val">${f.waybillNo}</div>
                <div style="font-size:9px;color:#555;margin-top:4px">Date issued: ${new Date(f.generatedAt).toLocaleDateString('en-KE')}</div>
            </div>
        </div>
        <div class="wb-notice">
            Issued by: <b>${f.carrierName}</b> · KRA PIN: <b>${f.carrierKraPin || '_______________'}</b>
            ${f.isCrossBorder ? ' · CROSS-BORDER CONSIGNMENT — 4 COPIES REQUIRED — KRA PIN MANDATORY' : ' · DOMESTIC CONSIGNMENT — 4 COPIES REQUIRED'}
        </div>

        <!-- Carrier -->
        <div class="wb-sec">
            <div class="wb-sec-title">1 · Carrier (transporter)</div>
            <div class="wb-fields" style="grid-template-columns:2fr 1fr 1fr">
                <div class="wb-field"><div class="wb-flabel">Company name</div><div class="wb-fval large">${fmtLine(f.carrierName)}</div></div>
                <div class="wb-field"><div class="wb-flabel">KRA PIN</div><div class="wb-fval mono">${fmtLine(f.carrierKraPin)}</div></div>
                <div class="wb-field"><div class="wb-flabel">NTSA licence no.</div><div class="wb-fval mono">${fmtLine(f.carrierNtsa)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Address</div><div class="wb-fval">${fmtLine(f.carrierAddress)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Phone</div><div class="wb-fval mono">${fmtLine(f.carrierPhone)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Email</div><div class="wb-fval">${fmtLine(f.carrierEmail)}</div></div>
            </div>
        </div>

        <!-- Vehicle & Driver -->
        <div class="wb-sec">
            <div class="wb-sec-title">2 · Vehicle & driver</div>
            <div class="wb-fields" style="grid-template-columns:1fr 1fr 1fr 1fr">
                <div class="wb-field"><div class="wb-flabel">Vehicle reg.</div><div class="wb-fval large mono">${fmtLine(f.vehicleReg)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Trailer reg.</div><div class="wb-fval mono">${fmtLine(f.trailerReg)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Vehicle type</div><div class="wb-fval">${fmtLine(f.vehicleType)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Max payload (t)</div><div class="wb-fval mono">${fmtLine(f.maxPayload)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Driver name</div><div class="wb-fval large">${fmtLine(f.driverName)}</div></div>
                <div class="wb-field"><div class="wb-flabel">ID / Passport no.</div><div class="wb-fval mono">${fmtLine(f.driverIdNo)}</div></div>
                <div class="wb-field"><div class="wb-flabel">PSV / DL licence</div><div class="wb-fval mono">${fmtLine(f.driverLicence)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Driver phone</div><div class="wb-fval mono">${fmtLine(f.driverPhone)}</div></div>
            </div>
        </div>

        <!-- Consignor + Consignee side by side -->
        <div class="wb-sec" style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000">
            <div style="border-right:1px solid #000">
                <div class="wb-sec-title">3 · Consignor (sender)</div>
                <div class="wb-fields" style="grid-template-columns:1fr 1fr">
                    <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Full name / company</div><div class="wb-fval large">${fmtLine(f.consignorName)}</div></div>
                    <div class="wb-field"><div class="wb-flabel">KRA PIN</div><div class="wb-fval mono">${fmtLine(f.consignorKraPin)}</div></div>
                    <div class="wb-field"><div class="wb-flabel">Phone</div><div class="wb-fval mono">${fmtLine(f.consignorPhone)}</div></div>
                    <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Loading address</div><div class="wb-fval">${fmtLine(f.consignorAddress)}</div></div>
                    <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Date & time of loading</div><div class="wb-fval mono">${fmtLine(f.loadingDateTime)}</div></div>
                </div>
            </div>
            <div>
                <div class="wb-sec-title">4 · Consignee (receiver)</div>
                <div class="wb-fields" style="grid-template-columns:1fr 1fr">
                    <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Full name / company</div><div class="wb-fval large">${fmtLine(f.consigneeName)}</div></div>
                    <div class="wb-field"><div class="wb-flabel">KRA PIN${f.isCrossBorder ? ' ✱' : ''}</div><div class="wb-fval mono">${fmtLine(f.consigneeKraPin)}</div></div>
                    <div class="wb-field"><div class="wb-flabel">Phone</div><div class="wb-fval mono">${fmtLine(f.consigneePhone)}</div></div>
                    <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Delivery address</div><div class="wb-fval">${fmtLine(f.consigneeAddress)}</div></div>
                    <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Expected delivery date</div><div class="wb-fval mono">${fmtLine(f.expectedDelivery)}</div></div>
                </div>
            </div>
        </div>

        <!-- Route -->
        <div class="wb-sec">
            <div class="wb-sec-title">5 · Route</div>
            <div class="wb-fields" style="grid-template-columns:1fr 1fr ${f.isCrossBorder ? '1fr 1fr' : '1fr 1fr'}">
                <div class="wb-field"><div class="wb-flabel">Origin</div><div class="wb-fval large">${fmtLine(f.origin)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Destination</div><div class="wb-fval large">${fmtLine(f.destination)}</div></div>
                ${f.isCrossBorder ? `<div class="wb-field"><div class="wb-flabel">Border crossing</div><div class="wb-fval">${fmtLine(f.borderPoint)}</div></div>` : ''}
                <div class="wb-field"><div class="wb-flabel">Est. distance (km)</div><div class="wb-fval mono">${fmtLine(String(f.estDistance))}</div></div>
                ${f.isCrossBorder ? `<div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Approved transit route</div><div class="wb-fval">${fmtLine(f.transitRoute)}</div></div>` : ''}
                <div class="wb-field"><div class="wb-flabel">Odometer at loading</div><div class="wb-fval mono">${fmtLine(f.odomAtLoading)} km</div></div>
                <div class="wb-field"><div class="wb-flabel">Odometer at delivery</div><div class="wb-fval mono">${fmtLine(f.odomAtDelivery)} km</div></div>
            </div>
        </div>

        <!-- Cargo -->
        <div class="wb-sec">
            <div class="wb-sec-title">6 · Cargo description</div>
            <table class="cargo">
                <thead>
                    <tr>
                        <th style="width:22px">#</th>
                        <th>Description of goods</th>
                        ${f.isCrossBorder ? '<th style="width:70px">HS code</th>' : ''}
                        <th style="width:55px">Packages</th>
                        <th style="width:65px">Gross kg</th>
                        <th style="width:65px">Net kg</th>
                        <th style="width:55px">Vol m³</th>
                        <th style="width:85px">Declared value</th>
                    </tr>
                </thead>
                <tbody>
                    ${f.cargo.map((c, i) => `<tr>
                        <td>${i + 1}</td>
                        <td>${fmtLine(c.description)}</td>
                        ${f.isCrossBorder ? `<td style="font-family:monospace">${fmtLine(c.hsCode)}</td>` : ''}
                        <td>${fmtLine(c.packages)}</td>
                        <td style="font-family:monospace">${fmtLine(c.grossKg)}</td>
                        <td style="font-family:monospace">${fmtLine(c.netKg)}</td>
                        <td>${fmtLine(c.volumeM3)}</td>
                        <td style="font-family:monospace">${fmtLine(c.declaredValue)}</td>
                    </tr>`).join('')}
                    ${f.cargo.length < 3 ? Array(3 - f.cargo.length).fill('<tr><td>&nbsp;</td><td></td>${f.isCrossBorder ? "<td></td>" : ""}<td></td><td></td><td></td><td></td><td></td></tr>').join('') : ''}
                    <tr class="total">
                        <td colspan="${f.isCrossBorder ? 3 : 2}" style="text-align:right;font-size:8px;letter-spacing:0.5px;text-transform:uppercase">Totals</td>
                        <td style="font-family:monospace">${totalPackages || ''}</td>
                        <td style="font-family:monospace">${totalGrossKg ? totalGrossKg.toLocaleString('en-KE') : ''}</td>
                        <td style="font-family:monospace">${totalNetKg ? totalNetKg.toLocaleString('en-KE') : ''}</td>
                        <td></td>
                        <td style="font-family:monospace">${totalValue ? 'KES ' + totalValue.toLocaleString('en-KE') : ''}</td>
                    </tr>
                </tbody>
            </table>
            <div class="wb-fields" style="grid-template-columns:1fr 1fr">
                <div class="wb-field"><div class="wb-flabel">Nature of goods</div><div class="wb-fval">${fmtLine(f.cargoNature)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Special handling</div><div class="wb-fval">${fmtLine(f.specialHandling)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Condition at loading</div><div class="wb-fval">${fmtLine(f.conditionAtLoading)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Seal no. / container no.</div><div class="wb-fval mono">${fmtLine(f.sealNo)}</div></div>
                <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Exceptions at loading (NIL if none)</div><div class="wb-fval">${fmtLine(f.exceptionsAtLoading)}</div></div>
            </div>
        </div>

        <!-- Freight + Documents side by side -->
        <div class="wb-sec" style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000">
            <div style="border-right:1px solid #000">
                <div class="wb-sec-title">7 · Freight charges</div>
                <div class="wb-fields" style="grid-template-columns:1fr 1fr">
                    <div class="wb-field"><div class="wb-flabel">Agreed freight</div><div class="wb-fval mono large">${fmtLine(f.agreedFreight ? 'KES ' + Number(f.agreedFreight).toLocaleString('en-KE') : '')}</div></div>
                    <div class="wb-field"><div class="wb-flabel">Payment terms</div><div class="wb-fval">${fmtLine(f.paymentTerms)}</div></div>
                    <div class="wb-field"><div class="wb-flabel">Advance paid</div><div class="wb-fval mono">${fmtLine(f.advancePaid ? 'KES ' + Number(f.advancePaid).toLocaleString('en-KE') : '')}</div></div>
                    <div class="wb-field"><div class="wb-flabel">Balance due</div><div class="wb-fval mono">${fmtLine(f.balanceDue ? 'KES ' + Number(f.balanceDue).toLocaleString('en-KE') : '')}</div></div>
                </div>
            </div>
            <div>
                <div class="wb-sec-title">8 · Documents accompanying</div>
                <div style="padding:6px 10px;display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:9px">
                    ${docList.length > 0
                        ? docList.map(d => `<div>&#9745; ${d}</div>`).join('')
                        : '<div style="color:#999">No documents specified</div>'
                    }
                </div>
            </div>
        </div>

        <!-- Signatures at loading -->
        <div class="wb-sec">
            <div class="wb-sec-title">9 · Certification at loading / dispatch — all parties sign before departure</div>
            <div class="sig-row">
                <div class="sig-box">
                    <div class="stamp">Company stamp</div>
                    <div style="font-size:9px;color:#444;margin-bottom:4px">Consignor — I confirm the goods described above have been handed to the carrier in the stated condition.</div>
                    <div class="sig-line"></div>
                    <div class="sig-label">Signature &amp; name · Date</div>
                </div>
                <div class="sig-box">
                    <div style="font-size:9px;color:#444;margin-bottom:4px">Driver / Carrier — I have received the above goods and confirm the details are correct.</div>
                    <div class="sig-line"></div>
                    <div class="sig-label">Signature &amp; name · Date</div>
                </div>
                <div class="sig-box">
                    <div class="stamp">Carrier stamp</div>
                    <div style="font-size:9px;color:#444;margin-bottom:4px">Carrier company authorised representative (required for cross-border transit).</div>
                    <div class="sig-line"></div>
                    <div class="sig-label">Signature &amp; name · Date</div>
                </div>
            </div>
        </div>

        <!-- Delivery receipt -->
        <div class="wb-sec">
            <div class="wb-sec-title">10 · Delivery receipt — completed by consignee on delivery</div>
            <div class="wb-fields" style="grid-template-columns:1fr 1fr 1fr">
                <div class="wb-field"><div class="wb-flabel">Date & time of delivery</div><div class="wb-fval mono">${fmtLine(f.deliveryDateTime)}</div></div>
                <div class="wb-field"><div class="wb-flabel">Odometer at delivery</div><div class="wb-fval mono">${fmtLine(f.odomAtDeliveryFinal)} km</div></div>
                <div class="wb-field"><div class="wb-flabel">Condition on arrival</div><div class="wb-fval">${fmtLine(f.conditionOnArrival)}</div></div>
                <div class="wb-field" style="grid-column:1/-1"><div class="wb-flabel">Exceptions / damage on delivery (NIL if none)</div><div class="wb-fval" style="min-height:20px">${fmtLine(f.exceptionsOnDelivery)}</div></div>
            </div>
            <div class="sig-row">
                <div class="sig-box">
                    <div class="stamp">Company stamp</div>
                    <div style="font-size:9px;color:#444;margin-bottom:4px">Consignee — I confirm receipt of the goods described above.</div>
                    <div class="sig-line"></div>
                    <div class="sig-label">Signature &amp; name · ID no. · Date</div>
                </div>
                <div class="sig-box">
                    <div style="font-size:9px;color:#444;margin-bottom:4px">Driver — delivery completed.</div>
                    <div class="sig-line"></div>
                    <div class="sig-label">Signature &amp; name · Date</div>
                </div>
                <div class="sig-box">
                    <div style="font-size:9px;color:#444;margin-bottom:4px">Balance freight received:</div>
                    <div style="font-size:16px;font-weight:700;font-family:monospace;margin:6px 0 12px">${f.balanceReceived ? 'KES ' + Number(f.balanceReceived).toLocaleString('en-KE') : '________________'}</div>
                    <div class="sig-line"></div>
                    <div class="sig-label">Carrier receipt stamp · Date</div>
                </div>
            </div>
        </div>

        <div class="copy-bar">
            <b>4 copies required:</b>
            <span><span class="copy-dot" style="background:#1a7f37"></span>White — Consignor (original, retained)</span>
            <span><span class="copy-dot" style="background:#0969da"></span>Blue — Consignee (travels with goods)</span>
            <span><span class="copy-dot" style="background:#d1242f"></span>Red — Driver (kept throughout journey)</span>
            <span><span class="copy-dot" style="background:#9a6700"></span>Yellow — KRA / Customs (surrendered at border or weighbridge)</span>
        </div>
    </div>`;
};
```

Call `renderPrintView(f, companyName, logoUrl)` inside `saveAndPrint`, before `window.print()`.
After `window.print()`, reset the print root: `document.getElementById('waybill-print-root').style.display = 'none';`

---

## PART 4 — Settings: Waybill Defaults section

In the Settings component, in `NAV_GROUPS` under the Business group, add:
```js
{ id: 'waybill', icon: '📋', label: 'Waybill Defaults' },
```

Add the following state variables to Settings:
```js
const [wbCarrierName,    setWbCarrierName]    = useState(() => loadSetting('wbCarrierName', ''));
const [wbCarrierKraPin,  setWbCarrierKraPin]  = useState(() => loadSetting('wbCarrierKraPin', ''));
const [wbCarrierNtsa,    setWbCarrierNtsa]    = useState(() => loadSetting('wbCarrierNtsa', ''));
const [wbCarrierAddress, setWbCarrierAddress] = useState(() => loadSetting('wbCarrierAddress', ''));
const [wbCarrierPhone,   setWbCarrierPhone]   = useState(() => loadSetting('wbCarrierPhone', ''));
const [wbCarrierEmail,   setWbCarrierEmail]   = useState(() => loadSetting('wbCarrierEmail', ''));
const [wbTrailerReg,     setWbTrailerReg]     = useState(() => loadSetting('wbTrailerReg', ''));
const [wbPrefix,         setWbPrefix]         = useState(() => loadSetting('wbPrefix', 'WB'));
const [wbCounter,        setWbCounter]        = useState(() => loadSetting('waybillCounter', 1));
```

Add these to `saveSettings()`:
```js
wbCarrierName, wbCarrierKraPin, wbCarrierNtsa, wbCarrierAddress,
wbCarrierPhone, wbCarrierEmail, wbTrailerReg,
wbPrefix, waybillCounter: +wbCounter,
```

Add the waybill panel to the `panels` object:
```jsx
waybill: (
    <>
        {sectionHead('Waybill defaults', 'These values pre-fill every new waybill. Only fields specific to each trip need to be entered manually.')}

        {card(<>
            {cardTitle('Carrier details (Section 1 of every waybill)')}
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>
                These are your company's details as the road carrier / transporter. Set once, pre-filled on all waybills.
            </div>
            <div style={grid2}>
                {field('Carrier / company name', 'Defaults to your company name if blank', inp(wbCarrierName, setWbCarrierName, { placeholder: 'Segecha Group Ltd' }))}
                {field('KRA PIN', 'Required on all waybills — domestic and cross-border', inp(wbCarrierKraPin, setWbCarrierKraPin, { placeholder: 'P000000000A' }))}
                {field('NTSA transport licence no.', 'Your commercial transport operator licence', inp(wbCarrierNtsa, setWbCarrierNtsa, { placeholder: 'NTSA/TL/XXXX' }))}
                {field('Default trailer registration', 'Pre-filled in Section 2 — override per waybill as needed', inp(wbTrailerReg, setWbTrailerReg, { placeholder: 'e.g. ZH 5825' }))}
                {field('Office address', 'Shown on waybill as carrier address', inp(wbCarrierAddress, setWbCarrierAddress, { placeholder: 'e.g. Industrial Area, Nairobi' }))}
                {field('Office phone / WhatsApp', 'Shown on waybill', inp(wbCarrierPhone, setWbCarrierPhone, { placeholder: '+254700000000' }))}
                {field('Office email', '', inp(wbCarrierEmail, setWbCarrierEmail, { placeholder: 'operations@segecha.com', type: 'email' }))}
            </div>
        </>)}

        {card(<>
            {cardTitle('Waybill numbering')}
            <div style={grid2}>
                {field('Waybill number prefix', 'e.g. WB → WB-2025-00001', inp(wbPrefix, setWbPrefix, { onChange: e => setWbPrefix(e.target.value.toUpperCase()) }))}
                {field('Next waybill number', 'Auto-increments after each generated waybill', inp(String(wbCounter), v => setWbCounter(+v), { type: 'number', min: 1 }))}
            </div>
            <div style={{ background: dark ? T.bg : '#f8fafc', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: T.textDim }}>
                Next waybill will be: <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.text }}>{wbPrefix}-{new Date().getFullYear()}-{String(wbCounter).padStart(5, '0')}</span>
            </div>
        </>)}

        {card(<>
            {cardTitle('Cross-border routes & border points')}
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>
                When a journey destination matches one of these keywords, cross-border mode is enabled automatically
                and the border crossing point is pre-filled. Add or adjust as needed.
            </div>
            <div style={{ background: dark ? T.bg : '#f8fafc', borderRadius: 6, padding: '10px 14px', fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textDim, lineHeight: 2 }}>
                kampala, jinja, entebbe → Malaba / Busia<br/>
                dar es salaam, dodoma → Namanga / Lunga Lunga<br/>
                mwanza → Isebania<br/>
                kigali → Malaba then Gatuna<br/>
                bujumbura → Malaba then Kobero<br/>
                kinshasa, goma → Malaba then Kasindi
            </div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 8 }}>
                Edit the <code style={{ background: T.surface2, padding: '1px 5px', borderRadius: 3 }}>borderMap</code> object
                in the <code style={{ background: T.surface2, padding: '1px 5px', borderRadius: 3 }}>openWaybillGenerator</code> function
                to customise these mappings.
            </div>
        </>)}
    </>
),
```

---

## PART 5 — Waybill history tab on Journey detail

In the `VehicleDetailModal` or the journey table row, add a waybill indicator:

In the journey table, in the Status column area, if `journey.waybillGenerated` is true, add:
```jsx
{journey.waybillGenerated && (
    <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.blue, marginLeft: 6 }}>
        {journey.waybillNo}
    </span>
)}
```

---

## PART 6 — Checklist

- [ ] "Waybill" button appears on every journey row in the Journeys table
- [ ] Button says "View Waybill" if waybill already generated for that journey
- [ ] Clicking opens the WaybillModal pre-populated with journey data
- [ ] Section 1 (Carrier) pre-fills from Settings → Waybill Defaults
- [ ] Section 2 (Vehicle & Driver) pre-fills from fleet + drivers data
- [ ] Section 3 (Consignor) pre-fills from journey origin + invoice client name
- [ ] Section 4 (Consignee) pre-fills destination, everything else blank (manual entry)
- [ ] Section 5 (Route) pre-fills from journey — origin, destination, distance, odometers
- [ ] Kampala/Jinja/Dar/Kigali destinations auto-enable cross-border mode
- [ ] Cross-border mode auto-fills border crossing point (Malaba / Busia etc.)
- [ ] "Cross-border mode" toggle in modal header switches mode on/off
- [ ] Cross-border fields (HS codes, border point, COMESA docs, T1) are greyed out in domestic mode
- [ ] Cross-border fields become active and editable when cross-border mode is on
- [ ] CB badge shown next to cross-border-only fields in the form
- [ ] HS code column appears in cargo table only in cross-border mode
- [ ] Cargo table supports adding/removing lines (+ Add cargo line, ✕ per row)
- [ ] Cargo totals row auto-calculates gross kg, net kg, packages, declared value
- [ ] Documents checklist: CB-only docs (T1, transit bond, COMESA, customs entry) auto-check in cross-border mode
- [ ] CB-only doc checkboxes are disabled in domestic mode
- [ ] Required fields (marked *) have red border if empty
- [ ] "Save without printing" saves waybill data to journey record
- [ ] "Save & Print" saves data, renders print HTML, calls window.print()
- [ ] Print view renders clean A4 layout with no app chrome
- [ ] Print view uses Arial (printer-safe font), black text, light grey section headers
- [ ] Print view shows company logo if set in Settings → Company
- [ ] Print view has 4-copy colour bar at bottom
- [ ] Print CSS hides all app UI except #waybill-print-root
- [ ] After print, #waybill-print-root is hidden again
- [ ] Journey row shows waybill number (WB-2025-00001) after generation
- [ ] Waybill counter auto-increments in Settings after each generation
- [ ] Settings → Waybill Defaults shows carrier fields, numbering, border map reference
- [ ] Next waybill number preview shown in Settings (e.g. WB-2025-00003)
- [ ] Re-opening a generated waybill loads the saved data (not re-generated)
