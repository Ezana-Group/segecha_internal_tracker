# Segecha — Waybill Fix (Corrective Prompt)
# Cursor AI Prompt — File: src/App.jsx only
#
# The current implementation is wrong. It created a standalone "Waybill Management"
# page with a "Register Waybill" form that has 4 fields and is disconnected from
# the journeys data. This must be removed entirely and replaced with the correct
# approach described below.

---

## STEP 1 — Remove the broken implementation

Search for and DELETE all of the following:

1. Any component named `WaybillManagement`, `WaybillPage`, `WaybillRegister`,
   or anything with "waybill" in the name that renders as a standalone page.

2. Any modal named `RegisterWaybillModal` or similar that has only these fields:
   waybill number, date, customer, assigned truck, status.

3. Any navigation item pointing to a standalone waybill page.

4. Any state variable like `waybillList` that stores waybills as a separate
   array independent of journeys.

5. The "+ Register Waybill" button that opens the above modal.

After deletion, run `npm run dev` and confirm the app still loads. The journeys
page must still work normally.

---

## STEP 2 — Understand the correct architecture

A waybill in this system is NOT a standalone record.
A waybill IS a document generated FROM an existing journey record.

The relationship is:
  journey (1) ──── generates ──── waybill (1)

One journey = one waybill. The waybill number (e.g. WB-2025-00001) is stored
ON the journey object, not in a separate list.

The waybill button lives on the JOURNEYS page, on each journey row.
There is no separate "Waybill Management" page.

---

## STEP 3 — Add these fields to each journey object in SEED

In the SEED data (the default journey objects), add:
```js
waybillNo:        null,
waybillGenerated: false,
waybillData:      null,
```

Also ensure `getSettings()` reads these waybill-related settings with fallbacks:
```js
const s = getSettings();
const wbPrefix  = s.wbPrefix  || 'WB';
const wbCounter = s.waybillCounter || 1;
```

---

## STEP 4 — Add the Waybill button to the Journeys table

Find the Journeys page component. Find the `<tbody>` rows where each journey
is rendered. Find the `<td>` that contains action buttons (Edit, Delete, etc).

Add ONE new button to that actions cell:

```jsx
<button
    style={{
        padding: '4px 10px',
        fontSize: 11,
        borderRadius: 5,
        border: `1px solid ${T.border}`,
        background: journey.waybillGenerated ? T.greenBg : T.surface2,
        color: journey.waybillGenerated ? T.green : T.textDim,
        cursor: 'pointer',
        fontWeight: journey.waybillGenerated ? 600 : 400,
    }}
    onClick={() => openWaybillGenerator(journey)}>
    {journey.waybillGenerated ? `WB: ${journey.waybillNo}` : 'Waybill'}
</button>
```

If the journey already has a waybill, the button shows the waybill number in green.
If not, it shows "Waybill" in grey.

---

## STEP 5 — Add state variables (near other modal state variables)

Find where modal state is declared (near `paymentRecordModal`, `verifyModal`, etc).
Add:

```js
const [waybillModal, setWaybillModal]   = useState(null); // holds the journey object
const [waybillForm,  setWaybillForm]    = useState(null); // holds the waybill data shape
```

---

## STEP 6 — Add the openWaybillGenerator function

Find the helper functions section (near `buildPortalUrl`, `buildWhatsAppUrl`, etc).
Add this function:

```js
const openWaybillGenerator = (journey) => {
    // If waybill already generated, load saved data for editing
    if (journey.waybillData) {
        setWaybillForm(journey.waybillData);
        setWaybillModal(journey);
        return;
    }

    const s      = getSettings();
    const truck  = data.trucks.find(t => t.id === journey.truck)  || {};
    const driver = data.drivers.find(d => d.id === journey.driver) || {};

    // Auto-generate waybill number
    const counter   = s.waybillCounter || 1;
    const prefix    = s.wbPrefix || 'WB';
    const year      = new Date().getFullYear();
    const waybillNo = `${prefix}-${year}-${String(counter).padStart(5, '0')}`;

    // Auto-detect cross-border based on destination
    const crossBorderKeywords = [
        'kampala', 'jinja', 'entebbe', 'gulu', 'mbarara',
        'dar es salaam', 'dodoma', 'mwanza', 'arusha', 'moshi',
        'kigali', 'bujumbura', 'kinshasa', 'goma', 'bukavu',
        'lusaka', 'nairobi' // nairobi is domestic so exclude
    ];
    const destLower = (journey.dest || '').toLowerCase();
    const isCrossBorder = crossBorderKeywords
        .filter(k => k !== 'nairobi')
        .some(k => destLower.includes(k));

    // Auto-fill border crossing point
    const borderMap = {
        'kampala': 'Malaba / Busia', 'jinja': 'Malaba / Busia',
        'entebbe': 'Malaba / Busia', 'gulu': 'Malaba / Busia',
        'mbarara': 'Malaba / Busia',
        'dar es salaam': 'Namanga / Lunga Lunga',
        'dodoma': 'Namanga', 'arusha': 'Namanga', 'moshi': 'Namanga',
        'mwanza': 'Isebania',
        'kigali': 'Malaba then Gatuna',
        'bujumbura': 'Malaba then Kobero',
        'kinshasa': 'Malaba then Kasindi', 'goma': 'Malaba then Kasindi',
    };
    const borderPoint = Object.entries(borderMap)
        .find(([k]) => destLower.includes(k))?.[1] || '';

    // Find linked invoice client name
    const linkedInvoice = data.invoices.find(i =>
        i.journey === journey.id || i.journeyId === journey.id
    );

    const form = {
        waybillNo,
        generatedAt:    new Date().toISOString(),
        isCrossBorder,

        // Carrier — from settings
        carrierName:    s.wbCarrierName    || s.companyName    || 'Segecha Group Ltd',
        carrierKraPin:  s.wbCarrierKraPin  || '',
        carrierNtsa:    s.wbCarrierNtsa    || '',
        carrierAddress: s.wbCarrierAddress || '',
        carrierPhone:   s.wbCarrierPhone   || s.companyPhone   || '',
        carrierEmail:   s.wbCarrierEmail   || '',

        // Vehicle — from fleet data
        vehicleReg:  truck.reg       || '',
        trailerReg:  s.wbTrailerReg  || truck.trailerReg || '',
        vehicleType: truck.type      || '',
        maxPayload:  truck.capacity  ? String(truck.capacity) : '',

        // Driver — from drivers list
        driverName:    driver.name    || '',
        driverIdNo:    driver.idNo    || '',
        driverLicence: driver.license || '',
        driverPhone:   driver.phone   || '',

        // Consignor — from invoice or journey
        consignorName:    linkedInvoice?.client || '',
        consignorKraPin:  '',
        consignorAddress: journey.origin || '',
        consignorPhone:   '',
        loadingDateTime:  journey.date ? journey.date + 'T08:00' : '',

        // Consignee — must be entered manually
        consigneeName:    '',
        consigneeKraPin:  '',
        consigneeAddress: journey.dest || '',
        consigneePhone:   '',
        expectedDelivery: '',

        // Route — from journey
        origin:        journey.origin  || '',
        destination:   journey.dest    || '',
        borderPoint,
        transitRoute:  isCrossBorder
            ? 'Northern Corridor — A109 Mombasa–Nairobi–Malaba'
            : '',
        estDistance:   journey.distance || 0,
        odomAtLoading:  journey.startOdom ? String(journey.startOdom) : '',
        odomAtDelivery: journey.endOdom   ? String(journey.endOdom)   : '',

        // Cargo — pre-fill from journey cargo field
        cargo: [{
            id: 'c1',
            description:    journey.cargo  || '',
            hsCode:         '',
            packages:       '',
            grossKg:        journey.weight ? String(+journey.weight * 1000) : '',
            netKg:          '',
            volumeM3:       '',
            declaredValue:  '',
        }],
        cargoNature:         'General',
        specialHandling:     '',
        sealNo:              '',
        conditionAtLoading:  'Good condition',
        exceptionsAtLoading: 'NIL',

        // Freight — from journey revenue
        agreedFreight: journey.revenue  ? String(journey.revenue)  : '',
        paymentTerms:  'Collect',
        advancePaid:   '',
        balanceDue:    journey.revenue  ? String(journey.revenue)  : '',

        // Documents checklist — auto-tick cross-border ones
        docs: {
            commercialInvoice:   isCrossBorder,
            packingList:         isCrossBorder,
            kraCustomsEntry:     isCrossBorder,
            certOfOrigin:        false,
            comesaLicence:       isCrossBorder,
            transitBond:         isCrossBorder,
            phytoSanitary:       false,
            kebsCertificate:     false,
            t1Document:          isCrossBorder,
            dangerousGoodsDecl:  false,
            insuranceCert:       true,
            other:               '',
        },

        // Delivery — filled later on arrival
        deliveryDateTime:     '',
        odomAtDeliveryFinal:  '',
        conditionOnArrival:   '',
        exceptionsOnDelivery: 'NIL',
        balanceReceived:      '',
    };

    setWaybillForm(form);
    setWaybillModal(journey);
};
```

