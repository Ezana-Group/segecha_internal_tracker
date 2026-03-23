import { motion } from "framer-motion";

export function Button({ children, variant = "primary", size = "md", icon: Icon, loading, disabled, className = "", ...props }) {
    const getStyles = () => {
        const base = {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            borderRadius: "var(--radius-md)",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-sans)",
        };

        const sizes = {
            sm: { padding: "6px 12px", fontSize: "12px", minHeight: 32 },
            md: { padding: "9px 18px", fontSize: "13px", minHeight: 38 },
            lg: { padding: "11px 22px", fontSize: "14px", minHeight: 42 },
        };

        const variants = {
            primary: {
                background: "var(--brand-primary)",
                color: "#ffffff",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
            },
            secondary: {
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
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
                background: "var(--brand-primary)",
                color: "#ffffff",
                boxShadow: "none",
            },
        };

        const v = variants[variant] || variants.primary;
        return { ...base, ...sizes[size], ...v };
    };

    return (
        <motion.button
            whileHover={{ opacity: disabled || loading ? 1 : 0.92 }}
            whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
            style={getStyles()}
            disabled={disabled || loading}
            className={`btn-premium ${className}`.trim()}
            {...props}
        >
            {loading ? (
                <div
                    className="loader-spinner"
                    style={{
                        width: 14,
                        height: 14,
                        border: "2px solid currentColor",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                    }}
                />
            ) : (
                <>
                    {Icon && <Icon size={size === "sm" ? 14 : 16} strokeWidth={2} />}
                    {children}
                </>
            )}
        </motion.button>
    );
}
