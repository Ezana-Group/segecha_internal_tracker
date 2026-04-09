const DEDUP_MS = 8000;
let lastKey = "";
let lastAt = 0;

function post(payload) {
    const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
    const url = `${base}/api/client-error`;
    if (typeof fetch !== "function") return;
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
    }).catch(() => {});
}

function dedupSend(payload) {
    const k = `${payload.source}|${payload.message}|${payload.stack?.slice?.(0, 200) || ""}`;
    const now = Date.now();
    if (k === lastKey && now - lastAt < DEDUP_MS) return;
    lastKey = k;
    lastAt = now;
    post(payload);
}

export function installClientErrorReporter(source = "driver") {
    if (typeof window === "undefined") return;

    window.addEventListener("error", (ev) => {
        const err = ev.error;
        dedupSend({
            source,
            level: "error",
            message: err?.message || ev.message || "window.error",
            stack: err?.stack || "",
            url: window.location?.href,
            userAgent: navigator.userAgent,
            meta: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
        });
    });

    window.addEventListener("unhandledrejection", (ev) => {
        const r = ev.reason;
        const msg = r instanceof Error ? r.message : String(r);
        const stack = r instanceof Error ? r.stack : "";
        dedupSend({
            source,
            level: "error",
            message: `unhandledrejection: ${msg}`,
            stack,
            url: window.location?.href,
            userAgent: navigator.userAgent,
            meta: {},
        });
    });
}
