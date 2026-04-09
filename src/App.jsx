import { useState, useEffect, useMemo } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { isPathAllowedInPreview, defaultPreviewPath } from "./constants/previewNav.js";
import { PreviewModeBanner } from "./components/PreviewModeBanner.jsx";
import { useWindowWidth } from "./hooks/useWindowWidth";
import { useAppState } from "./hooks/useAppState";
import { DRIVER_PORTAL_URL } from "./utils/env.js";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/Toast";
import { Dashboard } from "./pages/Dashboard";
import { Fleet } from "./pages/Fleet";
import { Drivers } from "./pages/Drivers";
import { Journeys } from "./pages/Journeys";
import { FuelLog } from "./pages/FuelLog";
import { Expenses } from "./pages/Expenses";
import { Invoices } from "./pages/Invoices";
import { Payroll } from "./pages/Payroll";
import { Maintenance } from "./pages/Maintenance";
import { PnL } from "./pages/PnL";
import { Settings } from "./pages/Settings";
import { Staff } from "./pages/Staff";
import { Documents } from "./pages/Documents";
import { VehicleProfile } from "./pages/VehicleProfile";
import { TrailerProfile } from "./pages/TrailerProfile";
import { DriverProfile } from "./pages/DriverProfile";
import { JourneyProfile } from "./pages/JourneyProfile";
import { Customers } from "./pages/Customers";
import { CustomerProfile } from "./pages/CustomerProfile";
import { StaffProfile } from "./pages/StaffProfile";
import { Incidents } from "./pages/Incidents";
import { ImportReview } from "./pages/ImportReview";
import { ErrorLogs } from "./pages/ErrorLogs";
import { TyreMonitor } from "./pages/TyreMonitor";
import { Assets } from "./pages/Assets";
import { GlobalModals } from "./components/GlobalModals";
import { WaybillModal } from "./components/WaybillModal";
import { VerificationModal } from "./components/VerificationModal";
import { getTheme, getStyles } from "./constants/theme";
import { adminAuth } from "./utils/adminAuth";
import { applyBrandColor } from "./utils/brandColor";
import { Login } from "./pages/Login";
import { KeyedProfile } from "./components/KeyedProfile";

