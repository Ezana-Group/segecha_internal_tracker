import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Constants & Config
import { COLORS, S, TAB_NAV_PERM, TAB_TITLE } from './constants/theme';
import { PRIMARY_TABS } from './constants/nav';
import { API_URL as API } from './utils/api';
import { today } from './utils/formatters';

// Permission Utils
import { mergeProfilePermissions, mergeFlatPermissionOverrides } from './utils/profilePermissions';

// Pages
import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';

// Tabs
import { JourneysTab } from './components/journeys/JourneysTab';
import { SubmitTab } from './components/fuel/SubmitTab';
import { CostsTab } from './components/expenses/CostsTab';
import { MaintenanceTab } from './components/maintenance/MaintenanceTab';
import { PayslipsTab } from './components/payments/PayslipsTab';
import { MyDocsTab } from './components/documents/MyDocsTab';
import { ProfileTab } from './components/profile/ProfileTab';

export default function DriverPortal() {
    // --- Authentication & Identity ---
    const [token, setToken] = useState(() => localStorage.getItem('driver_token') || '');
    const [driverData, setDriverData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('login'); // login | forgot | reset
    const [resetToken, setResetToken] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginMethod, setLoginMethod] = useState('phone'); // phone | email
    const [tab, setTab] = useState('journeys');

    // --- Permissions & Routing ---
    const portalPerm = useMemo(() => {
        const merged = mergeProfilePermissions(driverData?.profilePermissions);
        return mergeFlatPermissionOverrides(merged.driverPortal, driverData?.driver?.permissionOverrides?.driverPortal);
    }, [driverData]);

    const visiblePrimaryTabs = useMemo(
        () => PRIMARY_TABS.filter((t) => portalPerm[TAB_NAV_PERM[t.id]] !== false),
        [portalPerm]
    );

    const canDocsTab = portalPerm.docsUploadSection !== false || portalPerm.docsList !== false || portalPerm.docsViewFile !== false;
    const canMaintTab = portalPerm.maintLogForm !== false || portalPerm.maintHistory !== false;
    const canPayslipsTab = portalPerm.payslipsIntro !== false || portalPerm.payslipsList !== false;

    useEffect(() => {
        if (!token || !driverData) return;
        const onPrimary = PRIMARY_TABS.some((t) => t.id === tab);
        const allowedPrimary = visiblePrimaryTabs.some((t) => t.id === tab);
        if (onPrimary && !allowedPrimary && visiblePrimaryTabs.length) {
            setTab(visiblePrimaryTabs[0].id);
            return;
        }
        if (tab === 'docs' && !canDocsTab && visiblePrimaryTabs.length) setTab(visiblePrimaryTabs[0].id);
        else if (tab === 'maintenance' && !canMaintTab && visiblePrimaryTabs.length) setTab(visiblePrimaryTabs[0].id);
        else if (tab === 'payslips' && !canPayslipsTab && visiblePrimaryTabs.length) setTab(visiblePrimaryTabs[0].id);
    }, [tab, token, driverData, visiblePrimaryTabs, canDocsTab, canMaintTab, canPayslipsTab]);

    // --- Data Fetching ---
    const prevDataRef = useRef(null);
    const fetchDriverData = useCallback(async (tok, isBackground = false) => {
        if (!tok) return false;
        if (!isBackground) setLoading(true);
        try {
            const res = await fetch(`${API}/api/driver/portal-data`, { headers: { Authorization: `Bearer ${tok}` } });
            if (res.status === 401) {
                setToken('');
                setDriverData(null);
                setView('login');
                setLoginError('Session expired. Please log in again.');
                localStorage.removeItem('driver_token');
                if (!isBackground) setLoading(false);
                return false;
            }
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.driver) {
                if (!isBackground) {
                    setToken('');
                    setDriverData(null);
                    setView('login');
                    setLoginError(payload?.error || 'Driver profile not found. Contact your office.');
                    localStorage.removeItem('driver_token');
                }
                if (!isBackground) setLoading(false);
                return false;
            }
            const newJson = JSON.stringify(payload);
            if (newJson !== prevDataRef.current) {
                prevDataRef.current = newJson;
                setDriverData(payload);
            }
            if (!isBackground) setLoading(false);
            return true;
        } catch {
            if (!isBackground) setLoginError('Could not connect to server. Please try again.');
            if (!isBackground) setLoading(false);
            return false;
        }
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tok = params.get('token');
        if (tok) {
            setResetToken(tok);
            setView('reset');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    useEffect(() => { 
        if (!token) return;
        let timeoutId;
        let isActive = true;
        let currentInterval = 5000;
        const maxInterval = 60000;

        const poll = async () => {
            if (!isActive) return;
            const success = await fetchDriverData(token, true);
            
            if (success) {
                currentInterval = 5000; // Reset to fast polling on success
            } else {
                currentInterval = Math.min(currentInterval * 2, maxInterval); // Exponential backoff max 60s
            }

            if (isActive && localStorage.getItem('driver_token')) {
                timeoutId = setTimeout(poll, currentInterval);
            }
        };

        fetchDriverData(token, false).then(() => {
            if (isActive && localStorage.getItem('driver_token')) {
                timeoutId = setTimeout(poll, currentInterval);
            }
        });

        return () => {
            isActive = false;
            clearTimeout(timeoutId);
        };
    }, [token, fetchDriverData]);

    // --- Actions ---
    const login = async () => {
        const errorMsg = loginMethod === 'email' ? 'Enter your email and temporary password' : 'Enter your phone number and 6-digit OTP';
        if (!identifier || !password) { setLoginError(errorMsg); return; }
        setLoginLoading(true); setLoginError('');
        try {
            const res = await fetch(`${API}/api/driver/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password, method: loginMethod }),
            });
            const data = await res.json();
            if (data.requirePasswordChange && data.setupToken) {
                setResetToken(data.setupToken);
                setView('reset');
                setLoginError('Use this step to set your new password/PIN.');
            } else if (data.token) {
                localStorage.setItem('driver_token', data.token);
                setToken(data.token);
            } else setLoginError(data.error || 'Login failed — contact your office');
        } catch { setLoginError('Could not connect to server. Try again.'); }
        setLoginLoading(false);
    };

    const forgotPassword = async () => {
        if (!identifier) { setLoginError('Enter your phone or email first'); return; }
        setLoginLoading(true); setLoginError('');
        try {
            const res = await fetch(`${API}/api/driver/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier }),
            });
            const data = await res.json();
            setLoginError(data.message);
            if (res.ok) setView('login');
        } catch { setLoginError('Could not connect to server'); }
        setLoginLoading(false);
    };

    const logout = () => { localStorage.removeItem('driver_token'); setToken(''); setDriverData(null); };

    const apiPost = async (url, body) => {
        const res = await fetch(`${API}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        return res.json();
    };

    // --- Tab Rendering Helpers ---
    const {
        driver = null,
        truck = null,
        tyreInfo = null,
        activeJourneys = [],
        completedJourneys = [],
        fuelEntries = [],
        expenses = [],
        payslips = null,
        maintenanceHistory = [],
        customers: customerDirectory = [],
    } = driverData || {};

    const tabProps = {
        token, driver, truck, tyreInfo, activeJourneys, completedJourneys,
        fuelEntries, expenses, payslips, maintenanceHistory,
        customerDirectory, portalPerm, fetchDriverData, apiPost, setTab, driverData
    };

    const renderTab = () => {
        switch(tab) {
            case 'journeys': return <JourneysTab {...tabProps} />;
            case 'submit': return <SubmitTab {...tabProps} />;
            case 'costs': return <CostsTab {...tabProps} />;
            case 'maintenance': return <MaintenanceTab {...tabProps} />;
            case 'docs': return <MyDocsTab {...tabProps} />;
            case 'payslips': return <PayslipsTab {...tabProps} />;
            case 'profile': return <ProfileTab {...tabProps} />;
            default: return <JourneysTab {...tabProps} />;
        }
    };

    // --- Main Render ---
    if (!token || !driverData) {
        if (view === 'reset') return <SetPasswordPage resetToken={resetToken} setToken={setToken} setView={setView} />;
        return (
            <LoginPage 
                view={view} setView={setView} loginError={loginError} setLoginError={setLoginError}
                loginMethod={loginMethod} setLoginMethod={setLoginMethod} identifier={identifier}
                setIdentifier={setIdentifier} password={password} setPassword={setPassword}
                loginLoading={loginLoading} login={login} forgotPassword={forgotPassword}
            />
        );
    }

    if (!driver) {
        return (
            <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>Driver profile unavailable</div>
                    <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 14 }}>Your session is active but no driver profile was returned.</div>
                    <button style={{ ...S.btn(), width: '100%' }} onClick={logout}>Back to login</button>
                </div>
            </div>
        );
    }

    const isPrimaryTab = visiblePrimaryTabs.some((t) => t.id === tab);
    const firstName = driver?.name?.split(' ')[0] || 'Driver';

    return (
        <div style={{ ...S.page, paddingBottom: isPrimaryTab ? S.page.paddingBottom : 'max(20px, env(safe-area-inset-bottom, 0px))' }}>
            <div style={S.topbar}>
                <div style={{ flex: '0 0 auto', minWidth: 120, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isPrimaryTab ? (
                        <>
                            <img src="/logo.png" alt="S" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                            <span style={{ color: COLORS.text, fontWeight: 800, fontSize: 14, letterSpacing: -0.3 }}>Segecha Group</span>
                        </>
                    ) : (
                        <button type="button" onClick={() => setTab('profile')} style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, fontSize: 13, fontWeight: 700, padding: '8px 12px', cursor: 'pointer' }}>← Back</button>
                    )}
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: COLORS.text, fontWeight: 800, fontSize: 16 }}>{TAB_TITLE[tab] || 'Driver'}</div>
                <div style={{ flex: '0 0 auto', minWidth: 72, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" title="Refresh" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.textDim, fontSize: 16, padding: '6px 10px', cursor: 'pointer' }} onClick={() => fetchDriverData(token)}>↻</button>
                    <button type="button" title="Logout" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: '#ef4444', fontSize: 13, fontWeight: 700, padding: '6px 10px', cursor: 'pointer' }} onClick={logout}>Logout</button>
                </div>
            </div>
            {loading && <div style={{ textAlign: 'center', padding: 40, color: COLORS.textFaint }}>⏳ Loading…</div>}
            {!loading && renderTab()}
            {isPrimaryTab && (
                <div style={S.tabBar}>
                    {visiblePrimaryTabs.map((t) => (
                        <button key={t.id} type="button" style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
                            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.2, textTransform: 'none', lineHeight: 1.2, textAlign: 'center' }}>{t.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
