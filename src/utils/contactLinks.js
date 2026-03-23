/** Kenya-oriented phone normalization for wa.me / sms: links */

export function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
}

/** E.164-ish without + for wa.me (e.g. 2547xxxxxxxx) */
export function toKeMobileDigits(phone) {
    let d = digitsOnly(phone);
    if (!d) return "";
    if (d.startsWith("0")) d = "254" + d.slice(1);
    if (d.startsWith("254")) return d;
    if (d.length === 9) return "254" + d;
    return d;
}

export function buildWhatsAppUrl(phone, text) {
    const p = toKeMobileDigits(phone);
    if (!p) return null;
    return `https://wa.me/${p}?text=${encodeURIComponent(text || "")}`;
}

/** sms: URI — works on many mobile devices; desktop may no-op */
export function buildSmsUrl(phone, body) {
    const p = toKeMobileDigits(phone);
    if (!p) return null;
    const b = body ? encodeURIComponent(body) : "";
    return b ? `sms:${p}?body=${b}` : `sms:${p}`;
}

export function buildMailtoUrl(email, subject, body) {
    if (!email || !String(email).trim()) return null;
    const q = new URLSearchParams();
    if (subject) q.set("subject", subject);
    if (body) q.set("body", body);
    const qs = q.toString();
    return `mailto:${encodeURIComponent(String(email).trim())}${qs ? `?${qs}` : ""}`;
}
