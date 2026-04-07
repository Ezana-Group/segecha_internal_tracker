/* ─── PageHeader ────────────────────────────────────────────────────
   Title on left (large + bold), actions on right.
   Icon shown as a colored square badge.
   Description in muted text below title.
   Divider line below the entire header.
   Props: icon | title | description | actions | belowTitle |
          className | marginBottom
   ──────────────────────────────────────────────────────────────── */

export function PageHeader({
    icon: Icon,
    title,
    description,
    actions,
    belowTitle,
    className = "",
    marginBottom = 28,
}) {
    return (
        <header
            className={`page-header ${className}`.trim()}
            style={{ marginBottom }}
        >
            {/* ── Main row ── */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px 20px",
                    paddingBottom: 16,
                }}
            >
                {/* Left: icon + text */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        flex: "1 1 240px",
                        minWidth: 0,
                    }}
                >
                    {Icon && (
                        <div
                            className="page-header-icon"
                            aria-hidden
                            style={{
                                flexShrink: 0,
                                width: 40,
                                height: 40,
                                borderRadius: "var(--radius-md)",
                                background: "var(--brand-muted)",
                                border: "1px solid var(--brand-border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--brand-primary)",
                            }}
                        >
                            <Icon size={20} strokeWidth={2} />
                        </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                        <h1
                            className="page-header-title"
                            style={{
                                fontSize: "22px",
                                fontWeight: 800,
                                color: "var(--text-primary)",
                                lineHeight: 1.2,
                                letterSpacing: "-0.02em",
                                margin: 0,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {title}
                        </h1>
                        {description != null && description !== false && (
                            <div
                                className="page-header-desc"
                                style={{
                                    marginTop: 3,
                                    fontSize: "13px",
                                    color: "var(--text-muted)",
                                    lineHeight: 1.5,
                                }}
                            >
                                {description}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: actions */}
                {actions != null && actions !== false && (
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                            flexShrink: 0,
                        }}
                    >
                        {actions}
                    </div>
                )}
            </div>

            {/* ── Divider ── */}
            <div
                style={{
                    height: 1,
                    background: "var(--border-subtle)",
                    borderRadius: 1,
                }}
            />

            {/* ── Below-title slot (tabs, filters, etc.) ── */}
            {belowTitle != null && (
                <div
                    className="page-header-below"
                    style={{ marginTop: 14 }}
                >
                    {belowTitle}
                </div>
            )}
        </header>
    );
}
