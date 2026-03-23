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
import { DriverProfile } from "./pages/DriverProfile";
import { JourneyProfile } from "./pages/JourneyProfile";
import { Customers } from "./pages/Customers";
import { CustomerProfile } from "./pages/CustomerProfile";
import { StaffProfile } from "./pages/StaffProfile";
import { ImportReview } from "./pages/ImportReview";
import { TyreMonitor } from "./pages/TyreMonitor";
import { GlobalModals } from "./components/GlobalModals";
import { WaybillModal } from "./components/WaybillModal";
import { VerificationModal } from "./components/VerificationModal";
import { getTheme, getStyles } from "./constants/theme";
import { adminAuth } from "./utils/adminAuth";
import { Login } from "./pages/Login";

export default function App() {
    // ── Admin login gate
    const [adminAuthed, setAdminAuthed] = useState(() => {
        return localStorage.getItem('segecha_admin_authed') === 'true';
    });
    const [loginInput, setLoginInput]   = useState('');
    const [loginError, setLoginError]   = useState('');

    const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'segecha2025';

    const handleAdminLogin = () => {
        if (loginInput === ADMIN_PASSWORD) {
            localStorage.setItem('segecha_admin_authed', 'true');
            setAdminAuthed(true);
            setLoginError('');
        } else {
            setLoginError('Incorrect password. Contact your system administrator.');
            setLoginInput('');
        }
    };

    const state = useAppState();
    const location = useLocation();
    const navigate = useNavigate();
    const winW = useWindowWidth();
    const isMobile = winW < 640;
    const isTablet = winW >= 640 && winW < 1024;

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

    const tyreAlertCount = state.data.trucks.filter(t => state.tyreStatus(t).status !== "OK").length;
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

    const layoutStyle = {
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg-main)",
        color: "var(--text-secondary)",
        transition: "background-color 0.3s ease",
    };

    const mainStyle = {
        flex: 1,
        padding: !adminAuth.isAuthenticated() ? "0" : (isMobile ? "16px" : "32px"),
        marginTop: !adminAuth.isAuthenticated() ? "0" : (state.previewMode ? "calc(var(--topbar-height) + 40px)" : "var(--topbar-height)"),
        minWidth: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
    };

    const AdminLoginScreen = () => (
        <div style={{
            minHeight: '100vh',
            background: state.dark ? '#0d1117' : '#f6f8fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'DM Sans', -apple-system, sans-serif",
            padding: 20,
        }}>
            <div style={{
                background: state.dark ? '#161b22' : '#ffffff',
                border: `1px solid ${state.dark ? '#30363d' : '#d0d7de'}`,
                borderRadius: 12,
                padding: '40px 36px',
                width: '100%',
                maxWidth: 380,
                boxShadow: state.dark
                    ? '0 16px 48px rgba(0,0,0,0.6)'
                    : '0 16px 48px rgba(0,0,0,0.1)',
            }}>
                {/* Logo / brand */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    {(() => {
                        const logo = localStorage.getItem('segecha_logo');
                        const name = (() => {
                            try {
                                return JSON.parse(localStorage.getItem('segecha_settings') || '{}')
                                    .companyName || 'Segecha Group';
                            } catch { return 'Segecha Group'; }
                        })();
                        return logo
                            ? <img src={logo} alt={name}
                                style={{ height: 48, maxWidth: 180,
                                    objectFit: 'contain', marginBottom: 12 }} />
                            : <div style={{
                                width: 52, height: 52, borderRadius: 12,
                                background: '#E8501A',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 22, fontWeight: 700, color: '#fff',
                                margin: '0 auto 12px',
                                fontFamily: "'Syne', sans-serif",
                              }}>
                                {name.charAt(0)}
                              </div>;
                    })()}
                    <div style={{
                        fontSize: 18, fontWeight: 700, color: state.dark ? '#e6edf3' : '#1f2328',
                        fontFamily: "'Syne', sans-serif", letterSpacing: '-0.3px',
                    }}>
                        Fleet Management
                    </div>
                    <div style={{
                        fontSize: 13, color: state.dark ? '#8b949e' : '#636c76',
                        marginTop: 4,
                    }}>
                        app.segecha.com — admin access only
                    </div>
                </div>

                {/* Form */}
                <div style={{ marginBottom: 14 }}>
                    <label style={{
                        display: 'block', fontSize: 12, fontWeight: 500,
                        color: state.dark ? '#8b949e' : '#636c76',
                        marginBottom: 6,
                    }}>
                        Admin password
                    </label>
                    <input
                        type="password"
                        placeholder="Enter password"
                        value={loginInput}
                        onChange={e => setLoginInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                        autoFocus
                        style={{
                            width: '100%', padding: '10px 14px',
                            borderRadius: 8,
                            border: `1px solid ${loginError
                                ? '#ef4444'
                                : state.dark ? '#30363d' : '#d0d7de'}`,
                            background: state.dark ? '#0d1117' : '#f6f8fa',
                            color: state.dark ? '#e6edf3' : '#1f2328',
                            fontSize: 15, outline: 'none',
                            fontFamily: "'DM Sans', sans-serif",
                            boxSizing: 'border-box',
                        }}
                    />
                    {loginError && (
                        <div style={{
                            fontSize: 12, color: '#ef4444',
                            marginTop: 6, fontWeight: 500,
                        }}>
                            {loginError}
                        </div>
                    )}
                </div>

                <button
                    onClick={handleAdminLogin}
                    style={{
                        width: '100%', padding: '11px',
                        background: '#E8501A', color: '#fff',
                        border: 'none', borderRadius: 8,
                        fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: '0.1px',
                    }}>
                    Sign in
                </button>

                <div style={{
                    marginTop: 20, textAlign: 'center',
                    fontSize: 11, color: state.dark ? '#484f58' : '#9ca3af',
                }}>
                    Segecha Group Ltd · Fleet ERP v3.0
                    <br />
                    <span style={{ color: state.dark ? '#30363d' : '#d0d7de' }}>
                        Unauthorised access is prohibited
                    </span>
                </div>
            </div>
        </div>
    );

    if (!adminAuthed) return <AdminLoginScreen />;

    return (
        <div id="app-shell" style={layoutStyle}>
            <div id="waybill-print-root" style={{ display: "none" }} aria-hidden="true" />
            {isMobile && state.sideOpen && (
                <div 
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 89 }} 
                    onClick={() => state.setSideOpen(false)} 
                />
            )}
            
            
            {adminAuth.isAuthenticated() && <Topbar {...p} setAdminAuthed={setAdminAuthed} />}
            <PreviewModeBanner
                previewMode={state.previewMode}
                label={previewLabel}
                driverPortalUrl={DRIVER_PORTAL_URL}
                className={isMobile ? "" : "with-sidebar-offset"}
                onExit={() => {
                    state.clearPreviewMode();
                    navigate("/", { replace: true });
                    state.showToast("Preview closed", "success");
                }}
            />

            <div style={{ display: "flex", flex: 1, position: "relative" }}>
                {adminAuth.isAuthenticated() && !state.previewMode && <Sidebar {...p} />}
                
                <main style={mainStyle} className="animate-fade-in">
                    <Routes>
                        <Route path="/login" element={<Login showToast={state.showToast} />} />
                        <Route path="*" element={
                            adminAuth.isAuthenticated() ? (
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
