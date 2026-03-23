# Segecha Fleet — Complete UI/UX Redesign
# Cursor AI Prompt — File: src/App.jsx only
# Full visual overhaul — design system, layout, typography, colour, components

---

## Design direction

**Aesthetic:** Premium enterprise SaaS — think Linear.app meets African fintech.
Clean, data-dense, confident. Dark sidebar with a light content area. Every pixel earns its place.

**Tone:** Serious money tool. Operators trust this with their fleet. It should feel like
Stripe's dashboard if Stripe were built in Nairobi. Not playful. Not corporate-grey.
Sharply professional with moments of warmth.

**The one thing people will remember:** The sidebar is deep navy with a glowing green
active indicator. Data tables are razor-clean with subtle row striping. KPI cards feel
like they belong on a Bloomberg terminal — numbers are large, labels are tiny.

**What to kill:**
- All inline emoji in UI chrome (navigation, headers, buttons, badges) — emoji only in user data
- The orange `#E8501A` used everywhere — demote it to a single call-to-action accent
- Gray backgrounds with no texture or depth
- Every card having a top-coloured border
- `fontWeight: 800` used on everything — creates visual noise
- Generic `borderRadius: 12` on everything — vary it intentionally

---

## PART 1 — Design tokens (replace the existing T / S system entirely)

Find the theme/style system in App.jsx — the `T`, `S`, `dark`, `theme` variables that
are computed before the main render. Replace the entire token system with:

