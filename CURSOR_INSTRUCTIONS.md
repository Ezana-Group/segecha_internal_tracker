# Segecha Internal Tracker — Cursor AI Upgrade Instructions

> **Project:** Segecha Group Ltd — Fleet ERP  
> **Current version:** v2.0 (single-file prototype)  
> **Target version:** v3.0 (production-ready)  
> **Codebase:** `segecha_internal_tracker/src/App.jsx` (1,130 lines, 91KB monolith)  
> **Stack:** React 19 + Vite + JavaScript (no backend, no DB, no persistence)

---

## ⚠️ Read This First

- Execute phases **in order**. Do not skip to Phase 3 features before Phase 1 is complete.
- Run `npm run dev` after every significant change to confirm the app still works.
- **Never remove Kenyan localisation:** KES currency, M-Pesa references, +254 phone format, 16% VAT, PSV licence format, Kenyan truck plate format (KCx NNNx).
- All data is currently hardcoded in a `SEED` constant inside `App.jsx`. Users lose everything on page refresh.

---

## Phase 1 — Foundation (Critical, Do First)

### P1.1 — Fix Data Loss with localStorage

**Problem:** `useState(SEED)` resets all data on every page refresh. This is the single most urgent fix.

Find this line in `App.jsx`:

```js
const [data, setData] = useState(SEED);
```

Replace it with:

```js
const [data, setData] = useState(() => {
  try {
    const saved = localStorage.getItem('segecha_tracker_v2');
    return saved ? JSON.parse(saved) : SEED;
  } catch {
    return SEED;
  }
});

useEffect(() => {
  try {
    localStorage.setItem('segecha_tracker_v2', JSON.stringify(data));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}, [data]);
```

Also add a **Reset to Demo Data** button in a Settings section (or in the sidebar footer):

```js
const resetData = () => {
  if (window.confirm('Reset all data to demo data? This cannot be undone.')) {
    localStorage.removeItem('segecha_tracker_v2');
    window.location.reload();
  }
};
```

---

### P1.2 — Split App.jsx into Module Files

**Problem:** 99.2% of the codebase lives in one file. It cannot be maintained, tested, or extended.

Create the following folder structure. Move code out of `App.jsx` section by section. **Do not change any logic during the move — extract only.**

```
src/
├── App.jsx                        ← slim coordinator, ~80 lines after split
├── constants/
│   ├── seed.js                    ← the SEED data object
│   ├── theme.js                   ← T (theme tokens) and SC (status colours)
│   └── nav.js                     ← NAV array and PAGES map
├── hooks/
│   ├── useAppState.js             ← useState, localStorage, saveItem, delItem, markPaid
│   └── useWindowWidth.js          ← responsive breakpoint hook
├── utils/
│   └── formatters.js              ← fmt(), fmtN(), today(), uid(), monthLabel()
├── components/
│   ├── Modal.jsx                  ← reusable modal dialog
│   ├── Field.jsx                  ← reusable form field (text, number, date, select)
│   ├── Sidebar.jsx                ← navigation sidebar
│   ├── Topbar.jsx                 ← top bar with theme toggle and search
│   ├── ErrorBoundary.jsx          ← error boundary (see P1.5)
│   └── Toast.jsx                  ← toast notification system (see P1.5)
└── pages/
    ├── Dashboard.jsx
    ├── Fleet.jsx
    ├── Drivers.jsx
    ├── Journeys.jsx
    ├── FuelLog.jsx
    ├── Expenses.jsx
    ├── Invoices.jsx
    ├── Payroll.jsx
    ├── TyreMonitor.jsx
    └── PnL.jsx
```

**Props contract for every page component:**

```js
// Every page receives these props from App.jsx
<Dashboard
  data={data}
  saveItem={saveItem}
  delItem={delItem}
  theme={T}
  isMobile={isMobile}
  isTablet={isTablet}
/>
```

**After the split:**
- Delete `src/App.css` — it is unused Vite template CSS.
- Update `index.html` title from `"truck-erp-app"` to `"Segecha Internal Tracker"`.

---

### P1.3 — Add React Router

**Problem:** Browser back/forward buttons don't work. Pages cannot be bookmarked or linked.

```bash
npm install react-router-dom
```

Wrap the app in `main.jsx`:

