export const fmt = (n) =>
    `KES ${Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtN = (n, d = 1) => Number(n || 0).toFixed(d);
export const fmtDate = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date)) return d; // Fallback for already formatted strings
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getRelativeMonth ? date.getMonth() + 1 : date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/** Normalize persisted message template.type (handles legacy / inconsistent casing). */
export function canonicalTemplateType(raw) {
    const s = String(raw ?? "Email").trim().toLowerCase();
    if (s === "sms") return "SMS";
    if (s === "pdf") return "PDF";
    if (s === "whatsapp") return "WhatsApp";
    return "Email";
}

/** Weight / numeric fields: 0 is valid; only null/undefined/empty/NaN show as em dash in summaries. */
export function fmtKgDisplay(value) {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString();
}

/** Same as fmtKgDisplay with optional " kg" suffix for profile cards. */
export function fmtKgLabel(value) {
    const s = fmtKgDisplay(value);
    return s === "—" ? "—" : `${s} kg`;
}

/** Profile / badge text: prefer settings-prefixed uId, else canonical id (avoids stale or truncated id display). */
export function displayRecordId(record) {
    if (!record || typeof record !== "object") return "—";
    const s = String(record.uId ?? record.id ?? "").trim();
    return s || "—";
}

export const today = () => new Date().toISOString().split("T")[0];
export const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
export const monthLabel = (m) => new Date(m + "-01").toLocaleDateString("en-KE", { month: "long", year: "numeric" });