```js
// ─── DESIGN TOKENS ────────────────────────────────────────────────────────
const logoUrl = localStorage.getItem('segecha_logo') || '';

const T = dark ? {
    // Dark theme
    bg:         '#0d1117',       // Page background — GitHub-dark inspired
    sidebar:    '#0a0d12',       // Sidebar — slightly darker than bg
    sidebarHover: '#161b22',
    surface:    '#161b22',       // Cards, modals
    surface2:   '#1c2333',       // Nested surfaces, table headers
    border:     '#30363d',       // Default border
    border2:    '#21262d',       // Subtle / dividers
    text:       '#e6edf3',       // Primary text
    textDim:    '#8b949e',       // Secondary text
    textFaint:  '#484f58',       // Tertiary / hints
    accent:     '#E8501A',       // CTA orange — used sparingly
    accentGlow: '#E8501A22',
    green:      '#3fb950',       // Success / active / positive
    greenBg:    '#1a3a2a',
    amber:      '#d29922',       // Warning
    amberBg:    '#2d2000',
    red:        '#f85149',       // Danger
    redBg:      '#3d1a1a',
    blue:       '#58a6ff',       // Info / links
    blueBg:     '#0d2044',
    purple:     '#bc8cff',       // Special / verification
    purpleBg:   '#1e1040',
    nav:        '#e6edf3',       // Nav text active
    navMuted:   '#484f58',       // Nav text inactive
    navActive:  '#E8501A',       // Active nav indicator
} : {
    // Light theme
    bg:         '#f6f8fa',
    sidebar:    '#ffffff',
    sidebarHover: '#f3f4f6',
    surface:    '#ffffff',
    surface2:   '#f6f8fa',
    border:     '#d0d7de',
    border2:    '#eaeef2',
    text:       '#1f2328',
    textDim:    '#636c76',
    textFaint:  '#9ca3af',
    accent:     '#E8501A',
    accentGlow: '#E8501A18',
    green:      '#1a7f37',
    greenBg:    '#dafbe1',
    amber:      '#9a6700',
    amberBg:    '#fff8c5',
    red:        '#d1242f',
    redBg:      '#ffebe9',
    blue:       '#0969da',
    blueBg:     '#ddf4ff',
    purple:     '#8250df',
    purpleBg:   '#fbefff',
    nav:        '#1f2328',
    navMuted:   '#9ca3af',
    navActive:  '#E8501A',
};

// ─── TYPOGRAPHY ────────────────────────────────────────────────────────────
// Inject fonts once — DM Sans for UI, JetBrains Mono for data
const injectFonts = () => {
    if (document.getElementById('segecha-fonts')) return;
    const link = document.createElement('link');
    link.id = 'segecha-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap';
    document.head.appendChild(link);
};
injectFonts();

// ─── COMPONENT STYLES ─────────────────────────────────────────────────────
const S = {
    // ── Layout
    page: {
        display: 'flex',
        minHeight: '100vh',
        background: T.bg,
        fontFamily: "'DM Sans', -apple-system, sans-serif",
        color: T.text,
        fontSize: 14,
        lineHeight: 1.6,
    },

    // ── Sidebar
    sidebar: {
        width: 220,
        flexShrink: 0,
        background: T.sidebar,
        borderRight: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
    },

    sidebarLogo: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '18px 16px 16px',
        borderBottom: `1px solid ${T.border2}`,
    },

    sidebarLogoMark: {
        width: 32,
        height: 32,
        borderRadius: 8,
        background: T.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        fontFamily: "'Syne', sans-serif",
    },

    sidebarLogoText: {
        fontSize: 14,
        fontWeight: 600,
        color: T.text,
        fontFamily: "'Syne', sans-serif",
        letterSpacing: '-0.3px',
        lineHeight: 1.2,
    },

    sidebarLogoSub: {
        fontSize: 10,
        color: T.textFaint,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
    },

    navGroup: {
        padding: '14px 12px 4px',
        fontSize: 10,
        color: T.textFaint,
        textTransform: 'uppercase',
        letterSpacing: '1.2px',
        fontWeight: 600,
    },

    navItem: (active) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 12px',
        margin: '1px 6px',
        borderRadius: 6,
        cursor: 'pointer',
        border: 'none',
        background: active ? T.accentGlow : 'transparent',
        color: active ? T.accent : T.navMuted,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        width: 'calc(100% - 12px)',
        textAlign: 'left',
        transition: 'background 0.1s, color 0.1s',
        position: 'relative',
        borderLeft: active ? `2px solid ${T.accent}` : '2px solid transparent',
    }),

    navIcon: {
        width: 16,
        height: 16,
        opacity: 0.7,
        flexShrink: 0,
    },

    navBadge: {
        marginLeft: 'auto',
        background: T.red,
        color: '#fff',
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 10,
        minWidth: 18,
        textAlign: 'center',
    },

    sidebarFooter: {
        marginTop: 'auto',
        padding: '12px 16px',
        borderTop: `1px solid ${T.border2}`,
        fontSize: 11,
        color: T.textFaint,
    },

    // ── Topbar
    topbar: {
        height: 52,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 12,
        background: T.surface,
        position: 'sticky',
        top: 0,
        zIndex: 50,
    },

    // ── Content area
    content: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
    },

    main: {
        flex: 1,
        padding: '24px 28px',
        maxWidth: 1400,
        width: '100%',
    },

    // ── Page header
    ph: {
        fontSize: 20,
        fontWeight: 700,
        color: T.text,
        fontFamily: "'Syne', sans-serif",
        letterSpacing: '-0.4px',
        marginBottom: 20,
    },

    // ── Cards
    card: (accent) => ({
        background: T.surface,
        border: `1px solid ${accent ? accent + '30' : T.border}`,
        borderRadius: 8,
        padding: '16px 18px',
        marginBottom: 12,
    }),

    // ── KPI card
    kpiCard: {
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '14px 16px',
    },
    kpi: {
        fontSize: 11,
        color: T.textDim,
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        fontWeight: 500,
        marginBottom: 6,
    },
    val: (c) => ({
        fontSize: 26,
        fontWeight: 600,
        color: c || T.text,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '-0.5px',
        lineHeight: 1,
    }),
    sub: {
        fontSize: 11,
        color: T.textFaint,
        marginTop: 4,
    },

    // ── Tables
    tbl: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
    },
    th: {
        fontSize: 11,
        color: T.textFaint,
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        fontWeight: 500,
        padding: '10px 14px',
        textAlign: 'left',
        background: T.surface2,
        borderBottom: `1px solid ${T.border}`,
        whiteSpace: 'nowrap',
    },
    td: {
        padding: '11px 14px',
        borderBottom: `1px solid ${T.border2}`,
        color: T.text,
        verticalAlign: 'middle',
    },

    // ── Buttons
    btn: (variant) => {
        const base = {
            padding: '7px 14px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'opacity 0.1s',
            fontFamily: "'DM Sans', sans-serif",
            whiteSpace: 'nowrap',
        };
        if (variant === 'primary' || !variant) return { ...base, background: T.accent, color: '#fff', padding: '8px 16px' };
        if (variant === 'sm')     return { ...base, background: T.surface2, color: T.textDim, border: `1px solid ${T.border}`, padding: '5px 10px', fontSize: 12 };
        if (variant === 'ghost')  return { ...base, background: 'transparent', color: T.textDim, border: `1px solid ${T.border}` };
        if (variant === 'danger') return { ...base, background: T.redBg, color: T.red, border: `1px solid ${T.red}30` };
        if (variant === 'del')    return { ...base, background: 'transparent', color: T.textFaint, border: `1px solid ${T.border}`, padding: '5px 8px', fontSize: 11 };
        if (variant === 'green')  return { ...base, background: T.greenBg, color: T.green, border: `1px solid ${T.green}44`, padding: '8px 16px' };
        if (variant === 'blue')   return { ...base, background: T.blueBg, color: T.blue, border: `1px solid ${T.blue}44` };
        return base;
    },

    // ── Form inputs
    inp: {
        width: '100%',
        padding: '8px 11px',
        borderRadius: 6,
        border: `1px solid ${T.border}`,
        background: T.surface,
        color: T.text,
        fontSize: 13,
        outline: 'none',
        boxSizing: 'border-box',
        marginBottom: 12,
        fontFamily: "'DM Sans', sans-serif",
        transition: 'border-color 0.15s',
    },

    lbl: {
        display: 'block',
        fontSize: 12,
        color: T.textDim,
        fontWeight: 500,
        marginBottom: 4,
        letterSpacing: '0.1px',
    },

    // ── Badges / status pills
    badge: (status) => {
        const map = {
            'Active':               { bg: T.greenBg, color: T.green },
            'Completed':            { bg: T.greenBg, color: T.green },
            'Paid':                 { bg: T.greenBg, color: T.green },
            'OK':                   { bg: T.greenBg, color: T.green },
            'In Transit':           { bg: T.blueBg,  color: T.blue  },
            'Loading':              { bg: T.amberBg, color: T.amber },
            'Pending':              { bg: T.amberBg, color: T.amber },
            'Due Soon':             { bg: T.amberBg, color: T.amber },
            'Partial':              { bg: T.amberBg, color: T.amber },
            'Awaiting Verification':{ bg: T.purpleBg, color: T.purple },
            'Overdue':              { bg: T.redBg,   color: T.red   },
            'Inactive':             { bg: T.surface2, color: T.textFaint },
            'Suspended':            { bg: T.redBg,   color: T.red   },
            'Maintenance':          { bg: T.amberBg, color: T.amber },
            'Off Road':             { bg: T.redBg,   color: T.red   },
            'Cancelled':            { bg: T.redBg,   color: T.red   },
        };
        const style = map[status] || { bg: T.surface2, color: T.textDim };
        return {
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 500,
            background: style.bg,
            color: style.color,
            letterSpacing: '0.2px',
        };
    },

    // ── Alert banners
    alertBox: (color) => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 6,
        background: color + '12',
        border: `1px solid ${color}33`,
        marginBottom: 8,
    }),

    // ── Modal overlay
    ovl: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
    },

    // ── Modal box
    mbox: {
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: '0',
        width: 'min(560px, 95vw)',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: dark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(0,0,0,0.15)',
    },

    // ── Modal title bar
    mtitle: {
        fontSize: 15,
        fontWeight: 600,
        color: T.text,
        padding: '16px 20px',
        borderBottom: `1px solid ${T.border}`,
        fontFamily: "'Syne', sans-serif",
    },

    // ── Modal body padding
    mbody: {
        padding: '20px',
    },

    // ── Form grid helpers
    fgg: (cols) => ({
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${cols}, 1fr)`,
        gap: 12,
    }),
    fg: {},

    // ── Table wrapper with border
    tableWrap: {
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        overflow: 'hidden',
    },

    // ── Stat row in tables (for footer totals)
    tfoot: {
        background: T.surface2,
        borderTop: `1px solid ${T.border}`,
    },
};
```

---

## PART 2 — Global CSS injection

Find the first `useEffect` in the component (usually the data persistence one).
Before it, add:

```js
// ── Inject global CSS resets and focus styles
useEffect(() => {
    const style = document.createElement('style');
    style.id = 'segecha-global';
    style.textContent = `
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: ${T.bg}; }
        #root { min-height: 100vh; }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: ${T.accent} !important;
            box-shadow: 0 0 0 3px ${T.accent}18;
        }
        input::placeholder, textarea::placeholder { color: ${T.textFaint}; }
        select option { background: ${T.surface}; color: ${T.text}; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.textFaint}; }
        .segecha-table tr:hover td { background: ${T.surface2}; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .segecha-fade { animation: fadeIn 0.2s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
        .segecha-slide { animation: slideIn 0.15s ease; }
    `;
    const existing = document.getElementById('segecha-global');
    if (existing) existing.remove();
    document.head.appendChild(style);
}, [dark]);
```

---

## PART 3 — Sidebar redesign

Find the sidebar JSX. Replace the entire sidebar render with:

```jsx
<aside style={S.sidebar}>
    {/* Logo / brand */}
    <div style={S.sidebarLogo}>
        {logoUrl ? (
            <img src={logoUrl} alt="logo" style={{ height: 28, maxWidth: 100, objectFit: 'contain' }} />
        ) : (
            <div style={S.sidebarLogoMark}>
                {(companyName || 'S').charAt(0).toUpperCase()}
            </div>
        )}
        <div>
            <div style={S.sidebarLogoText}>{companyName || 'Segecha'}</div>
            <div style={S.sidebarLogoSub}>Fleet ERP</div>
        </div>
    </div>

    {/* Nav groups */}
    <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>

        {/* Fleet operations group */}
        <div style={S.navGroup}>Fleet</div>
        {[
            { id: 'dashboard', icon: GridIcon,      label: 'Dashboard' },
            { id: 'trucks',    icon: TruckIcon,      label: 'Fleet',     alias: 'fleet' },
            { id: 'drivers',   icon: PersonIcon,     label: 'Drivers' },
            { id: 'journeys',  icon: RouteIcon,      label: 'Journeys',
              badge: data.journeys.filter(j => j.status === 'Awaiting Verification').length || null },
            { id: 'maintenance', icon: WrenchIcon,   label: 'Maintenance',
              badge: (() => { const ov = data.trucks.filter(t => t.status === 'Maintenance').length; return ov || null; })() },
        ].map(n => (
            <button key={n.id} style={S.navItem(page === n.id || page === n.alias)}
                onClick={() => setPage(n.id)}>
                <n.icon size={15} style={{ color: page === n.id ? T.accent : T.textFaint, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.badge ? <span style={S.navBadge}>{n.badge}</span> : null}
            </button>
        ))}

        {/* Finance group */}
        <div style={S.navGroup}>Finance</div>
        {[
            { id: 'fuel',      icon: FuelIcon,       label: 'Fuel Log' },
            { id: 'expenses',  icon: ReceiptIcon,    label: 'Expenses' },
            { id: 'invoices',  icon: InvoiceIcon,    label: 'Invoices',
              badge: (() => { const ov = data.invoices.filter(i => i.status === 'Pending' && new Date(i.due) < new Date()).length; return ov || null; })() },
            { id: 'payroll',   icon: PayrollIcon,    label: 'Payroll' },
            { id: 'pnl',       icon: ChartIcon,      label: 'P&L Report' },
        ].map(n => (
            <button key={n.id} style={S.navItem(page === n.id)}
                onClick={() => setPage(n.id)}>
                <n.icon size={15} style={{ color: page === n.id ? T.accent : T.textFaint, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.badge ? <span style={S.navBadge}>{n.badge}</span> : null}
            </button>
        ))}

        {/* Other group */}
        <div style={S.navGroup}>Admin</div>
        {[
            { id: 'documents', icon: FolderIcon,     label: 'Documents' },
            { id: 'settings',  icon: SettingsIcon,   label: 'Settings' },
        ].map(n => (
            <button key={n.id} style={S.navItem(page === n.id)}
                onClick={() => setPage(n.id)}>
                <n.icon size={15} style={{ color: page === n.id ? T.accent : T.textFaint, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{n.label}</span>
            </button>
        ))}
    </div>

    {/* Footer */}
    <div style={S.sidebarFooter}>
        <div style={{ fontWeight: 500, color: T.textDim, marginBottom: 2 }}>v3.0</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: T.green, fontSize: 10 }}>●</span>
            <span>{data.trucks.filter(t => t.status === 'Active').length} active</span>
            <span style={{ color: T.textFaint }}>·</span>
            <span>{data.journeys.filter(j => j.status === 'In Transit').length} in transit</span>
        </div>
    </div>
</aside>
```

---

## PART 4 — SVG icon components

Add these lightweight SVG icon components near the top of the file (after imports, before the App function). These replace all emoji in navigation and UI chrome:

```jsx
const Icon = ({ d, size = 16, style: s }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        strokeLinejoin="round" style={s}>
        <path d={d} />
    </svg>
);

// Each icon is a simple SVG path — clean, consistent weight
const GridIcon     = (p) => <Icon {...p} d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" />;
const TruckIcon    = (p) => <Icon {...p} d="M1 4h9v7H1zM10 7l3 1v3h-3zM3 11a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 11a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />;
const PersonIcon   = (p) => <Icon {...p} d="M8 7a3 3 0 100-6 3 3 0 000 6zM2 15a6 6 0 0112 0" />;
const RouteIcon    = (p) => <Icon {...p} d="M2 4a2 2 0 100-4 2 2 0 000 4zM14 16a2 2 0 100-4 2 2 0 000 4zM2 2h6a4 4 0 014 4v4" />;
const WrenchIcon   = (p) => <Icon {...p} d="M12 2a3 3 0 00-2.83 4L2 13l1 1 7.17-7.17A3 3 0 0012 2z" />;
const FuelIcon     = (p) => <Icon {...p} d="M3 2h7v12H3zM10 5h2a1 1 0 011 1v3a1 1 0 01-1 1h-2" />;
const ReceiptIcon  = (p) => <Icon {...p} d="M2 2h12v12l-2-1-2 1-2-1-2 1-2-1V2zM5 6h6M5 9h4" />;
const InvoiceIcon  = (p) => <Icon {...p} d="M4 1h8l2 3v11H2V4zM5 7h6M5 10h4M5 4h3" />;
const PayrollIcon  = (p) => <Icon {...p} d="M8 1v14M11 4H6.5a2.5 2.5 0 000 5h3a2.5 2.5 0 010 5H5" />;
const ChartIcon    = (p) => <Icon {...p} d="M1 15l4-5 3 2 4-6 3 3" />;
const FolderIcon   = (p) => <Icon {...p} d="M1 4l2-3h5l1 1h6v10H1z" />;
const SettingsIcon = (p) => <Icon {...p} d="M8 10a2 2 0 100-4 2 2 0 000 4zM13.5 8a5.5 5.5 0 00-.1-1l1.5-1.2-1.5-2.6-1.9.6A5.5 5.5 0 009 2.6L8.7 1h-3l-.3 1.6A5.5 5.5 0 003.5 3.8l-1.9-.6L0 5.8 1.5 7A5.5 5.5 0 001.5 9L0 10.2l1.5 2.6 1.9-.6A5.5 5.5 0 007 13.4l.3 1.6h3l.3-1.6a5.5 5.5 0 001.9-1.2l1.9.6 1.5-2.6L14.5 9A5.5 5.5 0 0013.5 8z" />;
const SearchIcon   = (p) => <Icon {...p} d="M10 10l3 3M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />;
const PlusIcon     = (p) => <Icon {...p} d="M8 2v12M2 8h12" />;
const ChevronIcon  = (p) => <Icon {...p} d="M5 7l3 3 3-3" />;
const SunIcon      = (p) => <Icon {...p} d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3M8 5a3 3 0 100 6 3 3 0 000-6z" />;
const MoonIcon     = (p) => <Icon {...p} d="M12 3A7 7 0 103 12a7 7 0 009-9z" />;
const AlertIcon    = (p) => <Icon {...p} d="M8 2L1 14h14zM8 6v4M8 11v1" />;
const CheckIcon    = (p) => <Icon {...p} d="M2 8l4 4 8-8" />;
const XIcon        = (p) => <Icon {...p} d="M3 3l10 10M13 3L3 13" />;
const DownloadIcon = (p) => <Icon {...p} d="M8 2v9M4 8l4 4 4-4M2 14h12" />;
const EyeIcon      = (p) => <Icon {...p} d="M1 8s3-6 7-6 7 6 7 6-3 6-7 6-7-6-7-6zM8 6a2 2 0 100 4 2 2 0 000-4z" />;
const SendIcon     = (p) => <Icon {...p} d="M14 2L1 8l5 2M14 2L8 15l-2-5" />;
```

---

## PART 5 — Topbar redesign

Find the topbar JSX. Replace it with:

```jsx
<header style={S.topbar}>
    {/* Page title — dynamic */}
    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "'Syne', sans-serif" }}>
        {NAV.find(n => n.id === page)?.label || 'Dashboard'}
    </div>

    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Location + date */}
        <div style={{ fontSize: 12, color: T.textFaint, paddingRight: 8, borderRight: `1px solid ${T.border}` }}>
            Nairobi, KE · {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        {/* Dark mode toggle */}
        <button
            onClick={() => setDark(d => !d)}
            style={{ ...S.btn('ghost'), padding: '5px 8px', border: 'none', background: 'transparent' }}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? <SunIcon size={15} style={{ color: T.textDim }} /> : <MoonIcon size={15} style={{ color: T.textDim }} />}
        </button>

        {/* Fleet status pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 20, fontSize: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, display: 'inline-block' }} />
            <span style={{ color: T.textDim }}>{data.trucks.filter(t => t.status === 'Active').length}/{data.trucks.length} Active</span>
        </div>

        {/* Reset button */}
        <button
            onClick={() => { if (window.confirm('Reset to demo data?')) { localStorage.removeItem('segecha_v2'); window.location.reload(); }}}
            style={{ ...S.btn('ghost'), padding: '5px 10px', fontSize: 11 }}>
            Reset
        </button>
    </div>