```js
import { BrowserRouter } from 'react-router-dom';

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

Replace the manual `setPage()` state switching in `App.jsx` with `<Routes>`:

```js
import { Routes, Route, useNavigate } from 'react-router-dom';

// Route map
const ROUTES = [
  { path: '/',          element: <Dashboard /> },
  { path: '/fleet',     element: <Fleet /> },
  { path: '/drivers',   element: <Drivers /> },
  { path: '/journeys',  element: <Journeys /> },
  { path: '/fuel',      element: <FuelLog /> },
  { path: '/expenses',  element: <Expenses /> },
  { path: '/invoices',  element: <Invoices /> },
  { path: '/payroll',   element: <Payroll /> },
  { path: '/tyres',     element: <TyreMonitor /> },
  { path: '/pnl',       element: <PnL /> },
];
```

Update `Sidebar.jsx` to use `<NavLink>` so the active page is highlighted:

```js
import { NavLink } from 'react-router-dom';

<NavLink
  to={item.path}
  style={({ isActive }) => ({
    background: isActive ? T.accent : 'transparent',
    color: isActive ? '#fff' : T.text2,
  })}
>
  {item.label}
</NavLink>
```

---

### P1.4 — Input Validation on All Forms

**Problem:** Forms accept any input. No required fields, no format checking.

Create `src/utils/validators.js`:

```js
export const validators = {
  required: (v) => (v && String(v).trim() !== '' ? null : 'This field is required'),

  kenyaPhone: (v) => {
    const clean = String(v).replace(/\s+/g, '');
    return /^(\+254|0)7\d{8}$/.test(clean) ? null : 'Enter a valid Kenyan phone number (e.g. 0712 345678)';
  },

  mpesa: (v) => {
    const clean = String(v).replace(/\s+/g, '');
    return /^07\d{8}$/.test(clean) ? null : 'M-Pesa number must be in format 07XXXXXXXX';
  },

  truckReg: (v) => {
    return /^[A-Z]{3}\s\d{3}[A-Z]$/.test(String(v).toUpperCase()) ? null : 'Format must be KCB 100A';
  },

  psvLicence: (v) => {
    return /^PSV\/LIC\/\d{4}\/\d{5}$/.test(String(v)) ? null : 'Format must be PSV/LIC/YYYY/NNNNN';
  },

  positiveNumber: (v) => {
    return v && Number(v) > 0 ? null : 'Must be a number greater than zero';
  },

  dateOrder: (start, end) => {
    return !end || !start || new Date(end) >= new Date(start)
      ? null
      : 'End date cannot be before start date';
  },
};

// Run multiple validators and return first error
export const validate = (value, ...rules) => {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return null;
};
```

Update `Field.jsx` to accept and display errors:

```js
export function Field({ label, error, ...inputProps }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </label>
      <input
        {...inputProps}
        style={{
          width: '100%',
          border: `1px solid ${error ? '#DC2626' : '#D1D5DB'}`,
          borderRadius: 6,
          padding: '8px 10px',
        }}
      />
      {error && (
        <p style={{ color: '#DC2626', fontSize: 11, marginTop: 3 }}>{error}</p>
      )}
    </div>
  );
}
```

**Rules by form:**

| Form | Field | Validation |
|------|-------|------------|
| Add Truck | Registration | Required, format KCx NNNx |
| Add Truck | Capacity | Required, positive number |
| Add Driver | Phone | Required, Kenyan phone format |
| Add Driver | M-Pesa | Required, 07XXXXXXXX format |
| Add Driver | PSV Licence | Required, PSV/LIC/YYYY/NNNNN |
| Add Driver | Salary | Required, positive number |
| Add Journey | End Date | Must not be before Start Date |
| Add Journey | Revenue | Required, positive number |
| Add Journey | Distance | Required, positive number |
| Add Fuel | Litres | Required, positive number, max 2000 |
| Add Fuel | Price/L | Required, positive number |
| All forms | All KES amounts | Must be positive numbers |

**Modal Save button:** Disable when validation errors exist:

```js
<button
  disabled={Object.values(errors).some(Boolean)}
  style={{ opacity: Object.values(errors).some(Boolean) ? 0.5 : 1 }}
  onClick={handleSave}
>
  Save
