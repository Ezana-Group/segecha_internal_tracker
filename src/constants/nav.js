// ═══════════════════════════════════════════════════════════════════
// SEGECHA — SETTINGS-AWARE CONSTANTS
// Reads from localStorage 'segecha_settings' for user-customizable values
// ═══════════════════════════════════════════════════════════════════

import { getLicenceClasses as readLicenceClasses, getCommonRoutes as readCommonRoutes } from "../utils/settingsStore.js";

const _S = (() => { try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); } catch { return {}; } })();

// ─── Navigation (icons are defined in Sidebar ICON_MAP) ─────────────
export const NAV = [
    { id: "dashboard", path: "/", label: "Dashboard" },
    { id: "trucks", path: "/fleet", label: "Fleet" },
    { id: "drivers", path: "/drivers", label: "Drivers" },
    { id: "staff", path: "/staff", label: "Staff" },
    { id: "customers", path: "/customers", label: "Customers" },
    { id: "journeys", path: "/journeys", label: "Journeys" },
    { id: "fuel", path: "/fuel", label: "Fuel log" },
    { id: "expenses", path: "/expenses", label: "Expenses" },
    { id: "invoices", path: "/invoices", label: "Invoices" },
    { id: "payroll", path: "/payroll", label: "Payroll" },
    { id: "maintenance", path: "/maintenance", label: "Maintenance" },
    { id: "tyres", path: "/tyres", label: "Tyre health" },
    { id: "pnl", path: "/pnl", label: "P&L report" },
    { id: "documents", path: "/documents", label: "Documents" },
    { id: "import", path: "/import", label: "Import" },
    { id: "settings", path: "/settings", label: "Settings" },
];

// ─── Customizable Dropdowns ──────────────────────────────────────
export const CATS = _S.expenseCategories?.length ? _S.expenseCategories : ["Fuel", "Maintenance", "Toll", "Permit", "Tyre", "Allowance", "Salary", "Insurance", "Other"];
export const TRUCK_TYPES = _S.truckTypes?.length ? _S.truckTypes : ["Rigid", "Semi-Trailer", "Tipper", "Flatbed", "Tanker", "Box Body"];
/** Snapshot at module load; use `getLicenceClasses` from `settingsStore` when options must stay in sync */
export const LICENCE_CLASSES = readLicenceClasses();
export const CARGO_TYPES = _S.cargoTypes?.length ? _S.cargoTypes : ["Electronics", "FMCG Goods", "Spare Parts", "Machinery", "Cement", "Fertiliser", "Fuel", "Timber", "Other"];
/** Snapshot at module load; use `getCommonRoutes` from `settingsStore` when options must stay in sync */
export const COMMON_ROUTES = readCommonRoutes();

// ─── Status Enums (not customizable) ─────────────────────────────
export const STATUSES_JOURNEY = ["Loading", "In Transit", "Awaiting Verification", "Completed", "Cancelled"];
export const STATUSES_TRUCK = ["Active", "Maintenance", "Off Road"];

// ─── Configurable Thresholds ─────────────────────────────────────
export const TYRE_WARN_KM = _S.tyreWarnKm ? +_S.tyreWarnKm : Number(import.meta.env.VITE_TYRE_WARNING_KM) || 5000;
export const DEFAULT_TYRE_INTERVAL = _S.defaultTyreInterval ? +_S.defaultTyreInterval : 60000;
export const DEFAULT_FUEL_PRICE = _S.defaultFuelPrice ? +_S.defaultFuelPrice : 0;
export const MAX_FUEL_LITRES = _S.maxFuelLitres ? +_S.maxFuelLitres : 2000;
export const PAYMENT_TERMS_DAYS = _S.paymentTermsDays ? +_S.paymentTermsDays : 14;
export const INVOICE_PREFIX = _S.invoicePrefix || 'INV';
export const STALE_TRANSIT_DAYS = _S.staleTransitDays ? +_S.staleTransitDays : 5;
export const MAINTENANCE_OVERDUE_DAYS = _S.maintenanceOverdueDays ? +_S.maintenanceOverdueDays : 7;
export const FLEET_ACTIVE_WARN_PCT = _S.fleetActiveWarnPct ? +_S.fleetActiveWarnPct : 50;
