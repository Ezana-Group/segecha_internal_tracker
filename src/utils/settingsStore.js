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
 * - Server sync (`syncToServer`) — pushes tracker `data` + should include settings in exports
 *
 * Use `patchSettings` from UI so all listeners stay aligned. Direct `localStorage` writes
 * elsewhere should gradually migrate here.
 */

export const SETTINGS_STORAGE_KEY = "segecha_settings";

/** Default PSV / DL class labels when Settings has none configured */
export const DEFAULT_LICENCE_CLASSES = ["Class G", "Class CE", "Class C", "Class B"];
export const DEFAULT_TRUCK_TYPES = ["Prime Mover", "Tipper", "Tanker", "Flatbed", "Box Body", "Refrigerated", "Other"];
export const DEFAULT_CARGO_TYPES = ["Electronics", "FMCG Goods", "Spare Parts", "Machinery", "Cement", "Fertiliser", "Fuel", "Timber", "Other"];
export const DEFAULT_EXPENSE_CATEGORIES = ["Fuel", "Maintenance", "Toll", "Permit", "Tyre", "Allowance", "Salary", "Insurance", "Other"];

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

/** Replace entire settings object (e.g. restore backup). */
export function writeSettings(next) {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
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