</button>
```

---

### P1.5 — Add Error Boundaries and Toast Notifications

Create `src/components/ErrorBoundary.jsx`:

```jsx
import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Segecha Tracker Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: '#DC2626' }}>Something went wrong</h2>
          <p>This section encountered an error. Other pages are unaffected.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap every page in `App.jsx`:

```jsx
<ErrorBoundary>
  <Fleet data={data} ... />
</ErrorBoundary>
```

Create a simple toast system in `src/components/Toast.jsx`:

```jsx
// Usage: showToast('Journey saved', 'success') or showToast('Error saving', 'error')
// Add a [toasts, showToast] state pair in useAppState.js
// Render <ToastContainer toasts={toasts} /> at the bottom of App.jsx
```

Call `showToast('Record saved', 'success')` after every successful save/delete.

---

### P1.6 — Upgrade Vite and Add Environment Config

```bash
npm install vite@latest --save-dev
npm run build   # confirm zero errors
```

Create `.env` in the project root:

```env
VITE_APP_NAME=Segecha Internal Tracker
VITE_COMPANY_NAME=Segecha Group Ltd
VITE_VAT_RATE=0.16
VITE_TYRE_WARNING_KM=5000
VITE_INVOICE_OVERDUE_DAYS=30
```

Replace every hardcoded instance of `0.16` (VAT) in the codebase with:
```js
const VAT_RATE = Number(import.meta.env.VITE_VAT_RATE);
```

Replace the hardcoded tyre warning threshold `5000` with:
```js
const TYRE_WARNING_KM = Number(import.meta.env.VITE_TYRE_WARNING_KM);
```

---

## Phase 2 — Usability & Efficiency

### P2.1 — Global Search (Ctrl+K)

Add a search bar to `Topbar.jsx`.

**Search scope — search across all of these fields simultaneously:**

| Entity | Fields to search |
|--------|-----------------|
| Trucks | `reg`, `make`, `type` |
| Drivers | `name`, `phone`, `license` |
| Journeys | `origin`, `dest`, `cargo`, `id` |
| Invoices | `id`, `client` (from linked journey) |
| Expenses | `desc`, `category` |

