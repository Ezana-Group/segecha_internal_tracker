/* ─── Toast ─────────────────────────────────────────────────────────
   Bottom-right toast stack. Each toast slides in from the right.
   Icons: checkmark (success) · X circle (error) · info (warning)
   Exports: ToastContainer  — same API as before.
   Props (per toast): { id, type, message }
   ──────────────────────────────────────────────────────────────── */

/* Inject keyframe + base styles once into the document head. */
const INJECTED_KEY = "__segecha_toast_styles__";
if (typeof document !== "undefined" && !document.getElementById(INJECTED_KEY)) {
    const style = document.createElement("style");
    style.id = INJECTED_KEY;
    style.textContent = `
@keyframes toast-slide-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0);    }
}
@keyframes toast-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
.toast-item-enter {
  animation: toast-slide-in 0.22s var(--ease-out, cubic-bezier(0.16,1,0.3,1)) both;
}
    `;
    document.head.appendChild(style);
}

/* ── Icon components (inline SVG, no external dep) ── */
function IconCheck() {
    return (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
            <circle cx="7.5" cy="7.5" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M4.5 7.5L6.5 9.5L10.5 5.5" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconX() {
    return (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
            <circle cx="7.5" cy="7.5" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 5L10 10M10 5L5 10" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" />
        </svg>
    );
}

function IconInfo() {
    return (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
            <circle cx="7.5" cy="7.5" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7.5 6.5V10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="7.5" cy="4.5" r="0.75" fill="currentColor" />
        </svg>
    );
}

/* ── Config per type ── */
const CONFIG = {
    success: {
        label: "Done",
        Icon: IconCheck,
        color: "#22c55e",
        bg: "rgba(34,197,94,0.10)",
        border: "rgba(34,197,94,0.22)",
    },
    error: {
        label: "Error",
        Icon: IconX,
        color: "#EF4444",
        bg: "rgba(239,68,68,0.10)",
        border: "rgba(239,68,68,0.22)",
    },
    warning: {
        label: "Notice",
        Icon: IconInfo,
        color: "#F59E0B",
        bg: "rgba(245,158,11,0.10)",
        border: "rgba(245,158,11,0.22)",
    },
};

/* ── Single toast item ── */
function ToastItem({ toast }) {
    const kind = CONFIG[toast.type] || CONFIG.success;
    const { Icon, color, bg, border, label } = kind;

    return (
        <div
            className="toast-item-enter"
            role="alert"
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "11px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-elevated, #111113)",
                border: `1px solid ${border}`,
                boxShadow: "var(--shadow-md)",
                backdropFilter: "blur(12px)",
                minWidth: 260,
                maxWidth: 360,
                pointerEvents: "auto",
            }}
        >
            {/* Colored icon */}
            <span
                style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "var(--radius-sm)",
                    background: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: color,
                    marginTop: 1,
                }}
            >
                <Icon />
            </span>

            {/* Text */}
            <div style={{ minWidth: 0, flex: 1 }}>
                <div
                    style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: color,
                        lineHeight: 1.3,
                        marginBottom: 2,
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.45,
                        wordBreak: "break-word",
                    }}
                >
                    {toast.message}
                </div>
            </div>
        </div>
    );
}

/* ── Container — fixed, bottom-right ── */
export function ToastContainer({ toasts }) {
    if (!toasts || toasts.length === 0) return null;

    return (
        <div
            className="toast-stack"
            role="status"
            aria-live="polite"
            style={{
                position: "fixed",
                bottom: "24px",
                right: "24px",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "flex-end",
                pointerEvents: "none",
            }}
        >
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} />
            ))}
        </div>
    );
}