---

## STEP 7 — Add the WaybillModal component

Place this component definition BEFORE the PAGES map (where other modal
components like `PaymentRequestModal`, `VerificationModal` live).

```jsx
// ══════════════════════════════════════════════════════════════════════════
// WAYBILL GENERATOR MODAL
// ══════════════════════════════════════════════════════════════════════════
const WaybillModal = () => {
    if (!waybillModal || !waybillForm) return null;

    const f   = waybillForm;
    const set = (key, val) =>
        setWaybillForm(prev => ({ ...prev, [key]: val }));
    const setDocField = (key, val) =>
        setWaybillForm(prev => ({ ...prev, docs: { ...prev.docs, [key]: val } }));
    const setCargo = (idx, key, val) =>
        setWaybillForm(prev => {
            const cargo = [...prev.cargo];
            cargo[idx] = { ...cargo[idx], [key]: val };
            return { ...prev, cargo };
        });
    const addCargoRow = () =>
        setWaybillForm(prev => ({
            ...prev,
            cargo: [...prev.cargo, {
                id: uid(), description: '', hsCode: '',
                packages: '', grossKg: '', netKg: '',
                volumeM3: '', declaredValue: '',
            }]
        }));
    const removeCargoRow = (idx) =>
        setWaybillForm(prev => ({
            ...prev,
            cargo: prev.cargo.filter((_, i) => i !== idx)
        }));

    // ── Save waybill data onto the journey record
    const persistWaybill = () => {
        const s = getSettings();
        // Increment counter only on first save
        if (!waybillModal.waybillGenerated) {
            const newCounter = (s.waybillCounter || 1) + 1;
            localStorage.setItem('segecha_settings',
                JSON.stringify({ ...s, waybillCounter: newCounter }));
        }
        setData(d => ({
            ...d,
            journeys: d.journeys.map(j =>
                j.id === waybillModal.id
                    ? { ...j,
                        waybillGenerated: true,
                        waybillNo: f.waybillNo,
                        waybillData: waybillForm }
                    : j
            )
        }));
    };

    const handleSave = () => {
        persistWaybill();
        setWaybillModal(null);
        setWaybillForm(null);
    };

    const handleSaveAndPrint = () => {
        persistWaybill();
        buildAndPrint(f);
    };

    const close = () => {
        setWaybillModal(null);
        setWaybillForm(null);
    };

    // ── Shared field renderer
    const Field = ({ label, value, onChange, opts = {} }) => (
        <div style={{ padding: '7px 12px',
            borderRight: `0.5px solid ${T.border2}`,
            borderBottom: `0.5px solid ${T.border2}`,
            flex: 1 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase',
                letterSpacing: '0.6px', color: T.textFaint, marginBottom: 3 }}>
                {label}
                {opts.required && <span style={{ color: T.red }}> *</span>}
                {opts.cbOnly && !f.isCrossBorder &&
                    <span style={{ color: T.amber, fontSize: 8,
                        marginLeft: 4, fontWeight: 600 }}> CB</span>}
            </div>
            {opts.select ? (
                <select
                    style={{ ...S.inp, marginBottom: 0, fontSize: 12,
                        opacity: opts.cbOnly && !f.isCrossBorder ? 0.4 : 1 }}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    disabled={opts.cbOnly && !f.isCrossBorder}>
                    {opts.select.map(o =>
                        <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input
                    style={{ ...S.inp, marginBottom: 0, fontSize: 12,
                        fontFamily: opts.mono ? "'DM Mono', monospace" : undefined,
                        opacity: opts.cbOnly && !f.isCrossBorder ? 0.4 : 1,
                        borderColor: opts.required && !value
                            ? T.red + '88' : undefined }}
                    type={opts.type || 'text'}
                    placeholder={opts.placeholder || ''}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    readOnly={opts.readOnly}
                    disabled={opts.cbOnly && !f.isCrossBorder} />
            )}
        </div>
    );

    // ── Section title bar
    const Sec = ({ n, label, hint }) => (
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: T.textFaint, padding: '6px 12px 4px',
            background: T.surface2, borderTop: `1px solid ${T.border}`,
            borderBottom: `0.5px solid ${T.border2}` }}>
            {n} · {label}
            {hint && <span style={{ fontWeight: 400, textTransform: 'none',
                letterSpacing: 0, marginLeft: 6, color: T.textFaint,
                fontSize: 9 }}>{hint}</span>}
        </div>
    );

    const Row = ({ children, cols }) => (
        <div style={{ display: 'grid',
            gridTemplateColumns: cols || `repeat(${children.length || 2}, 1fr)` }}>
            {children}
        </div>
    );

    return (
        <div style={S.ovl} onClick={close}>
            <div
                style={{ background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 10, width: 'min(900px, 98vw)',
                    maxHeight: '92vh', overflowY: 'auto',
                    boxShadow: dark
                        ? '0 24px 64px rgba(0,0,0,0.7)'
                        : '0 24px 64px rgba(0,0,0,0.18)' }}
                onClick={e => e.stopPropagation()}>

                {/* ─── STICKY HEADER ─────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 18px', borderBottom: `1px solid ${T.border}`,
                    background: T.surface2, position: 'sticky', top: 0, zIndex: 10 }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600,
                            color: T.text, fontFamily: "'Syne', sans-serif" }}>
                            Road Freight Waybill — {f.waybillNo}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 1 }}>
                            {waybillModal.origin} → {waybillModal.dest}
                            &nbsp;·&nbsp;{waybillModal.date}
                            &nbsp;
                            <span style={{ padding: '1px 7px', borderRadius: 4,
                                fontSize: 10, fontWeight: 600,
                                background: f.isCrossBorder ? T.blueBg : T.greenBg,
                                color: f.isCrossBorder ? T.blue : T.green }}>
                                {f.isCrossBorder ? 'Cross-border' : 'Domestic'}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Cross-border toggle */}
                        <label style={{ display: 'flex', alignItems: 'center',
                            gap: 6, fontSize: 12, color: T.textDim,
                            cursor: 'pointer', padding: '5px 10px',
                            border: `1px solid ${T.border}`, borderRadius: 6,
                            background: T.surface }}>
                            <input type="checkbox"
                                checked={f.isCrossBorder}
                                onChange={e => set('isCrossBorder', e.target.checked)} />
                            Cross-border mode
                        </label>
                        <button style={S.btn('ghost')} onClick={close}>Cancel</button>
                        <button style={S.btn('ghost')} onClick={handleSave}>Save</button>
                        <button style={S.btn('primary')} onClick={handleSaveAndPrint}>
                            Save & Print
                        </button>
                    </div>
                </div>

                {/* CB hint banner */}
                <div style={{ padding: '6px 14px', fontSize: 11,
                    background: T.amberBg, color: T.amber,
                    borderBottom: `1px solid ${T.amber}33` }}>
                    Fields marked <span style={{ color: T.red, fontWeight: 700 }}>*</span> are required.
                    Fields labelled <span style={{ background: T.blueBg, color: T.blue,
                        fontSize: 9, fontWeight: 700, padding: '0 5px',
                        borderRadius: 3 }}>CB</span> are
                    cross-border only — enable the toggle above to unlock them.
                    Pre-filled sections come from your fleet data and
                    Settings → Waybill Defaults.
                </div>

                {/* ─── SECTION 1: Carrier ─────────────────────────── */}
                <Sec n="1" label="Carrier" hint="pre-filled from Settings → Waybill Defaults" />
                <Row cols="1fr 1fr 1fr">
                    <Field label="Company name" value={f.carrierName}
                        onChange={v => set('carrierName', v)}
                        opts={{ required: true }} />
                    <Field label="KRA PIN" value={f.carrierKraPin}
                        onChange={v => set('carrierKraPin', v)}
                        opts={{ required: true, mono: true, placeholder: 'P000000000A' }} />
                    <Field label="NTSA transport licence" value={f.carrierNtsa}
                        onChange={v => set('carrierNtsa', v)}
                        opts={{ mono: true }} />
                </Row>
                <Row cols="1fr 1fr 1fr">
                    <Field label="Physical address" value={f.carrierAddress}
                        onChange={v => set('carrierAddress', v)} />
                    <Field label="Phone / WhatsApp" value={f.carrierPhone}
                        onChange={v => set('carrierPhone', v)}
                        opts={{ mono: true }} />
                    <Field label="Email" value={f.carrierEmail}
                        onChange={v => set('carrierEmail', v)} />
                </Row>

                {/* ─── SECTION 2: Vehicle & Driver ────────────────── */}
                <Sec n="2" label="Vehicle & driver" hint="pre-filled from fleet data" />
                <Row cols="1fr 1fr 1fr 1fr">
                    <Field label="Vehicle registration" value={f.vehicleReg}
                        onChange={v => set('vehicleReg', v)}
                        opts={{ required: true, mono: true }} />
                    <Field label="Trailer reg." value={f.trailerReg}
                        onChange={v => set('trailerReg', v)}
                        opts={{ mono: true }} />
                    <Field label="Vehicle type" value={f.vehicleType}
                        onChange={v => set('vehicleType', v)} />
                    <Field label="Max payload (tonnes)" value={f.maxPayload}
                        onChange={v => set('maxPayload', v)}
                        opts={{ mono: true }} />
                </Row>
                <Row cols="1fr 1fr 1fr 1fr">
                    <Field label="Driver full name" value={f.driverName}
                        onChange={v => set('driverName', v)}
                        opts={{ required: true }} />
                    <Field label="ID / Passport no." value={f.driverIdNo}
                        onChange={v => set('driverIdNo', v)}
                        opts={{ required: true, mono: true }} />
                    <Field label="PSV / DL licence" value={f.driverLicence}
                        onChange={v => set('driverLicence', v)}
                        opts={{ mono: true }} />
                    <Field label="Driver phone" value={f.driverPhone}
                        onChange={v => set('driverPhone', v)}
                        opts={{ mono: true }} />
                </Row>

                {/* ─── SECTION 3: Consignor ────────────────────────── */}
                <Sec n="3" label="Consignor (sender)" hint="enter manually" />
                <Row cols="2fr 1fr">
                    <Field label="Full name / company" value={f.consignorName}
                        onChange={v => set('consignorName', v)}
                        opts={{ required: true }} />
                    <Field label="KRA PIN" value={f.consignorKraPin}
                        onChange={v => set('consignorKraPin', v)}
                        opts={{ mono: true }} />
                </Row>
                <Row cols="1fr 1fr 1fr">
                    <Field label="Loading address" value={f.consignorAddress}
                        onChange={v => set('consignorAddress', v)}
                        opts={{ required: true }} />
                    <Field label="Phone" value={f.consignorPhone}
                        onChange={v => set('consignorPhone', v)}
                        opts={{ mono: true }} />
                    <Field label="Date & time of loading" value={f.loadingDateTime}
                        onChange={v => set('loadingDateTime', v)}
                        opts={{ type: 'datetime-local' }} />
                </Row>

                {/* ─── SECTION 4: Consignee ────────────────────────── */}
                <Sec n="4" label="Consignee (receiver)" hint="enter manually" />
                <Row cols="2fr 1fr">
                    <Field label="Full name / company" value={f.consigneeName}
                        onChange={v => set('consigneeName', v)}
                        opts={{ required: true }} />
                    <Field label="KRA PIN" value={f.consigneeKraPin}
                        onChange={v => set('consigneeKraPin', v)}
                        opts={{ mono: true, cbOnly: true }} />
                </Row>
                <Row cols="1fr 1fr 1fr">
                    <Field label="Delivery address" value={f.consigneeAddress}
                        onChange={v => set('consigneeAddress', v)}
                        opts={{ required: true }} />
                    <Field label="Phone" value={f.consigneePhone}
                        onChange={v => set('consigneePhone', v)}
                        opts={{ mono: true }} />
                    <Field label="Expected delivery date" value={f.expectedDelivery}
                        onChange={v => set('expectedDelivery', v)}
                        opts={{ type: 'date' }} />
                </Row>

                {/* ─── SECTION 5: Route ────────────────────────────── */}
                <Sec n="5" label="Route" hint="pre-filled from journey" />
                <Row cols="1fr 1fr 1fr 1fr">
                    <Field label="Origin" value={f.origin}
                        onChange={v => set('origin', v)}
                        opts={{ required: true }} />
                    <Field label="Destination" value={f.destination}
                        onChange={v => set('destination', v)}
                        opts={{ required: true }} />
                    <Field label="Border crossing" value={f.borderPoint}
                        onChange={v => set('borderPoint', v)}
                        opts={{ cbOnly: true, placeholder: 'e.g. Malaba / Busia' }} />
                    <Field label="Est. distance (km)" value={String(f.estDistance)}
                        onChange={v => set('estDistance', +v)}
                        opts={{ mono: true }} />
                </Row>
                <Row cols="2fr 1fr 1fr">
                    <Field label="Approved transit route" value={f.transitRoute}
                        onChange={v => set('transitRoute', v)}
                        opts={{ cbOnly: true,
                            placeholder: 'e.g. Northern Corridor — A109' }} />
                    <Field label="Odometer at loading (km)" value={f.odomAtLoading}
                        onChange={v => set('odomAtLoading', v)}
                        opts={{ mono: true }} />
                    <Field label="Odometer at delivery (km)" value={f.odomAtDelivery}
                        onChange={v => set('odomAtDelivery', v)}
                        opts={{ mono: true }} />
                </Row>

                {/* ─── SECTION 6: Cargo ────────────────────────────── */}
                <Sec n="6"
                    label="Cargo description"
                    hint={f.isCrossBorder ? 'HS codes required for cross-border' : ''} />
                <div style={{ padding: '8px 0' }}>
                    <table style={{ ...S.tbl, minWidth: '100%' }}>
                        <thead>
                            <tr>
                                {['#', 'Description of goods',
                                    f.isCrossBorder ? 'HS code' : null,
                                    'Packages', 'Gross kg', 'Net kg',
                                    'Vol m³', 'Declared value (KES)', ''
                                ].filter(Boolean).map(h => (
                                    <th key={h} style={{ ...S.th,
                                        padding: '5px 8px', fontSize: 9 }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {f.cargo.map((c, i) => (
                                <tr key={c.id}>
                                    <td style={{ ...S.td, fontSize: 11,
                                        color: T.textFaint, textAlign: 'center',
                                        width: 28 }}>{i + 1}</td>
                                    <td style={S.td}>
                                        <input
                                            style={{ ...S.inp, marginBottom: 0,
                                                fontSize: 12 }}
                                            value={c.description}
                                            placeholder="e.g. Maize flour, 50kg bags"
                                            onChange={e => setCargo(i, 'description',
                                                e.target.value)} />
                                    </td>
                                    {f.isCrossBorder && (
                                        <td style={S.td}>
                                            <input
                                                style={{ ...S.inp, marginBottom: 0,
                                                    fontSize: 12,
                                                    fontFamily: "'DM Mono', monospace",
                                                    width: 80 }}
                                                value={c.hsCode}
                                                placeholder="1101.00"
                                                onChange={e => setCargo(i, 'hsCode',
                                                    e.target.value)} />
                                        </td>
                                    )}
                                    <td style={S.td}>
                                        <input style={{ ...S.inp, marginBottom: 0,
                                            fontSize: 12, width: 70 }}
                                            value={c.packages}
                                            onChange={e => setCargo(i, 'packages',
                                                e.target.value)} />
                                    </td>
                                    <td style={S.td}>
                                        <input style={{ ...S.inp, marginBottom: 0,
                                            fontSize: 12,
                                            fontFamily: "'DM Mono', monospace",
                                            width: 80 }}
                                            value={c.grossKg}
                                            onChange={e => setCargo(i, 'grossKg',
                                                e.target.value)} />
                                    </td>
                                    <td style={S.td}>
                                        <input style={{ ...S.inp, marginBottom: 0,
                                            fontSize: 12,
                                            fontFamily: "'DM Mono', monospace",
                                            width: 80 }}
                                            value={c.netKg}
                                            onChange={e => setCargo(i, 'netKg',
                                                e.target.value)} />
                                    </td>
                                    <td style={S.td}>
                                        <input style={{ ...S.inp, marginBottom: 0,
                                            fontSize: 12, width: 70 }}
                                            value={c.volumeM3}
                                            onChange={e => setCargo(i, 'volumeM3',
                                                e.target.value)} />
                                    </td>
                                    <td style={S.td}>
                                        <input style={{ ...S.inp, marginBottom: 0,
                                            fontSize: 12,
                                            fontFamily: "'DM Mono', monospace",
                                            width: 110 }}
                                            value={c.declaredValue}
                                            onChange={e => setCargo(i, 'declaredValue',
                                                e.target.value)} />
                                    </td>
                                    <td style={S.td}>
                                        {f.cargo.length > 1 && (
                                            <button
                                                style={S.btn('del')}
                                                onClick={() => removeCargoRow(i)}>
                                                ✕
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button
                        style={{ ...S.btn('ghost'), fontSize: 11,
                            margin: '8px 12px' }}
                        onClick={addCargoRow}>
                        + Add cargo line
                    </button>
                </div>
                <Row>
                    <Field label="Nature of goods" value={f.cargoNature}
                        onChange={v => set('cargoNature', v)}
                        opts={{ select: ['General', 'Perishable', 'Hazardous',
                            'Restricted', 'Perishable + Hazardous'] }} />
                    <Field label="Special handling instructions"
                        value={f.specialHandling}
                        onChange={v => set('specialHandling', v)}
                        opts={{ placeholder: 'e.g. Keep dry, do not stack' }} />
                </Row>

                {/* ─── SECTION 7: Freight ──────────────────────────── */}
                <Sec n="7" label="Freight charges" />
                <Row cols="1fr 1fr 1fr 1fr">
                    <Field label="Agreed freight (KES)" value={f.agreedFreight}
                        onChange={v => set('agreedFreight', v)}
                        opts={{ mono: true }} />
                    <Field label="Payment terms" value={f.paymentTerms}
                        onChange={v => set('paymentTerms', v)}
                        opts={{ select: ['Collect', 'Prepaid', 'Third Party'] }} />
                    <Field label="Advance paid (KES)" value={f.advancePaid}
                        onChange={v => set('advancePaid', v)}
                        opts={{ mono: true }} />
                    <Field label="Balance due on delivery (KES)" value={f.balanceDue}
                        onChange={v => set('balanceDue', v)}
                        opts={{ mono: true }} />
                </Row>

                {/* ─── SECTION 8: Documents checklist ─────────────── */}
                <Sec n="8" label="Documents accompanying" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    padding: '10px 12px', gap: '4px 0',
                    borderBottom: `0.5px solid ${T.border2}` }}>
                    {[
                        ['commercialInvoice',  'Commercial invoice',                false],
                        ['packingList',         'Packing list',                     false],
                        ['kraCustomsEntry',     'KRA customs entry / IDF',          true],
                        ['certOfOrigin',        'Certificate of origin (COMESA/EAC)',true],
                        ['comesaLicence',       'COMESA carrier licence',           true],
                        ['transitBond',         'Goods in transit bond',            true],
                        ['phytoSanitary',       'Phytosanitary / health cert.',     false],
                        ['kebsCertificate',     'KEBS certificate of conformity',   false],
                        ['t1Document',          'T1 transit document',              true],
                        ['dangerousGoodsDecl',  'Dangerous goods declaration',      false],
                        ['insuranceCert',       'Insurance certificate',            false],
                    ].map(([key, label, cbOnly]) => (
                        <label key={key} style={{ display: 'flex',
                            alignItems: 'center', gap: 7, fontSize: 12,
                            color: cbOnly && !f.isCrossBorder
                                ? T.textFaint : T.textDim,
                            cursor: 'pointer', padding: '3px 0',
                            opacity: cbOnly && !f.isCrossBorder ? 0.45 : 1 }}>
                            <input type="checkbox"
                                checked={!!f.docs[key]}
                                disabled={cbOnly && !f.isCrossBorder}
                                onChange={e => setDocField(key, e.target.checked)} />
                            {label}
                            {cbOnly && (
                                <span style={{ fontSize: 9, fontWeight: 700,
                                    padding: '0 4px', background: T.blueBg,
                                    color: T.blue, borderRadius: 2 }}>CB</span>
                            )}
                        </label>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center',
                        gap: 7, gridColumn: '1/-1' }}>
                        <input type="checkbox"
                            checked={!!f.docs.other}
                            onChange={e => setDocField('other',
                                e.target.checked ? 'Other' : '')} />
                        <span style={{ fontSize: 12, color: T.textDim }}>Other:</span>
                        <input style={{ ...S.inp, marginBottom: 0, fontSize: 12,
                            flex: 1, maxWidth: 300 }}
                            value={typeof f.docs.other === 'string'
                                ? f.docs.other : ''}
                            onChange={e => setDocField('other', e.target.value)}
                            placeholder="Specify document name…" />
                    </div>
                </div>

                {/* ─── SECTION 9: Condition ────────────────────────── */}
                <Sec n="9" label="Condition of goods at loading" />
                <Row cols="1fr 1fr 1fr">
                    <Field label="Condition at loading"
                        value={f.conditionAtLoading}
                        onChange={v => set('conditionAtLoading', v)} />
                    <Field label="Seal / container no."
                        value={f.sealNo}
                        onChange={v => set('sealNo', v)}
                        opts={{ mono: true, cbOnly: true }} />
                    <Field label="Exceptions at loading (NIL if none)"
                        value={f.exceptionsAtLoading}
                        onChange={v => set('exceptionsAtLoading', v)} />
                </Row>

                {/* ─── SECTION 10: Delivery receipt ────────────────── */}
                <Sec n="10" label="Delivery receipt"
                    hint="completed on arrival — leave blank before departure" />
                <Row cols="1fr 1fr 1fr">
                    <Field label="Date & time of delivery"
                        value={f.deliveryDateTime}
                        onChange={v => set('deliveryDateTime', v)}
                        opts={{ type: 'datetime-local' }} />
                    <Field label="Final odometer (km)"
                        value={f.odomAtDeliveryFinal}
                        onChange={v => set('odomAtDeliveryFinal', v)}
                        opts={{ mono: true }} />
                    <Field label="Condition on arrival"
                        value={f.conditionOnArrival}
                        onChange={v => set('conditionOnArrival', v)} />
                </Row>
                <Row>
                    <Field label="Exceptions / damage on delivery (NIL if none)"
                        value={f.exceptionsOnDelivery}
                        onChange={v => set('exceptionsOnDelivery', v)} />
                    <Field label="Balance freight received (KES)"
                        value={f.balanceReceived}
                        onChange={v => set('balanceReceived', v)}
                        opts={{ mono: true }} />
                </Row>

                {/* ─── FOOTER ACTIONS ──────────────────────────────── */}
                <div style={{ display: 'flex', gap: 10, padding: '14px 18px',
                    justifyContent: 'flex-end', borderTop: `1px solid ${T.border}`,
                    background: T.surface2 }}>
                    <div style={{ marginRight: 'auto', alignSelf: 'center',
                        fontSize: 11, color: T.textFaint }}>
                        <span style={{ fontFamily: "'DM Mono', monospace",
                            fontWeight: 600, color: T.text }}>
                            {f.waybillNo}
                        </span>
                        {f.isCrossBorder
                            ? <span style={{ color: T.blue, marginLeft: 8 }}>
                                Cross-border · 4 copies · KRA PIN mandatory
                              </span>
                            : <span style={{ color: T.green, marginLeft: 8 }}>
                                Domestic · 4 copies required
                              </span>}
                    </div>
                    <button style={S.btn('ghost')} onClick={close}>Cancel</button>
                    <button style={S.btn('ghost')} onClick={handleSave}>
                        Save without printing
                    </button>
                    <button style={{ ...S.btn('primary'), padding: '8px 20px' }}
                        onClick={handleSaveAndPrint}>
                        Save & Print waybill
                    </button>
                </div>
            </div>
        </div>
    );
};
```