**Behaviour:**
- Show results in a dropdown panel, grouped by type (Trucks / Drivers / Journeys / Invoices)
- Clicking a result navigates to the relevant page and opens the edit modal for that record
- Press `Escape` to close the dropdown
- Keyboard shortcut: `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac) focuses the search input from anywhere

```js
// Keyboard shortcut
useEffect(() => {
  const handler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchRef.current?.focus();
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

---

### P2.2 — Sortable and Filterable Tables

Apply to every data table in the application.

**Sorting:** Clicking a column header toggles ascending/descending. Show `↑` or `↓` in the active header.

```js
const [sortCol, setSortCol] = useState(null);
const [sortDir, setSortDir] = useState('asc');

const sorted = [...items].sort((a, b) => {
  if (!sortCol) return 0;
  const va = a[sortCol], vb = b[sortCol];
  const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
  return sortDir === 'asc' ? cmp : -cmp;
});
```

**Quick-filter dropdowns to add per page:**

| Page | Filters |
|------|---------|
| Fleet | Status (All / Active / Maintenance / Off Road), Truck Type |
| Drivers | Status (All / Active / Inactive / Suspended), Licence Class |
| Journeys | Status, Truck (dropdown), Driver (dropdown), Month |
| Fuel Log | Truck (dropdown), Month, Station |
| Expenses | Truck (dropdown), Category, Month |
| Invoices | Status (All / Paid / Pending), Month |
| Payroll | Month selector (already exists — keep it) |

---

### P2.3 — Data Export (CSV and PDF)

```bash
npm install jspdf jspdf-autotable papaparse
```

**CSV export** — add to every table page:

```js
import Papa from 'papaparse';

const exportCSV = (data, filename) => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${today()}.csv`;
  a.click();
};
```

**Invoice PDF** — add a Download PDF button per invoice row:

```js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const generateInvoicePDF = (invoice, journey) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('SEGECHA GROUP LTD', 14, 20);
  doc.setFontSize(11);
  doc.text('Nairobi, Kenya', 14, 28);
  doc.text(`Invoice #: ${invoice.id}`, 14, 36);
  doc.text(`Date: ${invoice.date}`, 14, 44);
  doc.text(`Status: ${invoice.status}`, 14, 52);

  // Line items
  autoTable(doc, {
    startY: 65,
    head: [['Description', 'Amount (KES)']],
    body: [
      [`Journey: ${journey.origin} → ${journey.dest}`, fmt(journey.revenue)],
      [`Cargo: ${journey.cargo} (${journey.weight}t)`, ''],
      ['', ''],
      ['Subtotal', fmt(invoice.amount)],
      ['VAT 16%', fmt(invoice.amount * 0.16)],
      ['TOTAL', fmt(invoice.amount * 1.16)],
    ],
  });

  // Payment instructions
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.text('Payment via M-Pesa Paybill: [Your Paybill Number]', 14, finalY);
  doc.text('Account: Invoice number above', 14, finalY + 8);

  doc.save(`Invoice_${invoice.id}.pdf`);
};
```

**Payroll CSV** — format specifically for M-Pesa bulk payment upload:

```js
const exportPayrollCSV = (payrollItems) => {
  const rows = payrollItems.map(p => ({
    'Phone Number': p.mpesa,
    'Amount': p.net,
    'Reference': `SALARY-${p.month}`,
    'Full Name': p.driver,
  }));
  exportCSV(rows, 'Payroll_MPesa_Upload');
};
```

---

### P2.4 — Dashboard Alerts Panel

Add an **Alerts & Action Required** panel at the top of `Dashboard.jsx`. Automatically detect and display:

```js
const getAlerts = (data) => {
  const alerts = [];

  // Overdue tyres
  data.trucks.forEach(t => {
    const remaining = t.tyreLimit - (t.odom - t.tyreOdom);
    if (remaining <= 0) {
      alerts.push({
        type: 'error',
        message: `${t.reg} — Tyre change OVERDUE by ${Math.abs(remaining).toLocaleString()} km`,
        link: '/tyres',
        record: t.id,
      });
    } else if (remaining <= TYRE_WARNING_KM) {
      alerts.push({
        type: 'warning',
        message: `${t.reg} — Tyre change due in ${remaining.toLocaleString()} km`,
        link: '/tyres',
        record: t.id,
      });
    }
  });

  // Overdue invoices (unpaid > 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  data.invoices
    .filter(i => i.status === 'Pending' && new Date(i.date) < thirtyDaysAgo)
    .forEach(i => {
      alerts.push({
        type: 'error',
        message: `Invoice ${i.id} — Unpaid for over 30 days`,
        link: '/invoices',
        record: i.id,
      });
    });

  // Journeys in transit > 5 days
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  data.journeys
    .filter(j => j.status === 'In Transit' && new Date(j.date) < fiveDaysAgo)
    .forEach(j => {
      alerts.push({
        type: 'warning',
        message: `Journey ${j.id} (${j.origin} → ${j.dest}) — In Transit for over 5 days`,
        link: '/journeys',
        record: j.id,
      });
    });

  // Suspended driver still assigned to truck
  data.drivers
    .filter(d => d.status === 'Suspended' && d.truck)
    .forEach(d => {
      alerts.push({
        type: 'error',
        message: `Driver ${d.name} is Suspended but still assigned to truck ${d.truck}`,
        link: '/drivers',
        record: d.id,
      });
    });

  return alerts;
};
```

Show the count as a badge on the Dashboard nav item when `alerts.length > 0`.

**Also improve existing KPI cards:**
- Add a small trend indicator comparing current month vs last month for: Revenue, Fuel Cost, Active Journeys
- Make each KPI card clickable — Revenue → `/pnl`, Active Journeys → `/journeys`, etc.

---

### P2.5 — Smarter Forms

**Journey form:**
- When a Truck is selected, auto-populate the Driver field with that truck's assigned driver (allow manual override)
- Add a common routes quick-select dropdown for Origin and Destination:
  ```
  Nairobi → Mombasa, Nairobi → Kisumu, Nairobi → Eldoret,
  Mombasa → Kampala, Nairobi → Nakuru, Eldoret → Kisumu
  ```
  With a "Custom route" option that shows free-text inputs

**Fuel Log form:**
- When a Journey is selected, auto-fill the Truck field
- Show a live cost estimate below the form: `Estimated cost: KES X,XXX` (litres × price/L) as user types

**Payroll form:**
- Show live Net Pay calculation: `Net = Base + Allowances − Deductions`
- Update in real time as any of the three values change

**Invoice form:**
- Auto-populate client/description from the linked Journey
- Show live VAT calculation: `VAT (16%): KES X,XXX` and `Total: KES X,XXX`

**All date fields:**
- Default to today's date (`today()` utility already exists)
- Use `<input type="date">` consistently — no free-text date entry

**Unsaved changes warning:**
```js
// In Modal.jsx — detect if user modified anything and warn before closing
const [isDirty, setIsDirty] = useState(false);

