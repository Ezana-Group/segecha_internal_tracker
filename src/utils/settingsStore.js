/**
 * Workspace configuration persisted in localStorage (`segecha_settings`).
 *
 * Interconnections (read this blob elsewhere today):
 * - `constants/nav.js` — dropdown defaults (module load; use `getLicenceClasses()` / `getCommonRoutes()` for live values)
 * - `useAppState` — theme preference, template fill, waybill counter sync
 * - `Sidebar`, `Topbar` — company name
 * - `GlobalModals`, `InvoiceView`, `PaymentRequestModal` — invoice/company copy
 * - `WaybillModal` / `waybillPrint.js` — carrier defaults, logo, counter, cross-border keyword rules (`crossBorderRules`)
 * - `Maintenance` page — maintenance schedule JSON
 * - Server sync — every `writeSettings` call debounces a push to /api/tracker/snapshot
 *   so settings survive localStorage clears (restored by useAppState on login).
 *
 * Use `patchSettings` from UI so all listeners stay aligned. Direct `localStorage` writes
 * elsewhere should gradually migrate here.
 */

import { PAYMENT_API } from './env';
import { adminAuth } from './adminAuth';

// Debounce timer for server sync — avoids one API call per keystroke
let _syncTimer = null;

/**
 * Push the current full settings object to the server (system_settings table).
 * Called automatically by writeSettings; debounced 2s.
 * Silent on failure — localStorage is still the source of truth for immediate reads.
 */
