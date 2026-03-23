# Segecha Tracker — Settings Page Tab Layout
# Cursor AI Prompt — File: src/App.jsx only

Replace the existing `Settings` component inside `App.jsx` with the version below.
Do not touch anything else. All existing state variables, save logic, and
functionality must be preserved exactly — only the layout and navigation change.

---

## Find the Settings component

Locate the comment line:
```jsx
// ══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════
const Settings = () => {
```

Delete everything from that line to the closing `};` of the Settings component.
Replace it entirely with the code below.

---

## Replace with this complete Settings component

```jsx
// ══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════
const Settings = () => {
    const [activeTab, setActiveTab] = useState('company');
    const [saved, setSaved] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');

    const loadSetting = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}')[key] ?? fallback; }
        catch { return fallback; }
    };

    // ── Company
    const [companyName, setCompanyName] = useState(() => loadSetting('companyName', 'Segecha Group Ltd'));
    const [companyPhone, setCompanyPhone] = useState(() => loadSetting('companyPhone', '+254 700 000 000'));
    const [vatRate, setVatRate] = useState(() => loadSetting('vatRate', '16'));
    const [dateFormat, setDateFormat] = useState(() => loadSetting('dateFormat', 'YYYY-MM-DD'));

    // ── M-Pesa
    const [paybillNumber, setPaybillNumber] = useState(() => loadSetting('paybillNumber', ''));
    const [paybillAccount, setPaybillAccount] = useState(() => loadSetting('paybillAccount', ''));
    const [mpesaBusinessName, setMpesaBusinessName] = useState(() => loadSetting('mpesaBusinessName', 'Segecha Group Ltd'));
    const [mpesaConfirmationNote, setMpesaConfirmationNote] = useState(() => loadSetting('mpesaConfirmationNote', 'Payment via M-Pesa Paybill · Thank you for your business!'));
    const [b2cShortcode, setB2cShortcode] = useState(() => loadSetting('b2cShortcode', ''));

    // ── Finance
    const [invoicePrefix, setInvoicePrefix] = useState(() => loadSetting('invoicePrefix', 'INV'));
    const [paymentTermsDays, setPaymentTermsDays] = useState(() => loadSetting('paymentTermsDays', '14'));
    const [bankName, setBankName] = useState(() => loadSetting('bankName', ''));
    const [bankAccount, setBankAccount] = useState(() => loadSetting('bankAccount', ''));
    const [bankBranch, setBankBranch] = useState(() => loadSetting('bankBranch', ''));

    // ── Fleet & Fuel
    const [defaultFuelPrice, setDefaultFuelPrice] = useState(() => loadSetting('defaultFuelPrice', ''));
    const [maxFuelLitres, setMaxFuelLitres] = useState(() => loadSetting('maxFuelLitres', '2000'));
    const [defaultTyreInterval, setDefaultTyreInterval] = useState(() => loadSetting('defaultTyreInterval', '60000'));

    // ── Routes & Cargo
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
        } catch { return 'Electronics\nFMCG Goods\nSpare Parts\nMachinery\nCement\nFertiliser'; }
    });

    // ── Mileage
    const [driverPerKm, setDriverPerKm] = useState(() => loadSetting('driverPerKm', '10'));
    const [turnboyPerKm, setTurnboyPerKm] = useState(() => loadSetting('turnboyPerKm', '6'));
    const [routeOverridesText, setRouteOverridesText] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
            const o = s.routeOverrides || {};
            return Object.keys(o).length ? Object.entries(o).map(([r, v]) => `${r},${v.driver},${v.turnboy}`).join('\n') : '';
        } catch { return ''; }
    });

    // ── Alerts
    const [tyreWarnKm, setTyreWarnKm] = useState(() => loadSetting('tyreWarnKm', '5000'));
    const [invoiceOverdueDays, setInvoiceOverdueDays] = useState(() => loadSetting('invoiceOverdueDays', '30'));
    const [staleTransitDays, setStaleTransitDays] = useState(() => loadSetting('staleTransitDays', '5'));
    const [maintenanceOverdueDays, setMaintenanceOverdueDays] = useState(() => loadSetting('maintenanceOverdueDays', '7'));
    const [fleetActiveWarnPct, setFleetActiveWarnPct] = useState(() => loadSetting('fleetActiveWarnPct', '50'));

    // ── Appearance
    const [defaultDarkMode, setDefaultDarkMode] = useState(() => loadSetting('defaultDarkMode', 'light'));

    // ── Lists
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

    // ── Driver portal auth state (one email+password per driver)
    const [driverCreds, setDriverCreds] = useState(() =>
        data.drivers.reduce((acc, d) => ({ ...acc, [d.id]: { email: '', password: '' } }), {})
    );
    const [driverAuthStatus, setDriverAuthStatus] = useState({});

    const parseLines = t => t.split('\n').map(l => l.trim()).filter(Boolean);
    const parseRoutes = t => t.split('\n').map(l => {
        const p = l.split(',').map(x => x.trim());
        return p.length >= 2 ? { origin: p[0], dest: p[1], distance: +p[2] || 0 } : null;
    }).filter(Boolean);
    const parseRouteOverrides = t => {
        const o = {};
        t.split('\n').filter(l => l.trim()).forEach(line => {
            const p = line.split(',').map(x => x.trim());
            if (p.length >= 2 && p[0] && +p[1] > 0) o[p[0]] = { driver: +p[1], turnboy: +p[2] || 0 };
        });
        return o;
    };

    const saveSettings = () => {
        const s = {
            companyName, companyPhone, vatRate, dateFormat,
            paybillNumber, paybillAccount, mpesaBusinessName, mpesaConfirmationNote, b2cShortcode,
            invoicePrefix, paymentTermsDays, bankName, bankAccount, bankBranch,
            defaultFuelPrice, maxFuelLitres, defaultTyreInterval,
            commonRoutes: parseRoutes(commonRoutes),
            cargoTypes: parseLines(cargoTypesText),
            driverPerKm, turnboyPerKm,
            routeOverrides: parseRouteOverrides(routeOverridesText),
            tyreWarnKm, invoiceOverdueDays, staleTransitDays, maintenanceOverdueDays, fleetActiveWarnPct,
            defaultDarkMode,
            expenseCategories: parseLines(expCategoriesText),
            truckTypes: parseLines(truckTypesText),
            licenceClasses: parseLines(licenceClassesText),
        };
        localStorage.setItem('segecha_settings', JSON.stringify(s));
        setSaved(true);
        setTimeout(() => { setSaved(false); window.location.reload(); }, 1200);
    };

    const syncData = async () => {
        setSyncing(true); setSyncStatus('');
        try {
            const res = await fetch(`${PAYMENT_API}/api/tracker/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data, adminKey: ADMIN_KEY }),
            });
            const result = await res.json();
            setSyncStatus(result.success ? '✅ Data synced successfully' : '❌ ' + result.error);
        } catch { setSyncStatus('❌ Server not reachable — is it running?'); }
        setSyncing(false);
    };

    const saveDriverAuth = async (driver) => {
        const cred = driverCreds[driver.id] || {};
        if (!cred.email || !cred.password || cred.password.length < 6) {
            setDriverAuthStatus(s => ({ ...s, [driver.id]: '❌ Enter a valid email and password (6+ chars)' }));
            return;
        }
        setDriverAuthStatus(s => ({ ...s, [driver.id]: '⏳ Saving…' }));
        try {
            const res = await fetch(`${PAYMENT_API}/api/driver/set-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: driver.id, email: cred.email, password: cred.password, adminKey: ADMIN_KEY }),
            });
            const result = await res.json();
            setDriverAuthStatus(s => ({ ...s, [driver.id]: result.success ? '✅ Login saved' : '❌ ' + result.error }));
            if (result.success) setDriverCreds(c => ({ ...c, [driver.id]: { email: cred.email, password: '' } }));
        } catch { setDriverAuthStatus(s => ({ ...s, [driver.id]: '❌ Server not reachable' })); }
    };

    const storageSize = (() => {
        try { const s = localStorage.getItem('segecha_v2'); return s ? (new Blob([s]).size / 1024).toFixed(1) + ' KB' : '0 KB'; }
        catch { return 'N/A'; }
    })();

    // ── Shared style helpers
    const field = (label, hint, input) => (
        <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</label>
            {hint && <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 5 }}>{hint}</div>}
            {input}
        </div>
    );

    const inp = (val, set, opts = {}) => (
        <input style={S.inp} value={val} onChange={e => set(e.target.value)} {...opts} />
    );

    const ta = (val, set, rows = 6) => (
        <textarea style={{ ...S.inp, height: rows * 22, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            value={val} onChange={e => set(e.target.value)} />
    );

    const sel = (val, set, options) => (
        <select style={S.inp} value={val} onChange={e => set(e.target.value)}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );

    const sectionHead = (title, sub) => (
        <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>{title}</div>
            {sub && <div style={{ fontSize: 13, color: T.textDim }}>{sub}</div>}
        </div>
    );

    const card = (children, accent) => (
        <div style={{ background: T.surface, border: `1px solid ${accent ? accent + '33' : T.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            {children}
        </div>
    );

    const cardTitle = (t) => (
        <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 14 }}>{t}</div>
    );

    const grid2 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 };
    const grid3 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12 };

    const alertRow = (label, hint, val, set, unit) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${T.border2}` }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</div>
                {hint && <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>{hint}</div>}
            </div>
            <input style={{ ...S.inp, width: 80, textAlign: 'center', marginBottom: 0 }} type="number" value={val}
                onChange={e => set(e.target.value)} />
            {unit && <span style={{ fontSize: 12, color: T.textFaint, whiteSpace: 'nowrap' }}>{unit}</span>}
        </div>
    );

    // ── Nav items config
    const NAV_GROUPS = [
        {
            label: 'Business',
            items: [
                { id: 'company',    icon: '🏢', label: 'Company' },
                { id: 'mpesa',      icon: '💚', label: 'M-Pesa' },
                { id: 'finance',    icon: '🧾', label: 'Finance' },
            ]
        },
        {
            label: 'Operations',
            items: [
                { id: 'fleet',      icon: '🚛', label: 'Fleet & Fuel' },
                { id: 'routes',     icon: '🗺️', label: 'Routes & Cargo' },
                { id: 'mileage',    icon: '🛣️', label: 'Mileage Rates' },
                { id: 'turnboys',   icon: '👤', label: 'Turnboys' },
            ]
        },
        {
            label: 'System',
            items: [
                { id: 'alerts',     icon: '🔔', label: 'Alerts', badge: 5 },
                { id: 'appearance', icon: '🎨', label: 'Appearance' },
                { id: 'lists',      icon: '📋', label: 'Dropdowns' },
            ]
        },
        {
            label: 'Data',
            items: [
                { id: 'drivers',    icon: '🚗', label: 'Driver Access' },
                { id: 'backup',     icon: '💾', label: 'Backup & Import' },
                { id: 'danger',     icon: '⚠️', label: 'Data Management' },
            ]
        },
    ];

    // ── Sidebar styles
    const navItem = (id) => ({
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 14px',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        textAlign: 'left',
        background: activeTab === id ? '#f9731618' : 'transparent',
        color: activeTab === id ? '#f97316' : T.textFaint,
        fontWeight: activeTab === id ? 700 : 400,
        borderLeft: activeTab === id ? '2px solid #f97316' : '2px solid transparent',
        marginBottom: 1,
    });

    const navGroupLabel = {
        padding: '12px 14px 4px',
        fontSize: 10,
        color: T.textGhost,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontWeight: 700,
    };

    // ── Content panels
    const panels = {

        company: (
            <>
                {sectionHead('Company information', 'Shown on invoices, reports, and the payment portal.')}
                <div style={grid2}>
                    {field('Company name', 'Appears on all invoices and reports', inp(companyName, setCompanyName))}
                    {field('Company phone', 'Shown on invoice footer', inp(companyPhone, setCompanyPhone, { type: 'tel' }))}
                    {field('VAT rate (%)', 'Kenya standard is 16% (KRA)', inp(vatRate, setVatRate, { type: 'number' }))}
                    {field('Date display format', 'How dates appear across the app',
                        sel(dateFormat, setDateFormat, [
                            ['YYYY-MM-DD', '2025-03-21 (ISO — default)'],
                            ['DD/MM/YYYY', '21/03/2025 (Kenyan standard)'],
                            ['DD MMM YYYY', '21 Mar 2025 (readable)'],
                        ])
                    )}
                </div>
            </>
        ),

        mpesa: (
            <>
                {sectionHead('M-Pesa configuration', 'Configure your Safaricom Paybill and B2C shortcode.')}
                {card(<>
                    {cardTitle('Invoice payments — clients pay you')}
                    <div style={grid2}>
                        {field('Paybill number', 'Your Safaricom Business Paybill', inp(paybillNumber, setPaybillNumber, { placeholder: 'e.g. 522522' }))}
                        {field('Account number', 'What clients enter on M-Pesa', inp(paybillAccount, setPaybillAccount, { placeholder: 'e.g. SEGECHA or Invoice No.' }))}
                        {field('Business name on M-Pesa', "Name on client's M-Pesa receipt", inp(mpesaBusinessName, setMpesaBusinessName))}
                        {field('Invoice payment footer', 'Text at bottom of every invoice',
                            <textarea style={{ ...S.inp, height: 64, resize: 'vertical', fontFamily: 'inherit' }}
                                value={mpesaConfirmationNote} onChange={e => setMpesaConfirmationNote(e.target.value)} />
                        )}
                    </div>
                    {paybillNumber && (
                        <div style={{ background: dark ? '#10b98108' : '#f0fdf4', border: '1px solid #10b98133', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: T.textDim }}>
                            Preview: Pay via <b style={{ color: T.text }}>M-Pesa Paybill: {paybillNumber}</b> · Account: <b style={{ color: T.text }}>{paybillAccount || 'Invoice Number'}</b>
                        </div>
                    )}
                </>)}

                {card(<>
                    {cardTitle('Driver salary payments — you pay drivers')}
                    {field('B2C shortcode / Till number', 'For paying drivers via M-Pesa Business', inp(b2cShortcode, setB2cShortcode, { placeholder: 'e.g. 600000' }))}
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Registered driver M-Pesa numbers</div>
                    <table style={{ ...S.tbl }}>
                        <thead><tr>{['Driver', 'M-Pesa', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                        <tbody>
                            {data.drivers.map(d => (
                                <tr key={d.id}>
                                    <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{d.name}</td>
                                    <td style={{ ...S.td, fontFamily: 'monospace', color: d.mpesa ? '#10b981' : '#ef4444' }}>
                                        {d.mpesa ? `💚 ${d.mpesa}` : '⚠ Not set'}
                                    </td>
                                    <td style={S.td}><span style={S.badge(d.status)}>{d.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.drivers.some(d => !d.mpesa) && (
                        <div style={{ marginTop: 10, background: '#f9731612', border: '1px solid #f9731633', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#f97316' }}>
                            ⚠️ {data.drivers.filter(d => !d.mpesa).length} driver(s) missing M-Pesa number — edit on the Drivers page.
                        </div>
                    )}
                </>)}
            </>
        ),

        finance: (
            <>
                {sectionHead('Invoice & finance', 'Default invoice numbering, payment terms, and bank transfer details.')}
                <div style={grid2}>
                    {field('Invoice number prefix', 'e.g. SGR → SGR-00XY', inp(invoicePrefix, setInvoicePrefix, { onChange: e => setInvoicePrefix(e.target.value.toUpperCase()) }))}
                    {field('Default payment terms (days)', 'Due date auto-set from issue date', inp(paymentTermsDays, setPaymentTermsDays, { type: 'number' }))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: '4px 0 14px' }}>Bank transfer details</div>
                <div style={grid2}>
                    {field('Bank name', 'Shown on invoice payment footer', inp(bankName, setBankName, { placeholder: 'e.g. Equity Bank' }))}
                    {field('Account number', '', inp(bankAccount, setBankAccount, { placeholder: 'e.g. 0123456789' }))}
                    {field('Branch', '', inp(bankBranch, setBankBranch, { placeholder: 'e.g. Westlands, Nairobi' }))}
                </div>
            </>
        ),

        fleet: (
            <>
                {sectionHead('Fleet & fuel defaults', 'Pre-fill values used when logging fuel and adding new trucks.')}
                <div style={grid2}>
                    {field('Default fuel price (KES/L)', 'Pre-fills price when logging a fuel entry', inp(defaultFuelPrice, setDefaultFuelPrice, { type: 'number', placeholder: 'e.g. 176' }))}
                    {field('Max litres per fill-up', 'Validation cap — warn if a single entry exceeds this', inp(maxFuelLitres, setMaxFuelLitres, { type: 'number', placeholder: '2000' }))}
                    {field('Default tyre change interval (km)', 'Pre-filled when adding a new truck', inp(defaultTyreInterval, setDefaultTyreInterval, { type: 'number', placeholder: '60000' }))}
                </div>
            </>
        ),

        routes: (
            <>
                {sectionHead('Routes & cargo', 'Common routes appear as quick-select in the journey form. Cargo types appear as autocomplete suggestions.')}
                <div style={grid2}>
                    {field('Common routes', 'One per line: Origin, Destination, Distance(km)',
                        ta(commonRoutes, setCommonRoutes, 8)
                    )}
                    {field('Cargo types', 'One per line — shown as suggestions in the journey form',
                        ta(cargoTypesText, setCargoTypesText, 8)
                    )}
                </div>
            </>
        ),

        mileage: (
            <>
                {sectionHead('Mileage allowance rates', 'Auto-calculated when a journey is saved and created as Allowance expense entries.')}
                <div style={grid2}>
                    {field('Driver rate (KES per km)', 'Paid to the main assigned driver per km', inp(driverPerKm, setDriverPerKm, { type: 'number', placeholder: '10' }))}
                    {field('Turnboy rate (KES per km)', 'Paid to the turnboy / second driver per km', inp(turnboyPerKm, setTurnboyPerKm, { type: 'number', placeholder: '6' }))}
                </div>
                {(+driverPerKm > 0) && (
                    <div style={{ background: dark ? '#10b98108' : '#f0fdf4', border: '1px solid #10b98133', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: T.textDim, marginBottom: 20 }}>
                        Example — Nairobi → Mombasa (480 km):{' '}
                        Driver <b style={{ color: '#10b981' }}>KES {(+driverPerKm * 480).toLocaleString('en-KE')}</b>
                        {+turnboyPerKm > 0 && <> · Turnboy <b style={{ color: '#3b82f6' }}>KES {(+turnboyPerKm * 480).toLocaleString('en-KE')}</b></>}
                    </div>
                )}
                {field('Route-specific rate overrides',
                    'One per line: Origin→Destination, DriverRate, TurnboyRate   e.g.  Nairobi→Kampala,15,9',
                    ta(routeOverridesText, setRouteOverridesText, 5)
                )}
                {routeOverridesText.trim() && (
                    <div style={{ background: dark ? '#0c0e14' : '#f8fafc', borderRadius: 8, padding: '10px 14px', border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, marginBottom: 6 }}>Parsed overrides:</div>
                        {routeOverridesText.split('\n').filter(l => l.trim()).map((line, i) => {
                            const p = line.split(',').map(x => x.trim());
                            const valid = p.length >= 2 && p[0] && +p[1] > 0;
                            return (
                                <div key={i} style={{ fontSize: 12, marginBottom: 2, color: valid ? T.textDim : '#ef4444' }}>
                                    {valid ? `✅ ${p[0]} — Driver: KES ${p[1]}/km${p[2] ? `, Turnboy: KES ${p[2]}/km` : ''}` : `❌ Invalid: "${line}"`}
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        ),

        turnboys: (
            <>
                {sectionHead('Salaried turnboys', 'Add turnboys on the company payroll — they appear in the journey form as assignable. Casual turnboys are added by name directly on each journey.')}
                {(data.turnboys || []).length === 0 ? (
                    <div style={{ color: T.textFaint, fontSize: 13, padding: '16px 0', fontStyle: 'italic' }}>No salaried turnboys added yet.</div>
                ) : (
                    <div style={{ ...S.card(), overflowX: 'auto', marginBottom: 16 }}>
                        <table style={S.tbl}>
                            <thead><tr>{['Name', 'Phone', 'M-Pesa', 'Salary', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {(data.turnboys || []).map(tb => (
                                    <tr key={tb.id}>
                                        <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{tb.name}</td>
                                        <td style={S.td}>{tb.phone}</td>
                                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#10b981' }}>💚 {tb.mpesa}</td>
                                        <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>{fmt(tb.salary)}/mo</td>
                                        <td style={S.td}><span style={S.badge(tb.status)}>{tb.status}</span></td>
                                        <td style={S.td}><button style={S.btn('del')} onClick={() => delItem('turnboys', tb.id, tb.name)}>✕</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {card(
                    <>
                        {cardTitle('+ Add salaried turnboy')}
                        <AddTurnboyForm />
                    </>
                )}
            </>
        ),

        alerts: (
            <>
                {sectionHead('Alert thresholds', 'Control when each alert appears on the Dashboard. All thresholds are configurable here.')}
                {card(
                    <div>
                        {alertRow('Tyre warning', 'Warn when this many km remain before change is due', tyreWarnKm, setTyreWarnKm, 'km')}
                        {alertRow('Invoice overdue', 'Mark unpaid invoices overdue after this many days', invoiceOverdueDays, setInvoiceOverdueDays, 'days')}
                        {alertRow('Stale "In Transit" journey', 'Alert if a journey stays In Transit longer than this', staleTransitDays, setStaleTransitDays, 'days')}
                        {alertRow('Maintenance overdue', 'Alert if a truck stays in Maintenance longer than this', maintenanceOverdueDays, setMaintenanceOverdueDays, 'days')}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Low fleet active warning</div>
                                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                                    Alert when active fleet drops below this · Currently {data.trucks.length > 0 ? Math.round((data.trucks.filter(t => t.status === 'Active').length / data.trucks.length) * 100) : 100}% active
                                </div>
                            </div>
                            <input style={{ ...S.inp, width: 80, textAlign: 'center', marginBottom: 0 }} type="number" value={fleetActiveWarnPct} onChange={e => setFleetActiveWarnPct(e.target.value)} />
                            <span style={{ fontSize: 12, color: T.textFaint }}>%</span>
                        </div>
                    </div>
                )}
            </>
        ),

        appearance: (
            <>
                {sectionHead('Appearance', 'Controls how the app looks when it first loads.')}
                <div style={{ maxWidth: 380 }}>
                    {field('Default theme', 'Applied when the app first loads',
                        sel(defaultDarkMode, setDefaultDarkMode, [['light', '☀️ Light mode'], ['dark', '🌙 Dark mode']])
                    )}
                    {field('Date display format', 'How dates appear in tables and reports',
                        sel(dateFormat, setDateFormat, [
                            ['YYYY-MM-DD', '2025-03-21 (ISO — default)'],
                            ['DD/MM/YYYY', '21/03/2025 (Kenyan standard)'],
                            ['DD MMM YYYY', '21 Mar 2025 (readable)'],
                        ])
                    )}
                </div>
                <div style={{ background: '#f9731612', border: '1px solid #f9731633', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#f97316', marginTop: 8 }}>
                    ⚠️ Date format and theme changes take effect after saving (page reloads).
                </div>
            </>
        ),

        lists: (
            <>
                {sectionHead('Customise dropdown lists', 'Edit these to match your business. One item per line. Changes apply after saving.')}
                <div style={grid2}>
                    {field('Expense categories', '', ta(expCategoriesText, setExpCategoriesText, 7))}
                    {field('Truck types', '', ta(truckTypesText, setTruckTypesText, 5))}
                    {field('Driver licence classes', '', ta(licenceClassesText, setLicenceClassesText, 4))}
                </div>
            </>
        ),

        drivers: (
            <>
                {sectionHead('Driver portal access', 'Set login credentials for each driver and sync data to the driver portal at driver.segecha.com.')}
                {card(<>
                    {cardTitle('Sync tracker data')}
                    <div style={{ fontSize: 13, color: T.textDim, marginBottom: 14 }}>Pushes the latest journeys, trucks, and payslips to the driver app server. Do this after any major data changes.</div>
                    <button style={S.btn('green')} onClick={syncData} disabled={syncing}>
                        {syncing ? '⏳ Syncing…' : '📤 Sync Tracker Data'}
                    </button>
                    {syncStatus && <div style={{ fontSize: 12, color: syncStatus.startsWith('✅') ? '#10b981' : '#ef4444', marginTop: 10 }}>{syncStatus}</div>}
                </>)}
                {card(<>
                    {cardTitle('Driver login credentials')}
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>Set an email and password for each driver so they can log in to the driver portal.</div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ ...S.tbl, minWidth: 560 }}>
                            <thead><tr>{['Driver', 'Phone', 'Set Email', 'New Password', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {data.drivers.map(d => (
                                    <tr key={d.id}>
                                        <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{d.name}</td>
                                        <td style={{ ...S.td, color: T.textFaint }}>{d.phone}</td>
                                        <td style={S.td}>
                                            <input style={{ ...S.inp, marginBottom: 0, width: 160 }} type="email" placeholder="driver@email.com"
                                                value={driverCreds[d.id]?.email || ''}
                                                onChange={e => setDriverCreds(c => ({ ...c, [d.id]: { ...c[d.id], email: e.target.value } }))} />
                                        </td>
                                        <td style={S.td}>
                                            <input style={{ ...S.inp, marginBottom: 0, width: 130 }} type="password" placeholder="6+ chars"
                                                value={driverCreds[d.id]?.password || ''}
                                                onChange={e => setDriverCreds(c => ({ ...c, [d.id]: { ...c[d.id], password: e.target.value } }))} />
                                        </td>
                                        <td style={S.td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button style={S.btn('sm')} onClick={() => saveDriverAuth(d)}>Save Auth</button>
                                                {driverAuthStatus[d.id] && (
                                                    <span style={{ fontSize: 11, color: driverAuthStatus[d.id].startsWith('✅') ? '#10b981' : '#ef4444' }}>
                                                        {driverAuthStatus[d.id]}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>)}
            </>
        ),

        backup: (
            <>
                {sectionHead('Backup & import', 'Export your data for safekeeping, restore from a previous backup, or import records from CSV / Excel.')}
                <div style={grid2}>
                    {card(<>
                        {cardTitle('⬇️ Export backup')}
                        <div style={{ fontSize: 13, color: T.textDim, marginBottom: 14 }}>Downloads all data + settings as a dated .json file.</div>
                        <button style={S.btn('green')} onClick={() => {
                            const backup = { exportedAt: new Date().toISOString(), version: '3.0', data, settings: (() => { try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); } catch { return {}; } })() };
                            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = `segecha_backup_${today()}.json`; a.click();
                            URL.revokeObjectURL(url);
                        }}>⬇️ Download Backup ({today()})</button>
                    </>)}
                    {card(<>
                        {cardTitle('⬆️ Restore from backup')}
                        <div style={{ fontSize: 13, color: T.textDim, marginBottom: 14 }}><b>Overwrites</b> all current data and settings. Use a file exported from this tracker.</div>
                        <label style={{ ...S.btn(), display: 'inline-block', cursor: 'pointer' }}>
                            📂 Choose Backup File
                            <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => {
                                const file = e.target.files[0]; if (!file) return;
                                if (!window.confirm('Restore from this backup? All current data and settings will be replaced.')) { e.target.value = ''; return; }
                                const reader = new FileReader();
                                reader.onload = ev => {
                                    try {
                                        const backup = JSON.parse(ev.target.result);
                                        if (!backup.data?.trucks) { alert('Invalid backup file.'); return; }
                                        setData(backup.data);
                                        if (backup.settings) localStorage.setItem('segecha_settings', JSON.stringify(backup.settings));
                                        alert(`✅ Restored.\nExported: ${backup.exportedAt || 'unknown'}${backup.settings ? '\nSettings also restored.' : ''}`);
                                        window.location.reload();
                                    } catch { alert('❌ Could not read backup file.'); }
                                };
                                reader.readAsText(file); e.target.value = '';
                            }} />
                        </label>
                    </>)}
                </div>

                <div style={{ fontWeight: 700, fontSize: 13, color: T.text, margin: '8px 0 14px' }}>Import from CSV / Excel</div>
                <div style={{ fontSize: 13, color: T.textDim, marginBottom: 16 }}>Successfully imported rows are added immediately. Every failed row appears in the error report below with the exact reason.</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                    {Object.entries(IMPORT_SCHEMAS).map(([key, schema]) => (
                        <div key={key} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4 }}>{schema.label}</div>
                            <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 12 }}>Required: {schema.requiredFields.join(', ')}</div>
                            <label style={{ ...S.btn(), display: 'inline-block', cursor: 'pointer', fontSize: 12 }}>
                                📂 Choose File
                                <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={e => { const file = e.target.files[0]; if (file) runImport(file, key); e.target.value = ''; }} />
                            </label>
                        </div>
                    ))}
                </div>

                {showImportPanel && importResult && (
                    <div style={{ border: `1px solid ${importResult.errors.length > 0 ? '#ef4444' : '#10b981'}44`, borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>📋 Import Report — {importResult.schema}</div>
                            <button style={S.btn('ghost')} onClick={() => setShowImportPanel(false)}>✕ Close</button>
                        </div>
                        <div style={grid3}>
                            {[['✅ Imported', importResult.imported.length, '#10b981', 'rows added'], ['❌ Failed', importResult.errors.length, '#ef4444', 'rows had errors'], ['📄 Total', importResult.totalRows || 0, '#38bdf8', 'rows in file']].map(([label, val, c, sub]) => (
                                <div key={label} style={S.card(c)}><div style={S.kpi}>{label}</div><div style={S.val(c)}>{val}</div><div style={S.sub}>{sub}</div></div>
                            ))}
                        </div>
                        {importResult.errors.length > 0 && (
                            <div style={{ marginTop: 16, overflowX: 'auto' }}>
                                <table style={{ ...S.tbl, minWidth: 560 }}>
                                    <thead><tr>{['Row #', 'Problem Fields', 'Error Details', 'Raw Values'].map(h => <th key={h} style={{ ...S.th, background: '#ef444412', color: '#ef4444' }}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {importResult.errors.map((err, i) => (
                                            <tr key={i}>
                                                <td style={{ ...S.td, fontWeight: 800, color: '#ef4444' }}>Row {err.row}</td>
                                                <td style={S.td}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{err.fields.map(f => <span key={f} style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontFamily: 'monospace' }}>{f}</span>)}</div></td>
                                                <td style={S.td}><ul style={{ margin: 0, paddingLeft: 14, fontSize: 12, color: T.textDim }}>{err.messages.map((m, j) => <li key={j}>{m}</li>)}</ul></td>
                                                <td style={S.td}>{err.rawValues && <div style={{ fontSize: 10, fontFamily: 'monospace', color: T.textFaint, maxWidth: 200, wordBreak: 'break-all' }}>{Object.entries(err.rawValues).filter(([, v]) => v !== '').slice(0, 5).map(([k, v]) => <div key={k}><span style={{ color: '#f97316' }}>{k}</span>: {String(v).slice(0, 40)}</div>)}</div>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ ...{ fontWeight: 700, fontSize: 13, color: T.text }, margin: '24px 0 14px' }}>Data summary</div>
                <div style={grid3}>
                    {[['Trucks', data.trucks.length], ['Drivers', data.drivers.length], ['Journeys', data.journeys.length], ['Fuel Entries', data.fuel.length], ['Expenses', data.expenses.length], ['Invoices', data.invoices.length], ['Payroll Records', data.payroll.length], ['Storage Used', storageSize]].map(([l, v]) => (
                        <div key={l} style={{ background: dark ? T.bg : '#f8fafc', borderRadius: 8, padding: '12px 14px', border: `1px solid ${T.border}` }}>
                            <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 3 }}>{l}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{v}</div>
                        </div>
                    ))}
                </div>
            </>
        ),

        danger: (
            <>
                {sectionHead('Data management', 'These actions cannot be undone. Use with caution.')}
                <div style={{ background: dark ? '#ef444408' : '#fef2f2', border: '1px solid #ef444433', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginBottom: 14 }}>Destructive actions</div>
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>These actions affect your stored data permanently and cannot be reversed.</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button style={{ ...S.btn('del'), padding: '10px 18px' }} onClick={() => { if (window.confirm('Reset ALL data back to demo data? Everything you have entered will be lost.')) { localStorage.removeItem('segecha_v2'); window.location.reload(); } }}>↺ Reset to Demo Data</button>
                        <button style={{ ...S.btn('del'), padding: '10px 18px' }} onClick={() => { if (window.confirm('Clear ALL data? Cannot be undone.')) { setData({ trucks: [], drivers: [], journeys: [], fuel: [], expenses: [], invoices: [], payroll: [], turnboys: [] }); } }}>🗑️ Clear All Data</button>
                    </div>
                </div>
            </>
        ),
    };

    // ── Sub-component: AddTurnboyForm
    const AddTurnboyForm = () => {
        const [form, setForm] = useState({ status: 'Active' });
        const [msg, setMsg] = useState('');
        const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
        const save = () => {
            if (!form.name || !form.phone) { setMsg('❌ Name and phone required'); return; }
            setData(d => ({ ...d, turnboys: [...(d.turnboys || []), { id: 'TB' + uid().slice(0, 4), name: form.name, phone: form.phone, status: form.status || 'Active', salary: +form.salary || 0, mpesa: form.mpesa || form.phone.replace(/\s/g, ''), joined: today() }] }));
            setForm({ status: 'Active' }); setMsg('✅ Turnboy added');
            setTimeout(() => setMsg(''), 2000);
        };
        return (
            <>
                <div style={grid2}>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textFaint, marginBottom: 4 }}>Full name</label><input style={S.inp} placeholder="e.g. John Otieno" value={form.name || ''} onChange={e => set('name', e.target.value)} /></div>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textFaint, marginBottom: 4 }}>Phone</label><input style={S.inp} placeholder="07XX XXX XXX" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textFaint, marginBottom: 4 }}>M-Pesa number</label><input style={S.inp} placeholder="07XXXXXXXX" value={form.mpesa || ''} onChange={e => set('mpesa', e.target.value)} /></div>
                    <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textFaint, marginBottom: 4 }}>Monthly salary (KES)</label><input style={S.inp} type="number" placeholder="e.g. 25000" value={form.salary || ''} onChange={e => set('salary', e.target.value)} /></div>
                </div>
                {msg && <div style={{ fontSize: 12, color: msg.startsWith('✅') ? '#10b981' : '#ef4444', marginBottom: 10 }}>{msg}</div>}
                <button style={S.btn()} onClick={save}>+ Add Turnboy</button>
            </>
        );
    };

    // ── Render
    return (
        <div style={{ display: 'flex', gap: 0, minHeight: 600, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>

            {/* Sidebar */}
            {!isMobile && (
                <nav style={{ width: 200, flexShrink: 0, background: T.sidebar, borderRight: `1px solid ${T.border}`, padding: '14px 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    {NAV_GROUPS.map(group => (
                        <div key={group.label}>
                            <div style={navGroupLabel}>{group.label}</div>
                            {group.items.map(item => (
                                <button key={item.id} style={navItem(item.id)} onClick={() => setActiveTab(item.id)}>
                                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                                    <span>{item.label}</span>
                                    {item.badge && <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>{item.badge}</span>}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
            )}

            {/* Mobile tab row */}
            {isMobile && (
                <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${T.border}`, background: T.sidebar, padding: '8px 8px 0' }}>
                    {NAV_GROUPS.flatMap(g => g.items).map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id)}
                            style={{ flexShrink: 0, padding: '7px 12px 9px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: activeTab === item.id ? '#f97316' : T.textFaint, fontWeight: activeTab === item.id ? 700 : 400, borderBottom: activeTab === item.id ? '2px solid #f97316' : '2px solid transparent', whiteSpace: 'nowrap' }}>
                            {item.icon} {item.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, padding: isMobile ? 16 : 28 }}>
                    <div style={S.ph}>
                        {NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.icon}{' '}
                        {NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label}
                    </div>
                    {panels[activeTab] || null}
                </div>

                {/* Sticky save footer */}
                <div style={{ borderTop: `1px solid ${T.border}`, padding: '14px 28px', background: T.surface, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <button style={{ ...S.btn('green'), padding: '11px 28px', fontSize: 14 }} onClick={saveSettings}>
                        {saved ? '✅ Saved! Reloading…' : '💾 Save All Settings'}
                    </button>
                    <span style={{ fontSize: 12, color: T.textFaint }}>Settings are stored locally on this device. Page reloads after saving.</span>
                </div>
            </div>
        </div>
    );
};
```

---

## Checklist after implementing

- [ ] Settings nav has 4 groups: Business / Operations / System / Data
- [ ] Clicking each nav item shows the correct panel — no page scroll needed
- [ ] Company panel shows 4 fields including date format
- [ ] M-Pesa panel shows invoice + salary sections and driver M-Pesa table
- [ ] Finance panel shows prefix, payment terms, and bank details
- [ ] Fleet & Fuel panel shows 3 fuel/tyre defaults
- [ ] Routes & Cargo panel shows two side-by-side textareas
- [ ] Mileage Rates panel shows rates, live example calculation, route overrides with parse preview
- [ ] Turnboys panel shows table (empty initially) + Add form
- [ ] Alerts panel shows all 5 thresholds in a clean row layout with live fleet % shown
- [ ] Appearance panel shows theme and date format selectors
- [ ] Dropdowns panel shows 3 editable lists
- [ ] Driver Access panel shows Sync button and per-driver email/password table
- [ ] Backup panel shows export, restore, import cards, and data summary metrics
- [ ] Data Management panel shows danger zone with two destructive buttons
- [ ] Save All Settings button is sticky at the bottom — always visible
- [ ] On mobile, sidebar collapses to a horizontal scrollable tab row
- [ ] All existing save logic, import logic, and data management functionality still works