const handleClose = () => {
  if (isDirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
  onClose();
};
```

---

## Phase 3 — Production Readiness

### P3.1 — Migrate to TypeScript

```bash
npm install -D typescript @types/react @types/react-dom
npx tsc --init
```

In `tsconfig.json`, set:
```json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "target": "ES2020",
    "moduleResolution": "bundler"
  }
}
```

Rename all `.jsx` → `.tsx` and `.js` → `.ts`.

Create `src/types/index.ts` with these interfaces:

```ts
export type TruckStatus = 'Active' | 'Maintenance' | 'Off Road';
export type DriverStatus = 'Active' | 'Inactive' | 'Suspended';
export type JourneyStatus = 'Loading' | 'In Transit' | 'Completed' | 'Cancelled';
export type InvoiceStatus = 'Pending' | 'Paid';
export type PayrollStatus = 'Pending' | 'Paid';

export interface Truck {
  id: string;          // e.g. "T001"
  reg: string;         // e.g. "KCB 100A"
  make: string;
  year: number;
  type: 'Rigid' | 'Semi-Trailer' | 'Tipper' | 'Tanker' | 'Flatbed';
  capacity: number;    // tonnes
  driver: string;      // Driver ID FK — empty string if unassigned
  status: TruckStatus;
  odom: number;        // odometer km
  tyreOdom: number;    // odometer reading at last tyre change
  tyreLimit: number;   // tyre change interval km
}

export interface Driver {
  id: string;
  name: string;
  phone: string;       // +254 format
  license: string;     // PSV/LIC/YYYY/NNNNN
  class: 'G' | 'CE' | 'C' | 'B';
  status: DriverStatus;
  truck: string;       // Truck ID FK — empty string if unassigned
  joined: string;      // YYYY-MM-DD
  salary: number;      // monthly KES
  mpesa: string;       // 07XXXXXXXX
}

export interface Journey {
  id: string;
  truck: string;
  driver: string;
  origin: string;
  dest: string;
  date: string;        // YYYY-MM-DD departure
  endDate: string;     // YYYY-MM-DD arrival
  distance: number;    // km
  revenue: number;     // KES
  cargo: string;
  weight: number;      // tonnes
  status: JourneyStatus;
  notes: string;
}

export interface FuelEntry {
  id: string;
  truck: string;
  date: string;
  litres: number;
  pricePerL: number;   // KES per litre
  station: string;
  journey: string;     // Journey ID FK — optional
}

export interface Expense {
  id: string;
  truck: string;
  date: string;
  category: 'Maintenance' | 'Toll' | 'Tyre' | 'Insurance' | 'Other';
  amount: number;      // KES
  desc: string;
  journey: string;     // Journey ID FK — optional
}

export interface Invoice {
  id: string;
  journey: string;
  date: string;
  amount: number;      // KES (pre-VAT)
  status: InvoiceStatus;
  mpesaRef: string;    // M-Pesa confirmation code when paid
}

export interface PayrollRecord {
  id: string;
  driver: string;
  month: string;       // YYYY-MM
  base: number;        // KES
  allowances: number;  // KES
  deductions: number;  // KES
  status: PayrollStatus;
  mpesaRef: string;
}