function _syncToServer(settings) {
    if (!PAYMENT_API) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
        try {
            const token = adminAuth.getToken();
            if (!token) return;
            await fetch(`${PAYMENT_API}/api/tracker/snapshot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ settings }),
            });
        } catch { /* silent — localStorage copy is still intact */ }
    }, 2000);
}

export const SETTINGS_STORAGE_KEY = "segecha_settings";

/** Default PSV / DL class labels when Settings has none configured */
export const DEFAULT_LICENCE_CLASSES = ["Class G", "Class CE", "Class C", "Class B"];
export const DEFAULT_TRUCK_TYPES = ["Prime Mover", "Tipper", "Tanker", "Flatbed", "Box Body", "Refrigerated", "Other"];
export const DEFAULT_CARGO_TYPES = ["Electronics", "FMCG Goods", "Spare Parts", "Machinery", "Cement", "Fertiliser", "Fuel", "Timber", "Other"];
export const DEFAULT_EXPENSE_CATEGORIES = ["Fuel", "Maintenance", "Toll", "Permit", "Tyre", "Allowance", "Salary", "Insurance", "Other"];
export const DEFAULT_STATUSES_JOURNEY = ["Accepted", "Loading", "In Transit", "Awaiting Verification", "Completed", "Cancelled"];
export const DEFAULT_STATUSES_TRUCK = ["Active", "Maintenance", "Off Road"];
export const DEFAULT_INCIDENT_TYPES = [
    "Accident",
    "Breakdown",
    "Theft",
    "Near Miss",
    "Vehicle Damage",
    "Road Incident",
    "Cargo Damage",
    "Driver Incident",
    "Other",
];
export const DEFAULT_DOC_TYPES_TRUCK = [
    { value: 'insurance_lorry', label: 'Lorry Insurance Certificate' },
    { value: 'insurance_trailer', label: 'Trailer Insurance Certificate' },
    { value: 'comesa', label: 'COMESA Certificate' },
    { value: 'ntsa_inspection', label: 'NTSA Inspection Certificate' },
    { value: 'logbook', label: 'Vehicle Logbook / Title' },
    { value: 'overweight_permit', label: 'Overweight / Special Permit' },
    { value: 'customs', label: 'Customs / Border Document' },
    { value: 'other', label: 'Other Document' },
];
export const DEFAULT_DOC_TYPES_DRIVER = [
    { value: 'psv_licence', label: 'PSV Driving Licence' },
    { value: 'medical_certificate', label: 'Medical Certificate' },
    { value: 'id_card', label: 'National ID / Passport' },
    { value: 'certificate_of_good_conduct', label: 'Certificate of Good Conduct' },
    { value: 'other', label: 'Other Document' },
];
export const DEFAULT_DOC_TYPES_JOURNEY = [
    { value: 'delivery_note', label: 'Delivery Note / POD' },
    { value: 'loading_manifest', label: 'Loading Manifest' },
    { value: 'tr8_form', label: 'TR8 Transit Document' },
    { value: 'fuel_receipt', label: 'External Fuel Receipt' },
    { value: 'weighbridge_ticket', label: 'Weighbridge Ticket' },
    { value: 'customs_clearance', label: 'Customs Clearance' },
    { value: 'toll_receipt', label: 'Toll/Gate Receipt' },
    { value: 'other', label: 'Other Trip Document' },
];

/** Default “Quick route” presets for the journey modal when `commonRoutes` is not set in settings */
export const DEFAULT_COMMON_ROUTES = [
    { origin: "Nairobi", dest: "Mombasa", distance: 480 },
    { origin: "Nairobi", dest: "Kampala", distance: 680 },
    { origin: "Nairobi", dest: "Eldoret", distance: 315 },
    { origin: "Nairobi", dest: "Kisumu", distance: 350 },
    { origin: "Mombasa", dest: "Kampala", distance: 1100 },
    { origin: "Nairobi", dest: "Dar es Salaam", distance: 840 },
];

/**
 * When a journey destination contains any keyword (case-insensitive), the waybill opens in cross-border mode
 * and suggests the border point. Editable under Settings → Waybill defaults.
 */
export const DEFAULT_CROSS_BORDER_RULES = [
    { id: "cb-seed-1", keywordsText: "kampala, jinja, entebbe, gulu, mbarara", borderPoint: "Malaba / Busia" },
    { id: "cb-seed-2", keywordsText: "dar es salaam", borderPoint: "Namanga / Lunga Lunga" },
    { id: "cb-seed-3", keywordsText: "dodoma", borderPoint: "Namanga" },
    { id: "cb-seed-4", keywordsText: "mwanza", borderPoint: "Isebania" },
    { id: "cb-seed-5", keywordsText: "arusha", borderPoint: "Namanga / Holili" },
    { id: "cb-seed-6", keywordsText: "moshi", borderPoint: "Namanga / Holili" },
    { id: "cb-seed-7", keywordsText: "kigali", borderPoint: "Malaba then Gatuna" },
    { id: "cb-seed-8", keywordsText: "bujumbura", borderPoint: "Malaba then Kobero" },
    { id: "cb-seed-9", keywordsText: "kinshasa", borderPoint: "Malaba then Kasindi" },
    { id: "cb-seed-10", keywordsText: "goma", borderPoint: "Malaba then Kasindi" },
    { id: "cb-seed-11", keywordsText: "bukavu", borderPoint: "Malaba then Kasindi" },
    { id: "cb-seed-12", keywordsText: "lusaka", borderPoint: "" },
];

export const DEFAULT_EMAIL_IDENTITIES = {
    client: {
        fromEmail: "",
        fromName: "",
        replyToEmail: "",
        replyToName: "",
        fromFallbackEmails: [],
    },
    driverPortal: {
        fromEmail: "",
        fromName: "",
        replyToEmail: "",
        replyToName: "",
        fromFallbackEmails: [],
    },
    backupFrequency: "Disabled",
};

export const DEFAULT_PAYROLL_SETTINGS = {
    personalRelief: 2400,
    payeBands: [
        { lowerLimit: 0, upperLimit: 24000, ratePercent: 10 },
        { lowerLimit: 24001, upperLimit: 32333, ratePercent: 25 },
        { lowerLimit: 32334, upperLimit: 40667, ratePercent: 30 },
        { lowerLimit: 40668, upperLimit: 57333, ratePercent: 32.5 },
        { lowerLimit: 57334, upperLimit: null, ratePercent: 35 },
    ],
    nssfTier1Ceiling: 7000,
    nssfTier2Ceiling: 36000,
    nssfEmployeeRate: 6,
    nssfEmployerRate: 6,
    shifEnabled: true,
    shifRatePercent: 2.75,
    housingLevyEmployeeRate: 1.5,
    housingLevyEmployerRate: 1.5,
    driverAllowanceDefaults: {
        nightOutPerNight: 2000,
        tripAllowancePerTrip: 1500,
        overtimePerHour: 300,
    },
};

function mergeEmailIdentities(base, next) {
    const b = base || {};
    const n = next || {};
    return {
        client: {
            ...b.client,
            ...(n.client || {}),
            fromFallbackEmails: Array.isArray(n.client?.fromFallbackEmails)
                ? n.client.fromFallbackEmails
                : b.client?.fromFallbackEmails || [],
        },
        driverPortal: {
            ...b.driverPortal,
            ...(n.driverPortal || {}),
            fromFallbackEmails: Array.isArray(n.driverPortal?.fromFallbackEmails)
                ? n.driverPortal.fromFallbackEmails
                : b.driverPortal?.fromFallbackEmails || [],
        },
    };
}

function parseCrossBorderKeywords(text) {
    return String(text || "")
        .split(/[,;\n]/)
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
}

/** Resolved rules for waybill logic (keywords split, empty rules dropped). */
export function getCrossBorderRules() {
    const s = readSettings();
    const raw = s.crossBorderRules;
    const list = Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_CROSS_BORDER_RULES;
    return list
        .map((r) => {
            const keywordsText = String(r.keywordsText ?? r.keywords ?? "").trim();
            const keywords = parseCrossBorderKeywords(keywordsText);
            return {
                id: String(r.id || ""),
                keywordsText,
                keywords,
                borderPoint: String(r.borderPoint ?? "").trim(),
            };
        })
        .filter((r) => r.keywords.length > 0);
}

const CHANGE_EVENT = "segecha-settings-changed";

export function readSettings() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
        // Merge defaults so the UI and email sender logic have safe, predictable values.
        return {
            ...parsed,
            emailIdentities: mergeEmailIdentities(DEFAULT_EMAIL_IDENTITIES, parsed.emailIdentities),
        };
    } catch {
        return { emailIdentities: DEFAULT_EMAIL_IDENTITIES };
    }
}

/**
 * Write settings to localStorage only — used internally when restoring from the
 * server so we don't echo the data straight back to the API.
 */
export function writeSettingsLocal(next) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
    return next;
}

/** Replace entire settings object and sync to server (e.g. user save, restore backup). */
export function writeSettings(next) {
    writeSettingsLocal(next);
    _syncToServer(next); // debounced push to /api/tracker/snapshot
    return next;
}

/** Shallow merge into stored settings and notify listeners. */
export function patchSettings(partial) {
    const prev = readSettings();
    const next = { ...prev, ...partial };
    return writeSettings(next);
}

export function subscribeSettings(callback) {
    const fn = (e) => callback(e.detail);
    window.addEventListener(CHANGE_EVENT, fn);
    return () => window.removeEventListener(CHANGE_EVENT, fn);
}

/**
 * Licence class options for driver forms — reads current localStorage.
 * If `licenceClasses` was never set, returns built-in defaults.
 * If it was saved as an empty array (user cleared the list), returns [].
 */
export function getLicenceClasses() {
    const s = readSettings();
    const raw = s.licenceClasses;
    if (Array.isArray(raw)) {
        return raw.map((x) => String(x).trim()).filter(Boolean);
    }
    return [...DEFAULT_LICENCE_CLASSES];
}

export function getTruckTypes() {
    const s = readSettings();
    const raw = s.truckTypes;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return [...DEFAULT_TRUCK_TYPES];
}

export function getCargoTypes() {
    const s = readSettings();
    const raw = s.cargoTypes;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return [...DEFAULT_CARGO_TYPES];
}

export function getExpenseCategories() {
    const s = readSettings();
    const raw = s.expenseCategories;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return [...DEFAULT_EXPENSE_CATEGORIES];
}

export function getJourneyStatuses() {
    const s = readSettings();
    const raw = s.journeyStatuses;
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((x) => String(x).trim()).filter(Boolean);
    }
    return [...DEFAULT_STATUSES_JOURNEY];
}

export function getTruckStatuses() {
    const s = readSettings();
    const raw = s.truckStatuses;
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((x) => String(x).trim()).filter(Boolean);
    }
    return [...DEFAULT_STATUSES_TRUCK];
}

export function getPayrollSettings() {
    const s = readSettings();
    const raw = s.payrollSettings && typeof s.payrollSettings === "object" ? s.payrollSettings : {};
    return {
        ...DEFAULT_PAYROLL_SETTINGS,
        ...raw,
        driverAllowanceDefaults: {
            ...DEFAULT_PAYROLL_SETTINGS.driverAllowanceDefaults,
            ...(raw.driverAllowanceDefaults || {}),
        },
        payeBands: Array.isArray(raw.payeBands) && raw.payeBands.length > 0 ? raw.payeBands : DEFAULT_PAYROLL_SETTINGS.payeBands,
    };
}

export function getIncidentTypes() {
    const s = readSettings();
    const base = [...DEFAULT_INCIDENT_TYPES];
    const custom = Array.isArray(s.incidentTypesCustom)
        ? s.incidentTypesCustom.map((x) => String(x).trim()).filter(Boolean)
        : [];
    const seen = new Set();
    return [...base, ...custom].filter((x) => {
        const key = x.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function getDocumentTypes(entityType = 'truck') {
    const s = readSettings();
    const normalized = entityType === 'staff' ? 'driver' : entityType;
    const defaults =
        normalized === 'driver'
            ? DEFAULT_DOC_TYPES_DRIVER
            : normalized === 'journey'
                ? DEFAULT_DOC_TYPES_JOURNEY
                : DEFAULT_DOC_TYPES_TRUCK;
    const customKey =
        normalized === 'driver'
            ? 'documentTypesDriverCustom'
            : normalized === 'journey'
                ? 'documentTypesJourneyCustom'
                : 'documentTypesTruckCustom';
    const customLabels = Array.isArray(s[customKey]) ? s[customKey] : [];
    const custom = customLabels
        .map((label) => String(label || '').trim())
        .filter(Boolean)
        .map((label) => ({
            value: label,
            label,
        }));
    const combined = [...defaults, ...custom];
    const seen = new Set();
    return combined.filter((opt) => {
        const key = String(opt.value || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Quick-route presets for journey modals. Reads `segecha_settings.commonRoutes`.
 * If the key is missing, returns built-in defaults; if saved as `[]`, returns [].
 */
export function getCommonRoutes() {
    const s = readSettings();
    const raw = s.commonRoutes;
    if (Array.isArray(raw)) {
        return raw
            .map((r) => ({
                origin: String(r?.origin ?? "").trim(),
                dest: String(r?.dest ?? "").trim(),
                distance: Number(r?.distance) || 0,
            }))
            .filter((r) => r.origin && r.dest);
    }
    return [...DEFAULT_COMMON_ROUTES];
}
