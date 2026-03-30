import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";

// 1. Core Hooks & Utils
import { useAppState } from "./hooks/useAppState";
import { adminAuth } from "./utils/adminAuth";
import { useWindowWidth } from "./hooks/useWindowWidth";
import { DRIVER_PORTAL_URL } from "./utils/env.js";

// 2. Components
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/Toast";
import { GlobalModals } from "./components/GlobalModals";
import { WaybillModal } from "./components/WaybillModal";
import { VerificationModal } from "./components/VerificationModal";
import { PreviewModeBanner } from "./components/PreviewModeBanner.jsx";

// 3. Constant / Domain Logic
import { isPathAllowedInPreview, defaultPreviewPath } from "./constants/previewNav.js";
import { getTheme, getStyles } from "./constants/theme";

// 4. Page Definitions (Static Imports)
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Fleet = lazy(() => import("./pages/Fleet").then(m => ({ default: m.Fleet })));
const Drivers = lazy(() => import("./pages/Drivers").then(m => ({ default: m.Drivers })));
const Journeys = lazy(() => import("./pages/Journeys").then(m => ({ default: m.Journeys })));
const FuelLog = lazy(() => import("./pages/FuelLog").then(m => ({ default: m.FuelLog })));
const Expenses = lazy(() => import("./pages/Expenses").then(m => ({ default: m.Expenses })));
const Invoices = lazy(() => import("./pages/Invoices").then(m => ({ default: m.Invoices })));
const Payroll = lazy(() => import("./pages/Payroll").then(m => ({ default: m.Payroll })));
const Maintenance = lazy(() => import("./pages/Maintenance").then(m => ({ default: m.Maintenance })));
const PnL = lazy(() => import("./pages/PnL").then(m => ({ default: m.PnL })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const Staff = lazy(() => import("./pages/Staff").then(m => ({ default: m.Staff })));
const Documents = lazy(() => import("./pages/Documents").then(m => ({ default: m.Documents })));
const VehicleProfile = lazy(() => import("./pages/VehicleProfile").then(m => ({ default: m.VehicleProfile })));
const DriverProfile = lazy(() => import("./pages/DriverProfile").then(m => ({ default: m.DriverProfile })));
const JourneyProfile = lazy(() => import("./pages/JourneyProfile").then(m => ({ default: m.JourneyProfile })));
const Customers = lazy(() => import("./pages/Customers").then(m => ({ default: m.Customers })));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile").then(m => ({ default: m.CustomerProfile })));
const StaffProfile = lazy(() => import("./pages/StaffProfile").then(m => ({ default: m.StaffProfile })));
const Incidents = lazy(() => import("./pages/Incidents").then(m => ({ default: m.Incidents })));
const ImportReview = lazy(() => import("./pages/ImportReview").then(m => ({ default: m.ImportReview })));
const TyreMonitor = lazy(() => import("./pages/TyreMonitor").then(m => ({ default: m.TyreMonitor })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const MpesaTransactions = lazy(() => import("./pages/MpesaTransactions").then(m => ({ default: m.MpesaTransactions })));


export default function App() {
    const state = useAppState();
    const location = useLocation();
    const navigate = useNavigate();
    const winW = useWindowWidth();
    const isMobile = winW < 768; // Increased from 640
    const isTablet = winW >= 768 && winW < 1200; // Increased from 1024

    const isLogin = location.pathname === "/login";
    
    // Defensive auth check to avoid TDZ (Temporal Dead Zone) in minified builds
    const [authed, setAuthed] = useState(() => !!localStorage.getItem('segecha_admin_token'));
    
    useEffect(() => {
        // Sync auth state if needed, though direct storage check is usually enough
        const check = !!localStorage.getItem('segecha_admin_token');
        if (check !== authed) setAuthed(check);
    }, [location.pathname]);

    const previewLabel = useMemo(() => {
        const pm = state.previewMode;
        if (!pm) return "";
        if (pm.role === "driver") {
            return state.data.drivers?.find((d) => d.id === pm.entityId)?.name || pm.entityId;
        }
        return state.data.staff?.find((s) => s.id === pm.entityId)?.name || pm.entityId;
    }, [state.previewMode, state.data.drivers, state.data.staff]);

    useEffect(() => {
        if (!state.previewMode) return;
        if (state.previewMode.role === "driver" && !state.data.drivers?.some((d) => d.id === state.previewMode.entityId)) {
            state.clearPreviewMode();
            state.showToast("Driver preview ended (record removed).", "warning");
            navigate("/", { replace: true });
            return;
        }
        if (state.previewMode.role === "staff" && !state.data.staff?.some((s) => s.id === state.previewMode.entityId)) {
            state.clearPreviewMode();
            state.showToast("Staff preview ended (record removed).", "warning");
            navigate("/", { replace: true });
        }
    }, [state.previewMode, state.data.drivers, state.data.staff, state.clearPreviewMode, state.showToast, navigate]);

    useEffect(() => {
        if (!state.previewMode) return;
        if (!isPathAllowedInPreview(state.previewMode, location.pathname, state.data)) {
            navigate(defaultPreviewPath(state.previewMode), { replace: true });
        }
    }, [state.previewMode, location.pathname, state.data, navigate]);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', state.dark ? 'dark' : 'light');
    }, [state.dark]);

    // Inject SheetJS for Excel import
    useEffect(() => {
        if (window.XLSX) return;
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => console.log('SheetJS loaded');
        document.head.appendChild(script);
    }, []);

    // Apply branding (Favicon)
    useEffect(() => {
        const settings = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        if (settings.companyFavicon) {
            const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = settings.companyFavicon;
            document.getElementsByTagName('head')[0].appendChild(link);
        }
    }, [location.pathname]); // Update on navigation or when settings might have changed

    // Auto-Logout / Idle Timer
    useEffect(() => {
        if (!authed) return;

        const settings = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        const autoLogoutEnabled = settings.autoLogoutEnabled !== false; // Default ON
        const idleLimit = (settings.autoLogoutMinutes || 30) * 60 * 1000;

        if (!autoLogoutEnabled) return;

        let idleTimer;

        const resetTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                console.log("[IDLE] Session expired due to inactivity.");
                adminAuth.clearSession();
                state.showToast("Logged out due to inactivity for security.", "warning");
                // Use window.location instead of navigate to ensure a clean state
                window.location.href = "/login";
            }, idleLimit);
        };

        const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
        events.forEach(name => document.addEventListener(name, resetTimer, true));
        
        resetTimer(); // Start initial timer

        return () => {
            if (idleTimer) clearTimeout(idleTimer);
            events.forEach(name => document.removeEventListener(name, resetTimer, true));
        };
    }, [authed, state.showToast]);

    const tyreAlertCount = state.data.trucks.filter(t => state.tyreStatus(t).status !== "OK").length;
    const verifyAlertCount = (state.pendingVerifications || []).length;

    const T = getTheme(state.dark);
    const S = getStyles(T);

    // Simplified common props
    const p = {
        ...state,
        isMobile,
        isTablet,
        sideCollapsed: state.sideCollapsed,
        setSideCollapsed: state.setSideCollapsed,
        tyreAlertCount,
        verifyAlertCount,
        adminAuth,
        S,
        T
    };

    const layoutStyle = {
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg-main)",
        color: "var(--text-secondary)",
        transition: "background-color 0.3s ease",
    };

    const mainStyle = {
        flex: 1,
        padding: !authed ? "0" : (isMobile ? "16px" : "32px"),
        marginTop: !authed ? "0" : (state.previewMode ? "calc(var(--topbar-height) + 40px)" : "var(--topbar-height)"),
        marginLeft: (!authed || isMobile || state.previewMode) ? 0 : (state.sideCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)"),
        minWidth: 0,
        overflowX: "auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "margin-left 0.25s ease",
    };


    if (isLogin && !authed) {
        return (
            <div id="app-shell" style={layoutStyle}>
                <main style={{ ...mainStyle, padding: 0, marginTop: 0 }}>
                    <Routes>
                        <Route path="/login" element={<Login adminAuth={adminAuth} showToast={state.showToast} />} />
                    </Routes>
                </main>
                <ToastContainer toasts={state.toasts} />
            </div>
        );
    }

    return (
        <div id="app-shell" style={layoutStyle}>
            <div id="waybill-print-root" style={{ display: "none" }} aria-hidden="true" />
            {isMobile && state.sideOpen && (
                <div 
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 89 }} 
                    onClick={() => state.setSideOpen(false)} 
                />
            )}
            
            {authed && <Topbar {...p} />}
            <PreviewModeBanner
                previewMode={state.previewMode}
                label={previewLabel}
                driverPortalUrl={DRIVER_PORTAL_URL}
                className={isMobile ? "" : (state.sideCollapsed ? "with-sidebar-offset-collapsed" : "with-sidebar-offset")}
                onExit={() => {
                    state.clearPreviewMode();
                    navigate("/", { replace: true });
                    state.showToast("Preview closed", "success");
                }}
            />

            <div style={{ display: "flex", flex: 1, position: "relative" }}>
                {authed && !state.previewMode && <Sidebar {...p} />}
                
                <main style={mainStyle} className="animate-fade-in">
                    <Routes>
                        <Route path="/login" element={<Login adminAuth={adminAuth} showToast={state.showToast} />} />
                        <Route path="*" element={
                            authed ? (
                                <Suspense fallback={<div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%', color: 'var(--text-dim)' }}>Loading...</div>}>
                                    <Routes>
                                        <Route path="/" element={<ErrorBoundary><Dashboard {...p} /></ErrorBoundary>} />
                                        <Route path="/fleet" element={<ErrorBoundary><Fleet {...p} /></ErrorBoundary>} />
                                        <Route path="/fleet/:id" element={<ErrorBoundary><VehicleProfile {...p} /></ErrorBoundary>} />
                                        <Route path="/drivers" element={<ErrorBoundary><Drivers {...p} /></ErrorBoundary>} />
                                        <Route path="/drivers/:id" element={<ErrorBoundary><DriverProfile {...p} /></ErrorBoundary>} />
                                        <Route path="/customers" element={<ErrorBoundary><Customers {...p} /></ErrorBoundary>} />
                                        <Route path="/customers/:id" element={<ErrorBoundary><CustomerProfile {...p} /></ErrorBoundary>} />
                                        <Route path="/journeys" element={<ErrorBoundary><Journeys {...p} /></ErrorBoundary>} />
                                        <Route path="/journeys/:id" element={<ErrorBoundary><JourneyProfile {...p} /></ErrorBoundary>} />
                                        <Route path="/fuel" element={<ErrorBoundary><FuelLog {...p} /></ErrorBoundary>} />
                                        <Route path="/expenses" element={<ErrorBoundary><Expenses {...p} /></ErrorBoundary>} />
                                        <Route path="/incidents" element={<ErrorBoundary><Incidents {...p} /></ErrorBoundary>} />
                                        <Route path="/mpesa-logs" element={<ErrorBoundary><MpesaTransactions {...p} /></ErrorBoundary>} />
                                        <Route path="/invoices" element={<ErrorBoundary><Invoices {...p} /></ErrorBoundary>} />
                                        <Route path="/payroll" element={<ErrorBoundary><Payroll {...p} /></ErrorBoundary>} />
                                        <Route path="/maintenance" element={<ErrorBoundary><Maintenance {...p} /></ErrorBoundary>} />
                                        <Route path="/tyres" element={<ErrorBoundary><TyreMonitor {...p} /></ErrorBoundary>} />
                                        <Route path="/staff" element={<ErrorBoundary><Staff {...p} /></ErrorBoundary>} />
                                        <Route path="/staff/:id" element={<ErrorBoundary><StaffProfile {...p} /></ErrorBoundary>} />
                                        <Route path="/pnl" element={<ErrorBoundary><PnL {...p} /></ErrorBoundary>} />
                                        <Route path="/documents" element={<ErrorBoundary><Documents {...p} /></ErrorBoundary>} />
                                        <Route path="/settings" element={<ErrorBoundary><Settings {...p} /></ErrorBoundary>} />
                                        <Route path="/import" element={<ErrorBoundary><ImportReview {...p} /></ErrorBoundary>} />
                                    </Routes>
                                </Suspense>
                            ) : (
                                <ErrorBoundary>
                                    <Login adminAuth={adminAuth} showToast={state.showToast} />
                                </ErrorBoundary>
                            )
                        } />
                    </Routes>
                </main>
            </div>

            <ToastContainer toasts={state.toasts} />
            <GlobalModals {...p} />
            <WaybillModal
                waybillModalJourney={state.waybillModalJourney}
                waybillForm={state.waybillForm}
                setWaybillForm={state.setWaybillForm}
                setData={state.setData}
                closeWaybillModal={state.closeWaybillModal}
                dark={state.dark}
                S={S}
                T={T}
            />
            {state.verifyModal && (
                <VerificationModal 
                    {...p}
                    journey={state.verifyModal}
                />
            )}
        </div>
    );
}
