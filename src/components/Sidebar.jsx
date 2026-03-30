import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Activity,
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
    "mpesa-logs": Activity,
    documents: Files,
    import: Download,
    settings: Settings,
    "driver-overview": LayoutDashboard,
    "driver-trips": RouteIcon,
    "driver-portal-app": ExternalLink,
    "staff-overview": UserRoundCog,
};

export function Sidebar({ sideOpen, setSideOpen, isMobile, tyreAlertCount, verifyAlertCount, resetData, data, importSession, previewMode, sideCollapsed, setSideCollapsed }) {
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
            className={`sidebar-shell${isMobile ? " is-mobile-drawer" : ""}${!isMobile && sideCollapsed ? " is-collapsed" : ""}`}
            style={
                isMobile
                    ? {
                          transform: sideOpen ? "translateX(0)" : "translateX(-100%)",
                      }
                    : undefined
            }
        >
            <div className="sidebar-brand" style={{ padding: sideCollapsed && !isMobile ? '20px 14px' : '24px 20px', borderBottom: '1px solid var(--border-subtle)', justifyContent: sideCollapsed && !isMobile ? 'center' : 'flex-start' }}>
                <div className="sidebar-brand-mark" style={{ background: 'transparent', padding: 0, boxShadow: 'none' }}>
                    <img src={s.companyLogo || "/logo.png"} alt="Logo" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
                </div>
                {!sideCollapsed || isMobile ? (
                    <div style={{ marginLeft: 12 }}>
                        <div className="sidebar-brand-name" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {s.companyName || "Segecha Group"}
                        </div>
                        <div className="sidebar-brand-tag" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {previewMode ? "Preview mode" : "Fleet Operations"}
                        </div>
                    </div>
                ) : null}
            </div>

            <nav className="sidebar-nav-wrap">
                {(!sideCollapsed || isMobile) && <div className="sidebar-section-label">Navigation</div>}
                {navItems.map((n) => {
                    const Icon = ICON_MAP[n.id] || LayoutDashboard;
                    const importErrorCount =
                        importSession && !importSession.committed
                            ? Object.values(importSession.sheets).reduce((acc, sh) => acc + sh.errors.length, 0) || null
                            : null;

                    const hasAlert =
                        !previewMode &&
                        ((n.id === "tyres" && tyreAlertCount > 0) ||
                            (n.id === "journeys" && verifyAlertCount > 0) ||
                            (n.id === "import" && importErrorCount > 0));
                    const alertCount = n.id === "tyres" ? tyreAlertCount : n.id === "journeys" ? verifyAlertCount : importErrorCount;

                    let badgeClass = "sidebar-nav-badge";
                    if (n.id === "import") badgeClass += " sidebar-nav-badge--warn";
                    else if (n.id === "tyres") badgeClass += " sidebar-nav-badge--danger";
                    else if (n.id === "journeys") badgeClass += " sidebar-nav-badge--purple";

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
                            title={sideCollapsed && !isMobile ? n.label : ""}
                        >
                            <Icon size={18} strokeWidth={2} />
                            {(!sideCollapsed || isMobile) && <span style={{ flex: 1 }}>{n.label}</span>}
                            {hasAlert && <span className={badgeClass}>{alertCount}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {(!sideCollapsed || isMobile) && (
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
                    {!previewMode ? (
                        <button type="button" className="sidebar-meta-btn" onClick={resetData}>
                            Reset demo data
                        </button>
                    ) : null}
                </div>
            )}
        </aside>
    );
}