---

## STEP 8 — Add the print function

Add this helper function alongside `openWaybillGenerator`:

```js
const buildAndPrint = (f) => {
    const s = getSettings();
    const logoUrl     = localStorage.getItem('segecha_logo') || '';
    const companyName = s.companyName || 'Segecha Group Ltd';

    const fmtLine = v => v || '&nbsp;';
    const fmtKes  = v => v
        ? 'KES ' + Number(v).toLocaleString('en-KE')
        : '&nbsp;';

    const totalGrossKg  = f.cargo.reduce((s, c) => s + (+c.grossKg  || 0), 0);
    const totalNetKg    = f.cargo.reduce((s, c) => s + (+c.netKg    || 0), 0);
    const totalPackages = f.cargo.reduce((s, c) => s + (+c.packages || 0), 0);
    const totalValue    = f.cargo.reduce((s, c) => s + (+c.declaredValue || 0), 0);

    const checkedDocs = [
        f.docs.commercialInvoice   && 'Commercial invoice',
        f.docs.packingList          && 'Packing list',
        f.docs.kraCustomsEntry      && 'KRA customs entry / IDF',
        f.docs.certOfOrigin         && 'Certificate of origin',
        f.docs.comesaLicence        && 'COMESA carrier licence',
        f.docs.transitBond          && 'Goods in transit bond',
        f.docs.phytoSanitary        && 'Phytosanitary certificate',
        f.docs.kebsCertificate      && 'KEBS certificate',
        f.docs.t1Document           && 'T1 transit document',
        f.docs.dangerousGoodsDecl   && 'Dangerous goods declaration',
        f.docs.insuranceCert        && 'Insurance certificate',
        typeof f.docs.other === 'string' && f.docs.other,
    ].filter(Boolean);

    // Blank rows to pad cargo table to minimum 4 rows
    const blankRows = Math.max(0, 4 - f.cargo.length);

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${f.waybillNo} — Road Freight Waybill</title>
<style>
@page { size: A4 portrait; margin: 10mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt;
       color: #000; background: #fff; }
.outer { border: 1.5px solid #000; width: 100%; }
.hdr { display: flex; align-items: flex-start; gap: 12px;
       padding: 8px 12px; border-bottom: 1.5px solid #000; }
.logo { width: 52px; height: 52px; border: 1px solid #ccc;
        display: flex; align-items: center; justify-content: center;
        font-size: 18pt; font-weight: 700; flex-shrink: 0; }
.hdr-mid { flex: 1; }
.hdr-title { font-size: 18pt; font-weight: 700;
             text-transform: uppercase; letter-spacing: 1px; }
.hdr-sub { font-size: 7.5pt; color: #444; margin-top: 2px; }
.hdr-legal { font-size: 7pt; color: #555; margin-top: 4px; }
.wb-num-box { text-align: right; }
.wb-num-label { font-size: 7pt; color: #777;
                text-transform: uppercase; letter-spacing: 0.5px; }
.wb-num-val { font-size: 14pt; font-weight: 700; font-family: monospace;
              border: 1px solid #000; padding: 2px 7px;
              display: inline-block; margin-top: 2px; }
.wb-issued { font-size: 8pt; color: #555; margin-top: 4px; }
.notice { background: #f0f0f0; padding: 3px 10px; font-size: 8pt;
          border-bottom: 1px solid #bbb; }
.sec { border-bottom: 1px solid #000; }
.sec-title { font-size: 8pt; font-weight: 700;
             text-transform: uppercase; letter-spacing: 0.6px;
             padding: 3px 8px; background: #e8e8e8;
             border-bottom: 1px solid #bbb; }
.fields { display: grid; }
.field { padding: 4px 7px; border-right: 0.5px solid #ccc;
         border-bottom: 0.5px solid #eee; }
.field:last-child { border-right: none; }
.fl { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.4px;
      color: #555; margin-bottom: 2px; }
.fv { font-size: 9.5pt; border-bottom: 0.5px solid #999;
      min-height: 16px; padding-bottom: 1px; }
.fv.lg { font-size: 11pt; font-weight: 700; }
.fv.mono { font-family: monospace; }
table.cargo { width: 100%; border-collapse: collapse; }
table.cargo th { font-size: 7.5pt; text-transform: uppercase;
                 letter-spacing: 0.4px; padding: 3px 5px;
                 border-bottom: 1px solid #000; border-right: 0.5px solid #bbb;
                 background: #e8e8e8; text-align: left; }
table.cargo td { font-size: 9pt; padding: 3px 5px;
                 border-bottom: 0.5px solid #ddd;
                 border-right: 0.5px solid #ccc; min-height: 16px; }
table.cargo tr.totrow td { border-top: 1px solid #000;
                            font-weight: 700; background: #e8e8e8; }
.twocol { display: grid; grid-template-columns: 1fr 1fr; }
.twocol > div:first-child { border-right: 1px solid #000; }
.sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; }
.sig-box { padding: 7px 9px; border-right: 0.5px solid #bbb; }
.sig-box:last-child { border-right: none; }
.sig-note { font-size: 8pt; color: #333; margin-bottom: 3px; }
.sig-line { border-bottom: 1px solid #000; margin: 22px 0 3px; }
.sig-lbl { font-size: 7pt; color: #666; text-transform: uppercase; }
.stamp { width: 64px; height: 64px; border: 1px dashed #aaa; float: right;
         margin: 3px 0 3px 8px; display: flex; align-items: center;
         justify-content: center; font-size: 7pt; color: #aaa; text-align: center; }
.copy-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 3px 10px;
            background: #f8f8f8; border-top: 1px solid #bbb; font-size: 7.5pt; }
.copy-dot { width: 7px; height: 7px; border-radius: 50%;
            display: inline-block; margin-right: 3px; }
</style>
</head>
<body>
<div class="outer">

  <div class="hdr">
    <div class="logo">
      ${logoUrl
        ? `<img src="${logoUrl}" style="height:48px;max-width:100px;object-fit:contain;">`
        : `<span>${companyName.charAt(0)}</span>`}
    </div>
    <div class="hdr-mid">
      <div class="hdr-title">Road Freight Waybill</div>
      <div class="hdr-sub">
        Consignment Note / Goods Received Note &nbsp;·&nbsp;
        ${f.isCrossBorder ? 'CROSS-BORDER' : 'DOMESTIC'}
      </div>
      <div class="hdr-legal">
        Traffic Act Cap. 403 (Kenya) &nbsp;·&nbsp;
        EAC Customs Management Act 2004 &nbsp;·&nbsp;
        COMESA Transit Trade Regulations
      </div>
    </div>
    <div class="wb-num-box">
      <div class="wb-num-label">Waybill no.</div>
      <div class="wb-num-val">${f.waybillNo}</div>
      <div class="wb-issued">
        Issued: ${new Date(f.generatedAt).toLocaleDateString('en-KE',
          { day:'2-digit', month:'short', year:'numeric' })}
      </div>
    </div>
  </div>

  <div class="notice">
    Carrier: <strong>${f.carrierName}</strong>
    &nbsp;·&nbsp; KRA PIN: <strong>${f.carrierKraPin || '_______________'}</strong>
    ${f.isCrossBorder
      ? ' &nbsp;·&nbsp; CROSS-BORDER — 4 COPIES REQUIRED — KRA PIN MANDATORY'
      : ' &nbsp;·&nbsp; DOMESTIC — 4 COPIES REQUIRED'}
  </div>

  <!-- 1. Carrier -->
  <div class="sec">
    <div class="sec-title">1 · Carrier (transporter)</div>
    <div class="fields" style="grid-template-columns:2fr 1fr 1fr">
      <div class="field"><div class="fl">Company name</div>
        <div class="fv lg">${fmtLine(f.carrierName)}</div></div>
      <div class="field"><div class="fl">KRA PIN</div>
        <div class="fv mono">${fmtLine(f.carrierKraPin)}</div></div>
      <div class="field"><div class="fl">NTSA licence</div>
        <div class="fv mono">${fmtLine(f.carrierNtsa)}</div></div>
      <div class="field"><div class="fl">Address</div>
        <div class="fv">${fmtLine(f.carrierAddress)}</div></div>
      <div class="field"><div class="fl">Phone</div>
        <div class="fv mono">${fmtLine(f.carrierPhone)}</div></div>
      <div class="field"><div class="fl">Email</div>
        <div class="fv">${fmtLine(f.carrierEmail)}</div></div>
    </div>
  </div>

  <!-- 2. Vehicle & Driver -->
  <div class="sec">
    <div class="sec-title">2 · Vehicle &amp; driver</div>
    <div class="fields" style="grid-template-columns:1fr 1fr 1fr 1fr">
      <div class="field"><div class="fl">Vehicle reg.</div>
        <div class="fv lg mono">${fmtLine(f.vehicleReg)}</div></div>
      <div class="field"><div class="fl">Trailer reg.</div>
        <div class="fv mono">${fmtLine(f.trailerReg)}</div></div>
      <div class="field"><div class="fl">Type</div>
        <div class="fv">${fmtLine(f.vehicleType)}</div></div>
      <div class="field"><div class="fl">Max payload (t)</div>
        <div class="fv mono">${fmtLine(f.maxPayload)}</div></div>
      <div class="field"><div class="fl">Driver name</div>
        <div class="fv lg">${fmtLine(f.driverName)}</div></div>
      <div class="field"><div class="fl">ID / Passport</div>
        <div class="fv mono">${fmtLine(f.driverIdNo)}</div></div>
      <div class="field"><div class="fl">PSV / DL licence</div>
        <div class="fv mono">${fmtLine(f.driverLicence)}</div></div>
      <div class="field"><div class="fl">Driver phone</div>
        <div class="fv mono">${fmtLine(f.driverPhone)}</div></div>
    </div>
  </div>

  <!-- 3 & 4. Consignor + Consignee side by side -->
  <div class="sec twocol">
    <div>
      <div class="sec-title">3 · Consignor (sender)</div>
      <div class="fields" style="grid-template-columns:1fr 1fr">
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Full name / company</div>
          <div class="fv lg">${fmtLine(f.consignorName)}</div></div>
        <div class="field"><div class="fl">KRA PIN</div>
          <div class="fv mono">${fmtLine(f.consignorKraPin)}</div></div>
        <div class="field"><div class="fl">Phone</div>
          <div class="fv mono">${fmtLine(f.consignorPhone)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Loading address</div>
          <div class="fv">${fmtLine(f.consignorAddress)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Date &amp; time of loading</div>
          <div class="fv mono">${fmtLine(f.loadingDateTime)}</div></div>
      </div>
    </div>
    <div>
      <div class="sec-title">4 · Consignee (receiver)</div>
      <div class="fields" style="grid-template-columns:1fr 1fr">
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Full name / company</div>
          <div class="fv lg">${fmtLine(f.consigneeName)}</div></div>
        <div class="field">
          <div class="fl">KRA PIN${f.isCrossBorder ? ' ✱' : ''}</div>
          <div class="fv mono">${fmtLine(f.consigneeKraPin)}</div></div>
        <div class="field"><div class="fl">Phone</div>
          <div class="fv mono">${fmtLine(f.consigneePhone)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Delivery address</div>
          <div class="fv">${fmtLine(f.consigneeAddress)}</div></div>
        <div class="field" style="grid-column:1/-1;border-right:none">
          <div class="fl">Expected delivery date</div>
          <div class="fv mono">${fmtLine(f.expectedDelivery)}</div></div>
      </div>
    </div>
  </div>

  <!-- 5. Route -->
  <div class="sec">
    <div class="sec-title">5 · Route</div>
    <div class="fields" style="grid-template-columns:1fr 1fr ${f.isCrossBorder ? '1fr ' : ''}1fr">
      <div class="field"><div class="fl">Origin</div>
        <div class="fv lg">${fmtLine(f.origin)}</div></div>
      <div class="field"><div class="fl">Destination</div>
        <div class="fv lg">${fmtLine(f.destination)}</div></div>
      ${f.isCrossBorder
        ? `<div class="field"><div class="fl">Border crossing</div>
           <div class="fv">${fmtLine(f.borderPoint)}</div></div>`
        : ''}
      <div class="field"><div class="fl">Est. distance (km)</div>
        <div class="fv mono">${fmtLine(String(f.estDistance))}</div></div>
    </div>
    ${f.isCrossBorder
      ? `<div class="fields" style="grid-template-columns:2fr 1fr 1fr">
           <div class="field"><div class="fl">Approved transit route</div>
             <div class="fv">${fmtLine(f.transitRoute)}</div></div>
           <div class="field"><div class="fl">Odom at loading (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtLoading)}</div></div>
           <div class="field"><div class="fl">Odom at delivery (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtDelivery)}</div></div>
         </div>`
      : `<div class="fields" style="grid-template-columns:1fr 1fr">
           <div class="field"><div class="fl">Odom at loading (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtLoading)}</div></div>
           <div class="field"><div class="fl">Odom at delivery (km)</div>
             <div class="fv mono">${fmtLine(f.odomAtDelivery)}</div></div>
         </div>`}
  </div>

  <!-- 6. Cargo -->
  <div class="sec">
    <div class="sec-title">6 · Cargo description</div>
    <table class="cargo">
      <thead>
        <tr>
          <th style="width:20px">#</th>
          <th>Description of goods</th>
          ${f.isCrossBorder ? '<th style="width:65px">HS code</th>' : ''}
          <th style="width:52px">Packages</th>
          <th style="width:62px">Gross kg</th>
          <th style="width:62px">Net kg</th>
          <th style="width:52px">Vol m³</th>
          <th style="width:80px">Declared value</th>
        </tr>
      </thead>
      <tbody>
        ${f.cargo.map((c, i) => `<tr>
          <td>${i + 1}</td>
          <td>${fmtLine(c.description)}</td>
          ${f.isCrossBorder
            ? `<td style="font-family:monospace">${fmtLine(c.hsCode)}</td>`
            : ''}
          <td>${fmtLine(c.packages)}</td>
          <td style="font-family:monospace">${fmtLine(c.grossKg)}</td>
          <td style="font-family:monospace">${fmtLine(c.netKg)}</td>
          <td>${fmtLine(c.volumeM3)}</td>
          <td style="font-family:monospace">${fmtLine(c.declaredValue)}</td>
        </tr>`).join('')}
        ${Array(blankRows).fill(`<tr>
          <td>&nbsp;</td><td></td>
          ${f.isCrossBorder ? '<td></td>' : ''}
          <td></td><td></td><td></td><td></td><td></td>
        </tr>`).join('')}
        <tr class="totrow">
          <td colspan="${f.isCrossBorder ? 3 : 2}"
              style="text-align:right;font-size:7.5pt;
                     text-transform:uppercase;letter-spacing:0.4px">
            Totals
          </td>
          <td>${totalPackages || ''}</td>
          <td style="font-family:monospace">
            ${totalGrossKg
              ? totalGrossKg.toLocaleString('en-KE') : ''}</td>
          <td style="font-family:monospace">
            ${totalNetKg
              ? totalNetKg.toLocaleString('en-KE') : ''}</td>
          <td></td>
          <td style="font-family:monospace">
            ${totalValue
              ? 'KES ' + totalValue.toLocaleString('en-KE') : ''}</td>
        </tr>
      </tbody>
    </table>
    <div class="fields" style="grid-template-columns:1fr 1fr 1fr">
      <div class="field"><div class="fl">Nature of goods</div>
        <div class="fv">${fmtLine(f.cargoNature)}</div></div>
      <div class="field"><div class="fl">Special handling</div>
        <div class="fv">${fmtLine(f.specialHandling)}</div></div>
      <div class="field"><div class="fl">Seal / container no.</div>
        <div class="fv mono">${fmtLine(f.sealNo)}</div></div>
      <div class="field" style="grid-column:1/-1;border-right:none">
        <div class="fl">Exceptions at loading (NIL if none)</div>
        <div class="fv">${fmtLine(f.exceptionsAtLoading)}</div></div>
    </div>
  </div>

  <!-- 7 & 8. Freight + Documents side by side -->
  <div class="sec twocol">
    <div>
      <div class="sec-title">7 · Freight charges</div>
      <div class="fields" style="grid-template-columns:1fr 1fr">
        <div class="field"><div class="fl">Agreed freight</div>
          <div class="fv mono lg">${fmtKes(f.agreedFreight)}</div></div>
        <div class="field"><div class="fl">Payment terms</div>
          <div class="fv">${fmtLine(f.paymentTerms)}</div></div>
        <div class="field"><div class="fl">Advance paid</div>
          <div class="fv mono">${fmtKes(f.advancePaid)}</div></div>
        <div class="field"><div class="fl">Balance due</div>
          <div class="fv mono">${fmtKes(f.balanceDue)}</div></div>
      </div>
    </div>
    <div>
      <div class="sec-title">8 · Documents accompanying</div>
      <div style="padding:5px 8px;display:grid;
                  grid-template-columns:1fr 1fr;gap:1px;font-size:8pt">
        ${checkedDocs.length > 0
          ? checkedDocs.map(d => `<div>&#9745; ${d}</div>`).join('')
          : '<div style="color:#999">None specified</div>'}
      </div>
    </div>
  </div>

  <!-- 9. Dispatch signatures -->
  <div class="sec">
    <div class="sec-title">
      9 · Certification at loading — all parties sign before truck departs
    </div>
    <div class="sig-row">
      <div class="sig-box">
        <div class="stamp">Company stamp</div>
        <div class="sig-note">
          Consignor — I confirm the goods above have been handed to the
          carrier in the stated condition.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
      <div class="sig-box">
        <div class="sig-note">
          Driver — I have received the goods and confirm the details above
          are correct.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
      <div class="sig-box">
        <div class="stamp">Carrier stamp</div>
        <div class="sig-note">
          Carrier authorised rep. — required for cross-border.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
    </div>
  </div>

  <!-- 10. Delivery receipt -->
  <div class="sec">
    <div class="sec-title">10 · Delivery receipt — completed by consignee on delivery</div>
    <div class="fields" style="grid-template-columns:1fr 1fr 1fr">
      <div class="field"><div class="fl">Date &amp; time of delivery</div>
        <div class="fv mono">${fmtLine(f.deliveryDateTime)}</div></div>
      <div class="field"><div class="fl">Final odometer (km)</div>
        <div class="fv mono">${fmtLine(f.odomAtDeliveryFinal)}</div></div>
      <div class="field"><div class="fl">Condition on arrival</div>
        <div class="fv">${fmtLine(f.conditionOnArrival)}</div></div>
      <div class="field" style="grid-column:1/-1;border-right:none">
        <div class="fl">Exceptions / damage (NIL if none)</div>
        <div class="fv" style="min-height:20px">
          ${fmtLine(f.exceptionsOnDelivery)}</div></div>
    </div>
    <div class="sig-row">
      <div class="sig-box">
        <div class="stamp">Company stamp</div>
        <div class="sig-note">
          Consignee — I confirm receipt of the goods described above.
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · ID no. · Date</div>
      </div>
      <div class="sig-box">
        <div class="sig-note">Driver — delivery completed.</div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Signature &amp; name · Date</div>
      </div>
      <div class="sig-box">
        <div class="sig-note">Balance freight received:</div>
        <div style="font-size:14pt;font-weight:700;font-family:monospace;
                    margin:6px 0 14px">
          ${f.balanceReceived
            ? 'KES ' + Number(f.balanceReceived).toLocaleString('en-KE')
            : '_______________'}
        </div>
        <div class="sig-line"></div>
        <div class="sig-lbl">Carrier receipt stamp · Date</div>
      </div>
    </div>
  </div>

  <div class="copy-bar">
    <strong>4 copies:</strong>
    <span>
      <span class="copy-dot" style="background:#1a7f37"></span>
      White — Consignor (original, retained)
    </span>
    <span>
      <span class="copy-dot" style="background:#0969da"></span>
      Blue — Consignee (travels with goods, surrendered on delivery)
    </span>
    <span>
      <span class="copy-dot" style="background:#d1242f"></span>
      Red — Driver (kept throughout journey)
    </span>
    <span>
      <span class="copy-dot" style="background:#9a6700"></span>
      Yellow — KRA / Customs (surrendered at border or weighbridge)
    </span>
  </div>
