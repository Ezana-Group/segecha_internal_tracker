import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, LogOut, Settings, User, UserRoundCheck, UserRoundCog, Eye } from "lucide-react";
import { adminAuth } from "../utils/adminAuth";
import { patchSettings, readSettings, subscribeSettings } from "../utils/settingsStore.js";

export function TopbarUserMenu({ showToast, data, previewMode, setPreviewMode, clearPreviewMode }) {
    const navigate = useNavigate();
    const [settings, setSettings] = useState(readSettings);
    const [open, setOpen] = useState(false);
    const [menuView, setMenuView] = useState("root");
    const wrapRef = useRef(null);

    useEffect(() => subscribeSettings(setSettings), []);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (!wrapRef.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open) setMenuView("root");
    }, [open]);

    const adminUser = adminAuth.getUser();
    const name = adminUser?.displayName || (settings.operatorDisplayName || "").trim() || "Operator";
    const email = adminUser?.email || (settings.operatorWorkEmail || "").trim() || (settings.email || "").trim() || "";
    const company = (settings.companyName || "").trim() || "Workspace";

    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "OP";

    const signOut = () => {
        if (!window.confirm("Are you sure you want to sign out?")) return;
        adminAuth.clearSession();
        patchSettings({ operatorDisplayName: "", operatorWorkEmail: "" });
        showToast?.("Signed out", "success");
        setOpen(false);
        navigate("/login");
    };

    const drivers = data?.drivers || [];
    const staff = data?.staff || [];

    const startDriverPreview = (id) => {
        setPreviewMode({ role: "driver", entityId: id });
        navigate(`/drivers/${id}`);
        showToast?.("Office preview only — open Driver app for fuel, expenses & trip actions.", "success");
        setOpen(false);
    };

    const startStaffPreview = (id) => {
        setPreviewMode({ role: "staff", entityId: id });
        navigate(`/staff/${id}`);
        showToast?.("Staff preview — limited navigation", "success");
        setOpen(false);
    };

    const exitPreview = () => {
        clearPreviewMode();
        navigate("/", { replace: true });
        showToast?.("Preview closed", "success");
        setOpen(false);
    };

    return (
        <div className="topbar-user-menu" ref={wrapRef}>
            <button
                type="button"
                className="topbar-user-trigger"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((o) => !o)}
            >
                <span className="topbar-user-avatar" aria-hidden>
                    {initials}
                </span>
                {!open && (
                    <span className="topbar-user-text">
                        <span className="topbar-user-text-name">{name}</span>
                        <span className="topbar-user-text-sub">{company}</span>
                    </span>
                )}
                <ChevronDown size={16} className="topbar-user-chevron" aria-hidden />
            </button>
            {open && (
                <div className="topbar-user-dropdown" role="menu">
                    {menuView === "root" && (
                        <>
                            <div className="topbar-user-dropdown-head">
                                <div className="topbar-user-dropdown-avatar" aria-hidden>
                                    <User size={20} strokeWidth={2} />
                                </div>
                                <div className="topbar-user-dropdown-meta">
                                    <div className="topbar-user-dropdown-name">{name}</div>
                                    {email ? <div className="topbar-user-dropdown-email">{email}</div> : null}
                                    <div className="topbar-user-dropdown-company">{company}</div>
                                </div>
                            </div>
                            <div className="topbar-user-dropdown-actions">
                                {previewMode ? (
                                    <button
                                        type="button"
                                        className="topbar-user-dropdown-item"
                                        role="menuitem"
                                        onClick={exitPreview}
                                    >
                                        <Eye size={16} strokeWidth={2} aria-hidden />
                                        Exit preview
                                    </button>
                                ) : null}
                                {!previewMode ? (
                                    <>
                                        <button
                                            type="button"
                                            className="topbar-user-dropdown-item"
                                            role="menuitem"
                                            onClick={() => setMenuView("pick-driver")}
                                        >
                                            <UserRoundCheck size={16} strokeWidth={2} aria-hidden />
                                            Preview as driver…
                                        </button>
                                        <button
                                            type="button"
                                            className="topbar-user-dropdown-item"
                                            role="menuitem"
                                            onClick={() => setMenuView("pick-staff")}
                                        >
                                            <UserRoundCog size={16} strokeWidth={2} aria-hidden />
                                            Preview as staff…
                                        </button>
                                    </>
                                ) : null}
                                {!previewMode ? (
                                    <button
                                        type="button"
                                        className="topbar-user-dropdown-item"
                                        role="menuitem"
                                        onClick={() => {
                                            setOpen(false);
                                            navigate("/settings?tab=profile");
                                        }}
                                    >
                                        <Settings size={16} strokeWidth={2} aria-hidden />
                                        Profile &amp; settings
                                    </button>
                                ) : null}
                                <button type="button" className="topbar-user-dropdown-item topbar-user-dropdown-item--danger" role="menuitem" onClick={signOut}>
                                    <LogOut size={16} strokeWidth={2} aria-hidden />
                                    Sign out
                                </button>
                            </div>
                        </>
                    )}
                    {menuView === "pick-driver" && (
                        <div className="topbar-user-preview-panel">
                            <button type="button" className="topbar-user-preview-back" onClick={() => setMenuView("root")}>
                                <ChevronLeft size={16} aria-hidden />
                                Back
                            </button>
                            <div className="topbar-user-preview-title">Choose driver</div>
                            <div className="topbar-user-preview-list" role="listbox">
                                {drivers.length === 0 ? (
                                    <div className="topbar-user-preview-empty">No drivers in workspace</div>
                                ) : (
                                    drivers.map((d) => (
                                        <button
                                            key={d.id}
                                            type="button"
                                            className="topbar-user-preview-row"
                                            role="option"
                                            onClick={() => startDriverPreview(d.id)}
                                        >
                                            <span className="topbar-user-preview-row-name">{d.name || d.id}</span>
                                            <span className="topbar-user-preview-row-meta">{d.uId || d.id}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                    {menuView === "pick-staff" && (
                        <div className="topbar-user-preview-panel">
                            <button type="button" className="topbar-user-preview-back" onClick={() => setMenuView("root")}>
                                <ChevronLeft size={16} aria-hidden />
                                Back
                            </button>
                            <div className="topbar-user-preview-title">Choose staff member</div>
                            <div className="topbar-user-preview-list" role="listbox">
                                {staff.length === 0 ? (
                                    <div className="topbar-user-preview-empty">No staff in workspace</div>
                                ) : (
                                    staff.map((s) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className="topbar-user-preview-row"
                                            role="option"
                                            onClick={() => startStaffPreview(s.id)}
                                        >
                                            <span className="topbar-user-preview-row-name">{s.name || s.id}</span>
                                            <span className="topbar-user-preview-row-meta">{s.role || s.uId || s.id}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
