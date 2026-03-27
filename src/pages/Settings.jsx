import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { 
    Settings as SettingsIcon, 
    Building2, 
    Palette,
    Wallet, 
    Truck, 
    Navigation, 
    Package, 
    Timer, 
    Bell, 
    ShieldCheck, 
    Database, 
    LogOut,
    User,
    ChevronRight,
    Trash2,
    RefreshCw,
    Plus,
    FileUp,
    Download,
    Upload,
    X,
    UserPlus,
    CreditCard,
    Wrench,
    AlertTriangle,
    Search,
    Type,
    Layout,
    Briefcase,
    Key,
    Users,
    FileText,
    Copy,
    Eye,
    EyeOff,
    Lock,
    ClipboardList,
    Mail,
    Sparkles,
    PenLine,
    MessageSquare,
    MessageCircle,
    Sun,
    Moon,
    IdCard,
    Save,
    ArrowLeft,
    Send,
    UserRoundCog,
} from "lucide-react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { ImportUploadButton } from "./ImportReview";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { PAYMENT_API, ADMIN_KEY } from "../utils/env";
import { IMPORT_SCHEMAS } from "../utils/importEngine";
import { uid, fmt, canonicalTemplateType } from "../utils/formatters";
import { exportToExcel, exportToCSV, exportAllToCSV } from "../utils/exportUtils";
import {
    writeSettings,
    readSettings,
    subscribeSettings,
    patchSettings,
    DEFAULT_LICENCE_CLASSES,
    DEFAULT_TRUCK_TYPES,
    DEFAULT_TRAILER_TYPES,
    DEFAULT_CARGO_TYPES,
    DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_COMMON_ROUTES,
    DEFAULT_CROSS_BORDER_RULES,
} from "../utils/settingsStore.js";
import { buildSmsUrl } from "../utils/contactLinks.js";
import { expandMessageTemplateContext } from "../utils/templateContext.js";
import { SettingsProfilePermissions } from "../components/SettingsProfilePermissions.jsx";
import { adminAuth } from "../utils/adminAuth";

const SETTINGS_MENU = [
    {
        id: "grp-workspace",
        label: "Workspace",
        items: [
            { id: "profile", label: "My Profile", icon: User },
            { id: "general", label: "Organization", icon: Building2 },
            { id: "appearance", label: "Appearance", icon: Palette },
            { id: "staff", label: "Staff & HR", icon: UserPlus },
        ],
    },
    {
        id: "grp-ops",
        label: "Fleet & compliance",
        items: [
            { id: "fleet", label: "Fleet & fuel", icon: Truck },
            { id: "maintenance", label: "Maintenance", icon: Wrench },
            { id: "routes", label: "Routes & rates", icon: Navigation },
            { id: "waybill", label: "Waybill defaults", icon: ClipboardList },
            { id: "alerts", label: "Alerts & rules", icon: Bell },
        ],
    },
    {
        id: "grp-commercial",
        label: "Revenue & messages",
        items: [
            { id: "finance", label: "Finance & payments", icon: Wallet },
            { id: "templates", label: "Message templates", icon: MessageSquare },
        ],
    },
    {
        id: "grp-system",
        label: "Data & API",
        items: [
            { id: "security", label: "Portal & API", icon: ShieldCheck },
            { id: "permissions", label: "Profile permissions", icon: UserRoundCog },
            { id: "data", label: "Backup & import", icon: Database },
        ],
    },
];

const SETTINGS_TAB_IDS = SETTINGS_MENU.flatMap((g) => g.items.map((i) => i.id));
/** Tabs whose fields write to `segecha_settings` (auto-save on change) */
const SETTINGS_WORKSPACE_TABS = new Set([
    "profile",
    "general",
    "appearance",
    "finance",
    "fleet",
    "routes",
    "waybill",
    "maintenance",
    "alerts",
    "staff",
    "permissions",
]);
const SECTION_BY_ID = Object.fromEntries(
    SETTINGS_MENU.flatMap((g) => g.items.map((it) => [it.id, { ...it, groupLabel: g.label }]))
);

function createWorkspaceEditableMap(initialUnlocked) {
    return Object.fromEntries([...SETTINGS_WORKSPACE_TABS].map((id) => [id, initialUnlocked]));
}

/** Stable component identities — defining these inside Settings() recreated types every render and dropped input focus after each keystroke. */
function SettingsShellField({ label, children, sub }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{label}</label>
            {children}
            {sub && <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, fontWeight: 500 }}>{sub}</p>}
        </div>
    );
}

function SettingsShellInput(props) {
    const { style, ...rest } = props;
    return (
        <input
            {...rest}
            className="input-premium"
            style={{
                width: "100%",
                height: 42,
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10,
                padding: "0 14px",
                fontSize: 14,
                color: "var(--text-primary)",
                fontWeight: 600,
                ...style,
            }}
        />
    );
}

function SettingsShellSelect(props) {
    const { style, ...rest } = props;
    return (
        <select
            {...rest}
            className="input-premium"
            style={{
                width: "100%",
                height: 42,
                background: "var(--surface-subtle)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10,
                padding: "0 14px",
                fontSize: 14,
                color: "var(--text-primary)",
                fontWeight: 600,
                ...style,
            }}
        />
    );
}

function SettingsShellSectionHeader({ title, desc, icon: Icon }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                {Icon && (
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: "var(--brand-primary)15",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--brand-primary)",
                        }}
                    >
                        <Icon size={20} />
                    </div>
                )}
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{title}</h2>
            </div>
            {desc && <p style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 500 }}>{desc}</p>}
        </div>
    );
}