</div>
</body></html>`;

    const win = window.open('', '_blank',
        'width=900,height=900,toolbar=0,menubar=0,scrollbars=1');
    if (!win) {
        alert('Pop-up blocked. Please allow pop-ups for this site, then try again.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
};
```

---

## STEP 9 — Render the modal in the main JSX

Find the section near the bottom of the App JSX where modals are rendered
(look for `{paymentRecordModal && ...}`, `{verifyModal && ...}` etc).

Add:
```jsx
{waybillModal && waybillForm && <WaybillModal />}
```

---

## STEP 10 — Also prompt on new journey save (optional but recommended)

In the journey save handler (where `saveItem('journeys', form)` is called),
after saving, check if status is "Loading" and prompt:

```jsx
// After saveItem('journeys', form):
if (form.status === 'Loading' || form.status === 'In Transit') {
    setTimeout(() => {
        if (window.confirm(
            `Journey saved.\n\nGenerate waybill for ${form.origin} → ${form.dest} now?\n\n` +
            `(You can also do this later from the Journeys table)`
        )) {
            const saved = data.journeys.find(j =>
                j.date === form.date &&
                j.origin === form.origin &&
                j.dest === form.dest
            ) || form;
            openWaybillGenerator(saved);
        }
    }, 100);
}
```

