import { Menu, MapPin, Bell, Truck, Sun, Moon } from "lucide-react";
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
        >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {isMobile && (
                    <button
                        type="button"
                        className="topbar-icon-btn"
                        onClick={() => setSideOpen((o) => !o)}
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </button>
                )}

                {!isMobile && (
                    <div className="topbar-muted">
                        <MapPin size={14} strokeWidth={2} />
                        <span>Nairobi</span>
                        <span style={{ opacity: 0.35 }}>|</span>
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

            <div className="topbar-actions">
                {!previewMode && (
                    <NotificationCenter 
                        pendingVerifications={pendingVerifications} 
                        setVerifyModal={setVerifyModal} 
                        truckReg={truckReg}
                        dark={dark} 
                    />
                )}

                {!previewMode && tyreAlertCount > 0 && (
                    <div className="topbar-chip topbar-chip--alert">
                        <Bell size={14} />
                        <span>{tyreAlertCount} tyre</span>
                    </div>
                )}

                {!previewMode && !isMobile && (
                    <div className="topbar-chip topbar-chip--ok">
                        <Truck size={14} />
                        <span>
                            {activeTrucks}/{totalTrucks} active
                        </span>
                    </div>
                )}

                <button
                    type="button"
                    className="topbar-icon-btn"
                    onClick={() => setDark(!dark)}
                    aria-label={dark ? "Light mode" : "Dark mode"}
                >
                    {dark ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <TopbarUserMenu
                    showToast={showToast}
                    data={data}
                    previewMode={previewMode}
                    setPreviewMode={setPreviewMode}
                    clearPreviewMode={clearPreviewMode}
                />

                <button
                    style={{ ...S.btn('ghost'), padding: '5px 10px', fontSize: 11, marginLeft: 8 }}
                    onClick={() => {
                        if (window.confirm('Sign out of the admin panel?')) {
                            import("../utils/adminAuth").then(({ adminAuth }) => {
                                adminAuth.clearSession();
                                window.location.reload();
                            });
                        }
                    }}>
                    Sign out
                </button>
            </div>
        </header>
    );
}
