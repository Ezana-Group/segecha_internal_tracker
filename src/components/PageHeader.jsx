/**
 * Consistent page title, description, optional icon, actions, and secondary row (tabs, filters).
 */
export function PageHeader({
    icon: Icon,
    title,
    description,
    actions,
    belowTitle,
    className = "",
    marginBottom = 18,
}) {
    return (
        <header
            className={`page-header ${className}`.trim()}
            style={{ marginBottom }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                    gap: "16px 20px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: 14,
                        alignItems: "flex-start",
                        flex: "1 1 240px",
                        minWidth: 0,
                    }}
                >
                    {Icon && (
                        <div className="page-header-icon" aria-hidden>
                            <Icon size={22} strokeWidth={2} />
                        </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                        <h1 className="page-header-title">{title}</h1>
                        {description != null && description !== false && (
                            <div className="page-header-desc">{description}</div>
                        )}
                    </div>
                </div>
                {actions != null && actions !== false && (
                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        {actions}
                    </div>
                )}
            </div>
            {belowTitle != null && (
                <div style={{ marginTop: 14 }} className="page-header-below">
                    {belowTitle}
                </div>
            )}
        </header>
    );
}
