import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    User, 
    Calendar, 
    ArrowLeft, 
    Edit2, 
    MapPin, 
    Navigation, 
    TrendingUp, 
    FileText, 
    PieChart, 
    Plus,
    Clock,
    Shield,
    Phone,
    Mail,
    CreditCard,
    DollarSign,
    Award,
    MessageSquare,
    ArrowUpRight,
    ChevronRight,
    ExternalLink,
    SlidersHorizontal,
    Settings,
    Download,
    Trash2,
    KeyRound,
    AlertCircle,
} from "lucide-react";
import { fmt, fmtDate, today } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { DocumentPanel, DOC_TYPES_DRIVER } from "../components/DocumentPanel";
import { TableRowActions } from "../components/TableRowActions";
import { CommunicationChannelMenu } from "../components/CommunicationChannelMenu";
import { readSettings } from "../utils/settingsStore.js";
import { DRIVER_PORTAL_URL } from "../utils/env.js";
import {
    mergeFlatPermissionOverrides,
    patchPermissionOverridesOnEntity,
    useMergedProfilePermissions,
} from "../utils/profilePermissions.js";
import { ProfilePermissionOverridesPanel } from "../components/ProfilePermissionOverridesPanel.jsx";
import { PAYMENT_API, ADMIN_KEY } from "../utils/env.js";

const ACTIVE_TRIP_STATUSES = ["Loading", "In Transit", "Awaiting Verification"];

const DRIVER_TAB_PERM = {
    overview: "tabOverview",
    journeys: "tabJourneys",
    performance: "tabPerformance",
    documents: "tabDocuments",
    pnl: "tabFinancials",
};

