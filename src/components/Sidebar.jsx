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
import { adminAuth } from "../utils/adminAuth";

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

export function Sidebar({ sideOpen, setSideOpen, isMobile, tyreAlertCount, verifyAlertCount, resetData, data, importSession, previewMode }) {
    const activeCount = data?.trucks?.filter((t) => t.status === "Active").length || 0;
    const inTransitCount = data?.journeys?.filter((j) => ["In Transit", "Awaiting Start Verification"].includes(j.status)).length || 0;
    const role = adminAuth.getUser()?.role || 'staff';
    const navItems = (previewMode ? getPreviewNavItems(previewMode, data) : NAV).filter(n => {
        if (role !== 'admin' && role !== 'superadmin') {
            const restricted = ['staff', 'payroll', 'pnl', 'mpesa-logs', 'import', 'settings'];
            return !restricted.includes(n.id);
        }
        return true;
    });

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
            style={
                isMobile
                    ? {
                          transform: sideOpen ? "translateX(0)" : "translateX(-100%)",
                      }
                    : undefined
            }
        >
            <div className="sidebar-brand">
                <div className="sidebar-brand-mark" style={{ background: 'transparent', padding: 0, boxShadow: 'none' }}>
                    <img src={s.companyLogo || "/logo.png"} alt="Logo" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
                </div>
                <div style={{ marginLeft: 10 }}>
                    <div className="sidebar-brand-name" style={{ fontSize: 14.5 }}>
                        {s.companyName || "Segecha Group"}
                    </div>
                    <div className="sidebar-brand-tag" style={{ fontSize: 10.5 }}>
                        {previewMode ? "Preview mode" : "Fleet Operations"}
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav-wrap">
                <div className="sidebar-section-label">Navigation</div>
                {navItems.map((n, idx) => {
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

                    const delayClass = `delay-${Math.min(idx + 1, 8)}`;

                    if (n.external && n.href) {
                        return (
                            <a
                                key={n.id}
                                href={n.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`sidebar-nav-link sidebar-nav-link--external animate-slide-up ${delayClass}`}
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
                            className={`sidebar-nav-link animate-slide-up ${delayClass}`}
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
                {!previewMode ? (
                    <button type="button" className="sidebar-meta-btn" onClick={resetData}>
                        Reset demo data
                    </button>
                ) : null}
            </div>
        </aside>
    );
}