---

## STEP 11 — Checklist

- [ ] Standalone "Waybill Management" page is completely removed
- [ ] "Register Waybill" modal with 4 fields is completely gone
- [ ] No separate waybill navigation item in the sidebar
- [ ] Journeys table has a "Waybill" button on each row
- [ ] Button shows "WB-2025-00001" in green when waybill already generated
- [ ] Clicking "Waybill" on a new journey opens the WaybillModal (not RegisterWaybillModal)
- [ ] Section 1 (Carrier) pre-fills from Settings
- [ ] Section 2 (Vehicle & Driver) pre-fills from fleet / drivers data
- [ ] Section 3 (Consignor) pre-fills from journey origin + linked invoice client
- [ ] Section 4 (Consignee) is blank — must be entered manually
- [ ] Section 5 (Route) pre-fills from journey
- [ ] Kampala/Jinja destinations auto-enable cross-border mode
- [ ] "Cross-border mode" toggle at top of modal works
- [ ] CB fields are greyed out in domestic mode, active in cross-border mode
- [ ] Cargo table supports multiple lines (Add / Remove)
- [ ] Documents checklist ticks CB docs automatically in cross-border mode
- [ ] "Save without printing" persists waybillData onto the journey
- [ ] "Save & Print" opens a new browser tab with clean A4 print layout
- [ ] Print layout uses Arial font (no Google Fonts dependency)
- [ ] Print layout has all 10 sections, signature boxes, copy bar
- [ ] Company logo appears on print if set in Settings
- [ ] Saving a new journey (status: Loading) prompts to generate waybill
- [ ] Waybill counter in Settings increments after first save