export interface AppData {
  trucks: Truck[];
  drivers: Driver[];
  journeys: Journey[];
  fuel: FuelEntry[];
  expenses: Expense[];
  invoices: Invoice[];
  payroll: PayrollRecord[];
}
```

Run `npx tsc --noEmit` and fix all type errors before moving to P3.2.

---

### P3.2 — Add a Backend with Real Database

**Recommended approach: Express + SQLite** (simplest for a small team, no cloud required)

```bash
npm install express better-sqlite3 cors dotenv
npm install -D @types/better-sqlite3 @types/express
```

Create `server/index.js` and `server/db.js`. Run the frontend (Vite) and backend (Express) concurrently:

```bash
npm install -D concurrently
```

Update `package.json` scripts:
```json
"scripts": {
  "dev": "concurrently \"vite\" \"node server/index.js\"",
  "build": "vite build",
  "preview": "vite preview"
}
```

**Database schema** (`server/db.js`):

```sql
CREATE TABLE IF NOT EXISTS trucks (
  id TEXT PRIMARY KEY,
  reg TEXT NOT NULL UNIQUE,
  make TEXT,
  year INTEGER,
  type TEXT,
  capacity INTEGER,
  driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active',
  odom INTEGER DEFAULT 0,
  tyre_odom INTEGER DEFAULT 0,
  tyre_limit INTEGER DEFAULT 80000
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  license TEXT,
  class TEXT,
  status TEXT DEFAULT 'Active',
  truck_id TEXT REFERENCES trucks(id) ON DELETE SET NULL,
  joined TEXT,
  salary INTEGER,
  mpesa TEXT
);

-- journeys, fuel, expenses, invoices, payroll — same pattern
-- All KES amounts as INTEGER (whole shillings)
-- All dates as TEXT YYYY-MM-DD
```

**REST API endpoints to implement:**

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/trucks` | Return all trucks |
| POST | `/api/trucks` | Create truck |
| PUT | `/api/trucks/:id` | Update truck |
| DELETE | `/api/trucks/:id` | Delete truck (set FK references to NULL) |
| GET | `/api/journeys?truck=T001` | Journeys, optionally filtered |
| POST | `/api/journeys` | Create journey |
| PUT | `/api/journeys/:id` | Update journey |
| POST | `/api/invoices/:id/pay` | Mark paid, store M-Pesa ref |
| POST | `/api/payroll/:id/pay` | Mark paid, store M-Pesa ref |
| GET | `/api/reports/pnl` | Aggregated P&L data |

**Frontend:** Replace all `saveItem()` / `delItem()` calls with `fetch()` calls to these endpoints. Remove the localStorage layer once the backend is live.

---

### P3.3 — User Authentication

```bash
# If staying with React + Express:
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
```

**User roles:**

| Role | Access |
|------|--------|
| `admin` | Full access — all pages, all actions, user management |
| `dispatcher` | Journeys, Fleet, Drivers, Fuel, Expenses. No Payroll or P&L. |
| `accountant` | Invoices, Payroll, P&L reports. Read-only Fleet and Journeys. |

**Implementation steps:**
1. Create a `users` table: `id, email, password_hash, role, name`
2. Add `POST /api/auth/login` endpoint — returns a signed JWT
3. Add auth middleware to all API routes — reject requests without valid JWT
4. In the React app, store the JWT in memory (not localStorage — use a React context)
5. Show the logged-in user's name in `Topbar.jsx`
6. Hide nav items the current role cannot access
7. Session timeout: redirect to login after 8 hours of inactivity

---

### P3.4 — Replace Inline CSS with Tailwind

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:
```js
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#1B3A6B',
        accent: '#E8501A',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
    },
  },
};
```

**Migration approach:** Convert one page file at a time. After each page, run `npm run dev` and visually verify. Do not batch multiple pages — this makes regressions hard to isolate.

Replace the manual dark theme token system (`T.bg`, `T.text`, etc.) with Tailwind's `dark:` variant:
```jsx
// Before
<div style={{ background: T.bg, color: T.text }}>

// After
<div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">
```

---

### P3.5 — M-Pesa Daraja API Integration

> **Note:** Requires a Safaricom developer account and a registered Paybill or Till number. Test in the Daraja sandbox before going live.

Add to `.env`:
```env
MPESA_CONSUMER_KEY=your_key_here
MPESA_CONSUMER_SECRET=your_secret_here
MPESA_SHORTCODE=your_paybill_here
MPESA_PASSKEY=your_passkey_here
MPESA_ENV=sandbox   # change to 'production' when live
```

**Integration points:**

1. **Payroll — Pay via M-Pesa** button: triggers a B2C (Business to Customer) payment to the driver's M-Pesa number (`driver.mpesa`)
2. **Invoice — Mark as Paid**: accept a real M-Pesa confirmation code (10-character alphanumeric, e.g. `QGH3K7MXPL`) and validate format before saving
3. **Validation** — M-Pesa confirmation code format:
   ```js
   const validMpesaCode = (code) => /^[A-Z0-9]{10}$/.test(code);
   ```

