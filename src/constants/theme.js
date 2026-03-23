/* ═══════════════════════════════════════════════════════════════════
   SEGECHA — CORE THEME TOKENS
   Status colors and semantic values
   ═══════════════════════════════════════════════════════════════════ */

export const SC = {
    Completed: "#22c55e",
    "In Transit": "#3b82f6",
    Loading: "#ca8a04",
    Maintenance: "#ca8a04",
    Active: "#22c55e",
    "Off Road": "#dc2626",
    Cancelled: "#dc2626",
    Paid: "#22c55e",
    Pending: "#ca8a04",
    Overdue: "#dc2626",
    "Due Soon": "#d97706",
    Suspended: "#dc2626",
    "Awaiting Verification": "#6366f1",
    "Awaiting Start Verification": "#6366f1",
    Success: "#22c55e",
    Warning: "#ca8a04",
    Default: "#64748b",
};

// Minimal stubs for backward compatibility during migration
export const getTheme = (dark) => ({
    text: "var(--text-primary)",
    textDim: "var(--text-secondary)",
    textFaint: "var(--text-muted)",
    textGhost: "var(--text-dim)",
    border: "var(--border-subtle)",
    border2: "var(--border-medium)",
    bg: "var(--bg-surface)",
    card: "var(--bg-card)",
    surface: "var(--bg-surface)",
    surface2: "var(--bg-card)",
    red: "#dc2626",
    amber: "#ca8a04",
    blue: "#3b82f6",
    green: "#22c55e",
    blueBg: "rgba(59, 130, 246, 0.12)",
    greenBg: "rgba(16, 185, 129, 0.12)",
    amberBg: "rgba(245, 158, 11, 0.12)",
});

const SAFE_PAD = "max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))";

export const getStyles = (T) => ({
    ovl: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        overscrollBehavior: "contain",
        padding: SAFE_PAD,
    },
    mbox: {
        background: "var(--bg-surface)",
        borderRadius: 16,
        padding: 24,
        boxShadow: "var(--shadow-lg)",
        border: "1px solid var(--border-medium)",
        margin: "auto 0",
        position: "relative",
        maxHeight: "min(92dvh, 920px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    },
    mtitle: { fontSize: 20, fontWeight: 800, color: "var(--text-primary)" },
    lbl: { fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "block" },
    inp: {
        width: "100%",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--border-medium)",
        background: "var(--bg-surface)",
        color: "var(--text-primary)",
        fontSize: 14,
        fontFamily: "inherit",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    },
    fg: { marginBottom: 16 },
    fgg: (cols) => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }),
    btn: (variant) => {
        const sm = variant === "sm";
        const base = {
            padding: sm ? "6px 12px" : "10px 20px",
            borderRadius: 10,
            border: "none",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: sm ? 11 : 14,
        };
        if (variant === "primary") return { ...base, background: "var(--brand-primary)", color: "white" };
        if (variant === "green") return { ...base, background: "#16a34a", color: "white" };
        if (variant === "del") return { ...base, background: "#dc2626", color: "white", padding: "6px 10px", fontSize: 12 };
        if (variant === "ghost") return { ...base, background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" };
        if (variant === "sm") return { ...base, background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" };
        return { ...base, background: "rgba(255,255,255,0.05)", color: "white" };
    },
    tbl: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
    th: { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-dim)", fontWeight: 700 },
    td: { padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", verticalAlign: "middle" },
    grid: (d, t, m) => ({ display: "grid", gridTemplateColumns: `repeat(${d}, 1fr)`, gap: 16 }),
});