</header>
```

---

## PART 6 — Modal redesign

The existing modals use inline padding on the mbox. Update the `Modal` component
to use the new header + body pattern:

Find the `Modal` component (the generic one used for forms). Replace it:

```jsx
const Modal = ({ title, children, onSave, onClose, saveLabel = 'Save', wide = false }) => (
    <div style={S.ovl} onClick={onClose || (() => setModal(null))}>
        <div
            className="segecha-fade"
            style={{ ...S.mbox, width: wide ? 'min(760px,95vw)' : 'min(560px,95vw)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "'Syne', sans-serif" }}>{title}</div>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textFaint, padding: 4, display: 'flex', alignItems: 'center' }}
                    onClick={onClose || (() => setModal(null))}>
                    <XIcon size={16} />
                </button>
            </div>
            {/* Body */}
            <div style={{ padding: '20px' }}>
                {children}
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: `1px solid ${T.border}`, justifyContent: 'flex-end' }}>
                <button style={S.btn('ghost')} onClick={onClose || (() => setModal(null))}>Cancel</button>
                <button style={S.btn('primary')} onClick={onSave}>{saveLabel}</button>
            </div>
        </div>
    </div>
);
```

---

## PART 7 — Table rows: add hover class

For every `<table>` rendered in the app, add `className="segecha-table"` to the `<table>` tag.
This enables the hover effect defined in the global CSS injection.

---

## PART 8 — Dashboard redesign

Find the `Dashboard` component. Replace the KPI card grid with the new token system.
The layout should be: alert banners → 4-col KPI row → 2-col section (per-truck P&L + recent activity).

Key visual changes:
- KPI numbers use `S.val(color)` — DM Mono font, 26px
- KPI labels use `S.kpi` — uppercase, 11px, spaced
- Alert banners use `S.alertBox(color)` — no emoji prefix in the banner chrome (emoji only in the message text if part of data)
- The "2/3 Active" style fleet summary moves into the topbar (already done in Part 5)
- Remove the redundant status summary from the dashboard top

---

## PART 9 — Remove all emoji from UI chrome

Search the entire App.jsx for emoji characters used in:
- Navigation items (already replaced with SVG icons in Part 4)
- Button labels (replace with text or SVG icons)
- Section headers / page titles
- Card titles
- Modal titles
- Table headers
- Badge / pill labels

**Keep emoji only in:**
- User-entered data (driver names, cargo descriptions, notes)
- The company logo placeholder (the initial letter mark)

**Specific replacements:**
```
Page headers:    "🔧 Maintenance Hub"     → "Maintenance"
                 "📁 Document Library"    → "Documents"
                 "⚙ Settings"            → "Settings"
                 "💚 M-Pesa"              → "M-Pesa"
