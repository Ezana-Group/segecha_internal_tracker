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
    Package,
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
    assets: Package,
    invoices: FileText,
    payroll: CreditCard,
    maintenance: Wrench,
    tyres: CircleDot,
    pnl: BarChart3,
    incidents: AlertTriangle,
    documents: Files,
    import: Download,
    settings: Settings,
    "driver-overview": LayoutDashboard,
    "driver-trips": RouteIcon,
    "driver-portal-app": ExternalLink,
    "staff-overview": UserRoundCog,
};

// Nav items belonging to the Finance group
const FINANCE_IDS = new Set(["fuel", "expenses", "invoices", "payroll", "pnl"]);
// Nav items belonging to the Core group
const CORE_IDS = new Set(["dashboard", "trucks", "fleet", "drivers", "staff", "customers", "journeys"]);

export function Sidebar({ sideOpen, setSideOpen, isMobile, tyreAlertCount, verifyAlertCount, data, importSession, previewMode }) {
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

    // Group nav items: core | finance | other (ops/misc)
    const coreItems    = navItems.filter(n => CORE_IDS.has(n.id));
    const financeItems = navItems.filter(n => FINANCE_IDS.has(n.id));
    const otherItems   = navItems.filter(n => !CORE_IDS.has(n.id) && !FINANCE_IDS.has(n.id));

    const renderItem = (n) => {
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
                    onClick={() => { if (isMobile) setSideOpen(false); }}
                >
                    <Icon size={17} strokeWidth={2} />
                    <span style={{ flex: 1 }}>{n.label}</span>
                    <ExternalLink size={13} strokeWidth={2} className="sidebar-nav-external-icon" aria-hidden />
                </a>
            );
        }

        return (
            <NavLink
                key={n.id}
                to={n.path}
                end={n.path === "/"}
                onClick={() => { if (isMobile) setSideOpen(false); }}
                className="sidebar-nav-link"
            >
                <Icon size={17} strokeWidth={2} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {hasAlert && <span className={badgeClass}>{alertCount}</span>}
            </NavLink>
        );
    };

    return (
        <aside
            className={`sidebar-shell${isMobile ? " is-mobile-drawer" : ""}`}
            style={
                isMobile
                    ? { transform: sideOpen ? "translateX(0)" : "translateX(-100%)" }
                    : undefined
            }
        >
            {/* ── Brand area ─────────────────────────────────────── */}
            <div className="sidebar-brand">
                <div className="sidebar-brand-mark">
                    <img
                        src={s.companyLogo || "/logo.png"}
                        alt="Logo"
                        style={{ height: 38, width: 'auto', objectFit: 'contain' }}
                    />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div className="sidebar-brand-name">
                        {s.companyName || "Segecha Group"}
                    </div>
                    <div className="sidebar-brand-tag">
                        {previewMode ? "Preview mode" : "Fleet Ops"}
                    </div>
                </div>
            </div>

            {/* ── Navigation ─────────────────────────────────────── */}
            <nav className="sidebar-nav-wrap">
                {/* Preview mode or custom items: render flat */}
                {previewMode ? (
                    <>
                        <div className="sidebar-section-label">Navigation</div>
                        {navItems.map(renderItem)}
                    </>
                ) : (
                    <>
                        {/* Core section */}
                        {coreItems.length > 0 && (
                            <>
                                <div className="sidebar-section-label">Core</div>
                                {coreItems.map(renderItem)}
                            </>
                        )}

                        {/* Finance section */}
                        {financeItems.length > 0 && (
                            <>
                                <div className="sidebar-section-label" style={{ marginTop: 12 }}>Finance</div>
                                {financeItems.map(renderItem)}
                            </>
                        )}

                        {/* Other / Ops section */}
                        {otherItems.length > 0 && (
                            <>
                                <div className="sidebar-section-label" style={{ marginTop: 12 }}>Operations</div>
                                {otherItems.map(renderItem)}
                            </>
                        )}
                    </>
                )}
            </nav>

            {/* ── Footer live stats ──────────────────────────────── */}
            <div className="sidebar-footer">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span className="sidebar-stat-label" style={{ fontSize: 10, letterSpacing: '0.08em' }}>Live Status</span>
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

            </div>
        </aside>
    );
}
