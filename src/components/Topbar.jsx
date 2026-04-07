import { Menu, MapPin, Bell, Truck, Sun, Moon, LogOut } from "lucide-react";
import { TopbarUserMenu } from "./TopbarUserMenu";
import { NotificationCenter } from "./NotificationCenter";

export function Topbar({
    dark,
    setDark,
    isMobile,
    setSideOpen,
    tyreAlertCount,
    verifyAlertCount,
    data,
    showToast,
    previewMode,
    setPreviewMode,
    clearPreviewMode,
    pendingVerifications,
    setVerifyModal,
    truckReg,
    S,
}) {
    const activeTrucks = data.trucks.filter((t) => t.status === "Active").length;
    const totalTrucks = data.trucks.length;

    return (
        <header
            className={`topbar-shell${isMobile ? " full-bleed" : " with-sidebar"}`}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                height: "var(--topbar-height)",
                zIndex: 100,
                background: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                borderBottom: "var(--glass-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingLeft: isMobile ? 16 : 24,
                paddingRight: 16,
                boxSizing: "border-box",
                marginLeft: isMobile ? 0 : "var(--sidebar-width)",
            }}
        >
            {/* Left side */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {isMobile && (
                    <button
                        type="button"
                        className="topbar-icon-btn"
                        onClick={() => setSideOpen((o) => !o)}
                        aria-label="Open menu"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 36,
                            height: 36,
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            background: "var(--surface-subtle)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                        }}
                    >
                        <Menu size={18} />
                    </button>
                )}

                {!isMobile && (
                    <div
                        className="topbar-muted"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 13,
                            color: "var(--text-dim)",
                            fontWeight: 500,
                        }}
                    >
                        <MapPin size={13} strokeWidth={2} color="var(--brand-primary)" />
                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Nairobi</span>
                        <span style={{ opacity: 0.3, fontSize: 10 }}>|</span>
                        <span>
                            {new Date().toLocaleDateString("en-KE", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                            })}
                        </span>
                    </div>
                )}
            </div>

            {/* Right side actions */}
            <div
                className="topbar-actions"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: isMobile ? 6 : 8,
                }}
            >
                {/* Notification bell — desktop only when not in preview */}
                {!previewMode && !isMobile && (
                    <NotificationCenter
                        pendingVerifications={pendingVerifications}
                        setVerifyModal={setVerifyModal}
                        truckReg={truckReg}
                        dark={dark}
                    />
                )}

                {/* Tyre alert chip */}
                {!previewMode && tyreAlertCount > 0 && (
                    <div
                        className="topbar-chip topbar-chip--alert"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#ef444415",
                            border: "1px solid #ef444430",
                            color: "#ef4444",
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        <Bell size={12} />
                        <span>{tyreAlertCount} tyre</span>
                    </div>
                )}

                {/* Fleet status chip — desktop only */}
                {!previewMode && !isMobile && (
                    <div
                        className="topbar-chip topbar-chip--ok"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#10b98115",
                            border: "1px solid #10b98130",
                            color: "#10b981",
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        <Truck size={12} />
                        <span>{activeTrucks}/{totalTrucks} active</span>
                    </div>
                )}

                {/* Dark mode toggle */}
                <button
                    type="button"
                    className="topbar-icon-btn"
                    onClick={() => setDark(!dark)}
                    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 34,
                        height: 34,
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface-subtle)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                    }}
                >
                    {dark ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                {/* User menu */}
                <TopbarUserMenu
                    showToast={showToast}
                    data={data}
                    previewMode={previewMode}
                    setPreviewMode={setPreviewMode}
                    clearPreviewMode={clearPreviewMode}
                />

                {/* Sign out — ghost button with icon */}
                <button
                    type="button"
                    onClick={() => {
                        if (window.confirm("Sign out of the admin panel?")) {
                            import("../utils/adminAuth").then(({ adminAuth }) => {
                                adminAuth.clearSession();
                                window.location.reload();
                            });
                        }
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        background: "transparent",
                        color: "var(--text-dim)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ef4444";
                        e.currentTarget.style.borderColor = "#ef444440";
                        e.currentTarget.style.background = "#ef444410";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-dim)";
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                        e.currentTarget.style.background = "transparent";
                    }}
                >
                    <LogOut size={13} />
                    {!isMobile && <span>Sign out</span>}
                </button>
            </div>
        </header>
    );
}