Buttons:         "📤 Send"               → "Send" (or use SendIcon)
                 "💚 Record Payment"      → "Record Payment"
                 "☁️ Upload to Cloudflare" → "Upload"
                 "📤 Sync Tracker Data"   → "Sync data"
                 "⬇️ Download Backup"     → "Download backup"
                 "↺ Reset"               → "Reset"
Nav badges:      Keep numbers only (already done in Part 3)
```

---

## PART 10 — Typography consistency

Apply these rules throughout:

1. **Page titles** (`S.ph`): Syne font, 20px, weight 700, `letterSpacing: '-0.4px'`
   Find: every `<div style={S.ph}>` — the font will apply via the token system if S.ph is updated

2. **Section titles within pages**: DM Sans, 14px, weight 600, `color: T.text`
   No Syne below page-title level.

3. **Table headers**: DM Sans, 11px, weight 500, uppercase, `letterSpacing: '0.6px'`, `color: T.textFaint`

4. **Monospace data** (odometer readings, M-Pesa codes, invoice IDs, KES amounts in KPI cards):
   Add `fontFamily: "'DM Mono', monospace"` to these cells.
   Find invoice ID cells, odometer cells, M-Pesa code cells and add the font.

5. **KES amounts in tables**: Keep DM Sans but add `fontVariantNumeric: 'tabular-nums'`
   so columns align.

---

## PART 11 — Specific component fixes

### 11.1 — Invoice table amount column
```jsx
<td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontVariantNumeric: 'tabular-nums', color: T.text }}>
    {fmt(inv.amount)}