export default function App() {
    const state = useAppState();
    const location = useLocation();
    const navigate = useNavigate();
    const winW = useWindowWidth();
    const isMobile = winW < 640;
    const isTablet = winW >= 640 && winW < 1024;

    const isLogin = location.pathname === "/login";
    const authed = adminAuth.isAuthenticated();

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

    // Restore saved accent colour on startup (and whenever settings change)
    useEffect(() => {
        const settings = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        if (settings.accentColor) applyBrandColor(settings.accentColor);
    }, []);  // runs once on mount

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
            link.rel = 'icon';
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

    const tyreAlertCount = (state.data.trucks ?? []).filter(t => state.tyreStatus(t).status !== "OK").length;
    const verifyAlertCount = (state.pendingVerifications || []).length;

    const T = getTheme(state.dark);
    const S = getStyles(T);

    // Simplified common props
    const p = {
        ...state,
        isMobile,
        isTablet,
        tyreAlertCount,
        verifyAlertCount,
        S,
        T
    };

    if (isLogin && !authed) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-main)" }}>
                <Routes>
                    <Route path="/login" element={<Login showToast={state.showToast} />} />
                </Routes>
                <ToastContainer toasts={state.toasts} />
            </div>
        );
    }

    // Reliable flex layout: sidebar | right-column (topbar + main)
    // PreviewModeBanner and ToastContainer are fixed/absolute — never grid items.
    return (
        <div
            id="app-shell"
            style={{
                display: "flex",
                minHeight: "100vh",
                background: "var(--bg-main)",
                color: "var(--text-secondary)",
                transition: "background-color 0.3s ease",
            }}
        >
            <div id="waybill-print-root" style={{ display: "none" }} aria-hidden="true" />

            {/* Mobile overlay when sidebar is open */}
            {isMobile && state.sideOpen && (
                <div
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 89 }}
                    onClick={() => state.setSideOpen(false)}
                />
            )}

            {/* Sidebar — fixed-width left column */}
            {authed && !state.previewMode && <Sidebar {...p} />}

            {/* Right column: topbar (fixed) + scrollable main */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {authed && <Topbar {...p} />}

                <PreviewModeBanner
                    previewMode={state.previewMode}
                    label={previewLabel}
                    driverPortalUrl={DRIVER_PORTAL_URL}
                    className=""
                    onExit={() => {
                        state.clearPreviewMode();
                        navigate("/", { replace: true });
                        state.showToast("Preview closed", "success");
                    }}
                />

                <main
                    style={{
                        flex: 1,
                        marginTop: authed
                            ? (state.previewMode ? "calc(var(--topbar-height) + 40px)" : "var(--topbar-height)")
                            : 0,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                    }}
                    className="animate-fade-in"
                >
                    <Routes>
                        <Route path="/login" element={<Login showToast={state.showToast} />} />
                        <Route path="*" element={
                            authed ? (
                                <Routes>
                                    <Route path="/" element={<ErrorBoundary><Dashboard {...p} /></ErrorBoundary>} />
                                    <Route path="/fleet" element={<ErrorBoundary><Fleet {...p} /></ErrorBoundary>} />
                                    <Route path="/fleet/:id" element={<ErrorBoundary><KeyedProfile as={VehicleProfile} {...p} /></ErrorBoundary>} />
                                    <Route path="/trailers/:id" element={<ErrorBoundary><KeyedProfile as={TrailerProfile} {...p} /></ErrorBoundary>} />
                                    <Route path="/drivers" element={<ErrorBoundary><Drivers {...p} /></ErrorBoundary>} />
                                    <Route path="/drivers/:id" element={<ErrorBoundary><KeyedProfile as={DriverProfile} {...p} /></ErrorBoundary>} />
                                    <Route path="/customers" element={<ErrorBoundary><Customers {...p} /></ErrorBoundary>} />
                                    <Route path="/customers/:id" element={<ErrorBoundary><KeyedProfile as={CustomerProfile} {...p} /></ErrorBoundary>} />
                                    <Route path="/journeys" element={<ErrorBoundary><Journeys {...p} /></ErrorBoundary>} />
                                    <Route path="/journeys/:id" element={<ErrorBoundary><KeyedProfile as={JourneyProfile} {...p} /></ErrorBoundary>} />
                                    <Route path="/fuel" element={<ErrorBoundary><FuelLog {...p} /></ErrorBoundary>} />
                                    <Route path="/expenses" element={<ErrorBoundary><Expenses {...p} /></ErrorBoundary>} />
                                    <Route path="/assets" element={<ErrorBoundary><Assets {...p} /></ErrorBoundary>} />
                                    <Route path="/incidents" element={<ErrorBoundary><Incidents {...p} /></ErrorBoundary>} />
                                    <Route path="/invoices" element={<ErrorBoundary><Invoices {...p} /></ErrorBoundary>} />
                                    <Route path="/payroll" element={<ErrorBoundary><Payroll {...p} /></ErrorBoundary>} />
                                    <Route path="/maintenance" element={<ErrorBoundary><Maintenance {...p} /></ErrorBoundary>} />
                                    <Route path="/tyres" element={<ErrorBoundary><TyreMonitor {...p} /></ErrorBoundary>} />
                                    <Route path="/staff" element={<ErrorBoundary><Staff {...p} /></ErrorBoundary>} />
                                    <Route path="/staff/:id" element={<ErrorBoundary><KeyedProfile as={StaffProfile} {...p} /></ErrorBoundary>} />
                                    <Route path="/pnl" element={<ErrorBoundary><PnL {...p} /></ErrorBoundary>} />
                                    <Route path="/documents" element={<ErrorBoundary><Documents {...p} /></ErrorBoundary>} />
                                    <Route path="/settings" element={<ErrorBoundary><Settings {...p} /></ErrorBoundary>} />
                                    <Route path="/import" element={<ErrorBoundary><ImportReview {...p} /></ErrorBoundary>} />
                                    <Route path="/error-logs" element={<ErrorBoundary><ErrorLogs {...p} /></ErrorBoundary>} />
                                </Routes>
                            ) : (
                                <ErrorBoundary>
                                    <Login showToast={state.showToast} />
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
