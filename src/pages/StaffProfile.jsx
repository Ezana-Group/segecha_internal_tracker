import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    User,
    ArrowLeft,
    Edit2,
    Shield,
    Plus,
    Phone,
    CreditCard,
    DollarSign,
    FileText,
    Key,
    Calendar,
    Settings as SettingsIcon,
    Lock,
    AlertCircle,
    Users,
    Search as SearchIcon,
    Eye,
    EyeOff,
    MessageSquare,
    Download,
    Trash2,
} from "lucide-react";
import { fmt, fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { adminAuth } from "../utils/adminAuth";
import { PAYMENT_API } from "../utils/env";

import { Button } from "../components/Button";
import { DocumentPanel } from "../components/DocumentPanel";
import { ProfileQuickActionTile } from "../components/ProfileQuickActionTile";
import { CommunicationChannelMenu } from "../components/CommunicationChannelMenu";
import { readSettings, patchSettings, subscribeSettings } from "../utils/settingsStore.js";
import { PAYMENT_API, ADMIN_KEY } from "../utils/env.js";
import {
    mergeFlatPermissionOverrides,
    patchPermissionOverridesOnEntity,
    useMergedProfilePermissions,
} from "../utils/profilePermissions.js";
import { ProfilePermissionOverridesPanel } from "../components/ProfilePermissionOverridesPanel.jsx";

const DOC_TYPES_STAFF = [
    { value: "id_copy", label: "National ID / Passport" },
    { value: "resume", label: "Resume / CV" },
    { value: "contract", label: "Employment Contract" },
    { value: "kra_pin", label: "KRA PIN Certificate" },
    { value: "nssf", label: "NSSF Card" },
    { value: "nhif", label: "NHIF Card" },
    { value: "other", label: "Other Document" },
];

const TAB_PERM = {
    overview: "tabOverview",
    account: "tabAccessSettings",
    settings: "tabAccessSettings",
    documents: "tabDocuments",
    pay: "tabPayHistory",
};

export function StaffProfile({ data, setData, dark, isMobile, openModal, showToast, previewMode }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState("overview");
    const [finTab, setFinTab] = useState("overview"); // "overview" or "payroll"
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
    const mergedPerms = useMergedProfilePermissions();

    const staff = data.staff?.find((s) => s.id === id);

    const [accessSettings, setAccessSettings] = useState(() => readSettings());
    useEffect(() => {
        return subscribeSettings(setAccessSettings);
    }, []);

    const normalizeEmail = (v) => String(v || "").trim().toLowerCase();
    const operatorEmail = normalizeEmail(accessSettings.operatorWorkEmail || accessSettings.email || "");

    const configuredAdminUsers = Array.isArray(accessSettings.adminUsers) ? accessSettings.adminUsers : [];
    const configuredSuperAdminUsers = Array.isArray(accessSettings.superAdminUsers) ? accessSettings.superAdminUsers : [];
    const hasConfiguredAccessLists = configuredAdminUsers.length > 0 || configuredSuperAdminUsers.length > 0;

    const isSuperAdmin = operatorEmail && configuredSuperAdminUsers.some((u) => normalizeEmail(u?.email) === operatorEmail);
    const isAdmin = isSuperAdmin || (operatorEmail && configuredAdminUsers.some((u) => normalizeEmail(u?.email) === operatorEmail));

    // Bootstrap mode (no access lists configured yet): allow the operator to perform the first setup.
    const actorEffectiveSuperAdmin = !hasConfiguredAccessLists || isSuperAdmin;
    const actorIsAdminNonSuper = isAdmin && !isSuperAdmin;

    const targetEmail = normalizeEmail(staff?.email || "");
    const isTargetAdmin = targetEmail && configuredAdminUsers.some((u) => normalizeEmail(u?.email) === targetEmail);
    const isTargetSuperAdmin = targetEmail && configuredSuperAdminUsers.some((u) => normalizeEmail(u?.email) === targetEmail);

    const isStaffSelfView = previewMode?.role === "staff" && previewMode?.entityId === staff?.id;
    const baseStaffTracker = mergedPerms.staffTracker;
    const s = isStaffSelfView
        ? mergeFlatPermissionOverrides(baseStaffTracker, staff?.permissionOverrides?.staffTracker)
        : baseStaffTracker;

    const allTabs = useMemo(
        () => [
            { id: "overview", label: "Profile Overview" },
            { id: "account", label: "Account Settings" },
            { id: "settings", label: "Access & Settings" },
            { id: "documents", label: "Documents" },
            { id: "pay", label: "Financials" },
        ],
        []
    );

    const visibleTabs = useMemo(
        () => allTabs.filter((t) => (isStaffSelfView ? s[TAB_PERM[t.id]] !== false : true)),
        [allTabs, isStaffSelfView, s]
    );

    useEffect(() => {
        if (!visibleTabs.length) return;
        if (!visibleTabs.some((t) => t.id === tab)) setTab(visibleTabs[0].id);
    }, [visibleTabs, tab]);

    // Load account credentials status only when the account tab is visible.
    // Note: this hook must be registered before any early return.
    useEffect(() => {
        if (tab !== "account" || !staff?.id || !PAYMENT_API) return;
        fetch(`${PAYMENT_API}/api/staff/account-status/${staff.id}?adminKey=${encodeURIComponent(ADMIN_KEY)}`)
            .then((r) => r.json())
            .then((j) => setAccountStatus(j))
            .catch((err) => showAccountErr(err, "Could not load account status"));
    }, [tab, staff?.id, showAccountErr]);

    const [confPass, setConfPass] = useState("");
    const [passBusy, setPassBusy] = useState(false);
    const [showPassForm, setShowPassForm] = useState(false);

    const currentUser = adminAuth.getUser();
    const isActuallyMe = currentUser?.id === staff?.id;

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPass !== confPass) return showToast?.("New passwords do not match", "error");
        if (newPass.length < 6) return showToast?.("Password must be at least 6 characters", "error");

        try {
            setPassBusy(true);
            const res = await fetch(`${PAYMENT_API}/api/admin/change-password`, {

                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminAuth.getToken()}`
                },
                body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Failed to update password");
            
            showToast?.("Password updated successfully!", "success");
            setOldPass("");
            setNewPass("");
            setConfPass("");
            setShowPassForm(false);
        } catch (err) {
            showToast?.(err.message, "error");
        } finally {
            setPassBusy(false);
        }
    };

    if (!staff)

        return (
            <div style={{ padding: 80, textAlign: "center" }}>
                <h2 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800 }}>Profile Not Found</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>The requested staff member does not exist in the active directory.</p>
                <Button variant="secondary" onClick={() => navigate("/staff")}>
                    Return to Directory
                </Button>
            </div>
        );

    const handleResetPassword = async () => {
        // Enforce: a super admin cannot reset their own password; only another super admin may do it.
        if (isSuperAdmin && targetEmail && operatorEmail && targetEmail === operatorEmail) {
            showToast?.("Only another Super Admin can reset a Super Admin's password.", "error");
            return;
        }
        if (!window.confirm(`Reset password for ${staff.name}? They will be required to log in with a new OTP.`)) return;
        try {
            setAccountBusy(true);
            const res = await fetch(`${PAYMENT_API}/api/staff/account/regenerate-credentials`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staffId: staff.id,
                    email: staff.email || staff.name,
                    phone: staff.phone || "",
                    forcePasswordReset: true,
                    adminKey: ADMIN_KEY,
                }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setLastCreds({ otp: j.otp, tempPassword: j.tempPassword, at: new Date().toISOString() });
            setData((prev) => ({
                ...prev,
                staff: (prev.staff || []).map((x) =>
                    x.id === staff.id
                        ? { ...x, email: j.email || x.email, phone: j.phone || x.phone, firstLogin: true, otp: j.otp, tempPassword: j.tempPassword }
                        : x
                ),
            }));
            showToast?.("New OTP and temporary password generated.", "success");
        } catch (err) {
            showAccountErr(err, "Failed to reset password");
        } finally {
            setAccountBusy(false);
        }
    };
    const handleDeleteAccount = async () => {
        if (!window.confirm(`Delete ${staff.name}'s account and payroll records? This cannot be undone.`)) return;
        try {
            setAccountBusy(true);
            const res = await fetch(`${PAYMENT_API}/api/staff/account/${staff.id}?adminKey=${encodeURIComponent(ADMIN_KEY)}`, { method: "DELETE" });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setData((prev) => ({
                ...prev,
                staff: (prev.staff || []).filter((x) => x.id !== staff.id),
                payroll: (prev.payroll || []).filter((p) => p.driver !== staff.id),
            }));
            showToast?.("Staff account deleted", "success");
            navigate("/staff");
        } catch (err) {
            showAccountErr(err, "Failed to delete account");
        } finally {
            setAccountBusy(false);
        }
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
    const exportAccount = async () => {
        try {
            setAccountBusy(true);
            const res = await fetch(`${PAYMENT_API}/api/staff/account-export/${staff.id}?adminKey=${encodeURIComponent(ADMIN_KEY)}`);
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            downloadJson(`${staff.name.replace(/\s+/g, "_")}_account_export.json`, j);
            showToast?.("Account export downloaded", "success");
        } catch (err) {
            showAccountErr(err, "Failed to export account");
        } finally {
            setAccountBusy(false);
        }
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
    const regenerateOtpAndTemp = async () => {
        // Same restriction as `handleResetPassword`: super admins can't initiate password resets for their own account.
        if (isSuperAdmin && targetEmail && operatorEmail && targetEmail === operatorEmail) {
            showToast?.("Only another Super Admin can reset a Super Admin's password.", "error");
            return;
        }
        try {
            setAccountBusy(true);
            const res = await fetch(`${PAYMENT_API}/api/staff/account/regenerate-credentials`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staffId: staff.id,
                    email: staff.email || staff.name,
                    phone: staff.phone || "",
                    forcePasswordReset: false,
                    adminKey: ADMIN_KEY,
                }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            setLastCreds({ otp: j.otp, tempPassword: j.tempPassword, at: new Date().toISOString() });
            setData((prev) => ({
                ...prev,
                staff: (prev.staff || []).map((x) =>
                    x.id === staff.id
                        ? { ...x, email: j.email || x.email, phone: j.phone || x.phone, firstLogin: true, otp: j.otp, tempPassword: j.tempPassword }
                        : x
                ),
            }));
            showToast?.("New OTP and temporary password generated.", "success");
        } catch (err) {
            showAccountErr(err, "Failed to regenerate credentials");
        } finally {
            setAccountBusy(false);
        }
    };

    const updateAccessLists = (patch) => {
        patchSettings(patch);
    };

    const addAdminAccess = () => {
        if (!actorEffectiveSuperAdmin) return;
        if (!targetEmail) return showToast?.("Target employee email not found.", "warning");
        if (isTargetAdmin) return;
        const next = [...configuredAdminUsers, { name: staff.name, email: targetEmail }];
        updateAccessLists({ adminUsers: next });
        showToast?.("Admin access granted.", "success");
    };

    const promoteToSuperAdmin = () => {
        if (!actorEffectiveSuperAdmin) return;
        if (!targetEmail) return showToast?.("Target employee email not found.", "warning");
        if (!isTargetAdmin || isTargetSuperAdmin) {
            showToast?.("Only an existing Admin can be promoted to Super Admin.", "warning");
            return;
        }
        const exists = configuredSuperAdminUsers.some((u) => normalizeEmail(u?.email) === targetEmail);
        if (exists) return;
        const next = [...configuredSuperAdminUsers, { name: staff.name, email: targetEmail }];
        updateAccessLists({ superAdminUsers: next });
        showToast?.("Promoted to Super Admin.", "success");
    };

    const removeSuperAdmin = () => {
        if (!actorEffectiveSuperAdmin) return;
        if (!isTargetSuperAdmin) return;
        updateAccessLists({ superAdminUsers: configuredSuperAdminUsers.filter((u) => normalizeEmail(u?.email) !== targetEmail) });
        showToast?.("Super Admin access removed.", "success");
    };

    const removeAdmin = () => {
        if (!actorEffectiveSuperAdmin) return;
        if (!isTargetAdmin) return;
        updateAccessLists({ adminUsers: configuredAdminUsers.filter((u) => normalizeEmail(u?.email) !== targetEmail) });
        showToast?.("Admin access removed.", "success");
    };
    const getRoleColor = (role) => {
        if (role === "Driver") return "#f97316";
        if (role === "Turnboy") return "#8b5cf6";
        if (role === "Office Admin") return "#3b82f6";
        if (role === "Fleet Manager") return "#10b981";
        return "var(--text-dim)";
    };

    const personnelRows = [
        ["Full Legal Name", staff.name, "overviewFieldName"],
        ["Role & Department", staff.role, "overviewFieldRole"],
        ["Phone Connection", staff.phone, "overviewFieldPhone"],
        ["Electronic Mail", staff.email || "None set", "overviewFieldEmail"],
        ["Personnel Status", staff.status, "overviewFieldStatus"],
        ["Base Monthly Salary", `${fmt(staff.salary || 0)}/mo`, "overviewFieldSalary"],
    ].filter((row) => !isStaffSelfView || s[row[2]] !== false);

    const docCaps = {
        upload: !isStaffSelfView || s.documentsUpload !== false,
        viewList: !isStaffSelfView || s.documentsViewList !== false,
        open: !isStaffSelfView || s.documentsOpen !== false,
        delete: !isStaffSelfView || s.documentsDelete !== false,
    };

    return (
        <div className="page-shell">
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32, flexWrap: "wrap" }}>
                <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate("/staff")}>
                    Back
                </Button>
                <div
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: "var(--bg-surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: getRoleColor(staff.role),
                        border: "2px solid var(--border-subtle)",
                        boxShadow: "var(--glass-shadow)",
                    }}
                >
                    <User size={32} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.04em" }}>{staff.name}</div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
                        <span style={{ color: getRoleColor(staff.role), fontWeight: 700 }}>{staff.role}</span> · {staff.uId} · Joined {fmtDate(staff.joined)} ·{" "}
                        <Badge status={staff.status} />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {(!isStaffSelfView || s.headerSendMessage !== false) && (
                        <CommunicationChannelMenu
                            phone={staff.phone}
                            email={staff.email}
                            emailSubject={`${readSettings().companyName || "Segecha"} — ${staff.name}`}
                            emailBody={`Hi ${staff.name},\n\n`}
                            smsBody={`Hi ${staff.name}, message from ${readSettings().companyName || "Segecha"}.`}
                            whatsappBody={`Hi ${staff.name}, message from ${readSettings().companyName || "Segecha"}.`}
                            showToast={showToast}
                            label="Send message"
                            size="sm"
                        />
                    )}
                    {(!isStaffSelfView || s.headerTemplates !== false) && (
                        <Button
                            variant="secondary"
                            icon={MessageSquare}
                            onClick={() =>
                                openModal("templateSelector", {
                                    type: "staff",
                                    entityData: {
                                        staffName: staff.name,
                                        staffId: staff.uId || staff.id,
                                        firstName: (staff.name || "").trim().split(/\s+/)[0] || "",
                                        loginEmail: staff.email || "",
                                        customerPhone: staff.phone || "",
                                        otp: staff.otp || "",
                                        businessName: readSettings().companyName || "",
                                    },
                                })
                            }
                        >
                            Templates
                        </Button>
                    )}
                    {(!isStaffSelfView || s.headerEditProfile !== false) && (
                        <Button variant="premium" icon={Edit2} onClick={() => openModal("staff", staff)}>
                            Edit Profile
                        </Button>
                    )}
                </div>
            </div>

            {visibleTabs.length === 0 ? (
                <Card style={{ padding: 40, textAlign: "center" }}>
                    <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>No profile sections are enabled for your account. Contact the office.</p>
                </Card>
            ) : (
                <>
                    <div
                        style={{
                            display: "flex",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 16,
                            padding: 6,
                            gap: 4,
                            marginBottom: 32,
                            overflowX: "auto",
                        }}
                        className="hide-scrollbar"
                    >
                        {visibleTabs.map((t) => (
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
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <Card style={{ padding: 0, overflow: "hidden" }} className="animate-fade-in">
                        {tab === "overview" && s.tabOverview !== false && (
                            <div style={{ padding: 32 }}>
                                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 32 }}>
                                    {s.overviewSectionPersonnel !== false && (
                                        <div>
                                            <h3
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 800,
                                                    color: "var(--text-primary)",
                                                    marginBottom: 20,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                }}
                                            >
                                                <Shield size={20} color="var(--brand-primary)" />
                                                Personnel Details
                                            </h3>
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "1fr 1fr",
                                                    gap: 24,
                                                    background: "var(--bg-surface)",
                                                    padding: 24,
                                                    borderRadius: 20,
                                                    border: "1px solid var(--border-subtle)",
                                                }}
                                            >
                                                {personnelRows.map(([l, v]) => (
                                                    <div key={l}>
                                                        <div
                                                            style={{
                                                                fontSize: 11,
                                                                color: "var(--text-dim)",
                                                                fontWeight: 700,
                                                                textTransform: "uppercase",
                                                                marginBottom: 4,
                                                            }}
                                                        >
                                                            {l}
                                                        </div>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{v}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {s.overviewSectionQuickActions !== false && (
                                        <div>
                                            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Quick Actions</h3>
                                            <div className="profile-quick-actions">
                                                {(!isStaffSelfView || s.overviewQuickCall !== false) && (
                                                    <ProfileQuickActionTile
                                                        icon={Phone}
                                                        label="Call employee"
                                                        hint={staff.phone || "No phone on file"}
                                                        accent="#10b981"
                                                        disabled={!staff.phone}
                                                        onClick={() => staff.phone && window.open(`tel:${staff.phone}`)}
                                                    />
                                                )}
                                                {(!isStaffSelfView || s.overviewQuickMessage !== false) && (
                                                    <CommunicationChannelMenu
                                                        fullWidthTile
                                                        phone={staff.phone}
                                                        email={staff.email}
                                                        emailSubject={`${readSettings().companyName || "Segecha"} — ${staff.name}`}
                                                        emailBody={`Hi ${staff.name},\n\n`}
                                                        smsBody={`Hi ${staff.name}, message from ${readSettings().companyName || "Segecha"}.`}
                                                        whatsappBody={`Hi ${staff.name}, message from ${readSettings().companyName || "Segecha"}.`}
                                                        showToast={showToast}
                                                        label="Send message"
                                                        disabled={!staff.phone && !staff.email}
                                                    />
                                                )}
                                                {(!isStaffSelfView || s.overviewQuickDocuments !== false) && (
                                                    <ProfileQuickActionTile
                                                        icon={FileText}
                                                        label="View personnel files"
                                                        hint="IDs, contract, compliance"
                                                        accent="#8b5cf6"
                                                        onClick={() => setTab("documents")}
                                                    />
                                                )}
                                                {(!isStaffSelfView || s.overviewQuickPay !== false) && (
                                                    <ProfileQuickActionTile
                                                        icon={CreditCard}
                                                        label="View pay history"
                                                        hint="Salary and payroll records"
                                                        accent="#f97316"
                                                        onClick={() => setTab("pay")}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {tab === "account" && s.tabAccessSettings !== false && (
                            <div style={{ padding: 32 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                                    <SettingsIcon size={20} color="var(--brand-primary)" />
                                    Account Settings
                                </h3>
                                <div style={{ background: "var(--bg-surface)", padding: 24, borderRadius: 20, border: "1px solid var(--border-subtle)", maxWidth: 760 }}>
                                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
                                        Generate one-time credentials, force password reset, export account data, or delete this account.
                                    </div>

                                    {!isStaffSelfView && (
                                        <div style={{ marginBottom: 16, padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                                                <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                                                    <Shield size={16} color="var(--brand-primary)" />
                                                    Admin / Super Admin Access
                                                </div>
                                                <Badge
                                                    status={isTargetSuperAdmin ? "Active" : isTargetAdmin ? "Active" : "Inactive"}
                                                >
                                                    {isTargetSuperAdmin ? "Super Admin" : isTargetAdmin ? "Admin" : "None"}
                                                </Badge>
                                            </div>

                                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                                                {actorIsAdminNonSuper
                                                    ? "Admins can’t create or promote other Admin/Super Admin accounts. Ask a Super Admin."
                                                    : actorEffectiveSuperAdmin
                                                        ? "Use the buttons below to grant Admin access or promote an Admin to Super Admin."
                                                        : "Access changes are restricted to Super Admins."}
                                            </div>

                                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                                {actorEffectiveSuperAdmin ? (
                                                    <>
                                                        {!isTargetAdmin && !isTargetSuperAdmin && (
                                                            <Button variant="premium" onClick={addAdminAccess} disabled={!targetEmail}>
                                                                <Plus size={16} /> Make Admin
                                                            </Button>
                                                        )}
                                                        {isTargetAdmin && !isTargetSuperAdmin && (
                                                            <Button variant="premium" onClick={promoteToSuperAdmin}>
                                                                <Shield size={16} /> Promote to Super Admin
                                                            </Button>
                                                        )}
                                                        {isTargetSuperAdmin && (
                                                            <Button variant="danger" onClick={removeSuperAdmin}>
                                                                Remove Super Admin
                                                            </Button>
                                                        )}
                                                        {isTargetAdmin && !isTargetSuperAdmin && (
                                                            <Button variant="danger" onClick={removeAdmin}>
                                                                Remove Admin
                                                            </Button>
                                                        )}
                                                        {isTargetSuperAdmin && isTargetAdmin && (
                                                            <Button variant="danger" onClick={removeAdmin}>
                                                                Remove Admin
                                                            </Button>
                                                        )}
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}

                                    {accountStatus && (
                                        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 12 }}>
                                            <div>Requires password reset: <b>{accountStatus.requiresPasswordChange ? "Yes" : "No"}</b></div>
                                            <div>Active OTP: <b>{accountStatus.hasOtp ? "Yes" : "No"}</b></div>
                                            <div>Temp password active: <b>{accountStatus.hasTempPassword ? "Yes" : "No"}</b></div>
                                        </div>
                                    )}
                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                                        {isActuallyMe && (
                                            <Button variant="premium" icon={Lock} onClick={() => setShowPassForm(!showPassForm)}>
                                                {showPassForm ? "Cancel Change" : "Change My Password"}
                                            </Button>
                                        )}
                                        <Button variant="secondary" icon={Key} onClick={regenerateOtpAndTemp} disabled={accountBusy}>Create New OTP + Temp Password</Button>
                                        <Button variant="secondary" icon={Key} onClick={handleResetPassword} disabled={accountBusy}>Reset Password</Button>
                                        <Button variant="ghost" icon={Download} onClick={exportAccount} disabled={accountBusy}>Download Account</Button>
                                        <Button variant="danger" icon={Trash2} onClick={handleDeleteAccount} disabled={accountBusy}>Delete Account</Button>
                                    </div>

                                    {showPassForm && isActuallyMe && (
                                        <form onSubmit={handleChangePassword} style={{ marginBottom: 20, padding: 20, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--brand-primary)" }} className="animate-fade-in">
                                            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: "var(--brand-primary)" }}>Update Login Password</div>
                                            <div style={{ display: "grid", gap: 16 }}>
                                                <div>
                                                    <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 700, display: "block", marginBottom: 6 }}>Current Password</label>
                                                    <input 
                                                        type="password" 
                                                        value={oldPass} 
                                                        onChange={e => setOldPass(e.target.value)}
                                                        required
                                                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-shell)", color: "var(--text-primary)" }}
                                                    />
                                                </div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                                    <div>
                                                        <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 700, display: "block", marginBottom: 6 }}>New Password</label>
                                                        <input 
                                                            type="password" 
                                                            value={newPass} 
                                                            onChange={e => setNewPass(e.target.value)}
                                                            required
                                                            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-shell)", color: "var(--text-primary)" }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 700, display: "block", marginBottom: 6 }}>Confirm New Password</label>
                                                        <input 
                                                            type="password" 
                                                            value={confPass} 
                                                            onChange={e => setConfPass(e.target.value)}
                                                            required
                                                            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-shell)", color: "var(--text-primary)" }}
                                                        />
                                                    </div>
                                                </div>
                                                <Button type="submit" variant="premium" disabled={passBusy} style={{ width: "100%" }}>
                                                    {passBusy ? "Updating..." : "Confirm Password Change"}
                                                </Button>
                                            </div>
                                        </form>
                                    )}

                                    {(lastCreds || (staff.firstLogin && (staff.otp || staff.tempPassword))) && (
                                        <div style={{ padding: 12, background: "rgba(245, 158, 11, 0.1)", borderRadius: 10, border: "1px solid rgba(245, 158, 11, 0.3)", fontSize: 13 }}>
                                            <div style={{ fontWeight: 800, marginBottom: 4 }}>Temporary credentials</div>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                                <Button size="sm" variant="ghost" onClick={() => setShowCreds((v) => !v)}>
                                                    {showCreds ? "Hide" : "Show"}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => copyText(lastCreds?.otp || staff.otp, "OTP copied")}>Copy OTP</Button>
                                                <Button size="sm" variant="ghost" onClick={() => copyText(lastCreds?.tempPassword || staff.tempPassword, "Temporary password copied")}>Copy Temp Password</Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        copyText(
                                                            `OTP: ${lastCreds?.otp || staff.otp}\nTemporary password: ${lastCreds?.tempPassword || staff.tempPassword}`,
                                                            "Credentials copied"
                                                        )
                                                    }
                                                >
                                                    Copy Both
                                                </Button>
                                            </div>
                                            {(lastCreds?.otp || staff.otp) && <div>OTP: <b>{showCreds ? (lastCreds?.otp || staff.otp) : mask(lastCreds?.otp || staff.otp)}</b></div>}
                                            {(lastCreds?.tempPassword || staff.tempPassword) && <div>Temp password: <b>{showCreds ? (lastCreds?.tempPassword || staff.tempPassword) : mask(lastCreds?.tempPassword || staff.tempPassword)}</b></div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {tab === "settings" && s.tabAccessSettings !== false && (
                            <div style={{ padding: 32 }}>
                                <h3
                                    style={{
                                        fontSize: 18,
                                        fontWeight: 800,
                                        color: "var(--text-primary)",
                                        marginBottom: 20,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    <SettingsIcon size={20} color="var(--brand-primary)" />
                                    Account & Access Settings
                                </h3>
                                <div style={{ background: "var(--bg-surface)", padding: 24, borderRadius: 20, border: "1px solid var(--border-subtle)", maxWidth: 600 }}>
                                    <div style={{ marginBottom: 32 }}>
                                        {(!isStaffSelfView || s.accessPasswordReset !== false) && (
                                            <>
                                                <div
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: 800,
                                                        color: "var(--text-primary)",
                                                        marginBottom: 8,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <Lock size={16} /> Password & Security
                                                </div>
                                                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                                                    Reset this employee&apos;s password. They will be logged out of active sessions and required to set a new password using a temporary OTP.
                                                </div>
                                                <Button variant="secondary" icon={Key} onClick={handleResetPassword}>
                                                    Force Password Reset
                                                </Button>
                                            </>
                                        )}
                                        {(!isStaffSelfView || s.accessShowPendingOtp !== false) && staff.firstLogin && staff.otp && (
                                            <div
                                                style={{
                                                    marginTop: 16,
                                                    padding: "12px 16px",
                                                    background: "rgba(245, 158, 11, 0.1)",
                                                    borderRadius: 10,
                                                    border: "1px solid rgba(245, 158, 11, 0.2)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                }}
                                            >
                                                <Shield size={16} color="#f59e0b" />
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b" }}>Pending Initial Setup</div>
                                                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                                                        Temporary OTP is <b style={{ color: "var(--text-primary)" }}>{staff.otp}</b>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {(!isStaffSelfView || s.accessRoleBlurb !== false || s.accessEditCoreProfile !== false) && (
                                        <>
                                            <hr style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "none", marginBottom: 32 }} />
                                            <div>
                                                {(!isStaffSelfView || s.accessRoleBlurb !== false) && (
                                                    <>
                                                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Role & Permissions</div>
                                                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                                                            Current assigned role is <b>{staff.role}</b>. To change their role or deactivate their account entirely, edit their core profile.
                                                        </div>
                                                    </>
                                                )}
                                                {(!isStaffSelfView || s.accessEditCoreProfile !== false) && (
                                                    <Button variant="ghost" icon={Edit2} onClick={() => openModal("staff", staff)}>
                                                        Edit Core Profile
                                                    </Button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {!isStaffSelfView && (
                                    <div
                                        style={{
                                            background: "var(--bg-surface)",
                                            padding: 24,
                                            borderRadius: 20,
                                            border: "1px solid var(--border-subtle)",
                                            maxWidth: 920,
                                            marginTop: 24,
                                        }}
                                    >
                                        <h4
                                            style={{
                                                fontSize: 15,
                                                fontWeight: 800,
                                                color: "var(--text-primary)",
                                                margin: "0 0 8px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <Shield size={16} color="var(--brand-primary)" />
                                            Per-person access (staff preview)
                                        </h4>
                                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.5, maxWidth: 720 }}>
                                            Override office defaults from Settings → Profile permissions for this employee only. Unchecked items inherit the
                                            workspace setting; toggles here only store differences.
                                        </p>
                                        <ProfilePermissionOverridesPanel
                                            namespace="staffTracker"
                                            mergedGlobalFlat={mergedPerms.staffTracker}
                                            delta={staff.permissionOverrides?.staffTracker}
                                            onDeltaChange={(newDelta) =>
                                                setData((prev) => ({
                                                    ...prev,
                                                    staff: prev.staff.map((x) =>
                                                        x.id === staff.id ? patchPermissionOverridesOnEntity(x, "staffTracker", newDelta) : x
                                                    ),
                                                }))
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === "documents" && s.tabDocuments !== false && (
                            <div style={{ padding: 32 }}>
                                <DocumentPanel
                                    entityType="staff"
                                    entityId={staff.id}
                                    entityLabel={staff.name}
                                    docTypes={DOC_TYPES_STAFF}
                                    documents={data.documents}
                                    setDocuments={(docs) =>
                                        setData((d) => ({ ...d, documents: typeof docs === "function" ? docs(d.documents) : docs }))
                                    }
                                    dark={dark}
                                    capabilities={docCaps}
                                />
                            </div>
                        )}

                        {tab === "pay" && s.tabPayHistory !== false && (
                            <div style={{ padding: 32 }}>
                                {/* Sub-Navigation for Financials */}
                                <div style={{ display: 'flex', gap: 24, marginBottom: 32, borderBottom: "1px solid var(--border-subtle)" }}>
                                    {['overview', 'payroll'].map(t => (
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
                                            {t === 'overview' ? 'General Overview' : 'Payroll History'}
                                        </button>
                                    ))}
                                </div>

                                {finTab === 'overview' ? (
                                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24, marginBottom: 40 }}>
                                        {(!isStaffSelfView || s.payBaseCompensationCard !== false) && (
                                            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24, boxShadow: "var(--glass-shadow)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            color: "var(--text-muted)",
                                                            fontWeight: 800,
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                        }}
                                                    >
                                                        Base Compensation
                                                    </div>
                                                    <DollarSign size={18} color="#10b981" />
                                                </div>
                                                <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981" }}>{fmt(staff.salary || 0)}</div>
                                                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 8 }}>Standard monthly salary allocation</div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {(!isStaffSelfView || s.payPayrollTable !== false || s.payDownloadPayslips !== false) && (
                                            <>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Recent Payroll Allocations</h3>
                                                    {(!isStaffSelfView || s.payDownloadPayslips !== false) && (
                                                        <Button size="sm" variant="ghost" disabled>
                                                            Download Payslips
                                                        </Button>
                                                    )}
                                                </div>

                                                {(!isStaffSelfView || s.payPayrollTable !== false) && (
                                                    <div className="table-container" style={{ border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                                                        <table className="table-modern" style={{ margin: 0 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th className="sticky-col" title="Date Processed">Date Processed</th>
                                                                    <th title="Period">Period</th>
                                                                    <th title="Type">Type</th>
                                                                    <th title="Amount">Amount</th>
                                                                    <th className="status-col" title="Status">Status</th>
                                                                    <th style={{ textAlign: "right" }} title="Actions">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            {(() => {
                                                                const myPay = (data.payroll || []).filter(p => p.driver === staff.id).sort((a,b) => b.month.localeCompare(a.month));
                                                                if (myPay.length === 0) {
                                                                    return (
                                                                        <tbody>
                                                                            <tr style={{ opacity: 0.6 }}>
                                                                                <td colSpan={6} style={{ textAlign: "center", padding: 40 }}>
                                                                                    <Calendar size={24} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
                                                                                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>No payroll history generated yet.</div>
                                                                                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Past payslips and allowances will appear here.</div>
                                                                                </td>
                                                                            </tr>
                                                                        </tbody>
                                                                    );
                                                                }
                                                                return (
                                                                    <tbody>
                                                                        {myPay.map(p => (
                                                                            <tr key={p.id}>
                                                                                <td className="sticky-col">{p.paidDate ? fmtDate(p.paidDate) : '—'}</td>
                                                                                <td style={{ fontWeight: 800, color: "var(--text-primary)" }}>{p.month}</td>
                                                                                <td><Badge status="Salary" /></td>
                                                                                <td style={{ fontWeight: 800, color: "var(--brand-primary)" }}>{fmt((p.baseSalary || 0) + (p.allowance || 0) - (p.deductions || 0))}</td>
                                                                                <td className="status-col"><Badge status={p.status} /></td>
                                                                                <td style={{ textAlign: "right" }}>
                                                                                    {(!isStaffSelfView || s.payEditRecord !== false) && (
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
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}