---

## Module-Specific Improvements

### Fleet Page
- Add a **Maintenance Log** section per truck: list of events with date, type, cost, and workshop
- Add a **next service due** indicator (odometer-based, every 10,000 km)
- Show a **capacity warning** on journey assignment if cargo weight exceeds truck capacity

### Journeys Page
- Add a **Duplicate Journey** button to clone a route with a new date
- Show a **cargo weight warning** if weight > truck capacity
- Auto-generate a **waybill PDF** on journey creation (truck reg, driver, origin, destination, cargo, weight, date)

### Fuel Log Page
- Add a **km/L efficiency chart** per truck over time — use `recharts` (`npm install recharts`)
- Highlight fuel entries where efficiency drops >20% below the truck's average — flag as a potential engine/leak issue
- Add a **fuel station summary**: total litres and spend per station

### Invoices Page
- Add an **invoice ageing table**: group unpaid invoices by 0–30, 31–60, 61–90, 90+ days overdue
- Add a **client ledger**: click a client name to see all invoices for that client with running balance

### Tyre Monitor Page
- Add a **tyre change history log** per truck: date, km, workshop, cost
- Add a **projected change date** based on average daily km
- Add a **bulk alert** if 3+ trucks need tyres in the same month

### P&L Report Page
- Add a **month-over-month comparison**: select two months and show side-by-side
- Add a **per-route profitability table**: group by origin→destination, show avg revenue, avg cost, avg margin
- Add a **driver performance table**: journeys, total km, revenue generated, fuel efficiency per driver

---

## Testing Checklist

Run these checks after each phase before proceeding.

### After Phase 1
- [ ] Close browser, reopen — all data still present (localStorage working)
- [ ] `npm run build` completes with zero errors after the file split
- [ ] Browser Back button navigates correctly after React Router added
- [ ] Attempt to save a journey with end date before start date — rejected with error message
- [ ] Attempt to save a driver with phone `12345` — rejected
- [ ] Throw an error in `Fleet.jsx` — other pages still work (ErrorBoundary working)
- [ ] Vite upgrade: `npm run build` still succeeds

### After Phase 2
- [ ] Type `KCB` in search bar — matching trucks appear in dropdown
- [ ] Click column header in Journeys table — sorts correctly, arrow indicator shown
- [ ] Filter Fleet by `Maintenance` — only maintenance trucks visible
- [ ] Download CSV from Fuel Log — opens correctly in Excel/LibreOffice with correct KES values
- [ ] Set a tyre to overdue — alert appears on Dashboard
- [ ] `Ctrl+K` focuses the search bar from any page

### After Phase 3
- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `GET /api/trucks` without a session token — returns 401
- [ ] Log in as `dispatcher` — Payroll and P&L nav items are hidden
- [ ] Delete a truck that has linked journeys — journeys are not deleted, truck reference set to null
- [ ] Create a journey, refresh the page — journey still exists (DB persistence working)

---

## Kenyan Localisation — Do Not Change

These are legally and operationally required. Do not remove or modify:

| Item | Value |
|------|-------|
| Currency | KES (Kenyan Shilling) — formatted as `KES X,XXX` |
| VAT Rate | 16% (Kenya Revenue Authority standard) |
| Payment system | M-Pesa (Safaricom) |
| Phone format | `+254 7XX XXX XXX` or `07XX XXX XXX` |
| Truck plate format | `KCx NNNx` (e.g. `KCB 100A`) |
| Driver licence | `PSV/LIC/YYYY/NNNNN` |
| Company name | Segecha Group Ltd |
| Location | Nairobi, Kenya |
| Locale | `en-KE` |

---

## Recommended Package Summary

```bash
# Phase 1
npm install react-router-dom
npm install vite@latest --save-dev

# Phase 2
npm install jspdf jspdf-autotable papaparse recharts

# Phase 3
npm install express better-sqlite3 cors dotenv jsonwebtoken bcryptjs
npm install -D typescript @types/react @types/react-dom tailwindcss postcss autoprefixer concurrently
```

---

*Segecha Group Ltd — Internal Use Only — v3.0 Upgrade Specification*
