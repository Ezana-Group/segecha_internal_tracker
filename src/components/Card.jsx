/* ─── Card ─────────────────────────────────────────────────────────
   Clean card with optional colored top-border accent.
   Icon lives in a rounded square in the top-right corner.
   Props: children | title | subtitle | icon | accent | className |
          onClick  | style
   ──────────────────────────────────────────────────────────────── */

export function Card({
    children,
    title,
    subtitle,
    icon: Icon,
    accent,
    className = "",
    onClick,
    style: propStyle,
    ...props
}) {
    const accentColor = accent || null;

    const cardStyle = {
        position: "relative",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        boxShadow: "var(--shadow-sm)",
        cursor: onClick ? "pointer" : "default",
        transition: onClick
            ? "box-shadow 0.15s ease, border-color 0.15s ease, transform 0.12s ease"
            : undefined,
        // Colored top border when accent is passed
        borderTop: accentColor ? `2px solid ${accentColor}` : "1px solid var(--border-subtle)",
        ...propStyle,
    };

    return (
        <div
            className={`card ${className}`.trim()}
            style={cardStyle}
            onClick={onClick}
            {...props}
        >
            {/* Header row: title+subtitle left, icon right */}
            {(title || subtitle || Icon) && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: children ? 14 : 0,
                    }}
                >
                    {/* Text block */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                        {title && (
                            <h3
                                style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    lineHeight: 1.3,
                                    margin: 0,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p
                                style={{
                                    fontSize: "12px",
                                    color: "var(--text-muted)",
                                    margin: "3px 0 0",
                                    lineHeight: 1.4,
                                }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {/* Icon badge */}
                    {Icon && (
                        <div
                            style={{
                                flexShrink: 0,
                                width: 34,
                                height: 34,
                                borderRadius: "var(--radius-md)",
                                background: accentColor
                                    ? `${accentColor}18`
                                    : "var(--surface-subtle)",
                                border: `1px solid ${accentColor ? `${accentColor}28` : "var(--border-subtle)"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: accentColor || "var(--text-secondary)",
                            }}
                        >
                            <Icon size={16} strokeWidth={2} />
                        </div>
                    )}
                </div>
            )}

            {children}
        </div>
    );
}