</td>
```

### 11.2 — Fuel log table — cost column
Same monospace treatment for the cost column.

### 11.3 — Journey table — revenue column
Same monospace treatment.

### 11.4 — Odometer readings everywhere
Add `fontFamily: "'DM Mono', monospace"` to any cell showing km values.

### 11.5 — Status badges
Replace any inline status styling with `style={S.badge(status)}` throughout.
The badge system in Part 1 handles all status types.

### 11.6 — Form inputs — add focus ring via CSS (already done in Part 2)
Remove any inline `outline` or `boxShadow` from input elements.
The global CSS handles focus state.

### 11.7 — Delete buttons
Replace all red delete buttons with the ghost style + XIcon:
```jsx
<button style={S.btn('del')} onClick={() => delItem(...)}>
    <XIcon size={12} />
</button>
```

---

## PART 12 — Checklist

### Fonts
- [ ] DM Sans loads from Google Fonts (check Network tab — no 404)
- [ ] Syne loads and appears on page titles and sidebar logo text
- [ ] DM Mono loads and appears on KPI card numbers, odometer readings, invoice IDs, KES totals

### Colours
- [ ] Dark mode: sidebar is `#0a0d12`, content area `#0d1117`, cards `#161b22`
- [ ] Light mode: sidebar is white, content area `#f6f8fa`, cards white
- [ ] Orange `#E8501A` appears ONLY on: active nav indicator, primary buttons, logo mark
- [ ] No orange borders on every card (removed top-colour-border pattern)
- [ ] Status badges use semantic colours: green/blue/amber/red/purple from token map
- [ ] Alert banners use `T.red + '12'` background — not solid colours

