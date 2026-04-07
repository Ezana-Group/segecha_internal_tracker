/* ─── Button ───────────────────────────────────────────────────────
   Pure-CSS transitions, no framer-motion.
   Variants: primary | secondary | outline | danger | ghost | premium
   Sizes:    sm | md | lg
   ──────────────────────────────────────────────────────────────── */

const BASE = `
  btn-base
  inline-flex items-center justify-center
`;

/* Inline style maps keep things co-located and avoid a separate stylesheet. */
const SIZE_STYLES = {
    sm: { padding: "5px 12px",  fontSize: "11px", minHeight: 30, gap: 6 },
    md: { padding: "8px 16px",  fontSize: "13px", minHeight: 36, gap: 7 },
    lg: { padding: "10px 20px", fontSize: "14px", minHeight: 42, gap: 8 },
};

const ICON_SIZE = { sm: 13, md: 15, lg: 16 };

const VARIANT_STYLES = {
    primary: {
        background: "var(--brand-primary)",
        color: "#ffffff",
        border: "1px solid transparent",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
    },
    secondary: {
        background: "var(--bg-card)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-medium)",
        boxShadow: "var(--shadow-xs)",
    },
    outline: {
        background: "transparent",
        color: "var(--brand-primary)",
        border: "1px solid var(--brand-primary)",
    },
    danger: {
        background: "var(--btn-danger-bg)",
        color: "var(--btn-danger-fg)",
        border: "1px solid var(--btn-danger-border)",
        fontWeight: 700,
    },
    ghost: {
        background: "var(--surface-subtle)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border-subtle)",
    },
    premium: {
        background: "var(--brand-gradient)",
        color: "#ffffff",
        border: "1px solid transparent",
        boxShadow: "0 2px 8px rgba(249,115,22,0.35)",
    },
};

export function Button({
    children,
    variant = "primary",
    size = "md",
    icon: Icon,
    loading = false,
    disabled = false,
    className = "",
    ...props
}) {
    const isDisabled = disabled || loading;

    const style = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        letterSpacing: "0.01em",
        borderRadius: "var(--radius-md)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.52 : 1,
        outline: "none",
        transition:
            "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, " +
            "opacity 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease",
        userSelect: "none",
        whiteSpace: "nowrap",
        ...(SIZE_STYLES[size] || SIZE_STYLES.md),
        ...(VARIANT_STYLES[variant] || VARIANT_STYLES.primary),
    };

    return (
        <button
            style={style}
            disabled={isDisabled}
            className={`btn-base btn-${variant} btn-${size} ${className}`.trim()}
            {...props}
        >
            {loading ? (
                <span
                    aria-label="Loading"
                    style={{
                        display: "inline-block",
                        width:  size === "sm" ? 12 : 14,
                        height: size === "sm" ? 12 : 14,
                        border: "2px solid currentColor",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.65s linear infinite",
                        flexShrink: 0,
                    }}
                />
            ) : (
                <>
                    {Icon && (
                        <Icon
                            size={ICON_SIZE[size] || 15}
                            strokeWidth={2}
                            style={{ flexShrink: 0 }}
                        />
                    )}
                    {children}
                </>
            )}
        </button>
    );
}
