export function Card({ children, title, subtitle, icon: Icon, accent, className = "", onClick, ...props }) {
    const accentColor = accent || "var(--brand-primary)";

    return (
        <div
            className={`card-premium ${className}`.trim()}
            onClick={onClick}
            style={{
                cursor: onClick ? "pointer" : "default",
                ...props.style,
            }}
            {...props}
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "3px",
                    height: "100%",
                    background: accentColor,
                    opacity: accent ? 1 : 0,
                    borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
                }}
            />

            {(title || Icon) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                        {title && (
                            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
                        )}
                        {subtitle && (
                            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</p>
                        )}
                    </div>
                    {Icon && (
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: "var(--radius-md)",
                                background: accent ? "var(--brand-muted)" : "var(--surface-subtle)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: accentColor,
                                border: "1px solid var(--border-subtle)",
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
