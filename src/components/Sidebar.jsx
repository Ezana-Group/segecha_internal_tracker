import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Truck,
    Route as RouteIcon,
    Droplet,
    Receipt,
    FileText,
    CreditCard,
    Wrench,
    CircleDot,
    BarChart3,
    Settings,
    Files,
    Contact,
    UserRoundCheck,
    UserRoundCog,
    Download,
    ExternalLink,
    AlertTriangle,
} from "lucide-react";
import { NAV } from "../constants/nav";
import { getPreviewNavItems } from "../constants/previewNav.js";

const ICON_MAP = {
    dashboard: LayoutDashboard,
    trucks: Truck,
    fleet: Truck,
    drivers: UserRoundCheck,
    staff: UserRoundCog,
    customers: Contact,
    journeys: RouteIcon,
    fuel: Droplet,
    expenses: Receipt,
    invoices: FileText,
    payroll: CreditCard,
    maintenance: Wrench,
    tyres: CircleDot,
    pnl: BarChart3,
    incidents: AlertTriangle,
    documents: Files,
    import: Download,
    settings: Settings,
    "mpesa-logs": FileText,
    "driver-overview": LayoutDashboard,
    "driver-trips": RouteIcon,
    "driver-portal-app": ExternalLink,
    "staff-overview": UserRoundCog,
};

export function Sidebar({ isMobile, tyreAlertCount, resetData, data, importSession, previewMode, pendingVerifications }) {
    const activeCount = data?.trucks?.filter((t) => t.status === "Active").length || 0;
    const inTransitCount = data?.journeys?.filter((j) => ["In Transit", "Awaiting Start Verification"].includes(j.status)).length || 0;
    const navItems = previewMode ? getPreviewNavItems(previewMode, data) : NAV;

    const s = (() => {
        try {
            return JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        } catch {
            return {};
        }
    })();

    return (
        <aside
            className={`sidebar-shell${isMobile ? " is-mobile-drawer" : ""}`}
        >
            <div className="sidebar-brand" style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="sidebar-brand-mark" style={{ background: 'transparent', padding: 0, boxShadow: 'none' }}>
                    <img src={s.companyLogo || "/logo.png"} alt="Logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div style={{ marginLeft: 12 }}>
                    <div className="sidebar-brand-name" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                        {s.companyName || "Segecha Group"}
                    </div>
                    <div className="sidebar-brand-tag" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {previewMode ? "Preview mode" : "Fleet Operations"}
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav-wrap">
                <div className="sidebar-section-label">Navigation</div>
                {navItems.map((n) => {
                    const Icon = ICON_MAP[n.id] || LayoutDashboard;
                    const importErrorCount =
                        importSession && !importSession.committed
                            ? Object.values(importSession.sheets).reduce((acc, sh) => acc + sh.errors.length, 0) || null
                            : null;

                    let alertCount = 0;
                    if (n.id === "tyres") alertCount = tyreAlertCount;
                    else if (n.id === "journeys") alertCount = pendingVerifications?.filter(v => v._itemType === 'journey').length || 0;
                    else if (n.id === "fuel") alertCount = pendingVerifications?.filter(v => v._itemType === 'fuel').length || 0;
                    else if (n.id === "expenses") alertCount = pendingVerifications?.filter(v => v._itemType === 'expense').length || 0;
                    else if (n.id === "incidents") alertCount = pendingVerifications?.filter(v => v._itemType === 'incident').length || 0;
                    else if (n.id === "import") alertCount = importErrorCount;

                    const hasAlert = !previewMode && alertCount > 0;

                    let badgeClass = "sidebar-nav-badge";
                    if (n.id === "import") badgeClass += " sidebar-nav-badge--warn";
                    else if (n.id === "tyres" || n.id === "incidents") badgeClass += " sidebar-nav-badge--danger";
                    else if (["journeys", "fuel", "expenses"].includes(n.id)) badgeClass += " sidebar-nav-badge--purple";

                    if (n.external && n.href) {
                        return (
                            <a
                                key={n.id}
                                href={n.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sidebar-nav-link sidebar-nav-link--external"
                                onClick={() => {
                                    if (isMobile) setSideOpen(false);
                                }}
                            >
                                <Icon size={18} strokeWidth={2} />
                                <span style={{ flex: 1 }}>{n.label}</span>
                                <ExternalLink size={14} strokeWidth={2} className="sidebar-nav-external-icon" aria-hidden />
                            </a>
                        );
                    }

                    return (
                        <NavLink
                            key={n.id}
                            to={n.path}
                            end={n.path === "/"}
                            onClick={() => {
                                if (isMobile) setSideOpen(false);
                            }}
                            className="sidebar-nav-link"
                        >
                            <Icon size={18} strokeWidth={2} />
                            <span style={{ flex: 1 }}>{n.label}</span>
                            {hasAlert && <span className={badgeClass}>{alertCount}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span className="sidebar-stat-label">Live</span>
                    <span className="status-dot-pulse" aria-hidden />
                </div>
                <div className="sidebar-stat-grid">
                    <div className="sidebar-stat-cell">
                        <div className="sidebar-stat-label">Active units</div>
                        <div className="sidebar-stat-value">{activeCount}</div>
                    </div>
                    <div className="sidebar-stat-cell">
                        <div className="sidebar-stat-label">In transit</div>
                        <div className="sidebar-stat-value">{inTransitCount}</div>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    {/* Reset button removed for production safety */}
                </div>
            </div>
        </aside>
    );
}