### Sidebar
- [ ] Segecha logo/initial in orange square mark, company name in Syne font
- [ ] Active nav item has left orange border + orange text + orange tinted background
- [ ] Inactive nav items: muted grey, no background
- [ ] Nav groups (FLEET, FINANCE, ADMIN) show as tiny uppercase labels
- [ ] Red badge on Maintenance nav if any trucks in Maintenance status
- [ ] Red badge on Invoices nav if any invoices overdue
- [ ] Purple badge on Journeys nav if awaiting verification
- [ ] Footer shows "v3.0 · X active · Y in transit" in small muted text

### Topbar
- [ ] Page title shown dynamically (changes as you navigate)
- [ ] Dark/light toggle is an icon button (sun/moon SVG) — no label text
- [ ] Fleet status pill shows "X/Y Active" with green dot
- [ ] No emoji anywhere in topbar
- [ ] Reset button is plain text, no orange

### Modals
- [ ] All modals have header bar with title + close X icon
- [ ] Footer has Cancel (ghost) + Save (primary orange) buttons right-aligned
- [ ] Modal background has backdrop blur
- [ ] Modal animates in (fadeIn from Part 2 CSS)

### Typography
- [ ] Page titles: Syne, 20px, weight 700
- [ ] KPI numbers: DM Mono, 26px, weight 600
- [ ] Table headers: 11px uppercase with letter-spacing
- [ ] Odometer/amounts/codes in tables use DM Mono
- [ ] KES amounts use `fontVariantNumeric: 'tabular-nums'`

### Icons
- [ ] All sidebar nav items use SVG icons (no emoji)
- [ ] Delete buttons use XIcon SVG
- [ ] Send button uses SendIcon SVG
- [ ] Dark/light toggle uses Sun/Moon SVG
- [ ] No emoji in any button, header, or nav element

### Tables
- [ ] All tables have `className="segecha-table"` for hover effect
- [ ] Table headers use `S.th` — uppercase, 11px, surface2 background
- [ ] Row hover is subtle — `T.surface2` background
- [ ] Scrollbar is thin (6px) per global CSS
- [ ] Table wrapper has `border: 1px solid T.border` + `borderRadius: 8`

### Overall feel
- [ ] No card with a coloured top border (removed)
- [ ] No `fontWeight: 800` anywhere in UI chrome
- [ ] No `borderRadius: 12` or `14` used inconsistently — all cards use `borderRadius: 8`
- [ ] Spacing feels consistent — 24px page padding, 12px card gaps, 20px modal padding
- [ ] Dark mode looks premium — not just inverted light mode