export function DriverProfile({ data, setData, dark, isMobile, truckReg, openModal, showToast, previewMode, resetAccountCredentials, deleteDriverAccount }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState('overview');
    const [finTab, setFinTab] = useState('ledger'); // 'ledger' or 'payroll'
    const mergedPerms = useMergedProfilePermissions();

    const driver = data.drivers.find(d => d.id === id);
    const isDriverPreview = previewMode?.role === "driver" && previewMode.entityId === driver?.id;
    const baseDriverTracker = mergedPerms.driverTracker;
    const d = isDriverPreview
        ? mergeFlatPermissionOverrides(baseDriverTracker, driver?.permissionOverrides?.driverTracker)
        : baseDriverTracker;

    if (!driver) return (
        <div style={{ padding: 80, textAlign: 'center' }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800 }}>Operator Profile Not Found</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>The requested driver does not exist in the active directory.</p>
            <Button variant="secondary" onClick={() => navigate('/drivers')}>Return to Directory</Button>
        </div>
    );

    const allTabs = useMemo(
        () => [
            { id: "overview", label: "Overview" },
            { id: "journeys", label: "Journeys" },
            { id: "performance", label: "Performance" },
            { id: "documents", label: "Documents" },
            { id: "pnl", label: "Financials" },
            { id: "account", label: "Account Settings", adminOnly: true },
            { id: "access", label: "Access & permissions", adminOnly: true },
        ],
        []
    );
    const tabs = useMemo(
        () =>
            allTabs.filter((t) => {
                if (t.adminOnly) return !isDriverPreview;
                if (!isDriverPreview) return true;
                return d[DRIVER_TAB_PERM[t.id]] !== false;
            }),
        [allTabs, isDriverPreview, d]
    );
    useEffect(() => {
        if (!tabs.length) return;
        if (!tabs.some((t) => t.id === tab)) setTab(tabs[0].id);
    }, [tabs, tab]);

    // ── Per-driver data
    const driverJourneys = data.journeys.filter(j => j.driver === driver.id).sort((a,b) => b.date.localeCompare(a.date));
    const driverFuel     = data.fuel.filter(f => f.driver === driver.id).sort((a,b) => b.date.localeCompare(a.date));
    const driverExpenses = data.expenses.filter(e => e.driver === driver.id);
    const driverRevenue  = driverJourneys.reduce((s, j) => s + +j.revenue, 0);
    const totalKm       = driverJourneys.reduce((s, j) => s + +j.distance, 0);
    const totalLitres   = driverFuel.reduce((s, f) => s + +f.litres, 0);
    const avgKmPerL     = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : '—';
    const driverAllowances = data.expenses.filter(e => e.cat === "Allowance" && (e.driver_id === driver.id || e.driver === driver.id || (e.journey && driverJourneys.some(j => j.id === e.journey)) || e.desc?.includes(driver.name))).reduce((s, e) => s + +e.amount, 0);
    const missingOdomJourneys = driverJourneys.filter(j => j.status === 'Completed' && (j.distance == null || String(j.distance).trim() === '' || isNaN(Number(j.distance))));
    
    // Safety score (mock based on status)
    const safetyScore   = driver.status === 'Active' ? 94 : 45;

    const assignedTrailerReg = driver.assignedTrailer
        ? (data.trailers || []).find((t) => t.id === driver.assignedTrailer)?.reg || driver.assignedTrailer
        : "—";
    const vehicleLockLabel = driver.lockVehicleAssignment
        ? "Yes — office-assigned truck & trailer"
        : "No";
    const activeTripsForCrew = driverJourneys.filter((j) => ACTIVE_TRIP_STATUSES.includes(j.status));
    const turnboySummary =
        activeTripsForCrew.length === 0
            ? "—"
            : activeTripsForCrew
                  .map((j) => {
                      const tb = j.turnboyId ? data.turnboys?.find((t) => t.id === j.turnboyId) : null;
                      const name = tb?.name || j.turnboyName || "Not set";
                      return `${j.origin}→${j.dest}: ${name}`;
                  })
                  .join(" · ");

    const [accountBusy, setAccountBusy] = useState(false);
    const [accountStatus, setAccountStatus] = useState(null);
    const [lastCreds, setLastCreds] = useState(null);
    const [showCreds, setShowCreds] = useState(false);
    const isOfflineErr = (err) => {
        const msg = String(err?.message || "");
        return msg.includes("Failed to fetch") || msg.includes("ERR_CONNECTION_REFUSED");
    };
    const showAccountErr = (err, fallback) => {
        if (isOfflineErr(err)) {
            showToast?.("Backend is offline. Please start the API server and try again.", "warning");
            return;
        }
        showToast?.(err?.message || fallback, "error");
    };
    const downloadJson = (filename, payload) => {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(href);
    };
    const copyText = async (text, successMsg) => {
        if (!text) return;
        try {
            if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
            else {
                const ta = document.createElement("textarea");
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }
            showToast?.(successMsg, "success");
        } catch {
            showToast?.("Could not copy to clipboard", "error");
        }
    };
    const mask = (v) => (v ? "•".repeat(Math.max(8, String(v).length)) : "—");
    useEffect(() => {
        if (tab !== "account" || !driver?.id || !PAYMENT_API) return;
        fetch(`${PAYMENT_API}/api/driver/account-status/${driver.id}?adminKey=${encodeURIComponent(ADMIN_KEY)}`)
            .then((r) => r.json())
            .then((j) => setAccountStatus(j))
            .catch((err) => showAccountErr(err, "Could not load account status"));
    }, [tab, driver?.id]);

    const regenerateCredentials = async (forcePasswordReset = true) => {
        try {
            setAccountBusy(true);
            const j = await resetAccountCredentials("driver", driver, forcePasswordReset);
            setLastCreds({ otp: j.otp, tempPassword: j.tempPassword, at: new Date().toISOString() });
            showToast?.("New OTP and temporary password generated.", "success");
            setAccountStatus((prev) => ({ ...(prev || {}), requiresPasswordChange: true, hasOtp: true, hasTempPassword: true }));
        } catch (err) {
            showAccountErr(err, "Failed to regenerate credentials");
        } finally {
            setAccountBusy(false);
        }
    };

    const exportAccount = async () => {
        try {
            setAccountBusy(true);
            const res = await fetch(`${PAYMENT_API}/api/driver/account-export/${driver.id}?adminKey=${encodeURIComponent(ADMIN_KEY)}`);
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            downloadJson(`${driver.name.replace(/\s+/g, "_")}_account_export.json`, j);
            showToast?.("Account export downloaded.", "success");
        } catch (err) {
            showAccountErr(err, "Failed to export account");
        } finally {
            setAccountBusy(false);
        }
    };

    const deleteAccount = async () => {
        if (!window.confirm(`Delete ${driver.name}'s full account and related records? This cannot be undone.`)) return;
        try {
            setAccountBusy(true);
            await deleteDriverAccount(driver.id);
            showToast?.("Driver account deleted.", "success");
            navigate("/drivers");
        } catch (err) {
            showAccountErr(err, "Failed to delete account");
        } finally {
            setAccountBusy(false);
        }
    };

    return (
        <div className="page-shell">
            {/* Header / Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 20, marginBottom: isMobile ? 20 : 32, flexWrap: 'wrap' }}>
                <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/drivers')}>Back</Button>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--brand-primary)15", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--brand-primary)", border: "2px solid var(--brand-primary)30" }}>
                    <User size={32} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.04em" }}>{driver.name}</div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
                        ID: {driver.id.split('-')[0].toUpperCase()} · Joined {fmtDate(driver.joined)} · <Badge status={driver.status} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {(!isDriverPreview || d.headerSendMessage !== false) && (
                        <CommunicationChannelMenu
                            phone={driver.phone}
                            email={driver.email}
                            emailSubject={`${readSettings().companyName || "Segecha"} — ${driver.name}`}
                            emailBody={`Hi ${driver.name},\n\n`}
                            smsBody={`Hi ${driver.name}, message from ${readSettings().companyName || "Segecha"}.`}
                            whatsappBody={`Hi ${driver.name}, message from ${readSettings().companyName || "Segecha"}.`}
                            showToast={showToast}
                            label="Send message"
                            size="sm"
                            disabled={!driver.phone && !driver.email}
                        />
                    )}
                    {(!isDriverPreview || d.headerEditProfile !== false) && (
                        <Button variant="premium" icon={Edit2} onClick={() => openModal("driver", driver)}>
                            Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            {isDriverPreview && d.headerDriverPortalBanner !== false && (
                <div
                    style={{
                        marginBottom: isMobile ? 16 : 24,
                        padding: "16px 20px",
                        borderRadius: 16,
                        border: "1px solid var(--border-subtle)",
                        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.08))",
                    }}
                >
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)", marginBottom: 8 }}>
                        Office preview — not the driver login
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.55 }}>
                        You are still signed in as an <strong>operator</strong>. Fuel logs (with photos), expenses, delivery proof, and waybills are in the{" "}
                        <strong>Driver app</strong> at a separate address, with the driver&apos;s email and password.
                    </p>
                    <a
                        href={DRIVER_PORTAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 13,
                            fontWeight: 800,
                            color: "var(--brand-primary)",
                            textDecoration: "none",
                        }}
                    >
                        <ExternalLink size={16} strokeWidth={2.2} aria-hidden />
                        Open driver app ({DRIVER_PORTAL_URL.replace(/^https?:\/\//, "")})
                    </a>
                </div>
            )}

            {/* Navigation Tabs */}
            {tabs.length === 0 ? (
                <Card style={{ padding: 32, textAlign: "center", marginBottom: 24 }}>
                    <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>No profile sections are enabled for your account. Contact the office.</p>
                </Card>
            ) : (
            <div style={{ display: 'flex', background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 6, gap: 4, marginBottom: isMobile ? 20 : 32, overflowX: "auto", WebkitOverflowScrolling: "touch" }} className="hide-scrollbar">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        style={{
                            flex: 1,
                            padding: "10px 20px",
                            borderRadius: 10,
                            border: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.2s ease",
                            background: tab === t.id ? "var(--brand-primary)" : "transparent",
                            color: tab === t.id ? "white" : "var(--text-dim)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                        }}
                    >
                        {t.id === "access" && <SlidersHorizontal size={14} strokeWidth={2.2} aria-hidden />}
                        {t.id === "account" && <Settings size={14} strokeWidth={2.2} aria-hidden />}
                        {t.label}
                    </button>
                ))}
            </div>
            )}

            {/* Main Content Card */}
            {tabs.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }} className="animate-fade-in">
                {/* OVERVIEW */}
                {tab === 'overview' && d.tabOverview !== false && (
                    <div style={{ padding: isMobile ? 16 : 32 }}>
                        {missingOdomJourneys.length > 0 && (
                            <div style={{ padding: "12px 16px", background: "#ef444415", color: "#ef4444", borderRadius: 12, marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 13, border: "1px solid #ef444430" }}>
                                <AlertCircle size={18} />
                                <div>Distance data missing — final odometer not recorded for {missingOdomJourneys.length} completed journey(s).</div>
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 20, marginBottom: 40 }}>
                            {[
                                { l: 'Total Revenue',  v: fmt(driverRevenue),  c: '#10b981', i: TrendingUp, pk: 'kpiRevenue' },
                                { l: 'Total Distance', v: `${totalKm.toLocaleString()} km`, c: '#3b82f6', i: Navigation, pk: 'kpiDistance' },
                                { l: 'Efficiency',    v: `${avgKmPerL} km/L`, c: '#a78bfa', i: Award, pk: 'kpiEfficiency' },
                                { l: 'Safety Score',   v: `${safetyScore}%`,   c: safetyScore > 80 ? 'var(--brand-primary)' : '#f59e0b', i: Shield, pk: 'kpiSafety' },
                            ].filter((k) => !isDriverPreview || d[k.pk] !== false).map(k => (
                                <div key={k.l} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 20 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.l}</div>
                                        <k.i size={16} color="var(--text-dim)" />
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: k.c }}>{k.v}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: 32 }}>
                            {d.overviewSectionPersonnel !== false && (
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                                    <Shield size={20} color="var(--brand-primary)" />
                                    Personnel Details
                                </h3>
                                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
                                    Drivers update phone and licence in the driver portal; other fields are maintained here by the office.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 16 : 24, background: "var(--bg-surface)", padding: isMobile ? 16 : 24, borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                                    {[
                                        ['Full Legal Name', driver.name, 'overviewFieldName'],
                                        ['Phone Connection', driver.phone, 'overviewFieldPhone'],
                                        ['M-Pesa Registry', driver.mpesa, 'overviewFieldMpesa'],
                                        ['Electronic Mail', driver.email || 'None set', 'overviewFieldEmail'],
                                        ['Licence Number', driver.license, 'overviewFieldLicense'],
                                        ['Licence classes', Array.isArray(driver.class) && driver.class.length ? driver.class.join(', ') : '—', 'overviewFieldLicenceClasses'],
                                        ['Personnel Status', driver.status, 'overviewFieldStatus'],
                                        ['Current Vehicle', truckReg(driver.truck) || 'Unassigned', 'overviewFieldVehicle'],
                                        ['Assigned trailer', assignedTrailerReg, 'overviewFieldTrailer'],
                                        ['Vehicle assignment locked', vehicleLockLabel, 'overviewFieldVehicleLock'],
                                        ['Turnboy (active trips)', turnboySummary, 'overviewFieldTurnboy'],
                                    ].filter((row) => !isDriverPreview || d[row[2]] !== false).map(([l, v]) => (
                                        <div key={l}>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            )}
                            {d.commSection !== false && (
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                                    <MessageSquare size={20} color="var(--brand-primary)" />
                                    Communication
                                </h3>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                                        gap: 12,
                                        background: "var(--bg-surface)",
                                        padding: 20,
                                        borderRadius: 20,
                                        border: "1px solid var(--border-subtle)",
                                    }}
                                >
                                    {[
                                        {
                                            icon: Phone,
                                            title: "Call operator",
                                            hint: driver.phone || "No phone on file",
                                            color: "#10b981",
                                            onClick: () => driver.phone && window.open(`tel:${driver.phone}`),
                                            disabled: !driver.phone,
                                            pk: "commCall",
                                        },
                                        {
                                            icon: Mail,
                                            title: "Send dispatch email",
                                            hint: driver.email || "Add email in Edit Profile",
                                            color: "#3b82f6",
                                            onClick: () => driver.email && window.open(`mailto:${driver.email}`),
                                            disabled: !driver.email,
                                            pk: "commEmail",
                                        },
                                        {
                                            icon: CreditCard,
                                            title: "Payroll & compensation",
                                            hint: "Revenue, salary, mission ledger",
                                            color: "#f97316",
                                            onClick: () => setTab("pnl"),
                                            disabled: false,
                                            pk: "commPayroll",
                                        },
                                        {
                                            icon: FileText,
                                            title: "Personnel files",
                                            hint: "Licences, IDs, compliance docs",
                                            color: "#8b5cf6",
                                            onClick: () => setTab("documents"),
                                            disabled: false,
                                            pk: "commDocuments",
                                        },
                                    ].filter((a) => !isDriverPreview || d[a.pk] !== false).map((a) => {
                                        const Ic = a.icon;
                                        return (
                                            <button
                                                key={a.title}
                                                type="button"
                                                disabled={a.disabled}
                                                className="driver-profile-action-tile"
                                                onClick={a.onClick}
                                            >
                                                <div
                                                    style={{
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: 12,
                                                        background: `${a.color}18`,
                                                        color: a.color,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <Ic size={20} strokeWidth={2.2} aria-hidden />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>{a.title}</div>
                                                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.35 }}>{a.hint}</div>
                                                </div>
                                                <ChevronRight size={18} color="var(--text-dim)" style={{ flexShrink: 0, opacity: 0.5 }} aria-hidden />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            )}
                        </div>
                    </div>
                )}

                {/* JOURNEYS */}
                {tab === 'journeys' && d.tabJourneys !== false && (
                    <div>
                        {(d.journeysHeader !== false || (!isDriverPreview || d.journeysLogNewMission !== false)) && (
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                            {d.journeysHeader !== false && (
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Mission history</h3>
                                <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, margin: 0, maxWidth: 480 }}>
                                    Trips assigned to this operator. Log a new journey here — it opens with this driver (and default truck, if set) pre-filled.
                                </p>
                            </div>
                            )}
                            {(!isDriverPreview || d.journeysLogNewMission !== false) && (
                            <Button
                                size="sm"
                                icon={Plus}
                                onClick={() => {
                                    const assignedTruck = driver.truck ? data.trucks.find((t) => t.id === driver.truck) : null;
                                    openModal("journey", {
                                        driver: driver.id,
                                        truck: driver.truck || "",
                                        date: today(),
                                        status: "Loading",
                                        startOdom:
                                            assignedTruck != null && assignedTruck.odom != null
                                                ? String(assignedTruck.odom)
                                                : "",
                                    });
                                }}
                            >
                                Log new mission
                            </Button>
                            )}
                        </div>
                        )}
                        <div style={{ padding: 32 }}>
                            {d.journeysTable === false ? (
                                <div style={{ color: "var(--text-dim)", padding: 40, textAlign: "center", fontSize: 14, fontWeight: 500 }}>Mission list is hidden for your account.</div>
                            ) : driverJourneys.length === 0 ? <div style={{ color: "var(--text-dim)", padding: 60, textAlign: 'center', fontSize: 14, fontWeight: 500 }}>No mission history found for this operator.</div> : (
                                <div className="table-container">
                                <table className="table-modern" style={{ minWidth: 720 }}>
                                    <thead>
                                        <tr>
                                            <th className="sticky-col" title="Date">Date</th>
                                            <th title="Strategic Route">Strategic Route</th>
                                            <th title="Vehicle">Vehicle</th>
                                            <th title="Distance">Distance</th>
                                            <th title="Revenue">Revenue</th>
                                            <th className="status-col" title="Status">Status</th>
                                            <th style={{ textAlign: "right" }} title="Actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {driverJourneys.map(j => (
                                            <tr key={j.id}>
                                                <td className="sticky-col" title={fmtDate(j.date)}>{fmtDate(j.date)}</td>
                                                <td style={{ fontWeight: 800, color: "var(--text-primary)" }} title={`${j.origin} → ${j.dest}`}>{j.origin} → {j.dest}</td>
                                                <td
                                                    style={{
                                                        fontWeight: 600,
                                                        color: "var(--brand-primary)",
                                                        cursor: !isDriverPreview || d.journeysOpenVehicle !== false ? "pointer" : "default",
                                                    }}
                                                    title={truckReg(j.truck)}
                                                    onClick={() => (!isDriverPreview || d.journeysOpenVehicle !== false) && navigate(`/fleet/${j.truck}`)}
                                                >{truckReg(j.truck)}</td>
                                                <td style={{ fontWeight: 600 }} title={`${j.distance} km`}>{j.distance} km</td>
                                                <td style={{ color: "#10b981", fontWeight: 800 }} title={fmt(j.revenue)}>{fmt(j.revenue)}</td>
                                                <td className="status-col" title={j.status}><Badge status={j.status} /></td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                    <TableRowActions
                                                        ariaLabel={`Journey ${j.id}`}
                                                        items={[
                                                            ...((!isDriverPreview || d.journeysOpenJourney !== false)
                                                                ? [{
                                                                id: "details",
                                                                label: "View mission",
                                                                icon: ArrowUpRight,
                                                                onClick: () => navigate(`/journeys/${j.id}`),
                                                            }]
                                                                : []),
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PERFORMANCE */}
                {tab === 'performance' && d.tabPerformance !== false && (
                    <div>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)" }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Operational Efficiency Analysis</h3>
                        </div>
                        <div style={{ padding: 32 }}>
                            {d.performanceFuelTable === false ? (
                                <div style={{ color: "var(--text-dim)", padding: 40, textAlign: "center", fontWeight: 500 }}>Fuel performance data is hidden for your account.</div>
                            ) : driverFuel.length === 0 ? <div style={{ color: "var(--text-dim)", padding: 60, textAlign: 'center' }}>Insufficient data for efficiency profiling.</div> : (
                                <div className="table-container">
                                <table className="table-modern" style={{ minWidth: 560 }}>
                                    <thead>
                                        <tr>
                                            <th className="sticky-col" title="Date">Date</th>
                                            <th title="Vehicle">Vehicle</th>
                                            <th title="Consumption">Consumption</th>
                                            <th title="Energy Cost">Energy Cost</th>
                                            <th title="Odometer Reading">Odometer Reading</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {driverFuel.map(f => (
                                            <tr key={f.id}>
                                                <td className="sticky-col" title={fmtDate(f.date)}>{fmtDate(f.date)}</td>
                                                <td style={{ fontWeight: 700 }} title={truckReg(f.truck)}>{truckReg(f.truck)}</td>
                                                <td style={{ fontWeight: 600 }} title={`${f.litres} L`}>{f.litres} L</td>
                                                <td style={{ color: "#f97316", fontWeight: 800 }} title={fmt(f.litres * f.pricePerL)}>{fmt(f.litres * f.pricePerL)}</td>
                                                <td style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }} title={f.odom ? `${Number(f.odom).toLocaleString()} km` : 'None'}>{f.odom ? `${Number(f.odom).toLocaleString()} km` : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* DOCUMENTS */}
                {tab === 'documents' && d.tabDocuments !== false && (
                    <div style={{ padding: 32 }}>
                        <DocumentPanel 
                            entityType="driver" 
                            entityId={driver.id} 
                            entityLabel={driver.name} 
                            docTypes={DOC_TYPES_DRIVER} 
                            documents={data.documents}
                            setDocuments={(docs) => setData(d => ({ ...d, documents: typeof docs === 'function' ? docs(d.documents) : docs }))}
                            dark={dark}
                            capabilities={{
                                upload: !isDriverPreview || d.documentsUpload !== false,
                                viewList: !isDriverPreview || d.documentsViewList !== false,
                                open: !isDriverPreview || d.documentsOpen !== false,
                                delete: !isDriverPreview || d.documentsDelete !== false,
                            }}
                        />
                    </div>
                )}

                {/* FINANCIALS */}
                {tab === 'pnl' && d.tabFinancials !== false && (
                    <div style={{ padding: 32 }}>
                        {/* Sub-Navigation for Financials */}
                        <div style={{ display: 'flex', gap: 24, marginBottom: 32, borderBottom: "1px solid var(--border-subtle)" }}>
                            {['ledger', 'payroll'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFinTab(t)}
                                    style={{
                                        padding: "12px 0",
                                        background: "none",
                                        border: "none",
                                        borderBottom: finTab === t ? "2px solid var(--brand-primary)" : "2px solid transparent",
                                        color: finTab === t ? "var(--text-primary)" : "var(--text-dim)",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    {t === 'ledger' ? 'General Ledger' : 'Payroll History'}
                                </button>
                            ))}
                        </div>

                        {finTab === 'ledger' ? (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
                                    {(!isDriverPreview || d.finGrossRevenueCard !== false) && (
                                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24, boxShadow: "var(--glass-shadow)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Gross Value Generated</div>
                                            <TrendingUp size={18} color="#10b981" />
                                        </div>
                                        <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981" }}>{fmt(driverRevenue)}</div>
                                        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>Cumulative revenue from all missions</div>
                                    </div>
                                    )}
                                    {(!isDriverPreview || d.finBaseSalaryCard !== false) && (
                                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24, boxShadow: "var(--glass-shadow)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Base Compensation</div>
                                                <DollarSign size={18} color="#ef4444" />
                                            </div>
                                            <div style={{ fontSize: 32, fontWeight: 900, color: "#ef4444" }}>{fmt(driver.salary || 0)}</div>
                                            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>Standard monthly salary allocation</div>
                                        </div>
                                    )}
                                    {(!isDriverPreview || d.finAllowancesCard !== false) && (
                                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24, boxShadow: "var(--glass-shadow)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Accrued Allowances</div>
                                                <Award size={18} color="#f59e0b" />
                                            </div>
                                            <div style={{ fontSize: 32, fontWeight: 900, color: "#f59e0b" }}>{fmt(driverAllowances)}</div>
                                            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>Total allowances recorded from expenses</div>
                                        </div>
                                    )}
                                </div>

                                {(!isDriverPreview || d.finMissionLedger !== false) && (
                                    <>
                                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Mission Performance Ledger</h3>
                                        <div className="table-container" style={{ border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                                            <table className="table-modern" style={{ margin: 0 }}>
                                                <thead>
                                                    <tr>
                                                        <th className="sticky-col" title="Date">Date</th>
                                                        <th title="Route">Route</th>
                                                        <th title="Revenue Share">Revenue Share</th>
                                                        <th title="Mileage Allowance">Mileage Allowance</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {driverJourneys.map(j => (
                                                        <tr key={j.id}>
                                                            <td className="sticky-col" title={fmtDate(j.date)}>{fmtDate(j.date)}</td>
                                                            <td style={{ fontWeight: 700 }} title={`${j.origin} → ${j.dest}`}>{j.origin} → {j.dest}</td>
                                                            <td style={{ color: "#10b981", fontWeight: 800 }} title={fmt(j.revenue)}>{fmt(j.revenue)}</td>
                                                            <td style={{ color: "var(--brand-primary)", fontWeight: 800 }} title={fmt(j.driverMileage || 0)}>{fmt(j.driverMileage || 0)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Monthly Compensation History</h3>
                                </div>
                                <div className="table-container" style={{ border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                                    <table className="table-modern" style={{ margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th className="sticky-col" title="Payment Date">Payment Date</th>
                                                <th title="Month">Month</th>
                                                <th title="Breakdown">Breakdown</th>
                                                <th title="Net Total">Net Total</th>
                                                <th className="status-col" title="Status">Status</th>
                                                <th style={{ textAlign: "right" }} title="Actions">Actions</th>
                                            </tr>
                                        </thead>
                                        {(() => {
                                            const drvPay = (data.payroll || []).filter(p => p.driver === driver.id).sort((a,b) => b.month.localeCompare(a.month));
                                            if (drvPay.length === 0) {
                                                return (
                                                    <tbody>
                                                        <tr style={{ opacity: 0.6 }}>
                                                            <td colSpan={6} style={{ textAlign: "center", padding: 40 }}>
                                                                <Calendar size={24} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
                                                                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>No payroll history found.</div>
                                                                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Historical payments will appear here once generated.</div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                );
                                            }
                                            return (
                                                <tbody>
                                                    {drvPay.map(p => (
                                                        <tr key={p.id}>
                                                            <td className="sticky-col">{p.paidDate ? fmtDate(p.paidDate) : '—'}</td>
                                                            <td style={{ fontWeight: 800, color: "var(--text-primary)" }}>{p.month}</td>
                                                            <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                                S: {fmt(p.baseSalary || 0)} · M: {fmt(p.mileage || 0)} · A: {fmt(p.allowance || 0)}
                                                            </td>
                                                            <td style={{ fontWeight: 800, color: "var(--brand-primary)" }}>
                                                                {fmt((p.baseSalary || 0) + (p.mileage || 0) + (p.allowance || 0) - (p.deductions || 0))}
                                                            </td>
                                                            <td className="status-col"><Badge status={p.status} /></td>
                                                            <td style={{ textAlign: "right" }}>
                                                                {(!isDriverPreview || d.payEditRecord !== false) && (
                                                                    <Button size="sm" variant="ghost" icon={Edit2} onClick={() => openModal("payroll", p)}>Edit</Button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            );
                                        })()}
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === "account" && !isDriverPreview && (
                    <div style={{ padding: isMobile ? 16 : 32 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                            <Settings size={20} color="var(--brand-primary)" /> Account Settings
                        </h3>
                        <div style={{ background: "var(--bg-surface)", padding: 20, borderRadius: 16, border: "1px solid var(--border-subtle)", marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                                Login email is locked to Segecha domain: <b style={{ color: "var(--text-primary)" }}>{driver.email || "Not set"}</b>
                            </div>
                            {accountStatus && (
                                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
                                    <div>Requires password reset: <b>{accountStatus.requiresPasswordChange ? "Yes" : "No"}</b></div>
                                    <div>Active OTP: <b>{accountStatus.hasOtp ? "Yes" : "No"}</b></div>
                                    <div>Temp password active: <b>{accountStatus.hasTempPassword ? "Yes" : "No"}</b></div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                            <Button icon={KeyRound} onClick={() => regenerateCredentials(false)} disabled={accountBusy}>Create New OTP + Temp Password</Button>
                            <Button variant="secondary" icon={KeyRound} onClick={() => regenerateCredentials(true)} disabled={accountBusy}>Reset Password</Button>
                            <Button variant="ghost" icon={Download} onClick={exportAccount} disabled={accountBusy}>Download Account</Button>
                            <Button variant="danger" icon={Trash2} onClick={deleteAccount} disabled={accountBusy}>Delete Account</Button>
                        </div>
                        {lastCreds && (
                            <div style={{ background: "rgba(245, 158, 11, 0.10)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: 12, padding: 12, fontSize: 13 }}>
                                <div style={{ fontWeight: 800, marginBottom: 4 }}>Share these once with the driver</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                    <Button size="sm" variant="ghost" onClick={() => setShowCreds((v) => !v)}>
                                        {showCreds ? "Hide" : "Show"}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => copyText(lastCreds.otp, "OTP copied")}>Copy OTP</Button>
                                    <Button size="sm" variant="ghost" onClick={() => copyText(lastCreds.tempPassword, "Temporary password copied")}>Copy Temp Password</Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            copyText(`OTP: ${lastCreds.otp}\nTemporary password: ${lastCreds.tempPassword}`, "Credentials copied")
                                        }
                                    >
                                        Copy Both
                                    </Button>
                                </div>
                                <div>OTP: <b>{showCreds ? lastCreds.otp : mask(lastCreds.otp)}</b></div>
                                <div>Temporary password: <b>{showCreds ? lastCreds.tempPassword : mask(lastCreds.tempPassword)}</b></div>
                            </div>
                        )}
                    </div>
                )}

                {tab === "access" && !isDriverPreview && (
                    <div style={{ padding: isMobile ? 16 : 32 }}>
                        <h3
                            style={{
                                fontSize: 18,
                                fontWeight: 800,
                                color: "var(--text-primary)",
                                marginBottom: 10,
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <SlidersHorizontal size={20} color="var(--brand-primary)" />
                            Access & permissions for this driver
                        </h3>
                        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.55, maxWidth: 720 }}>
                            These overrides apply when this person uses <strong>preview as driver</strong> in the tracker, the <strong>My trips</strong> page, and the{" "}
                            <strong>driver app</strong> (after you push data to the API). Office defaults live under Settings → Profile permissions.
                        </p>
                        <div
                            style={{
                                background: "var(--bg-surface)",
                                padding: 24,
                                borderRadius: 16,
                                border: "1px solid var(--border-subtle)",
                            }}
                        >
                            <ProfilePermissionOverridesPanel
                                namespace="driverTracker"
                                mergedGlobalFlat={mergedPerms.driverTracker}
                                delta={driver.permissionOverrides?.driverTracker}
                                onDeltaChange={(newDelta) =>
                                    setData((prev) => ({
                                        ...prev,
                                        drivers: prev.drivers.map((x) =>
                                            x.id === driver.id ? patchPermissionOverridesOnEntity(x, "driverTracker", newDelta) : x
                                        ),
                                    }))
                                }
                            />
                            <ProfilePermissionOverridesPanel
                                showTopDivider
                                namespace="driverPreviewJourneys"
                                mergedGlobalFlat={mergedPerms.driverPreviewJourneys}
                                delta={driver.permissionOverrides?.driverPreviewJourneys}
                                onDeltaChange={(newDelta) =>
                                    setData((prev) => ({
                                        ...prev,
                                        drivers: prev.drivers.map((x) =>
                                            x.id === driver.id ? patchPermissionOverridesOnEntity(x, "driverPreviewJourneys", newDelta) : x
                                        ),
                                    }))
                                }
                            />
                            <ProfilePermissionOverridesPanel
                                showTopDivider
                                namespace="driverPortal"
                                mergedGlobalFlat={mergedPerms.driverPortal}
                                delta={driver.permissionOverrides?.driverPortal}
                                onDeltaChange={(newDelta) =>
                                    setData((prev) => ({
                                        ...prev,
                                        drivers: prev.drivers.map((x) =>
                                            x.id === driver.id ? patchPermissionOverridesOnEntity(x, "driverPortal", newDelta) : x
                                        ),
                                    }))
                                }
                            />
                        </div>
                    </div>
                )}
            </Card>
            )}
        </div>
    );
}