export function Settings({ 
    dark, setDark, data, setData, setSettings, importSession, setImportSession, runExcelImport, isMobile, showToast, fillTemplate, syncToServer, hardResetSystem,
    backups, backupsLoading, fetchBackups, createManualBackup, restoreFromBackup, downloadBackup, uploadBackup
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState(() =>
        tabFromUrl && SETTINGS_TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "general"
    );
    const [templateSearch, setTemplateSearch] = useState('');
    /** Email | PDF | SMS — each tab shows only that type */
    const [templateTypeFilter, setTemplateTypeFilter] = useState("Email");
    const [phSearch, setPhSearch] = useState('');
    const [phCategory, setPhCategory] = useState('ALL');
    const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
    const [sendTestEmail, setSendTestEmail] = useState("");
    const [sendTestPhone, setSendTestPhone] = useState("");
    const [localS, setLocalS] = useState(readSettings);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [settingsMenuCollapsed, setSettingsMenuCollapsed] = useState(false);
    const navigate = useNavigate();
    const subjectInputRef = useRef(null);
    const bodyInputRef = useRef(null);
    const templateCursorRef = useRef({
        lastField: "body",
        subject: { start: 0, end: 0 },
        body: { start: 0, end: 0 },
    });

    // Password change state
    const [passForm, setPassForm] = useState({ old: '', new: '', confirm: '' });
    const [passLoading, setPassLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [draggingBackup, setDraggingBackup] = useState(false);

    const currentUser = adminAuth.getUser();
    const operatorEmail = String(currentUser?.email || "").trim().toLowerCase();
    const configuredAdminUsers = Array.isArray(localS.adminUsers) ? localS.adminUsers : [];
    const configuredSuperAdminUsers = Array.isArray(localS.superAdminUsers) ? localS.superAdminUsers : [];
    const hasConfiguredAccessLists = configuredAdminUsers.length > 0 || configuredSuperAdminUsers.length > 0;
    const isSuperAdmin =
        (!!operatorEmail && configuredSuperAdminUsers.some((u) => String(u?.email || "").trim().toLowerCase() === operatorEmail)) ||
        operatorEmail === 'admin@segecha.com';
    const isAdmin =
        isSuperAdmin ||
        (!!operatorEmail && configuredAdminUsers.some((u) => String(u?.email || "").trim().toLowerCase() === operatorEmail));
    const canEditSettings = !hasConfiguredAccessLists || isAdmin;


    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (!passForm.old || !passForm.new || !passForm.confirm) {
            showToast?.("All password fields are required.", "warning");
            return;
        }
        if (passForm.new !== passForm.confirm) {
            showToast?.("New passwords do not match.", "warning");
            return;
        }
        if (passForm.new.length < 5) {
            showToast?.("Password is too short (min 5 characters).", "warning");
            return;
        }

        setPassLoading(true);
        try {
            const res = await fetch(`${PAYMENT_API}/api/admin/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminAuth.getToken()}` },
                body: JSON.stringify({
                    email: operatorEmail,
                    oldPassword: passForm.old,
                    newPassword: passForm.new,
                    adminKey: ADMIN_KEY
                }),
            });
            const d = await res.json();
            if (d.success) {
                showToast?.("Password updated successfully.", "success");
                setPassForm({ old: '', new: '', confirm: '' });
            } else {
                showToast?.(d.error || "Failed to update password.", "error");
            }
        } catch (err) {
            showToast?.("Network error resetting password.", "error");
        } finally {
            setPassLoading(false);
        }
    };



    useEffect(() => {
        if (activeTab === 'data' && fetchBackups) {
            fetchBackups();
        }
    }, [activeTab, fetchBackups]);
    const canRunSuperAdminActions = !hasConfiguredAccessLists || isSuperAdmin;

    useEffect(() => {
        return subscribeSettings(setLocalS);
    }, []);

    useEffect(() => {
        const t = searchParams.get("tab");
        if (t && SETTINGS_TAB_IDS.includes(t)) {
            if (t !== activeTab) {
                setActiveTab(t);
            }
        }
    }, [searchParams, activeTab]);

    useEffect(() => {
        if (isMobile) {
            setSettingsMenuCollapsed(false);
            return;
        }
        const media = window.matchMedia("(max-width: 1240px)");
        const apply = () => setSettingsMenuCollapsed(media.matches);
        apply();
        const onChange = () => apply();
        if (typeof media.addEventListener === "function") {
            media.addEventListener("change", onChange);
            return () => media.removeEventListener("change", onChange);
        }
        media.addListener(onChange);
        return () => media.removeListener(onChange);
    }, [isMobile]);

    const navigateTab = useCallback(
        (id) => {
            if (!SETTINGS_TAB_IDS.includes(id)) return;
            setActiveTab(id);
            setSearchParams(
                (prev) => {
                    const n = new URLSearchParams(prev);
                    n.set("tab", id);
                    return n;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const saveSettings = (partial) => {
        setSaving(true);
        const next = patchSettings(partial);
        setLocalS(next);
        if (setSettings) setSettings(next);
        setLastSaved(new Date());
        window.setTimeout(() => setSaving(false), 550);
    };

    const [workspaceTabEditable, setWorkspaceTabEditable] = useState(() => createWorkspaceEditableMap(false));
    const [templatesEditable, setTemplatesEditable] = useState(false);

    /** Flush `segecha_settings` to localStorage, notify, and lock the current workspace tab. */
    const saveWorkspaceTab = useCallback(async () => {
        if (!SETTINGS_WORKSPACE_TABS.has(activeTab)) return;
        if (!canEditSettings) {
            showToast?.("Only Admin or Super Admin can edit settings.", "warning");
            return;
        }
        setSaving(true);
        try {
            const snapshot = readSettings();
            writeSettings(snapshot);
            setLocalS(snapshot);
            if (setSettings) setSettings(snapshot);
            
            // Persist to server database
            if (syncToServer) {
                await syncToServer();
            }
            
            setLastSaved(new Date());
            setWorkspaceTabEditable((p) => ({ ...p, [activeTab]: false }));
            showToast?.("Settings saved and synced to database", "success");
        } catch (e) {
            showToast?.("Failed to sync settings: " + e.message, "error");
        } finally {
            window.setTimeout(() => setSaving(false), 450);
        }
    }, [activeTab, setSettings, showToast, canEditSettings, syncToServer]);

    const saveTemplatesTab = useCallback(() => {
        if (!canEditSettings) {
            showToast?.("Only Admin or Super Admin can edit templates.", "warning");
            return;
        }
        setTemplatesEditable(false);
        setLastSaved(new Date());
        showToast?.("Templates saved with your workspace data", "success");
    }, [showToast, canEditSettings]);

    const flushAllData = () => {
        if (!canRunSuperAdminActions) {
            showToast?.("Only Super Admin can destroy local data.", "error");
            return;
        }
        hardResetSystem?.();
    };

    // (import is handled by the dedicated Import components)

    // ── Forms
    const [routeForm, setRouteForm] = useState({ origin: '', dest: '', driverRate: '', turnboyRate: '', returnDriverRate: '', returnTurnboyRate: '' });

    const [quickRouteForm, setQuickRouteForm] = useState({ origin: '', dest: '', distance: '' });
    const [newLicenceClass, setNewLicenceClass] = useState("");
    const [newTruckType, setNewTruckType] = useState("");
    const [newTrailerType, setNewTrailerType] = useState("");
    const [newCargoType, setNewCargoType] = useState("");
    const [newExpenseCategory, setNewExpenseCategory] = useState("");

    const unlockWorkspaceTab = useCallback(() => {
        if (!canEditSettings) {
            showToast?.("Only Admin or Super Admin can edit this tab.", "warning");
            return;
        }
        setWorkspaceTabEditable((p) => ({ ...p, [activeTab]: true }));
    }, [activeTab, canEditSettings, showToast]);

    const updateTemplate = useCallback((id, patch) => {
        setData((d) => ({
            ...d,
            templates: (d.templates || []).map((tx) =>
                tx.id === id ? { ...tx, ...patch, updatedAt: new Date().toISOString() } : tx
            ),
        }));
    }, [setData]);

    const previewSampleContext = useMemo(() => {
        const co = localS.companyName || "Segecha Group Ltd";
        const addr = (localS.address || "Nairobi").split(",")[0].trim();
        return expandMessageTemplateContext({
            company_name: co,
            businessName: co,
            customerName: "Bamburi Cement Ltd",
            firstName: "Sarah",
            customerEmail: "billing@example.com",
            customerPhone: "+254 700 111 222",
            invoiceId: "INV-2026-014",
            amount: "KES 125,000",
            dueDate: "2026-04-15",
            mpesaRef: "QJK1234567",
            journeyId: "J026",
            origin: "Nairobi",
            destination: "Mombasa",
            dest: "Mombasa",
            cargo: "Electronics",
            truckReg: "KCB 100A",
            trailerReg: "ZEA 101",
            waybillNo: "WB-2026-000A",
            borderPoint: "Busia",
            eta: "2026-04-12 14:00",
            distance: "480 km",
            revenue: "KES 85,000",
            driverName: "Peter Ochieng",
            driverId: "DRV-001",
            staffName: "Alice Wambui",
            staffId: "EMP-001",
            otp: "123456",
            verifyUrl: "https://driver.segecha.example/verify",
            resetUrl: "https://driver.segecha.example/reset",
            loginEmail: "james.kamau@example.com",
            footer: `${co} · ${addr}`,
            baseUrl: "https://operations.example.com",
            site: "Segecha Internal Tracker",
            loyaltyPoints: "1,250",
        });
    }, [localS.companyName, localS.address]);

    // Admin/Super Admin access list UI moved to Staff section.

    useEffect(() => {
        if (canEditSettings) return;
        setTemplatesEditable(false);
        setWorkspaceTabEditable(createWorkspaceEditableMap(false));
    }, [canEditSettings]);

    const runTemplatePreview = useCallback(
        (subject, body) => {
            if (fillTemplate) {
                return {
                    subject: fillTemplate(subject || "", previewSampleContext),
                    body: fillTemplate(body || "", previewSampleContext),
                };
            }
            let s = subject || "";
            let b = body || "";
            Object.entries(previewSampleContext).forEach(([k, v]) => {
                const re = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
                const str = String(v ?? "");
                s = s.replace(re, str);
                b = b.replace(re, str);
            });
            return { subject: s, body: b };
        },
        [fillTemplate, previewSampleContext]
    );

    const filteredTemplates = useMemo(() => {
        let list = (data.templates || []).filter((t) => canonicalTemplateType(t.type) === templateTypeFilter);
        const q = templateSearch.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (t) =>
                    (t.name || "").toLowerCase().includes(q) ||
                    (t.subject || "").toLowerCase().includes(q) ||
                    (t.description || "").toLowerCase().includes(q) ||
                    (t.category || "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [data.templates, templateSearch, templateTypeFilter]);

    const PLACEHOLDER_GROUPS = useMemo(
        () => [
            {
                cat: "BUSINESS",
                filterCat: "Business",
                icon: Briefcase,
                color: "#3b82f6",
                items: ["businessName", "company_name", "today", "footer", "baseUrl", "site", "supportEmail", "supportPhone"],
            },
            {
                cat: "AUTH & VERIFICATION",
                filterCat: "Auth & Verification",
                icon: Key,
                color: "#8b5cf6",
                items: ["verifyUrl", "resetUrl", "loginEmail", "otp", "loginUrl"],
            },
            {
                cat: "CUSTOMER",
                filterCat: "Customer",
                icon: Users,
                color: "#10b981",
                items: ["firstName", "lastName", "customerName", "customerEmail", "customerPhone", "loyaltyPoints", "customerAddress"],
            },
            {
                cat: "INVOICES",
                filterCat: "Invoices",
                icon: FileText,
                color: "#f97316",
                items: ["invoiceId", "invoiceUrl", "paymentUrl", "amount", "amountDue", "currency", "dueDate", "mpesaRef", "invoiceStatus", "billingMonth"],
            },
            {
                cat: "JOURNEYS & WAYBILL",
                filterCat: "Journeys",
                icon: Navigation,
                color: "#6366f1",
                items: ["journeyId", "origin", "destination", "dest", "cargo", "truckReg", "trailerReg", "driverName", "revenue", "waybillNo", "borderPoint", "eta", "distance"],
            },
            {
                cat: "STAFF & DRIVERS",
                filterCat: "Staff & drivers",
                icon: IdCard,
                color: "#ec4899",
                items: ["staffName", "staffId", "driverName", "driverId", "role", "licenseNo"],
            },
            {
                cat: "DOCUMENTS",
                filterCat: "Documents",
                icon: ClipboardList,
                color: "#64748b",
                items: ["docLabel", "docType", "expiryDate", "downloadUrl", "uploadedAt"],
            },
        ],
        []
    );

    const rememberTemplateSelection = useCallback((field) => {
        const el = field === "subject" ? subjectInputRef.current : bodyInputRef.current;
        if (!el) return;
        templateCursorRef.current[field] = {
            start: el.selectionStart ?? 0,
            end: el.selectionEnd ?? (el.selectionStart ?? 0),
        };
        templateCursorRef.current.lastField = field;
    }, []);

    const insertIntoTemplateField = useCallback(
        (templateId, field, snippet) => {
            const t = (data.templates || []).find((x) => x.id === templateId);
            if (!t) return;
            const isSubject = field === "subject";
            const el = isSubject ? subjectInputRef.current : bodyInputRef.current;
            const fallback = templateCursorRef.current[field] || { start: 0, end: 0 };
            const hasLiveSelection =
                el &&
                document.activeElement === el &&
                typeof el.selectionStart === "number" &&
                typeof el.selectionEnd === "number";
            const start = hasLiveSelection ? el.selectionStart : fallback.start;
            const end = hasLiveSelection ? el.selectionEnd : fallback.end;
            const text = isSubject ? t.subject || "" : t.body || "";
            const newValue = text.slice(0, start) + snippet + text.slice(end);
            updateTemplate(templateId, isSubject ? { subject: newValue } : { body: newValue });
            requestAnimationFrame(() => {
                const nextEl = isSubject ? subjectInputRef.current : bodyInputRef.current;
                if (!nextEl) return;
                nextEl.focus();
                const pos = start + snippet.length;
                try {
                    nextEl.setSelectionRange(pos, pos);
                } catch (e) {
                    void e;
                }
                templateCursorRef.current[field] = { start: pos, end: pos };
                templateCursorRef.current.lastField = field;
            });
        },
        [data.templates, updateTemplate]
    );

    const insertIntoSubject = useCallback(
        (templateId, snippet) => {
            insertIntoTemplateField(templateId, "subject", snippet);
        },
        [insertIntoTemplateField]
    );

    const insertIntoBody = useCallback(
        (templateId, snippet) => {
            insertIntoTemplateField(templateId, "body", snippet);
        },
        [insertIntoTemplateField]
    );

    const wrapBodySelection = useCallback(
        (templateId, left, right) => {
            const el = bodyInputRef.current;
            const t = (data.templates || []).find((x) => x.id === templateId);
            if (!t || !el) return;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? start;
            const text = t.body || "";
            const selected = text.slice(start, end);
            const middle = selected || "emphasized text";
            const inserted = left + middle + right;
            const newValue = text.slice(0, start) + inserted + text.slice(end);
            updateTemplate(templateId, { body: newValue });
            requestAnimationFrame(() => {
                el.focus();
                try {
                    if (selected) el.setSelectionRange(start + left.length, start + left.length + selected.length);
                    else el.setSelectionRange(start + left.length, start + left.length + middle.length);
                } catch (e) {
                    void e;
                }
                rememberTemplateSelection("body");
            });
        },
        [data.templates, rememberTemplateSelection, updateTemplate]
    );

    const currentSection = SECTION_BY_ID[activeTab];

    return (
        <div className={`page-shell-wide settings-layout ${isMobile ? "settings-layout--stack" : ""}`}>
            {!isMobile && (
                <aside className={`settings-sidebar ${settingsMenuCollapsed ? "is-collapsed" : ""}`}>
                    <div className="settings-sidebar-head">
                        {!settingsMenuCollapsed ? (
                            <PageHeader className="page-header--compact" title="Settings" marginBottom={20} />
                        ) : (
                            <div className="settings-sidebar-title-compact">Settings</div>
                        )}
                        <button
                            type="button"
                            className="settings-sidebar-toggle"
                            onClick={() => setSettingsMenuCollapsed((v) => !v)}
                            aria-label={settingsMenuCollapsed ? "Expand settings menu" : "Collapse settings menu"}
                            title={settingsMenuCollapsed ? "Expand settings menu" : "Collapse settings menu"}
                        >
                            <ChevronRight
                                size={16}
                                style={{
                                    transform: settingsMenuCollapsed ? "rotate(0deg)" : "rotate(180deg)",
                                    transition: "transform 0.15s ease",
                                }}
                            />
                        </button>
                    </div>
                    <nav className="settings-nav" aria-label="Settings sections">
                        {SETTINGS_MENU.map((group) => (
                            <div key={group.id} className="settings-nav-group">
                                {!settingsMenuCollapsed ? <div className="settings-nav-group-label">{group.label}</div> : null}
                                {group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`settings-nav-item ${activeTab === item.id ? "is-active" : ""}`}
                                        onClick={() => navigateTab(item.id)}
                                        title={item.label}
                                        aria-label={item.label}
                                    >
                                        <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} aria-hidden />
                                        {!settingsMenuCollapsed ? <span>{item.label}</span> : null}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </nav>
                </aside>
            )}

            <div className="settings-main">
                {isMobile && (
                    <div className="settings-mobile-picker">
                        <label className="settings-mobile-picker-label" htmlFor="settings-section-select">
                            Section
                        </label>
                        <SettingsShellSelect
                            id="settings-section-select"
                            value={activeTab}
                            onChange={(e) => navigateTab(e.target.value)}
                        >
                            {SETTINGS_MENU.flatMap((g) =>
                                g.items.map((it) => (
                                    <option key={it.id} value={it.id}>
                                        {g.label}: {it.label}
                                    </option>
                                ))
                            )}
                        </SettingsShellSelect>
                    </div>
                )}
                <Card className="settings-content-card" style={{ padding: isMobile ? 18 : "clamp(20px, 3vw, 40px)" }}>
                    {currentSection && (
                        <div className="settings-toolbar" role="status" aria-live="polite">
                            <div className="settings-toolbar-crumb">
                                <span className="settings-toolbar-group">{currentSection.groupLabel}</span>
                                <ChevronRight size={14} className="settings-toolbar-sep" aria-hidden />
                                <span className="settings-toolbar-section">{currentSection.label}</span>
                            </div>
                            <div className="settings-toolbar-right">
                                <div className="settings-toolbar-actions">
                                    {SETTINGS_WORKSPACE_TABS.has(activeTab) &&
                                        (workspaceTabEditable[activeTab] ? (
                                            <Button type="button" variant="primary" icon={Save} disabled={saving} onClick={saveWorkspaceTab}>
                                                Save
                                            </Button>
                                        ) : (
                                            <Button type="button" variant="secondary" icon={PenLine} onClick={unlockWorkspaceTab} disabled={!canEditSettings}>
                                                Edit
                                            </Button>
                                        ))}
                                    {activeTab === "templates" &&
                                        (templatesEditable ? (
                                            <Button type="button" variant="primary" icon={Save} onClick={saveTemplatesTab}>
                                                Save
                                            </Button>
                                        ) : (
                                            <Button type="button" variant="secondary" icon={PenLine} disabled={!canEditSettings} onClick={() => setTemplatesEditable(true)}>
                                                Edit
                                            </Button>
                                        ))}
                                </div>
                                <div className="settings-toolbar-status">
                                    {saving ? (
                                        <span>Saving…</span>
                                    ) : SETTINGS_WORKSPACE_TABS.has(activeTab) && !workspaceTabEditable[activeTab] ? (
                                        <span className="settings-toolbar-muted">Locked — click Edit to change this tab</span>
                                    ) : activeTab === "templates" && !templatesEditable ? (
                                        <span className="settings-toolbar-muted">Locked — click Edit to change templates</span>
                                    ) : lastSaved ? (
                                        <span>
                                            Saved ·{" "}
                                            {lastSaved.toLocaleTimeString(undefined, {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    ) : (
                                        <span className="settings-toolbar-muted">Edit, then Save to confirm</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {currentSection && SETTINGS_WORKSPACE_TABS.has(activeTab) && (
                        <div className="settings-save-strip" role="region" aria-label="Save workspace settings">
                            <p className="settings-save-strip-text">
                                <strong>How saving works:</strong> click <strong>Edit</strong> to unlock fields. Each change is written to this browser as you type. Click <strong>Save</strong> to confirm, refresh the stored copy, and lock the tab again.
                            </p>
                        </div>
                    )}
                    {currentSection && hasConfiguredAccessLists && !isAdmin && (
                        <div className="settings-save-strip settings-save-strip--info" role="note">
                            <p className="settings-save-strip-text">
                                <strong>Read-only:</strong> your signed-in email is <strong>{operatorEmail || "not set"}</strong>. This account is not in Admin/Super Admin lists.
                            </p>
                        </div>
                    )}
                    {currentSection && activeTab === "templates" && (
                        <div className="settings-save-strip settings-save-strip--info" role="note">
                            <p className="settings-save-strip-text">
                                <strong>Templates</strong> live in your workspace data. Click <strong>Edit</strong> to change the template editor, then <strong>Save</strong> for a confirmation. Use <strong>Backup &amp; import → Export State</strong> for a full JSON backup.
                            </p>
                        </div>
                    )}
                    {currentSection && activeTab === "security" && (
                        <div className="settings-save-strip settings-save-strip--info" role="note">
                            <p className="settings-save-strip-text">
                                <strong>API URL and admin key</strong> come from your environment file at build time (e.g. <code className="settings-save-strip-code">.env</code>), not from this screen. Nothing here needs a save button.
                            </p>
                        </div>
                    )}
                    {currentSection && activeTab === "data" && (
                        <div className="settings-save-strip settings-save-strip--info" role="note">
                            <p className="settings-save-strip-text">
                                <strong>Backup &amp; import:</strong> use <strong>Export State</strong> or <strong>Push snapshot to API</strong> below when you want a copy outside this browser. Other tabs use <strong>Edit</strong> / <strong>Save</strong> so settings are written to this browser when you confirm.
                            </p>
                        </div>
                    )}
                    {currentSection && activeTab === "permissions" && (
                        <div className="settings-save-strip settings-save-strip--info" role="note">
                            <p className="settings-save-strip-text">
                                <strong>Driver app:</strong> toggles apply when <strong>Edit</strong> is on. Use <strong>Backup &amp; import → Push snapshot to API</strong> so the driver portal loads these rules from the server.
                            </p>
                        </div>
                    )}
                    {/* ── PROFILE ── */}
                    {activeTab === 'profile' && (
                        <fieldset disabled={!workspaceTabEditable.profile || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Personal profile settings</legend>
                            <SettingsShellSectionHeader title="My Profile" desc="Manage your personal display information for this workspace." icon={User} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                <SettingsShellField label="Display Name" sub="How you appear in the dashboard and logs.">
                                    <SettingsShellInput 
                                        value={localS.operatorDisplayName || ''} 
                                        onChange={e => saveSettings({ operatorDisplayName: e.target.value })} 
                                        placeholder="Full Name" 
                                    />
                                </SettingsShellField>
                                <SettingsShellField label="Work Email" sub="Used for certain notifications and identifiers.">
                                    <SettingsShellInput 
                                        type="email"
                                        value={localS.operatorWorkEmail || ''} 
                                        onChange={e => saveSettings({ operatorWorkEmail: e.target.value })} 
                                        placeholder="email@example.com" 
                                    />
                                </SettingsShellField>
                                <div style={{ gridColumn: "1/-1" }}>
                                    <SettingsShellField label="Role / Designation" sub="Your primary role within the organization.">
                                        <SettingsShellInput 
                                            value={localS.operatorRole || ''} 
                                            onChange={e => saveSettings({ operatorRole: e.target.value })} 
                                            placeholder="e.g. Manager" 
                                        />
                                    </SettingsShellField>
                                </div>
                            </div>

                            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border-subtle)" }}>
                                <SettingsShellSectionHeader title="Security & Login" desc="Manage your password and account security." icon={Lock} />
                                <form onSubmit={handlePasswordChange} style={{ maxWidth: 400 }}>
                                    <div style={{ position: 'relative' }}>
                                        <SettingsShellField label="Current Password">
                                            <SettingsShellInput 
                                                type={showPass ? "text" : "password"}
                                                value={passForm.old} 
                                                onChange={e => setPassForm(p => ({ ...p, old: e.target.value }))} 
                                                placeholder="Enter current password"
                                            />
                                        </SettingsShellField>
                                        <button 
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            style={{ position: 'absolute', right: 10, top: 38, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        >
                                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <SettingsShellField label="New Password">
                                        <SettingsShellInput 
                                            type="password"
                                            value={passForm.new} 
                                            onChange={e => setPassForm(p => ({ ...p, new: e.target.value }))} 
                                            placeholder="Enter new password"
                                        />
                                    </SettingsShellField>
                                    <SettingsShellField label="Confirm New Password">
                                        <SettingsShellInput 
                                            type="password"
                                            value={passForm.confirm} 
                                            onChange={e => setPassForm(p => ({ ...p, confirm: e.target.value }))} 
                                            placeholder="Confirm new password"
                                        />
                                    </SettingsShellField>
                                    <Button type="submit" variant="primary" disabled={passLoading} style={{ width: '100%' }}>
                                        {passLoading ? "Updating..." : "Update Password"}
                                    </Button>
                                </form>
                            </div>
                        </fieldset>
                    )}


                    {/* ── GENERAL ── */}
                    {activeTab === 'general' && (
                        <fieldset disabled={!workspaceTabEditable.general || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Organization settings</legend>
                            <SettingsShellSectionHeader title="Organization Profile" desc="Configure your company details and contact information for documents." icon={Building2} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                <SettingsShellField label="Company Name">
                                    <SettingsShellInput value={localS.companyName || ''} onChange={e => saveSettings({ companyName: e.target.value })} placeholder="e.g. Segecha Logistics Ltd" />
                                </SettingsShellField>
                                <SettingsShellField label="Legal Entity ID / PIN">
                                    <SettingsShellInput value={localS.pinNumber || ''} onChange={e => saveSettings({ pinNumber: e.target.value })} placeholder="KRA PIN" />
                                </SettingsShellField>
                                <SettingsShellField label="Email Address">
                                    <SettingsShellInput value={localS.email || ''} onChange={e => saveSettings({ email: e.target.value })} placeholder="ops@example.com" />
                                </SettingsShellField>
                                 <SettingsShellField label="Phone Support">
                                    <SettingsShellInput value={localS.phone || ''} onChange={e => saveSettings({ phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
                                </SettingsShellField>
                                <SettingsShellField label="Corporate WhatsApp No.">
                                    <SettingsShellInput value={localS.whatsappNumber || ''} onChange={e => saveSettings({ whatsappNumber: e.target.value })} placeholder="2547XXXXXXXX" />
                                </SettingsShellField>

                                <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, background: "var(--brand-primary)05", padding: 20, borderRadius: 16, border: "1px dashed var(--brand-primary)30" }}>
                                    <SettingsShellField label="Organization Logo" sub="Shows in sidebar & documents">
                                        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                                            <div style={{ width: 60, height: 60, borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-primary)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                                {localS.companyLogo ? <img src={localS.companyLogo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Building2 size={24} style={{ opacity: 0.2 }} />}
                                            </div>
                                            <label className="btn-premium btn-ghost" style={{ fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>
                                                <Upload size={14} style={{ marginRight: 6 }} /> Upload Logo
                                                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => saveSettings({ companyLogo: ev.target.result });
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </label>
                                        </div>
                                    </SettingsShellField>

                                    <SettingsShellField label="Browser Favicon" sub="Icon in browser tab">
                                        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--surface-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {localS.companyFavicon ? <img src={localS.companyFavicon} style={{ width: 24, height: 24, objectFit: "contain" }} /> : <div style={{ width: 16, height: 16, background: "var(--brand-primary)", borderRadius: 2 }} />}
                                            </div>
                                            <label className="btn-premium btn-ghost" style={{ fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>
                                                <Upload size={14} style={{ marginRight: 6 }} /> Change Icon
                                                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => {
                                                            const base64 = ev.target.result;
                                                            saveSettings({ companyFavicon: base64 });
                                                            // Immediate UI apply
                                                            const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
                                                            link.type = 'image/x-icon';
                                                            link.rel = 'shortcut icon';
                                                            link.href = base64;
                                                            document.getElementsByTagName('head')[0].appendChild(link);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                            </label>
                                        </div>
                                    </SettingsShellField>
                                </div>
                                <div style={{ gridColumn: "1/-1" }}>
                                    <SettingsShellField label="Physical Address">
                                        <textarea 
                                            className="input-premium"
                                            style={{ width: "100%", height: 80, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12, fontSize: 14, color: "var(--text-primary)", fontWeight: 600, resize: "none" }}
                                            value={localS.address || ''} 
                                            onChange={e => saveSettings({ address: e.target.value })}
                                            placeholder="HQ Location..."
                                        />
                                    </SettingsShellField>
                                </div>
                                <div style={{ gridColumn: "1/-1", marginTop: 8 }}>
                                    <div style={{ background: "var(--surface-subtle)", borderRadius: 16, padding: 22, border: "1px solid var(--border-subtle)" }}>
                                        <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Signed-in user</h4>
                                        <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 18, lineHeight: 1.5 }}>
                                            Shown in the top bar. Sign out clears these fields on this device only; your workspace data is not removed.
                                        </p>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                            <SettingsShellField label="Your display name" sub="e.g. Jane Wanjiku">
                                                <SettingsShellInput value={localS.operatorDisplayName || ""} onChange={(e) => saveSettings({ operatorDisplayName: e.target.value })} placeholder="Full Name" />
                                            </SettingsShellField>
                                            <SettingsShellField label="Your work email" sub="Optional; for your reference in the menu">
                                                <SettingsShellInput type="email" value={localS.operatorWorkEmail || ""} onChange={(e) => saveSettings({ operatorWorkEmail: e.target.value })} placeholder="email@example.com" />
                                            </SettingsShellField>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ gridColumn: "1/-1", marginTop: 24, padding: 24, borderRadius: 16, border: "1px solid var(--border-subtle)", background: "var(--surface-subtle)" }}>
                                    <SettingsShellSectionHeader title="Security & Session" desc="Configure automatic safeguards for your workspace." icon={ShieldCheck} />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                        <SettingsShellField label="Auto-Logout (Inactivity)" sub="Automatically sign out after a period of no activity.">
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <input 
                                                    type="checkbox" 
                                                    id="autoLogoutEnabled"
                                                    checked={localS.autoLogoutEnabled !== false} 
                                                    onChange={e => saveSettings({ autoLogoutEnabled: e.target.checked })}
                                                    style={{ width: 18, height: 18, cursor: "pointer" }}
                                                />
                                                <label htmlFor="autoLogoutEnabled" style={{ fontSize: 13, cursor: "pointer", color: "var(--text-primary)" }}>
                                                    {localS.autoLogoutEnabled !== false ? "Enabled (Recommended)" : "Disabled"}
                                                </label>
                                            </div>
                                        </SettingsShellField>
                                        <SettingsShellField label="Idle Timeout Duration" sub="How long to wait before signing out.">
                                            <select 
                                                value={localS.autoLogoutMinutes || 30} 
                                                onChange={e => saveSettings({ autoLogoutMinutes: Number(e.target.value) })}
                                                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}
                                            >
                                                <option value={15}>15 Minutes</option>
                                                <option value={30}>30 Minutes</option>
                                                <option value={60}>1 Hour</option>
                                                <option value={240}>4 Hours</option>
                                                <option value={720}>12 Hours</option>
                                            </select>
                                        </SettingsShellField>
                                    </div>
                                </div>

                                <div style={{ gridColumn: "1/-1", marginTop: 12 }}>
                                    <div style={{ background: "var(--brand-primary)08", borderRadius: 16, padding: 24, border: "1px solid var(--brand-primary)20" }}>
                                        <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-primary)", marginBottom: 16 }}>Internal System Identifiers</h4>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                            <SettingsShellField label="Vehicle ID Prefix" sub="e.g. TRK- (Result: TRK-001)">
                                                <SettingsShellInput value={localS.vehicleIdPrefix || 'TRK-'} onChange={e => saveSettings({ vehicleIdPrefix: e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Driver ID Prefix" sub="e.g. DRV- (Result: DRV-001)">
                                                <SettingsShellInput value={localS.driverIdPrefix || 'DRV-'} onChange={e => saveSettings({ driverIdPrefix: e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Turnboy ID Prefix" sub="e.g. TBY- (Result: TBY-001)">
                                                <SettingsShellInput value={localS.turnboyIdPrefix || 'TBY-'} onChange={e => saveSettings({ turnboyIdPrefix: e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Staff ID Prefix" sub="e.g. EMP- (Result: EMP-001)">
                                                <SettingsShellInput value={localS.staffIdPrefix || 'EMP-'} onChange={e => saveSettings({ staffIdPrefix: e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Customer ID Prefix" sub="e.g. CST- (Result: CST-001)">
                                                <SettingsShellInput value={localS.customerIdPrefix || 'CST-'} onChange={e => saveSettings({ customerIdPrefix: e.target.value })} />
                                            </SettingsShellField>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </fieldset>
                    )}

                    {/* ── APPEARANCE ── */}
                    {activeTab === 'appearance' && (
                        <fieldset disabled={!workspaceTabEditable.appearance || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Appearance settings</legend>
                            <SettingsShellSectionHeader title="Visual Experience" desc="Customize how Segecha looks and feels on your devices." icon={Palette} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                <SettingsShellField label="Theme Mode" sub="Toggle between light and dark aesthetics.">
                                    <div style={{ display: "flex", gap: 12 }}>
                                        <Button variant={!dark ? 'primary' : 'ghost'} onClick={() => { setDark(false); localStorage.setItem('segecha_theme', 'light'); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Sun size={16} aria-hidden /> Light</Button>
                                        <Button variant={dark ? 'primary' : 'ghost'} onClick={() => { setDark(true); localStorage.setItem('segecha_theme', 'dark'); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Moon size={16} aria-hidden /> Dark</Button>
                                    </div>
                                </SettingsShellField>
                                <SettingsShellField label="Accent Color" sub="Choose your organization's primary brand color.">
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {['#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map(c => (
                                            <div 
                                                key={c}
                                                onClick={() => { document.documentElement.style.setProperty('--brand-primary', c); saveSettings({ accentColor: c }); }}
                                                style={{ width: 32, height: 32, borderRadius: 8, background: c, cursor: "pointer", border: localS.accentColor === c ? "2px solid white" : "none", boxShadow: localS.accentColor === c ? "0 0 0 2px " + c : "none" }}
                                            />
                                        ))}
                                    </div>
                                </SettingsShellField>
                            </div>

                            {/* ── SENDGRID EMAIL IDENTITIES ── */}
                            <div style={{ gridColumn: "1/-1", marginTop: 28 }}>
                                <div style={{ background: "var(--surface-subtle)", borderRadius: 16, padding: 22, border: "1px solid var(--border-subtle)" }}>
                                    <h4 style={{ fontSize: 15, fontWeight: 900, color: "var(--brand-primary)", margin: "0 0 6px" }}>
                                        SendGrid Email Identities
                                    </h4>
                                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
                                        Used for server-side emails sent via SendGrid (client invoices/receipts and driver portal welcome/reset). Add additional verified sender addresses to the fallback list if needed.
                                    </p>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                                        {/* Client emails */}
                                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 18 }}>
                                            <h5 style={{ fontSize: 13, fontWeight: 900, margin: "0 0 10px", color: "var(--text-primary)" }}>
                                                Client communications
                                            </h5>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                                <SettingsShellField label="From email">
                                                    <SettingsShellInput
                                                        type="email"
                                                        value={localS.emailIdentities?.client?.fromEmail || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    client: { ...localS.emailIdentities.client, fromEmail: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="payments@example.com"
                                                    />
                                                </SettingsShellField>
                                                <SettingsShellField label="From name">
                                                    <SettingsShellInput
                                                        value={localS.emailIdentities?.client?.fromName || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    client: { ...localS.emailIdentities.client, fromName: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="Segecha Group Ltd"
                                                    />
                                                </SettingsShellField>
                                                <SettingsShellField label="Reply-to email" sub="Where client replies land">
                                                    <SettingsShellInput
                                                        type="email"
                                                        value={localS.emailIdentities?.client?.replyToEmail || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    client: { ...localS.emailIdentities.client, replyToEmail: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="payments@example.com"
                                                    />
                                                </SettingsShellField>
                                                <SettingsShellField label="Reply-to name">
                                                    <SettingsShellInput
                                                        value={localS.emailIdentities?.client?.replyToName || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    client: { ...localS.emailIdentities.client, replyToName: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="Payments (Segecha)"
                                                    />
                                                </SettingsShellField>
                                            </div>
                                            <SettingsShellField
                                                label="Additional from emails (fallback)"
                                                sub="Comma-separated; used if active from is not verified in SendGrid."
                                            >
                                                <SettingsShellInput
                                                    value={(localS.emailIdentities?.client?.fromFallbackEmails || []).join(", ")}
                                                    onChange={(e) => {
                                                        const list = e.target.value
                                                            .split(",")
                                                            .map((s) => s.trim())
                                                            .filter(Boolean);
                                                        saveSettings({
                                                            emailIdentities: {
                                                                ...localS.emailIdentities,
                                                                client: { ...localS.emailIdentities.client, fromFallbackEmails: list },
                                                            },
                                                        });
                                                    }}
                                                    placeholder="e.g. ops@example.com, billing@example.com"
                                                />
                                            </SettingsShellField>
                                        </div>

                                        {/* Driver portal emails */}
                                        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 18 }}>
                                            <h5 style={{ fontSize: 13, fontWeight: 900, margin: "0 0 10px", color: "var(--text-primary)" }}>
                                                Driver portal communications
                                            </h5>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                                <SettingsShellField label="From email" sub="Welcome + password reset">
                                                    <SettingsShellInput
                                                        type="email"
                                                        value={localS.emailIdentities?.driverPortal?.fromEmail || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    driverPortal: { ...localS.emailIdentities.driverPortal, fromEmail: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="welcome@example.com"
                                                    />
                                                </SettingsShellField>
                                                <SettingsShellField label="From name">
                                                    <SettingsShellInput
                                                        value={localS.emailIdentities?.driverPortal?.fromName || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    driverPortal: { ...localS.emailIdentities.driverPortal, fromName: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="Segecha Driver Portal"
                                                    />
                                                </SettingsShellField>
                                                <SettingsShellField label="Reply-to email" sub="Drivers' inbox / support address">
                                                    <SettingsShellInput
                                                        type="email"
                                                        value={localS.emailIdentities?.driverPortal?.replyToEmail || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    driverPortal: { ...localS.emailIdentities.driverPortal, replyToEmail: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="drivers@example.com"
                                                    />
                                                </SettingsShellField>
                                                <SettingsShellField label="Reply-to name">
                                                    <SettingsShellInput
                                                        value={localS.emailIdentities?.driverPortal?.replyToName || ""}
                                                        onChange={(e) =>
                                                            saveSettings({
                                                                emailIdentities: {
                                                                    ...localS.emailIdentities,
                                                                    driverPortal: { ...localS.emailIdentities.driverPortal, replyToName: e.target.value },
                                                                },
                                                            })
                                                        }
                                                        placeholder="Drivers (Segecha)"
                                                    />
                                                </SettingsShellField>
                                            </div>
                                            <SettingsShellField
                                                label="Additional from emails (fallback)"
                                                sub="Comma-separated; default includes payments@example.com for safe fallback."
                                            >
                                                <SettingsShellInput
                                                    value={(localS.emailIdentities?.driverPortal?.fromFallbackEmails || []).join(", ")}
                                                    onChange={(e) => {
                                                        const list = e.target.value
                                                            .split(",")
                                                            .map((s) => s.trim())
                                                            .filter(Boolean);
                                                        saveSettings({
                                                            emailIdentities: {
                                                                ...localS.emailIdentities,
                                                                driverPortal: {
                                                                    ...localS.emailIdentities.driverPortal,
                                                                    fromFallbackEmails: list,
                                                                },
                                                            },
                                                        });
                                                    }}
                                                    placeholder="e.g. payments@example.com, ops@example.com"
                                                />
                                            </SettingsShellField>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, margin: "14px 0 0" }}>
                                        Note: carrier email for printed waybills lives under <strong>Waybill defaults → Carrier</strong> (enter `operations@example.com` once the inbox exists).
                                    </p>
                                </div>
                            </div>
                        </fieldset>
                    )}

                    {/* ── FINANCE ── */}
                    {activeTab === 'finance' && (
                        <fieldset disabled={!workspaceTabEditable.finance || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Finance settings</legend>
                            <SettingsShellSectionHeader title="Finance & M-Pesa" desc="Configure payment automation and invoice defaults." icon={Wallet} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                <SettingsShellField label="M-Pesa Business Shortcode">
                                    <SettingsShellInput value={localS.mpesaShortcode || ''} onChange={e => saveSettings({ mpesaShortcode: e.target.value })} placeholder="600XXX" />
                                </SettingsShellField>
                                <SettingsShellField label="Currency Symbol">
                                    <SettingsShellSelect value={localS.currency || 'KES'} onChange={e => saveSettings({ currency: e.target.value })}>
                                        <option value="KES">KES — Kenyan Shilling</option>
                                        <option value="USD">USD — US Dollar</option>
                                    </SettingsShellSelect>
                                </SettingsShellField>
                                <SettingsShellField label="Default Tax (VAT) %">
                                    <SettingsShellInput type="number" value={localS.vatRate || 16} onChange={e => saveSettings({ vatRate: +e.target.value })} />
                                </SettingsShellField>
                                <SettingsShellField label="Invoice Prefix">
                                    <SettingsShellInput value={localS.invoicePrefix || 'INV'} onChange={e => saveSettings({ invoicePrefix: e.target.value })} />
                                </SettingsShellField>
                                <SettingsShellField label="Default PDF Template" sub="Choose the layout used for generating PDF invoices.">
                                    <SettingsShellSelect 
                                        value={localS.defaultInvoiceTemplate || ''} 
                                        onChange={e => saveSettings({ defaultInvoiceTemplate: e.target.value })}
                                    >
                                        <option value="">Built-in layout (no custom template)</option>
                                        {(data.templates || []).filter((t) => canonicalTemplateType(t.type) === "PDF").map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </SettingsShellSelect>
                                    {(data.templates || []).filter((t) => canonicalTemplateType(t.type) === "PDF").length === 0 ? (
                                        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                                            No PDF templates yet. Go to Message templates, open the PDF tab, and add one. If you still see this after refresh, reload the app once so default seed templates (including Standard PDF Invoice) can merge into your workspace.
                                        </p>
                                    ) : null}
                                </SettingsShellField>

                                <SettingsShellField label="Invoice/Payment Terms (Days)" sub="Grace period before invoice is marked overdue.">
                                    <SettingsShellInput type="number" value={localS.paymentTermsDays || 14} onChange={e => saveSettings({ paymentTermsDays: +e.target.value })} />
                                </SettingsShellField>
                            </div>

                            <div style={{ marginTop: 32 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-primary)12", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)" }}>
                                        <Wallet size={18} aria-hidden />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Expense categories</h4>
                                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 }}>
                                            Standard labels for classification of fleet and operational costs.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                    {(() => {
                                        const expenseCatList = Array.isArray(localS.expenseCategories)
                                            ? localS.expenseCategories
                                            : [...DEFAULT_EXPENSE_CATEGORIES];
                                        const persistExpenseCats = (next) => saveSettings({ expenseCategories: next });
                                        return (
                                            <>
                                                {expenseCatList.map((cat, i) => (
                                                    <div key={`${cat}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                                                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{cat}</span>
                                                        <Button variant="danger" size="sm" onClick={() => persistExpenseCats(expenseCatList.filter((_, idx) => idx !== i))}>
                                                            <Trash2 size={14} aria-hidden />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border-subtle)", alignItems: "center" }}>
                                                    <SettingsShellInput
                                                        style={{ flex: "1 1 200px", minWidth: 160 }}
                                                        placeholder="e.g. Parking, Fines, Loading"
                                                        value={newExpenseCategory}
                                                        onChange={(e) => setNewExpenseCategory(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                const t = newExpenseCategory.trim();
                                                                if (!t) return;
                                                                persistExpenseCats([...expenseCatList, t]);
                                                                setNewExpenseCategory("");
                                                            }
                                                        }}
                                                    />
                                                    <Button variant="premium" onClick={() => {
                                                        const t = newExpenseCategory.trim();
                                                        if (!t) return;
                                                        persistExpenseCats([...expenseCatList, t]);
                                                        setNewExpenseCategory("");
                                                    }}>
                                                        <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
                                                        Add category
                                                    </Button>
                                                    <Button variant="ghost" onClick={() => {
                                                        persistExpenseCats([...DEFAULT_EXPENSE_CATEGORIES]);
                                                        showToast?.("Expense categories reset to defaults", "success");
                                                    }}>
                                                        Restore defaults
                                                    </Button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </fieldset>
                    )}

                    {/* ── FLEET ── */}
                    {activeTab === 'fleet' && (
                        <fieldset disabled={!workspaceTabEditable.fleet || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Fleet settings</legend>
                            <SettingsShellSectionHeader title="Fleet Intelligence" desc="Set default fuel pricing and maintenance intervals." icon={Truck} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                <SettingsShellField label="Default Fuel Price (KES/L)">
                                    <SettingsShellInput type="number" value={localS.defaultFuelPrice || 180} onChange={e => saveSettings({ defaultFuelPrice: +e.target.value })} />
                                </SettingsShellField>
                                <SettingsShellField label="Tyre Lifespan (km)">
                                    <SettingsShellInput type="number" value={localS.tyreKm || 40000} onChange={e => saveSettings({ tyreKm: +e.target.value })} />
                                </SettingsShellField>
                                <div style={{ gridColumn: "1/-1" }}>
                                    <div style={{ background: "var(--brand-primary)08", borderRadius: 16, padding: 24, border: "1px solid var(--brand-primary)20" }}>
                                        <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-primary)", marginBottom: 16 }}>Critical Maintenance & Fleet Thresholds</h4>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                                            <SettingsShellField label="Standard Warning Distance (km)">
                                                <SettingsShellInput type="number" value={localS.maintWarningKm || 1000} onChange={e => saveSettings({ maintWarningKm: +e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Critical Alert Distance (km)">
                                                <SettingsShellInput type="number" value={localS.maintCriticalKm || 200} onChange={e => saveSettings({ maintCriticalKm: +e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Tyre Warning Threshold (km)" sub="Alert when reached (e.g. 5000km before lifespan)">
                                                <SettingsShellInput type="number" value={localS.tyreWarnKm || 5000} onChange={e => saveSettings({ tyreWarnKm: +e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Default Tyre Interval (km)" sub="Fallback for new tyres">
                                                <SettingsShellInput type="number" value={localS.defaultTyreInterval || 60000} onChange={e => saveSettings({ defaultTyreInterval: +e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Max Fuel Tank Capacity (L)" sub="Used for abnormal fuel log validation">
                                                <SettingsShellInput type="number" value={localS.maxFuelLitres || 2000} onChange={e => saveSettings({ maxFuelLitres: +e.target.value })} />
                                            </SettingsShellField>
                                            <SettingsShellField label="Fleet Activity Alert (%)" sub="Warn if active fleet falls below this %">
                                                <SettingsShellInput type="number" value={localS.fleetActiveWarnPct || 50} onChange={e => saveSettings({ fleetActiveWarnPct: +e.target.value })} />
                                            </SettingsShellField>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ gridColumn: "1/-1", marginTop: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-primary)12", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)" }}>
                                        <IdCard size={18} aria-hidden />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Driving licence classes</h4>
                                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 }}>
                                            These options appear on the driver form so you can record which PSV / DL classes each operator holds.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                    {(() => {
                                        const licenceList = Array.isArray(localS.licenceClasses)
                                            ? localS.licenceClasses
                                            : [...DEFAULT_LICENCE_CLASSES];
                                        const persistList = (next) => saveSettings({ licenceClasses: next });
                                        return (
                                            <>
                                                {licenceList.length === 0 && (
                                                    <p
                                                        style={{
                                                            margin: "0 0 16px",
                                                            fontSize: 13,
                                                            color: "var(--text-muted)",
                                                            fontWeight: 500,
                                                            lineHeight: 1.5,
                                                        }}
                                                    >
                                                        No licence classes yet. Add labels below, or use <strong>Restore defaults</strong> for the standard list.
                                                    </p>
                                                )}
                                                {licenceList.map((cls, i) => (
                                                    <div
                                                        key={`${cls}-${i}`}
                                                        style={{
                                                            display: "flex",
                                                            justifyContent: "space-between",
                                                            alignItems: "center",
                                                            marginBottom: 12,
                                                            padding: "12px 14px",
                                                            background: "var(--bg-card)",
                                                            borderRadius: 10,
                                                            border: "1px solid var(--border-subtle)",
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{cls}</span>
                                                        <Button
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => {
                                                                const next = licenceList.filter((_, idx) => idx !== i);
                                                                persistList(next);
                                                            }}
                                                        >
                                                            <Trash2 size={14} aria-hidden />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: 12,
                                                        marginTop: 16,
                                                        paddingTop: 16,
                                                        borderTop: "1px dashed var(--border-subtle)",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <SettingsShellInput
                                                        style={{ flex: "1 1 200px", minWidth: 160 }}
                                                        placeholder="e.g. Class D1, CE artic"
                                                        value={newLicenceClass}
                                                        onChange={(e) => setNewLicenceClass(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                const t = newLicenceClass.trim();
                                                                if (!t) return;
                                                                if (licenceList.some((c) => c.toLowerCase() === t.toLowerCase())) {
                                                                    showToast?.("That class is already listed", "warning");
                                                                    return;
                                                                }
                                                                persistList([...licenceList, t]);
                                                                setNewLicenceClass("");
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        variant="premium"
                                                        onClick={() => {
                                                            const t = newLicenceClass.trim();
                                                            if (!t) return;
                                                            if (licenceList.some((c) => c.toLowerCase() === t.toLowerCase())) {
                                                                showToast?.("That class is already listed", "warning");
                                                                return;
                                                            }
                                                            persistList([...licenceList, t]);
                                                            setNewLicenceClass("");
                                                        }}
                                                    >
                                                        <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
                                                        Add class
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => {
                                                            persistList([...DEFAULT_LICENCE_CLASSES]);
                                                            showToast?.("Licence classes reset to defaults", "success");
                                                        }}
                                                    >
                                                        Restore defaults
                                                    </Button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                 <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 32, marginTop: 32 }}>
                                    {/* ── VEHICLE / TRUCK TYPES ── */}
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-primary)12", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)" }}>
                                                <Truck size={18} aria-hidden />
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Vehicle / Truck types</h4>
                                                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 }}>
                                                    Categories of vehicles (e.g. Tipper, Tanker).
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                            {(() => {
                                                const truckTypeList = Array.isArray(localS.truckTypes)
                                                    ? localS.truckTypes
                                                    : [...DEFAULT_TRUCK_TYPES];
                                                const persistTruckTypes = (next) => saveSettings({ truckTypes: next });
                                                return (
                                                    <>
                                                        {truckTypeList.length === 0 && (
                                                            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.5 }}>
                                                                No truck types defined.
                                                            </p>
                                                        )}
                                                        {truckTypeList.map((type, i) => (
                                                            <div key={`${type}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                                                                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{type}</span>
                                                                <Button variant="danger" size="sm" onClick={() => persistTruckTypes(truckTypeList.filter((_, idx) => idx !== i))}>
                                                                    <Trash2 size={14} aria-hidden />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border-subtle)", alignItems: "center" }}>
                                                            <SettingsShellInput
                                                                style={{ flex: "1" }}
                                                                placeholder="e.g. Tipper, Crane Truck"
                                                                value={newTruckType}
                                                                onChange={(e) => setNewTruckType(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        const t = newTruckType.trim();
                                                                        if (!t) return;
                                                                        persistTruckTypes([...truckTypeList, t]);
                                                                        setNewTruckType("");
                                                                    }
                                                                }}
                                                            />
                                                            <Button variant="premium" onClick={() => {
                                                                const t = newTruckType.trim();
                                                                if (!t) return;
                                                                persistTruckTypes([...truckTypeList, t]);
                                                                setNewTruckType("");
                                                            }}>
                                                                Add
                                                            </Button>
                                                        </div>
                                                        <Button variant="ghost" size="sm" style={{ marginTop: 12, fontSize: 11 }} onClick={() => {
                                                            persistTruckTypes([...DEFAULT_TRUCK_TYPES]);
                                                            showToast?.("Truck types reset to defaults", "success");
                                                        }}>
                                                            Restore defaults
                                                        </Button>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* ── TRAILER TYPES ── */}
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-primary)12", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)" }}>
                                                <Timer size={18} aria-hidden />
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Trailer unit types</h4>
                                                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 }}>
                                                    Categories of trailers (e.g. Low Loader, Skeletal).
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                            {(() => {
                                                const trailerTypeList = Array.isArray(localS.trailerTypes)
                                                    ? localS.trailerTypes
                                                    : [...DEFAULT_TRAILER_TYPES];
                                                const persistTrailerTypes = (next) => saveSettings({ trailerTypes: next });
                                                return (
                                                    <>
                                                        {trailerTypeList.length === 0 && (
                                                            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.5 }}>
                                                                No trailer types defined.
                                                            </p>
                                                        )}
                                                        {trailerTypeList.map((type, i) => (
                                                            <div key={`${type}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                                                                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{type}</span>
                                                                <Button variant="danger" size="sm" onClick={() => persistTrailerTypes(trailerTypeList.filter((_, idx) => idx !== i))}>
                                                                    <Trash2 size={14} aria-hidden />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border-subtle)", alignItems: "center" }}>
                                                            <SettingsShellInput
                                                                style={{ flex: "1" }}
                                                                placeholder="e.g. Flatbed, Skeletal"
                                                                value={newTrailerType}
                                                                onChange={(e) => setNewTrailerType(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        const t = newTrailerType.trim();
                                                                        if (!t) return;
                                                                        persistTrailerTypes([...trailerTypeList, t]);
                                                                        setNewTrailerType("");
                                                                    }
                                                                }}
                                                            />
                                                            <Button variant="premium" onClick={() => {
                                                                const t = newTrailerType.trim();
                                                                if (!t) return;
                                                                persistTrailerTypes([...trailerTypeList, t]);
                                                                setNewTrailerType("");
                                                            }}>
                                                                Add
                                                            </Button>
                                                        </div>
                                                        <Button variant="ghost" size="sm" style={{ marginTop: 12, fontSize: 11 }} onClick={() => {
                                                            persistTrailerTypes([...DEFAULT_TRAILER_TYPES]);
                                                            showToast?.("Trailer types reset to defaults", "success");
                                                        }}>
                                                            Restore defaults
                                                        </Button>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* ── CARGO TYPES ── */}
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, marginTop: 32 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-primary)12", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)" }}>
                                        <Package size={18} aria-hidden />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Cargo types</h4>
                                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 }}>
                                            Define the types of goods you transport.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                    {(() => {
                                        const cargoTypeList = Array.isArray(localS.cargoTypes)
                                            ? localS.cargoTypes
                                            : [...DEFAULT_CARGO_TYPES];
                                        const persistCargoTypes = (next) => saveSettings({ cargoTypes: next });
                                        return (
                                            <>
                                                {cargoTypeList.map((type, i) => (
                                                    <div key={`${type}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "12px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                                                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{type}</span>
                                                        <Button variant="danger" size="sm" onClick={() => persistCargoTypes(cargoTypeList.filter((_, idx) => idx !== i))}>
                                                            <Trash2 size={14} aria-hidden />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border-subtle)", alignItems: "center" }}>
                                                    <SettingsShellInput
                                                        style={{ flex: "1 1 200px", minWidth: 160 }}
                                                        placeholder="e.g. Hazardous Materials, Milk"
                                                        value={newCargoType}
                                                        onChange={(e) => setNewCargoType(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                const t = newCargoType.trim();
                                                                if (!t) return;
                                                                persistCargoTypes([...cargoTypeList, t]);
                                                                setNewCargoType("");
                                                            }
                                                        }}
                                                    />
                                                    <Button variant="premium" onClick={() => {
                                                        const t = newCargoType.trim();
                                                        if (!t) return;
                                                        persistCargoTypes([...cargoTypeList, t]);
                                                        setNewCargoType("");
                                                    }}>
                                                        <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
                                                        Add type
                                                    </Button>
                                                    <Button variant="ghost" onClick={() => {
                                                        persistCargoTypes([...DEFAULT_CARGO_TYPES]);
                                                        showToast?.("Cargo types reset to defaults", "success");
                                                    }}>
                                                        Restore defaults
                                                    </Button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </fieldset>
                    )}

                    {/* ── ROUTES & RATES ── */}
                    {activeTab === 'routes' && (
                        <fieldset disabled={!workspaceTabEditable.routes || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Routes and rates</legend>
                            <SettingsShellSectionHeader title="Mileage & Allowances" desc="Define standard pay rates per kilometer." icon={Navigation} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                                <SettingsShellField label="Driver Rate (KES/km)">
                                    <SettingsShellInput type="number" value={localS.driverPerKm || 10} onChange={e => saveSettings({ driverPerKm: +e.target.value })} />
                                </SettingsShellField>
                                <SettingsShellField label="Turnboy Rate (KES/km)">
                                    <SettingsShellInput type="number" value={localS.turnboyPerKm || 6} onChange={e => saveSettings({ turnboyPerKm: +e.target.value })} />
                                </SettingsShellField>
                            </div>

                            <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>International and Domestic Flat Rates</h4>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32, padding: 20, background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 12 }}>Inside Kenya (Domestic)</p>
                                    <div style={{ display: "grid", gap: 12 }}>
                                        <SettingsShellField label="Driver Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateInsideDriver || 0} onChange={e => saveSettings({ flatRateInsideDriver: +e.target.value })} />
                                        </SettingsShellField>
                                        <SettingsShellField label="Ret. Driver Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateInsideDriverReturn || 0} onChange={e => saveSettings({ flatRateInsideDriverReturn: +e.target.value })} />
                                        </SettingsShellField>
                                        <SettingsShellField label="Turnboy Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateInsideTurnboy || 0} onChange={e => saveSettings({ flatRateInsideTurnboy: +e.target.value })} />
                                        </SettingsShellField>
                                        <SettingsShellField label="Ret. Turnboy Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateInsideTurnboyReturn || 0} onChange={e => saveSettings({ flatRateInsideTurnboyReturn: +e.target.value })} />
                                        </SettingsShellField>
                                    </div>
                                </div>
                                <div style={{ borderLeft: "1px dashed var(--border-subtle)", paddingLeft: 24 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 12 }}>Outside Kenya (International)</p>
                                    <div style={{ display: "grid", gap: 12 }}>
                                        <SettingsShellField label="Driver Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateOutsideDriver || 0} onChange={e => saveSettings({ flatRateOutsideDriver: +e.target.value })} />
                                        </SettingsShellField>
                                        <SettingsShellField label="Ret. Driver Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateOutsideDriverReturn || 0} onChange={e => saveSettings({ flatRateOutsideDriverReturn: +e.target.value })} />
                                        </SettingsShellField>
                                        <SettingsShellField label="Turnboy Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateOutsideTurnboy || 0} onChange={e => saveSettings({ flatRateOutsideTurnboy: +e.target.value })} />
                                        </SettingsShellField>
                                        <SettingsShellField label="Ret. Turnboy Flat Rate (KES)">
                                            <SettingsShellInput type="number" value={localS.flatRateOutsideTurnboyReturn || 0} onChange={e => saveSettings({ flatRateOutsideTurnboyReturn: +e.target.value })} />
                                        </SettingsShellField>
                                    </div>
                                </div>
                            </div>

                            <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>Road User Allowance</h4>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32, padding: 20, background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                                <SettingsShellField label="Standard Road User Allowance (KES)" desc="Added to journey completion expenses automatically.">
                                    <SettingsShellInput type="number" value={localS.roadUserAllowance || 0} onChange={e => saveSettings({ roadUserAllowance: +e.target.value })} />
                                </SettingsShellField>
                                <SettingsShellField label="Return Road User Allowance (KES)" desc="Override for returning empty trips.">
                                    <SettingsShellInput type="number" value={localS.roadUserAllowanceReturn || 0} onChange={e => saveSettings({ roadUserAllowanceReturn: +e.target.value })} />
                                </SettingsShellField>
                            </div>

                            <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Quick routes (journey modal)</h4>
                            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.55, fontWeight: 500 }}>
                                These presets fill the <strong>Quick route</strong> dropdown when you log or edit a journey (origin, destination, and distance). They are stored in this browser under workspace settings.
                            </p>
                            <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20, marginBottom: 32 }}>
                                {(() => {
                                    const quickList = Array.isArray(localS.commonRoutes) ? localS.commonRoutes : [...DEFAULT_COMMON_ROUTES];
                                    const persistQuick = (next) => saveSettings({ commonRoutes: next });
                                    return (
                                        <>
                                            {quickList.map((r, i) => (
                                                <div
                                                    key={`${r.origin}-${r.dest}-${i}`}
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        marginBottom: 12,
                                                        padding: "12px 14px",
                                                        background: "var(--bg-card)",
                                                        borderRadius: 10,
                                                        border: "1px solid var(--border-subtle)",
                                                        gap: 12,
                                                        flexWrap: "wrap",
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>
                                                        {r.origin} → {r.dest}{" "}
                                                        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>({Number(r.distance) || 0} km)</span>
                                                    </span>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => {
                                                            const base = Array.isArray(localS.commonRoutes) ? [...localS.commonRoutes] : [...DEFAULT_COMMON_ROUTES];
                                                            persistQuick(base.filter((_, idx) => idx !== i));
                                                        }}
                                                    >
                                                        <Trash2 size={14} aria-hidden />
                                                    </Button>
                                                </div>
                                            ))}
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr minmax(88px, 120px) auto",
                                                    gap: 12,
                                                    marginTop: 16,
                                                    paddingTop: 16,
                                                    borderTop: "1px dashed var(--border-subtle)",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <SettingsShellInput
                                                    placeholder="Origin"
                                                    value={quickRouteForm.origin}
                                                    onChange={(e) => setQuickRouteForm((p) => ({ ...p, origin: e.target.value }))}
                                                />
                                                <SettingsShellInput
                                                    placeholder="Destination"
                                                    value={quickRouteForm.dest}
                                                    onChange={(e) => setQuickRouteForm((p) => ({ ...p, dest: e.target.value }))}
                                                />
                                                <SettingsShellInput
                                                    type="number"
                                                    placeholder="km"
                                                    value={quickRouteForm.distance}
                                                    onChange={(e) => setQuickRouteForm((p) => ({ ...p, distance: e.target.value }))}
                                                />
                                                <Button
                                                    variant="premium"
                                                    onClick={() => {
                                                        const o = quickRouteForm.origin.trim();
                                                        const d = quickRouteForm.dest.trim();
                                                        if (!o || !d) {
                                                            alert("Origin and destination are required.");
                                                            return;
                                                        }
                                                        const base = Array.isArray(localS.commonRoutes) ? [...localS.commonRoutes] : [...DEFAULT_COMMON_ROUTES];
                                                        const dist = Number(quickRouteForm.distance) || 0;
                                                        persistQuick([...base, { origin: o, dest: d, distance: dist }]);
                                                        setQuickRouteForm({ origin: "", dest: "", distance: "" });
                                                    }}
                                                >
                                                    <Plus size={16} aria-hidden style={{ marginRight: 6 }} />
                                                    Add
                                                </Button>
                                            </div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        persistQuick([...DEFAULT_COMMON_ROUTES]);
                                                        showToast?.("Quick routes restored to defaults", "success");
                                                    }}
                                                >
                                                    Restore default quick routes
                                                </Button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                            
                            <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>Route-Specific Overrides</h4>
                            <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                {(Array.isArray(localS.routeOverrides) ? localS.routeOverrides : []).map((ro, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: 12, background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{ro.origin} → {ro.dest}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)", display: 'flex', gap: 12, marginTop: 4 }}>
                                                <span>Driver: <strong>{fmt(ro.driverRate)}</strong> (Ret: {fmt(ro.returnDriverRate || ro.driverRate)})</span>
                                                <span>Turnboy: <strong>{fmt(ro.turnboyRate)}</strong> (Ret: {fmt(ro.returnTurnboyRate || ro.turnboyRate)})</span>
                                            </div>

                                        </div>
                                        <Button variant="danger" size="sm" onClick={() => saveSettings({ routeOverrides: (Array.isArray(localS.routeOverrides) ? localS.routeOverrides : []).filter((_, idx) => idx !== i) })}><Trash2 size={14}/></Button>
                                    </div>
                                ))}
                                
                                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1.2fr 1fr 1fr 1fr 1fr auto", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--border-subtle)", alignItems: 'end' }}>
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Origin</label>
                                        <SettingsShellInput placeholder="e.g. Mombasa" value={routeForm.origin} onChange={e => setRouteForm(prev => ({ ...prev, origin: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Destination</label>
                                        <SettingsShellInput placeholder="e.g. Nairobi" value={routeForm.dest} onChange={e => setRouteForm(prev => ({ ...prev, dest: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Driver Rate</label>
                                        <SettingsShellInput type="number" placeholder="KES/km" value={routeForm.driverRate} onChange={e => setRouteForm(prev => ({ ...prev, driverRate: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>TB Rate</label>
                                        <SettingsShellInput type="number" placeholder="KES/km" value={routeForm.turnboyRate} onChange={e => setRouteForm(prev => ({ ...prev, turnboyRate: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Ret. Driver</label>
                                        <SettingsShellInput type="number" placeholder="KES/km" value={routeForm.returnDriverRate} onChange={e => setRouteForm(prev => ({ ...prev, returnDriverRate: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Ret. TB</label>
                                        <SettingsShellInput type="number" placeholder="KES/km" value={routeForm.returnTurnboyRate} onChange={e => setRouteForm(prev => ({ ...prev, returnTurnboyRate: e.target.value }))} />
                                    </div>
                                    <Button variant="premium" style={{ height: 42 }} onClick={() => {
                                        if (routeForm.origin && routeForm.dest) {
                                            saveSettings({ routeOverrides: [...(Array.isArray(localS.routeOverrides) ? localS.routeOverrides : []), routeForm] });
                                            setRouteForm({ origin: '', dest: '', driverRate: '', turnboyRate: '', returnDriverRate: '', returnTurnboyRate: '' });
                                        } else {
                                            alert("Origin and Destination are required!");
                                        }
                                    }}>Add</Button>
                                </div>

                            </div>
                        </fieldset>
                    )}

                    {/* ── WAYBILL DEFAULTS ── */}
                    {activeTab === 'waybill' && (
                        <fieldset disabled={!workspaceTabEditable.waybill || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Waybill defaults</legend>
                            <SettingsShellSectionHeader title="Waybill defaults" desc="These values pre-fill every new road freight waybill. Trip-specific fields are filled per journey." icon={ClipboardList} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                                <SettingsShellField label="Carrier / company name" sub="Defaults to organization name if left blank">
                                    <SettingsShellInput value={localS.wbCarrierName || ''} onChange={e => saveSettings({ wbCarrierName: e.target.value })} placeholder="Segecha Group Ltd" />
                                </SettingsShellField>
                                <SettingsShellField label="KRA PIN (carrier)" sub="Shown on all waybills">
                                    <SettingsShellInput value={localS.wbCarrierKraPin || ''} onChange={e => saveSettings({ wbCarrierKraPin: e.target.value })} placeholder="P000000000A" />
                                </SettingsShellField>
                                <SettingsShellField label="NTSA transport licence no.">
                                    <SettingsShellInput value={localS.wbCarrierNtsa || ''} onChange={e => saveSettings({ wbCarrierNtsa: e.target.value })} placeholder="NTSA/TL/XXXX" />
                                </SettingsShellField>
                                <SettingsShellField label="Default trailer registration" sub="Pre-filled on waybill Section 2">
                                    <SettingsShellInput value={localS.wbTrailerReg || ''} onChange={e => saveSettings({ wbTrailerReg: e.target.value })} placeholder="e.g. ZH 5825" />
                                </SettingsShellField>
                                <SettingsShellField label="Office address" sub="Carrier address on waybill">
                                    <SettingsShellInput value={localS.wbCarrierAddress || ''} onChange={e => saveSettings({ wbCarrierAddress: e.target.value })} placeholder="Industrial Area, Nairobi" />
                                </SettingsShellField>
                                <SettingsShellField label="Office phone / WhatsApp">
                                    <SettingsShellInput value={localS.wbCarrierPhone || ''} onChange={e => saveSettings({ wbCarrierPhone: e.target.value })} placeholder="+254700000000" />
                                </SettingsShellField>
                                <SettingsShellField label="Office email">
                                    <SettingsShellInput type="email" value={localS.wbCarrierEmail || ''} onChange={e => saveSettings({ wbCarrierEmail: e.target.value })} placeholder="operations@example.com" />
                                </SettingsShellField>
                            </div>

                            <SettingsShellSectionHeader title="Waybill numbering" desc="Numbers auto-increment when a waybill is first saved from the journey modal." icon={ClipboardList} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 16 }}>
                                <SettingsShellField label="Waybill number prefix" sub="e.g. WB → WB-2025-00001">
                                    <SettingsShellInput
                                        value={localS.wbPrefix || localS.waybillPrefix || 'WB'}
                                        onChange={e => {
                                            const v = e.target.value.toUpperCase().replace(/\s+/g, '');
                                            saveSettings({ wbPrefix: v, waybillPrefix: v });
                                        }}
                                    />
                                </SettingsShellField>
                                <SettingsShellField label="Next waybill sequence no." sub="Increments after each first-time save">
                                    <SettingsShellInput
                                        type="number"
                                        min={1}
                                        value={localS.waybillCounter ?? 1}
                                        onChange={e => saveSettings({ waybillCounter: Math.max(1, +e.target.value || 1) })}
                                    />
                                </SettingsShellField>
                            </div>
                            <div style={{ background: "var(--surface-subtle)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
                                Next waybill will be:{" "}
                                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, color: "var(--text-primary)" }}>
                                    {(localS.wbPrefix || localS.waybillPrefix || 'WB')}-{new Date().getFullYear()}-{String(localS.waybillCounter ?? 1).padStart(5, '0')}
                                </span>
                            </div>

                            <div style={{ marginBottom: 32 }}>
                                <SettingsShellField label="Stale Transit Warning (Days)" sub="Journeys in transit longer than this will be flagged as stale.">
                                    <SettingsShellInput type="number" value={localS.staleTransitDays || 5} onChange={e => saveSettings({ staleTransitDays: +e.target.value })} />
                                </SettingsShellField>
                            </div>

                            <SettingsShellSectionHeader
                                title="Cross-border routes"
                                desc="When a journey destination contains any keyword below, the waybill opens in cross-border mode and fills the suggested border crossing (you can still edit it in the modal)."
                                icon={Navigation}
                            />
                            <div className="settings-cb-card">
                                <p className="settings-cb-intro">
                                    Use commas between place names (e.g. <span className="settings-cb-mono">kampala, jinja</span>). Matching ignores capital letters. The first row
                                    that matches wins. Leave the border field empty if you only want cross-border mode without a default suggestion.
                                </p>
                                <div className="settings-cb-table-head">
                                    <span>Destination keywords</span>
                                    <span>Suggested border / corridor</span>
                                    <span className="settings-cb-col-actions">Actions</span>
                                </div>
                                {(Array.isArray(localS.crossBorderRules) && localS.crossBorderRules.length > 0
                                    ? localS.crossBorderRules
                                    : DEFAULT_CROSS_BORDER_RULES.map((x) => ({ ...x }))
                                ).map((row) => (
                                    <div key={row.id} className="settings-cb-row">
                                        <SettingsShellInput
                                            value={row.keywordsText || ""}
                                            placeholder="e.g. kampala, jinja, entebbe"
                                            onChange={(e) => {
                                                const r = localS.crossBorderRules;
                                                const base =
                                                    Array.isArray(r) && r.length > 0
                                                        ? r.map((x) => ({ ...x }))
                                                        : DEFAULT_CROSS_BORDER_RULES.map((x) => ({ ...x }));
                                                saveSettings({
                                                    crossBorderRules: base.map((x) =>
                                                        x.id === row.id ? { ...x, keywordsText: e.target.value } : x
                                                    ),
                                                });
                                            }}
                                        />
                                        <SettingsShellInput
                                            value={row.borderPoint || ""}
                                            placeholder="e.g. Malaba / Busia"
                                            onChange={(e) => {
                                                const r = localS.crossBorderRules;
                                                const base =
                                                    Array.isArray(r) && r.length > 0
                                                        ? r.map((x) => ({ ...x }))
                                                        : DEFAULT_CROSS_BORDER_RULES.map((x) => ({ ...x }));
                                                saveSettings({
                                                    crossBorderRules: base.map((x) =>
                                                        x.id === row.id ? { ...x, borderPoint: e.target.value } : x
                                                    ),
                                                });
                                            }}
                                        />
                                        <div className="settings-cb-col-actions">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={Trash2}
                                                onClick={() => {
                                                    const r = localS.crossBorderRules;
                                                    const base =
                                                        Array.isArray(r) && r.length > 0
                                                            ? r.map((x) => ({ ...x }))
                                                            : DEFAULT_CROSS_BORDER_RULES.map((x) => ({ ...x }));
                                                    const next = base.filter((x) => x.id !== row.id);
                                                    saveSettings({ crossBorderRules: next.length ? next : DEFAULT_CROSS_BORDER_RULES.map((x) => ({ ...x })) });
                                                }}
                                                aria-label="Remove row"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div className="settings-cb-actions">
                                    <Button
                                        variant="secondary"
                                        icon={Plus}
                                        onClick={() => {
                                            const r = localS.crossBorderRules;
                                            const base =
                                                Array.isArray(r) && r.length > 0
                                                    ? r.map((x) => ({ ...x }))
                                                    : DEFAULT_CROSS_BORDER_RULES.map((x) => ({ ...x }));
                                            saveSettings({
                                                crossBorderRules: [
                                                    ...base,
                                                    { id: `cb-${Date.now()}`, keywordsText: "", borderPoint: "" },
                                                ],
                                            });
                                        }}
                                    >
                                        Add row
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    "Replace all rows with the built-in default list? Your current list will be lost."
                                                )
                                            ) {
                                                saveSettings({ crossBorderRules: DEFAULT_CROSS_BORDER_RULES.map((x) => ({ ...x })) });
                                            }
                                        }}
                                    >
                                        Restore built-in defaults
                                    </Button>
                                </div>
                            </div>
                        </fieldset>
                    )}

                    {/* ── MAINTENANCE ── */}
                    {activeTab === 'maintenance' && (
                        <fieldset disabled={!workspaceTabEditable.maintenance || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Maintenance schedule</legend>
                            <SettingsShellSectionHeader title="Preventive Maintenance Schedule" desc="Define recurring service tasks and their kilometer intervals." icon={Wrench} />
                            
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                                <SettingsShellField label="Maintenance Overdue Threshold (Days)" sub="Grace period after scheduled service date before status turns critical.">
                                    <SettingsShellInput type="number" value={localS.maintenanceOverdueDays || 7} onChange={e => saveSettings({ maintenanceOverdueDays: +e.target.value })} />
                                </SettingsShellField>
                            </div>
                            <div style={{ background: "var(--surface-subtle)", borderRadius: 16, border: "1px solid var(--border-subtle)", padding: 24 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginBottom: 12, padding: "0 12px", fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase" }}>
                                    <div>Service Task</div>
                                    <div>Interval (KM)</div>
                                    <div style={{ textAlign: "right" }}>Actions</div>
                                </div>
                                
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                                    {(localS.maintenanceSchedule || [
                                        { task: 'Oil Change', intervalKm: 10000 },
                                        { task: 'Tyre Rotation', intervalKm: 10000 },
                                        { task: 'Wheel Alignment & Balancing', intervalKm: 10000 },
                                        { task: 'Brake Disc Inspection', intervalKm: 15000 },
                                        { task: 'Brake Pad Replacement', intervalKm: 15000 },
                                        { task: 'Fuel Filter Replacement', intervalKm: 20000 },
                                        { task: 'Power Steering Fluid Top-up', intervalKm: 20000 },
                                        { task: 'Engine Belt Inspection', intervalKm: 30000 },
                                        { task: 'Differential Oil Change', intervalKm: 40000 },
                                        { task: 'Transmission Fluid Change', intervalKm: 40000 },
                                    ]).map((s, i) => (
                                        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", alignItems: "center", gap: 16, padding: "12px 16px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.task}</div>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 14 }}>{Number(s.intervalKm).toLocaleString()} km</div>
                                            <div style={{ textAlign: "right" }}>
                                                <TableRowActions
                                                    ariaLabel={`Actions for ${s.task}`}
                                                    items={[
                                                        {
                                                            id: "remove",
                                                            label: "Remove task",
                                                            icon: Trash2,
                                                            danger: true,
                                                            onClick: () => {
                                                                const current = localS.maintenanceSchedule || [
                                                                    { task: "Oil Change", intervalKm: 10000 },
                                                                    { task: "Tyre Rotation", intervalKm: 10000 },
                                                                    { task: "Wheel Alignment & Balancing", intervalKm: 10000 },
                                                                    { task: "Brake Disc Inspection", intervalKm: 15000 },
                                                                    { task: "Brake Pad Replacement", intervalKm: 15000 },
                                                                    { task: "Fuel Filter Replacement", intervalKm: 20000 },
                                                                    { task: "Power Steering Fluid Top-up", intervalKm: 20000 },
                                                                    { task: "Engine Belt Inspection", intervalKm: 30000 },
                                                                    { task: "Differential Oil Change", intervalKm: 40000 },
                                                                    { task: "Transmission Fluid Change", intervalKm: 40000 },
                                                                ];
                                                                saveSettings({ maintenanceSchedule: current.filter((_, idx) => idx !== i) });
                                                            },
                                                        },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, paddingTop: 20, borderTop: "1px dashed var(--border-subtle)" }}>
                                    <SettingsShellInput id="new-task-name" placeholder="Task Name (e.g. Gearbox Service)" />
                                    <SettingsShellInput id="new-task-km" type="number" placeholder="Interval (KM)" />
                                    <Button variant="premium" onClick={() => {
                                        const t = document.getElementById('new-task-name').value;
                                        const k = document.getElementById('new-task-km').value;
                                        if (t && k) {
                                            const current = localS.maintenanceSchedule || [
                                                { task: 'Oil Change', intervalKm: 10000 },
                                                { task: 'Tyre Rotation', intervalKm: 10000 },
                                                { task: 'Wheel Alignment & Balancing', intervalKm: 10000 },
                                                { task: 'Brake Disc Inspection', intervalKm: 15000 },
                                                { task: 'Brake Pad Replacement', intervalKm: 15000 },
                                                { task: 'Fuel Filter Replacement', intervalKm: 20000 },
                                                { task: 'Power Steering Fluid Top-up', intervalKm: 20000 },
                                                { task: 'Engine Belt Inspection', intervalKm: 30000 },
                                                { task: 'Differential Oil Change', intervalKm: 40000 },
                                                { task: 'Transmission Fluid Change', intervalKm: 40000 },
                                            ];
                                            saveSettings({ maintenanceSchedule: [...current, { task: t, intervalKm: +k }] });
                                            document.getElementById('new-task-name').value = '';
                                            document.getElementById('new-task-km').value = '';
                                        }
                                    }}><Plus size={18} /> Add Task</Button>
                                </div>
                            </div>
                        </fieldset>
                    )}


                    {/* ── ALERTS & RULES ── */}
                    {activeTab === 'alerts' && (
                        <fieldset disabled={!workspaceTabEditable.alerts || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Alerts and rules</legend>
                            <SettingsShellSectionHeader title="Alerts & Rules" desc="Configure notification threshold and document warnings." icon={Bell} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                <SettingsShellField label="Document Expiry Warning (Days)">
                                    <SettingsShellInput type="number" value={localS.docAlertDays || 30} onChange={e => saveSettings({ docAlertDays: +e.target.value })} />
                                </SettingsShellField>
                                <SettingsShellField label="Late Arrival Threshold (Hrs)">
                                    <SettingsShellInput type="number" value={localS.lateThreshold || 4} onChange={e => saveSettings({ lateThreshold: +e.target.value })} />
                                </SettingsShellField>
                            </div>
                        </fieldset>
                    )}

                    {/* ── STAFF CONFIGURATION ── */}
                    {activeTab === 'staff' && (
                        <fieldset disabled={!workspaceTabEditable.staff || !canEditSettings} className="settings-workspace-fieldset">
                            <legend className="settings-fieldset-sr-only">Staff and HR</legend>
                            <SettingsShellSectionHeader title="Staff & HR Configuration" desc="Manage company departments, employee roles, and access control." icon={UserPlus} />
                            
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                                {/* Departments */}
                                <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                    <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                                        Departments 
                                        <Badge status="Active" text={(localS.departments || ['Operations', 'Finance', 'Logistics']).length} />
                                    </h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                        {(localS.departments || ['Operations', 'Finance', 'Logistics']).map((d, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border-subtle)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                                {d}
                                                <Button variant="danger" size="sm" onClick={() => saveSettings({ departments: (localS.departments || ['Operations', 'Finance', 'Logistics']).filter((_, idx) => idx !== i) })} style={{ padding: "4px 8px", height: "auto" }}><Trash2 size={12}/></Button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <SettingsShellInput id="new-dept" placeholder="New Department..." />
                                        <Button variant="premium" onClick={() => {
                                            const val = document.getElementById('new-dept').value;
                                            if (val) {
                                                saveSettings({ departments: [...(localS.departments || ['Operations', 'Finance', 'Logistics']), val] });
                                                document.getElementById('new-dept').value = '';
                                            }
                                        }}><Plus size={16} /></Button>
                                    </div>
                                </div>

                                {/* Roles */}
                                <div style={{ background: "var(--surface-subtle)", borderRadius: 12, border: "1px solid var(--border-subtle)", padding: 20 }}>
                                    <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                                        Roles 
                                        <Badge status="Active" text={(localS.roles || ['Manager', 'Clerk', 'Accountant']).length} />
                                    </h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                                        {(localS.roles || ['Manager', 'Clerk', 'Accountant']).map((r, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border-subtle)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                                {r}
                                                <Button variant="danger" size="sm" onClick={() => saveSettings({ roles: (localS.roles || ['Manager', 'Clerk', 'Accountant']).filter((_, idx) => idx !== i) })} style={{ padding: "4px 8px", height: "auto" }}><Trash2 size={12}/></Button>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <SettingsShellInput id="new-role" placeholder="New Role..." />
                                        <Button variant="premium" onClick={() => {
                                            const val = document.getElementById('new-role').value;
                                            if (val) {
                                                saveSettings({ roles: [...(localS.roles || ['Manager', 'Clerk', 'Accountant']), val] });
                                                document.getElementById('new-role').value = '';
                                            }
                                        }}><Plus size={16} /></Button>
                                    </div>
                                </div>
                            </div>

                            {/* Access control moved to Staff section */}
                        </fieldset>
                    )}

                    {/* ── MESSAGE TEMPLATES ── */}
                    {activeTab === 'templates' && (
                        <div style={{ animation: "fade-in 0.4s ease-out" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 28 }}>
                                <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                                    <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, var(--brand-primary) 0%, #a855f7 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0, boxShadow: "0 8px 24px rgba(249, 115, 22, 0.25)" }}>
                                        <Sparkles size={26} strokeWidth={2.2} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                            Settings <ChevronRight size={10} /> Message Templates
                                        </div>
                                        <h2 style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.04em", margin: 0, lineHeight: 1.15 }}>
                                            Message & document templates
                                        </h2>
                                        <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--text-muted)", maxWidth: 520, lineHeight: 1.5 }}>
                                            Build emails, SMS, and PDF copy with placeholders. Changes save automatically with your workspace data.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    {localS._activeTemplateId && (
                                        <Button variant="secondary" onClick={() => { setLocalS((s) => ({ ...s, _activeTemplateId: null })); setTemplatePreviewOpen(false); }}>
                                            <X size={16} /> Back to library
                                        </Button>
                                    )}
                                    <Button
                                        variant="premium"
                                        icon={Plus}
                                        onClick={() => {
                                            const id = uid();
                                            const newTpl = {
                                                id,
                                                name: "New template",
                                                subject: "Subject line with {{businessName}}",
                                                description: "When this message is sent (e.g. after invoice issued).",
                                                body: templateTypeFilter === "PDF" ? "<h1>{{businessName}}</h1><p></p>" : "Hello {{customerName}},\n\n",
                                                type: templateTypeFilter,
                                                category: "General",
                                                _editorMode: templateTypeFilter === "PDF" ? "HTML" : "Visual",
                                                updatedAt: new Date().toISOString(),
                                            };
                                            setData((d) => ({ ...d, templates: [...(d.templates || []), newTpl] }));
                                            setLocalS((s) => ({ ...s, _activeTemplateId: id }));
                                            showToast?.("Template created — edit below", "success");
                                        }}
                                    >
                                        New template
                                    </Button>
                                </div>
                            </div>

                            {!localS._activeTemplateId ? (
                                <>
                                    <p className="template-studio-instructions">
                                        Use placeholders such as <code>{"{{businessName}}"}</code>, <code>{"{{invoiceId}}"}</code>,{" "}
                                        <code>{"{{destination}}"}</code>, <code>{"{{waybillNo}}"}</code>, and <code>{"{{staffId}}"}</code>. Snake_case
                                        variants (e.g. <code>{"{{customer_name}}"}</code>) still work. Sample preview uses your organization name from
                                        Settings where available.
                                    </p>

                                    <div className="template-studio-tabs" role="tablist" aria-label="Template channel">
                                        {["Email", "PDF", "SMS", "WhatsApp"].map((tf) => {
                                            const TIcon = tf === "Email" ? Mail : tf === "PDF" ? FileText : tf === "SMS" ? MessageSquare : MessageCircle;
                                            return (
                                                <button
                                                    key={tf}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={templateTypeFilter === tf}
                                                    className={`template-studio-tab${templateTypeFilter === tf ? " is-active" : ""}`}
                                                    onClick={() => setTemplateTypeFilter(tf)}
                                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700 }}
                                                >
                                                    <TIcon size={16} />
                                                    {tf}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="template-studio-search-row">
                                        <div className="template-studio-search-input-wrap">
                                            <Search size={18} strokeWidth={2} className="template-studio-search-icon" aria-hidden />
                                            <input
                                                value={templateSearch}
                                                onChange={(e) => setTemplateSearch(e.target.value)}
                                                placeholder="Search templates…"
                                                className="template-studio-search-input"
                                                aria-label="Search templates"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="premium"
                                            onClick={() =>
                                                showToast?.(
                                                    `${filteredTemplates.length} ${templateTypeFilter} template(s) match your search.`,
                                                    "success"
                                                )
                                            }
                                        >
                                            Search
                                        </Button>
                                    </div>

                                    {filteredTemplates.length === 0 ? (
                                        <Card style={{ padding: 56, textAlign: "center", border: "1px dashed var(--border-subtle)", borderRadius: 20, background: "var(--surface-subtle)" }}>
                                            <PenLine size={40} color="var(--text-dim)" style={{ margin: "0 auto 16px", opacity: 0.6 }} />
                                            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>No templates yet</div>
                                            <p style={{ color: "var(--text-muted)", marginBottom: 20, fontSize: 14 }}>
                                                {(data.templates || []).length === 0
                                                    ? `Create your first ${templateTypeFilter} template.`
                                                    : `No ${templateTypeFilter} templates match your search.`}
                                            </p>
                                            <Button
                                                variant="premium"
                                                icon={Plus}
                                                onClick={() => {
                                                    const id = uid();
                                                    const newTpl = {
                                                        id,
                                                        name: "New template",
                                                        subject: "Subject line with {{businessName}}",
                                                        description: "When this message is sent (e.g. after invoice issued).",
                                                        body: templateTypeFilter === "PDF" ? "<h1>{{businessName}}</h1><p></p>" : "Hello {{customerName}},\n\n",
                                                        type: templateTypeFilter,
                                                        category: "General",
                                                        _editorMode: templateTypeFilter === "PDF" ? "HTML" : "Visual",
                                                        updatedAt: new Date().toISOString(),
                                                    };
                                                    setData((d) => ({ ...d, templates: [...(d.templates || []), newTpl] }));
                                                    setLocalS((s) => ({ ...s, _activeTemplateId: id }));
                                                    showToast?.("Template created — edit below", "success");
                                                }}
                                            >
                                                Create template
                                            </Button>
                                        </Card>
                                    ) : (
                                        <Card style={{ padding: 0, overflow: "hidden", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                                            <div className="table-container">
                                                <table className="table-modern template-studio-table">
                                                    <thead>
                                                        <tr>
                                                            <th className="sticky-col" title="Template">Template</th>
                                                            <th title="Description">Description</th>
                                                            <th title="Last updated">Last updated</th>
                                                            <th className="status-col" style={{ textAlign: "right" }} title="Actions">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredTemplates.map((t) => {
                                                            const updatedLabel = t.updatedAt
                                                                ? new Date(t.updatedAt).toLocaleDateString("en-GB", {
                                                                      day: "numeric",
                                                                      month: "short",
                                                                      year: "numeric",
                                                                  })
                                                                : "—";
                                                            return (
                                                                <tr
                                                                    key={t.id}
                                                                    className="template-studio-table-row"
                                                                    onClick={() => {
                                                                        setTemplateTypeFilter(canonicalTemplateType(t.type));
                                                                        setLocalS((s) => ({ ...s, _activeTemplateId: t.id }));
                                                                    }}
                                                                >
                                                                    <td className="sticky-col" title={t.name}>
                                                                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{t.name}</div>
                                                                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{t.category || "General"}</div>
                                                                    </td>
                                                                    <td style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 360 }} title={t.description || "No description"}>
                                                                        {t.description || "—"}
                                                                    </td>
                                                                    <td style={{ color: "var(--text-muted)", fontSize: 13, whiteSpace: "nowrap" }} title={updatedLabel}>{updatedLabel}</td>
                                                                    <td className="status-col" style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
                                                                        <button
                                                                            type="button"
                                                                            className="template-studio-edit-link"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setLocalS((s) => ({ ...s, _activeTemplateId: t.id }));
                                                                            }}
                                                                            title="Edit template"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="template-studio-delete-icon-btn"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (window.confirm(`Delete the template "${t.name}" permanently?`)) {
                                                                                    setData((d) => ({ ...d, templates: (d.templates || []).filter((tx) => tx.id !== t.id) }));
                                                                                    showToast?.("Template deleted", "success");
                                                                                }
                                                                            }}
                                                                            style={{ 
                                                                                background: "none", 
                                                                                border: "none", 
                                                                                color: "#ef4444", 
                                                                                cursor: "pointer", 
                                                                                padding: "6px",
                                                                                borderRadius: "8px",
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                                transition: "background 0.2s"
                                                                            }}
                                                                            onMouseOver={(e) => e.currentTarget.style.background = "#fee2e2"}
                                                                            onMouseOut={(e) => e.currentTarget.style.background = "none"}
                                                                            title="Delete template"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Card>
                                    )}
                                </>
                            ) : (
                                <div
                                    className="template-studio-editor-shell"
                                    style={{
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: 24,
                                        overflow: "hidden",
                                        boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    {/* MAIN: Editor */}
                                    <div className={`template-studio-editor-grid ${isMobile ? "is-mobile" : ""}`} style={{ minHeight: 0 }}>
                                    <div style={{ background: "var(--bg-card)", display: "flex", flexDirection: "column", minHeight: 0 }}>
                                        {(() => {
                                            const t = (data.templates || []).find((x) => x.id === localS._activeTemplateId);
                                            if (!t) {
                                                return (
                                                    <div style={{ padding: 48, textAlign: "center" }}>
                                                        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>This template no longer exists.</p>
                                                        <Button variant="secondary" onClick={() => setLocalS((s) => ({ ...s, _activeTemplateId: null }))}>Back to library</Button>
                                                    </div>
                                                );
                                            }

                                            const tid = t.id;
                                            const tplType = canonicalTemplateType(t.type);
                                            const pdfPreview = tplType === "PDF" ? runTemplatePreview(t.subject, t.body) : null;
                                            const Hicon = tplType === "SMS" ? MessageSquare : tplType === "WhatsApp" ? MessageCircle : tplType === "PDF" ? FileText : Mail;

                                            return (
                                                <>
                                                    <div className="template-studio-editor-nav">
                                                        <button
                                                            type="button"
                                                            className="template-studio-back"
                                                            onClick={() => {
                                                                setLocalS((s) => ({ ...s, _activeTemplateId: null }));
                                                                setTemplatePreviewOpen(false);
                                                            }}
                                                        >
                                                            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
                                                            Back to {tplType} templates
                                                        </button>
                                                        {t.description ? (
                                                            <p className="template-studio-editor-purpose">{t.description}</p>
                                                        ) : null}
                                                    </div>
                                                <fieldset
                                                    disabled={!templatesEditable}
                                                    className="settings-workspace-fieldset template-studio-fields"
                                                    style={{
                                                        flex: 1,
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        minHeight: 0,
                                                        minWidth: 0,
                                                        border: "none",
                                                        margin: 0,
                                                        padding: 0,
                                                    }}
                                                >
                                                    <legend className="settings-fieldset-sr-only">Template fields</legend>
                                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                                                    <div
                                                        className="template-studio-editor-head"
                                                        style={{
                                                            borderBottom: "1px solid var(--border-subtle)",
                                                            background: "linear-gradient(180deg, var(--surface-subtle) 0%, var(--bg-card) 100%)",
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                                                            <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--brand-primary)18", color: "var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                                <Hicon size={24} />
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 200 }}>
                                                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Template name</label>
                                                                <input
                                                                    className="input-premium"
                                                                    value={t.name}
                                                                    onChange={(e) => updateTemplate(tid, { name: e.target.value })}
                                                                    style={{ width: "100%", marginTop: 6, height: 44, borderRadius: 12, fontSize: 16, fontWeight: 800 }}
                                                                />
                                                            </div>
                                                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                                                <div>
                                                                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Type</label>
                                                                    <select
                                                                        className="input-premium"
                                                                        value={tplType}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setTemplateTypeFilter(val);
                                                                            updateTemplate(tid, {
                                                                                type: val,
                                                                                ...(val === "PDF" ? { _editorMode: "HTML" } : {}),
                                                                            });
                                                                        }}
                                                                        style={{ height: 44, borderRadius: 12, minWidth: 120, fontWeight: 600 }}
                                                                    >
                                                                        <option value="Email">Email</option>
                                                                        <option value="SMS">SMS</option>
                                                                        <option value="WhatsApp">WhatsApp</option>
                                                                        <option value="PDF">PDF</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Category</label>
                                                                    <select
                                                                        className="input-premium"
                                                                        value={t.category || "General"}
                                                                        onChange={(e) => updateTemplate(tid, { category: e.target.value })}
                                                                        style={{ height: 44, borderRadius: 12, minWidth: 140, fontWeight: 600 }}
                                                                    >
                                                                        {["General", "Finance", "Staff", "Operations"].map((c) => (
                                                                            <option key={c} value={c}>
                                                                                {c}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Internal description</label>
                                                            <textarea
                                                                className="input-premium"
                                                                style={{ width: "100%", marginTop: 6, minHeight: 56, borderRadius: 12, resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
                                                                value={t.description || ""}
                                                                onChange={(e) => updateTemplate(tid, { description: e.target.value })}
                                                                placeholder="When staff should use this template (not sent to customers)."
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="template-studio-editor-scroll hide-scrollbar" style={{ overflowY: "auto", flex: 1 }}>
                                                        <div style={{ marginBottom: 28 }}>
                                                            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10, display: "block" }}>
                                                                {tplType === "PDF" ? "Document title" : tplType === "SMS" ? "Label (optional)" : "Subject line"}
                                                            </label>
                                                            <input
                                                                ref={subjectInputRef}
                                                                className="input-modern"
                                                                style={{ height: 50, fontSize: 15, fontWeight: 600, borderRadius: 14, width: "100%" }}
                                                                value={t.subject}
                                                                onChange={(e) => updateTemplate(tid, { subject: e.target.value })}
                                                                onFocus={() => rememberTemplateSelection("subject")}
                                                                onClick={() => rememberTemplateSelection("subject")}
                                                                onKeyUp={() => rememberTemplateSelection("subject")}
                                                                onSelect={() => rememberTemplateSelection("subject")}
                                                                placeholder={
                                                                    tplType === "PDF"
                                                                        ? "e.g. Tax invoice {{invoiceId}}"
                                                                        : tplType === "SMS"
                                                                          ? "Optional prefix (not all devices show this separately)"
                                                                          : "e.g. Invoice {{invoiceId}} from {{businessName}}"
                                                                }
                                                                id="tpl-subject"
                                                            />
                                                        </div>

                                                        <div>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                                                                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>
                                                                    {tplType === "PDF" ? "HTML layout" : tplType === "SMS" ? "SMS text" : "Message body"}
                                                                </label>
                                                                {tplType === "Email" ? (
                                                                    <div className="template-editor-segment" role="tablist" aria-label="Editor mode">
                                                                        <button
                                                                            type="button"
                                                                            role="tab"
                                                                            aria-selected={(t._editorMode || "Visual") === "Visual"}
                                                                            className={(t._editorMode || "Visual") === "Visual" ? "is-active" : ""}
                                                                            onClick={() => updateTemplate(tid, { _editorMode: "Visual" })}
                                                                        >
                                                                            Visual
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            role="tab"
                                                                            aria-selected={t._editorMode === "HTML"}
                                                                            className={t._editorMode === "HTML" ? "is-active" : ""}
                                                                            onClick={() => updateTemplate(tid, { _editorMode: "HTML" })}
                                                                        >
                                                                            HTML
                                                                        </button>
                                                                    </div>
                                                                ) : tplType === "PDF" ? (
                                                                    <span className="template-studio-badge-muted">HTML · A4 preview below</span>
                                                                ) : (
                                                                    <span className="template-studio-badge-muted">Plain text · GSM length limits apply</span>
                                                                )}
                                                            </div>
                                                            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 18, overflow: "hidden", background: "var(--bg-card)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                                                                <div className="template-editor-toolbar" style={{ padding: "10px 16px", background: "var(--surface-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
                                                                    <span className="template-editor-toolbar-label">Quick insert</span>
                                                                    <button
                                                                        type="button"
                                                                        className="template-toolbar-btn"
                                                                        title="Focus subject field"
                                                                        onClick={() => {
                                                                            document.getElementById("tpl-subject")?.focus();
                                                                            showToast?.("Editing subject line", "success");
                                                                        }}
                                                                    >
                                                                        <Type size={15} strokeWidth={2} aria-hidden /> Subject
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="template-toolbar-btn"
                                                                        title="Insert section divider"
                                                                        onClick={() => {
                                                                            insertIntoBody(tid, "\n\n────────────────\n");
                                                                            showToast?.("Divider inserted", "success");
                                                                        }}
                                                                    >
                                                                        <Layout size={15} strokeWidth={2} aria-hidden /> Divider
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="template-toolbar-btn"
                                                                        title="Insert invoice reference line"
                                                                        onClick={() => {
                                                                            insertIntoBody(tid, "Reference: {{invoiceId}}\n");
                                                                            showToast?.("Invoice line inserted", "success");
                                                                        }}
                                                                    >
                                                                        <FileText size={15} strokeWidth={2} aria-hidden /> Invoice ref
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="template-toolbar-btn"
                                                                        title="Wrap selection with bold markers"
                                                                        onClick={() => {
                                                                            wrapBodySelection(tid, "**", "**");
                                                                            showToast?.("Bold markers added", "success");
                                                                        }}
                                                                    >
                                                                        <span style={{ fontWeight: 800 }}>B</span> Bold
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="template-toolbar-btn"
                                                                        title="Copy body to clipboard"
                                                                        onClick={async () => {
                                                                            try {
                                                                                await navigator.clipboard.writeText(t.body || "");
                                                                                showToast?.("Body copied to clipboard", "success");
                                                                            } catch {
                                                                                showToast?.("Could not copy — select and copy manually", "warning");
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Copy size={15} strokeWidth={2} aria-hidden /> Copy
                                                                    </button>
                                                                </div>
                                                                <textarea
                                                                    ref={bodyInputRef}
                                                                    id="tpl-body"
                                                                    className="input-modern"
                                                                    style={{
                                                                        minHeight: tplType === "PDF" ? 300 : 420,
                                                                        border: "none",
                                                                        borderRadius: 0,
                                                                        padding: 28,
                                                                        fontSize: 15,
                                                                        lineHeight: 1.75,
                                                                        fontFamily:
                                                                            tplType === "PDF" || tplType === "SMS" || t._editorMode === "HTML"
                                                                                ? "ui-monospace, SFMono-Regular, Menlo, monospace"
                                                                                : "inherit",
                                                                        width: "100%",
                                                                        boxSizing: "border-box",
                                                                    }}
                                                                    value={t.body}
                                                                    onChange={(e) => updateTemplate(tid, { body: e.target.value })}
                                                                    onFocus={() => rememberTemplateSelection("body")}
                                                                    onClick={() => rememberTemplateSelection("body")}
                                                                    onKeyUp={() => rememberTemplateSelection("body")}
                                                                    onSelect={() => rememberTemplateSelection("body")}
                                                                    placeholder={
                                                                        tplType === "PDF"
                                                                            ? "<h1>{{businessName}}</h1>\n<p>Invoice {{invoiceId}} · {{amount}}</p>"
                                                                            : tplType === "SMS"
                                                                              ? "Hi {{firstName}}, your invoice {{invoiceId}} is ready. {{footer}}"
                                                                              : "Write your message. Use placeholders from the right panel."
                                                                    }
                                                                />
                                                                {tplType === "PDF" && pdfPreview ? (
                                                                    <div className="template-pdf-preview-stack">
                                                                        <div className="template-pdf-preview-label">Live A4 preview</div>
                                                                        <div className="template-pdf-preview-wrap template-pdf-printable">
                                                                            <div className="template-pdf-shadow">
                                                                                <article className="template-pdf-page">
                                                                                    {pdfPreview.subject ? (
                                                                                        <header className="template-pdf-doc-title">{pdfPreview.subject}</header>
                                                                                    ) : null}
                                                                                    <div className="template-pdf-html" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pdfPreview.body || "") }} />
                                                                                </article>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>

                                                        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "20px 0 0", lineHeight: 1.5 }}>
                                                            Changes to templates are saved automatically with your workspace data.
                                                        </p>
                                                        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
                                                            <Button variant="primary" icon={Eye} onClick={() => setTemplatePreviewOpen(true)}>
                                                                Preview with sample data
                                                            </Button>
                                                            <Button
                                                                variant="danger"
                                                                icon={Trash2}
                                                                onClick={() => {
                                                                    if (window.confirm("Delete this template permanently?")) {
                                                                        setData((d) => ({ ...d, templates: (d.templates || []).filter((tx) => tx.id !== tid) }));
                                                                        setLocalS((s) => ({ ...s, _activeTemplateId: null }));
                                                                        setTemplatePreviewOpen(false);
                                                                        showToast?.("Template deleted", "success");
                                                                    }
                                                                }}
                                                                style={{ 
                                                                    marginLeft: "auto",
                                                                    background: "#ef4444",
                                                                    color: "white",
                                                                    border: "none",
                                                                    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)"
                                                                }}
                                                            >
                                                                Delete template
                                                            </Button>
                                                        </div>

                                                        {tplType === "Email" ? (
                                                            <div style={{ marginTop: 40, padding: 28, background: "var(--surface-subtle)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                                    <Mail size={20} color="var(--brand-primary)" />
                                                                    <h4 style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>Send test email</h4>
                                                                </div>
                                                                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 18, lineHeight: 1.55 }}>
                                                                    Fills subject and body with sample placeholder values and opens your default mail client. Leave the address empty to choose the recipient in the mail app, or use your organization email from settings.
                                                                </p>
                                                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                                                    <input
                                                                        className="input-modern"
                                                                        placeholder="Optional: recipient email"
                                                                        style={{ flex: 1, minWidth: 200, borderRadius: 12, height: 46 }}
                                                                        value={sendTestEmail}
                                                                        onChange={(e) => setSendTestEmail(e.target.value)}
                                                                    />
                                                                    <Button
                                                                        variant="secondary"
                                                                        icon={Send}
                                                                        onClick={() => {
                                                                            const { subject, body } = runTemplatePreview(t.subject, t.body);
                                                                            const to = (sendTestEmail.trim() || localS.email || "").replace(/^mailto:/i, "");
                                                                            const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                                                            window.location.href = to ? `mailto:${encodeURIComponent(to)}?${q}` : `mailto:?${q}`;
                                                                            showToast?.("Opening your email application…", "success");
                                                                        }}
                                                                    >
                                                                        Send test
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : tplType === "SMS" ? (
                                                            <div style={{ marginTop: 40, padding: 28, background: "var(--surface-subtle)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                                    <MessageSquare size={20} color="var(--brand-primary)" />
                                                                    <h4 style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>Send test SMS</h4>
                                                                </div>
                                                                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 18, lineHeight: 1.55 }}>
                                                                    Opens your device&apos;s SMS app with sample-filled text (sms: link). Use a Kenya number (e.g. 07… or 254…). Leave empty to use the organization phone from Organization settings.
                                                                </p>
                                                                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                                                    <input
                                                                        className="input-modern"
                                                                        placeholder="Optional: recipient phone"
                                                                        style={{ flex: 1, minWidth: 200, borderRadius: 12, height: 46 }}
                                                                        value={sendTestPhone}
                                                                        onChange={(e) => setSendTestPhone(e.target.value)}
                                                                    />
                                                                    <Button
                                                                        variant="secondary"
                                                                        icon={Send}
                                                                        onClick={() => {
                                                                            const prev = runTemplatePreview(t.subject, t.body);
                                                                            const smsText = [prev.subject, prev.body].filter((x) => String(x || "").trim()).join("\n\n");
                                                                            const raw = (sendTestPhone.trim() || localS.phone || "").trim();
                                                                            const url = buildSmsUrl(raw, smsText);
                                                                            if (!url) {
                                                                                showToast?.("Enter a valid mobile number (e.g. 0712… or 254712…)", "warning");
                                                                                return;
                                                                            }
                                                                            window.location.href = url;
                                                                            showToast?.("Opening your SMS app…", "success");
                                                                        }}
                                                                    >
                                                                        Send test
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ marginTop: 40, padding: 28, background: "var(--surface-subtle)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                                    <FileText size={20} color="var(--brand-primary)" />
                                                                    <h4 style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>Print or save as PDF</h4>
                                                                </div>
                                                                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 18, lineHeight: 1.55 }}>
                                                                    Uses the live preview area above. In the print dialog, choose &quot;Save as PDF&quot; where available.
                                                                </p>
                                                                <Button
                                                                    variant="secondary"
                                                                    icon={FileText}
                                                                    onClick={() => {
                                                                        window.print();
                                                                    }}
                                                                >
                                                                    Print preview
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                </fieldset>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div className="template-studio-placeholder-panel" style={{ display: "flex", flexDirection: "column", background: "var(--surface-subtle)", minHeight: 0 }}>
                                        <div className="template-studio-placeholder-head" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                            <h4 style={{ fontSize: 15, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 6px" }}>Placeholders</h4>
                                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.45 }}>
                                                Click <b>Subj</b> (title or subject line) or <b>Body</b> to insert. Focus the field first so the snippet goes to the right place.
                                            </p>
                                            <div style={{ position: "relative" }}>
                                                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                                                <input
                                                    value={phSearch}
                                                    onChange={(e) => setPhSearch(e.target.value)}
                                                    placeholder="Filter by name…"
                                                    style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", fontSize: 13, color: "var(--text-primary)" }}
                                                />
                                            </div>
                                            <select
                                                className="input-premium"
                                                value={phCategory}
                                                onChange={(e) => setPhCategory(e.target.value)}
                                                style={{ width: "100%", height: 40, fontSize: 13, marginTop: 12, borderRadius: 12, background: "var(--bg-card)", fontWeight: 600 }}
                                            >
                                                <option value="ALL">All categories</option>
                                                <option value="Business">Business</option>
                                                <option value="Auth & Verification">Auth & verification</option>
                                                <option value="Customer">Customer</option>
                                                <option value="Invoices">Invoices</option>
                                                <option value="Journeys">Journeys &amp; waybill</option>
                                                <option value="Staff & drivers">Staff &amp; drivers</option>
                                            </select>
                                        </div>
                                        <div className="template-studio-placeholder-list hide-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
                                            {PLACEHOLDER_GROUPS.filter((g) => phCategory === "ALL" || g.filterCat === phCategory).map((group) => {
                                                const filteredItems = group.items.filter((p) => !phSearch.trim() || p.toLowerCase().includes(phSearch.trim().toLowerCase()));
                                                if (filteredItems.length === 0) return null;
                                                const Gicon = group.icon;
                                                return (
                                                    <div key={group.cat} style={{ marginBottom: 22 }}>
                                                        <div style={{ fontSize: 10, fontWeight: 900, color: group.color, marginBottom: 10, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
                                                            <Gicon size={14} />
                                                            {group.cat}
                                                        </div>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                            {filteredItems.map((p) => (
                                                                <div
                                                                    key={p}
                                                                    onClick={() => {
                                                                        const activeField = templateCursorRef.current.lastField || "body";
                                                                        insertIntoTemplateField(localS._activeTemplateId, activeField, `{{${p}}}`);
                                                                    }}
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: 8,
                                                                        background: "var(--bg-card)",
                                                                        border: "1px solid var(--border-subtle)",
                                                                        borderRadius: 12,
                                                                        padding: "8px 10px",
                                                                        fontSize: 12,
                                                                        color: "var(--text-primary)",
                                                                        fontWeight: 600,
                                                                        cursor: "pointer",
                                                                    }}
                                                                >
                                                                    <code style={{ flex: 1, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--brand-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>{`{{${p}}}`}</code>
                                                                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                insertIntoSubject(localS._activeTemplateId, `{{${p}}}`);
                                                                            }}
                                                                            style={{
                                                                                fontSize: 10,
                                                                                fontWeight: 800,
                                                                                background: "var(--surface-subtle)",
                                                                                border: "1px solid var(--border-subtle)",
                                                                                borderRadius: 8,
                                                                                padding: "4px 8px",
                                                                                color: "var(--text-secondary)",
                                                                                cursor: "pointer",
                                                                            }}
                                                                        >
                                                                            Subj
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                insertIntoBody(localS._activeTemplateId, `{{${p}}}`);
                                                                            }}
                                                                            style={{
                                                                                fontSize: 10,
                                                                                fontWeight: 800,
                                                                                background: "var(--surface-subtle)",
                                                                                border: "1px solid var(--border-subtle)",
                                                                                borderRadius: 8,
                                                                                padding: "4px 8px",
                                                                                color: "var(--text-secondary)",
                                                                                cursor: "pointer",
                                                                            }}
                                                                        >
                                                                            Body
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    </div>
                                </div>
                            )}

                            {templatePreviewOpen && localS._activeTemplateId && (() => {
                                const pt = (data.templates || []).find((x) => x.id === localS._activeTemplateId);
                                if (!pt) return null;
                                const rendered = runTemplatePreview(pt.subject, pt.body);
                                const prevType = canonicalTemplateType(pt.type);
                                const isPdfPrev = prevType === "PDF";
                                return (
                                    <div
                                        role="dialog"
                                        aria-modal="true"
                                        style={{
                                            position: "fixed",
                                            inset: 0,
                                            zIndex: 2000,
                                            background: "rgba(0,0,0,0.55)",
                                            backdropFilter: "blur(6px)",
                                            display: "flex",
                                            alignItems: "flex-start",
                                            justifyContent: "center",
                                            padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
                                            overflowY: "auto",
                                            overscrollBehavior: "contain",
                                        }}
                                        onClick={() => setTemplatePreviewOpen(false)}
                                    >
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                width: isPdfPrev ? "min(720px, calc(100vw - 32px))" : "min(560px, calc(100vw - 32px))",
                                                maxHeight: "min(88dvh, 720px)",
                                                margin: "20px 0",
                                                overflow: "hidden",
                                                display: "flex",
                                                flexDirection: "column",
                                                borderRadius: 20,
                                                border: "1px solid var(--border-subtle)",
                                                background: "var(--bg-card)",
                                                boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
                                            }}
                                        >
                                            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                                <div>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</div>
                                                    <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)" }}>{pt.name}</div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => setTemplatePreviewOpen(false)} aria-label="Close preview">
                                                    <X size={18} />
                                                </Button>
                                            </div>
                                            <div style={{ padding: 24, overflowY: "auto", flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" }}>
                                                {!isPdfPrev ? (
                                                    <>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>
                                                            {prevType === "SMS" ? "Label" : "Subject"}
                                                        </div>
                                                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 22, lineHeight: 1.45 }}>{rendered.subject || "—"}</div>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase" }}>Body</div>
                                                        <div
                                                            style={{
                                                                fontSize: 14,
                                                                lineHeight: 1.7,
                                                                color: "var(--text-secondary)",
                                                                whiteSpace: "pre-wrap",
                                                                wordBreak: "break-word",
                                                                padding: 18,
                                                                borderRadius: 14,
                                                                background: "var(--surface-subtle)",
                                                                border: "1px solid var(--border-subtle)",
                                                            }}
                                                        >
                                                            {rendered.body || "—"}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", marginBottom: 12, textTransform: "uppercase" }}>PDF layout</div>
                                                        <div className="template-pdf-preview-wrap template-pdf-preview-wrap--modal">
                                                            <div className="template-pdf-shadow">
                                                                <article className="template-pdf-page">
                                                                    {rendered.subject ? <header className="template-pdf-doc-title">{rendered.subject}</header> : null}
                                                                    <div className="template-pdf-html" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rendered.body || "") }} />
                                                                </article>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                                <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 16, marginBottom: 0 }}>Sample data is used for placeholders (e.g. customer name, invoice id). Your company name comes from Organization settings when available.</p>
                                            </div>
                                            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                                <Button variant="secondary" onClick={() => setTemplatePreviewOpen(false)}>
                                                    Close
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                        {/* ── SECURITY / PORTAL ── */}
                    {activeTab === 'security' && (
                        <div>
                            <SettingsShellSectionHeader title="Portal Authentication" desc="Connect to the driver mobile service." icon={ShieldCheck} />
                            <div style={{ background: "var(--surface-subtle)", borderRadius: 16, padding: 24, border: "1px solid var(--border-subtle)" }}>
                                <SettingsShellField label="Driver API Endpoint">
                                    <SettingsShellInput value={PAYMENT_API} readOnly style={{ opacity: 0.5, cursor: "not-allowed", fontFamily: "var(--font-mono)" }} />
                                </SettingsShellField>
                                <SettingsShellField label="Administrator Secret Key">
                                    <SettingsShellInput type="password" value={ADMIN_KEY} readOnly style={{ opacity: 0.5, cursor: "not-allowed", fontFamily: "var(--font-mono)" }} />
                                </SettingsShellField>
                                <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                                    <Button
                                        icon={RefreshCw}
                                        variant="ghost"
                                        disabled={!canRunSuperAdminActions}
                                        onClick={async () => {
                                            try {
                                                const r = await fetch(`${PAYMENT_API}/health`);
                                                const j = await r.json();
                                                if (r.ok) showToast?.(`API reachable (${j.env || "ok"})`, "success");
                                                else showToast?.("API returned an error", "error");
                                            } catch (e) {
                                                showToast?.("Cannot reach API: " + e.message, "error");
                                            }
                                        }}
                                    >
                                        Test API connection
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PROFILE PERMISSIONS ── */}
                    {activeTab === "permissions" && (
                        <div role="region" aria-label="Profile permissions" className="settings-workspace-fieldset">
                            <SettingsProfilePermissions
                                localProfilePermissions={localS.profilePermissions}
                                disabled={!workspaceTabEditable.permissions || !canEditSettings}
                                locked={!workspaceTabEditable.permissions || !canEditSettings}
                                onRequestUnlock={unlockWorkspaceTab}
                                onCommit={(next) => {
                                    saveSettings({ profilePermissions: next });
                                }}
                            />
                        </div>
                    )}

                    {/* ── DATA INTEGRITY ── */}
                    {activeTab === 'data' && (
                        <div>
                            <SettingsShellSectionHeader title="System Maintenance" desc="Local-first workspace: your browser is the source of truth. Push snapshots to the API for the driver portal and server-side jobs." icon={Database} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                                <Card accent="#2563eb" title="Sync to server" subtitle="Update server with local data" style={{ padding: 20 }}>
                                    <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
                                        Push your local data to the server to sync with the driver portal and other modules.
                                    </p>
                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                                        <Button
                                            icon={RefreshCw}
                                            loading={syncing}
                                            disabled={!canRunSuperAdminActions}
                                            onClick={async () => {
                                                if (!canRunSuperAdminActions) return showToast?.("Only Super Admin can push snapshots.", "error");
                                                setSyncing(true);
                                                await syncToServer();
                                                setSyncing(false);
                                            }}
                                        >
                                            Push to API
                                        </Button>
                                        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                                            Last: <strong>{(() => {
                                                try {
                                                    const t = localStorage.getItem("segecha_last_server_sync");
                                                    return t ? new Date(t).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Never";
                                                } catch { return "—"; }
                                            })()}</strong>
                                        </span>
                                    </div>
                                </Card>

                                <Card accent="#8b5cf6" title="Automated Backups" subtitle="Server-side safety scheduler" style={{ padding: 20 }}>
                                    <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
                                        How often should the server create a safe copy of your data?
                                    </p>
                                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                        <select
                                            value={localS.backupFrequency || 'Disabled'}
                                            onChange={(e) => saveSettings({ backupFrequency: e.target.value })}
                                            className="input-premium"
                                            style={{ flex: 1, padding: '0 12px', height: 40, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="Disabled">Disabled</option>
                                            <option value="Every 6 Hours">Every 6 Hours</option>
                                            <option value="Daily">Daily</option>
                                            <option value="Weekly">Weekly</option>
                                        </select>
                                        <Button icon={Plus} variant="secondary" onClick={createManualBackup}>Backup Now</Button>
                                        <label 
                                            style={{ 
                                                cursor: "pointer", display: "inline-block",
                                                border: draggingBackup ? "2px dashed var(--brand-primary)" : "1px solid transparent",
                                                borderRadius: 12,
                                                padding: draggingBackup ? 4 : 0,
                                                transition: "all 0.2s ease"
                                            }}
                                            onDragOver={e => { e.preventDefault(); setDraggingBackup(true); }}
                                            onDragLeave={() => setDraggingBackup(false)}
                                            onDrop={e => {
                                                e.preventDefault();
                                                setDraggingBackup(false);
                                                if (e.dataTransfer.files[0]) uploadBackup(e.dataTransfer.files[0]);
                                            }}
                                        >
                                            <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) uploadBackup(e.target.files[0]);
                                                e.target.value = null;
                                            }} />
                                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: scrolling ? "var(--surface-subtle)" : "var(--surface-subtle)", color: "var(--brand-primary)", borderRadius: 10, fontWeight: 700, fontSize: 13, border: "1px solid var(--border-subtle)", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                                <Upload size={16} /> Upload Backup
                                            </div>
                                        </label>
                                    </div>
                                </Card>
                            </div>

                            <Card title="Recent Server Backups" subtitle="Restore system to a previous state" style={{ marginBottom: 32 }}>
                                {backupsLoading ? (
                                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
                                        <RefreshCw className="animate-spin" style={{ margin: '0 auto 12px' }} />
                                        Loading backup history...
                                    </div>
                                ) : backups.length === 0 ? (
                                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
                                        No backups found on server.
                                    </div>
                                ) : (
                                    <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                                        <table className="table-modern">
                                            <thead>
                                                <tr>
                                                    <th>Backup File</th>
                                                    <th>Date & Time</th>
                                                    <th>Size</th>
                                                    <th style={{ textAlign: 'right' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {backups.map((b) => (
                                                    <tr key={b.name}>
                                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</td>
                                                        <td>{new Date(b.timestamp).toLocaleString()}</td>
                                                        <td style={{ color: 'var(--text-dim)' }}>{(b.size / 1024).toFixed(1)} KB</td>
                                                        <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                icon={Download} 
                                                                onClick={() => downloadBackup(b.name)}
                                                                style={{ color: 'var(--text-secondary)' }}
                                                            >
                                                                Download
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                icon={RefreshCw} 
                                                                onClick={() => restoreFromBackup(b.name)}
                                                                style={{ color: 'var(--brand-primary)' }}
                                                            >
                                                                Restore
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Card>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                                <Card accent="var(--brand-primary)" title="Universal Export">
                                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Download all tables in your preferred format.</p>
                                    <div style={{ display: "flex", gap: 12 }}>
                                        <Button icon={FileText} onClick={() => exportToExcel(data)}>Excel (.xlsx)</Button>
                                        <Button variant="secondary" icon={Download} onClick={() => exportAllToCSV(data)}>Bulk CSV (.csv)</Button>
                                    </div>
                                </Card>
                                <Card accent="#10b981" title="JSON Snapshot">
                                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Export all local state for offline JSON safekeeping.</p>
                                    <Button icon={Download} onClick={() => {
                                        const blob = new Blob([JSON.stringify({ data, settings: localS }, null, 2)], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `segecha_backup_${new Date().toISOString().slice(0,10)}.json`;
                                        a.click();
                                    }}>Export JSON</Button>
                                </Card>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                                <Card accent="#f59e0b" title="CSV Exports">
                                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Download specific tables as CSV files.</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.journeys, 'Journeys')}>Journeys</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.invoices, 'Invoices')}>Invoices</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.expenses, 'Expenses')}>Expenses</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.fuel, 'Fuel_Logs')}>Fuel Logs</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.drivers, 'Drivers')}>Drivers</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.staff, 'Staff')}>Staff</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.customers, 'Customers')}>Customers</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.trucks, 'Fleet')}>Fleet</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.trailers, 'Trailers')}>Trailers</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.maintenanceLogs, 'Maintenance')}>Maintenance</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.payroll, 'Payroll')}>Payroll</Button>
                                        <Button size="sm" variant="ghost" onClick={() => exportToCSV(data.turnboys, 'Turnboys')}>Turnboys</Button>
                                    </div>
                                </Card>
                                <Card accent="#ef4444" title="Hard Reset">
                                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Wipe all local data. Permanent action.</p>
                                    <Button variant="danger" icon={Trash2} disabled={!canRunSuperAdminActions} onClick={flushAllData}>Destroy All Local Data</Button>
                                </Card>
                            </div>

                            <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>Import from Trucking_2025.xlsx</h4>
                            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16, lineHeight: 1.6 }}>
                                Upload your <code style={{ background: "var(--surface-subtle)", padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>Trucking_2025.xlsx</code> file.
                                The system reads the <b>Trips_2025</b>, <b>Fixed_Expenses</b>, and <b>Maintenance</b> sheets automatically.
                                You review and fix any errors row-by-row before confirming the import.
                            </div>
                            <ImportUploadButton 
                                label="Upload Trucking_2025.xlsx"
                                runExcelImport={runExcelImport}
                                setImportSession={setImportSession}
                                onNavigate={() => navigate('/import')}
                            />
                            {importSession && !importSession.committed && (
                                <div style={{ marginTop: 16, background: 'rgba(245, 158, 11, 0.1)', border: `1px solid rgba(245, 158, 11, 0.3)`, borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>Import session active — {Object.values(importSession.sheets).reduce((s, sh) => s + sh.errors.length, 0)} rows need review.</div>
                                    <Button variant="ghost" size="sm" onClick={() => navigate('/import')}>
                                        Review now →
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="settings-footer-hint">
                        <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
                            Settings save to this browser. Use Data → Push snapshot for the driver portal.
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
