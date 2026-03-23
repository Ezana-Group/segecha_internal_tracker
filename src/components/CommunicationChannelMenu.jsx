import { useEffect, useRef, useState } from "react";
import { ChevronDown, Mail, MessageCircle, Smartphone, MessageSquare } from "lucide-react";
import { buildMailtoUrl, buildSmsUrl, buildWhatsAppUrl } from "../utils/contactLinks";

/**
 * Dropdown: send via Email, WhatsApp, or SMS (opens native / web handlers).
 */
export function CommunicationChannelMenu({
    phone,
    email,
    emailSubject,
    emailBody,
    smsBody,
    whatsappBody,
    showToast,
    label = "Send message",
    size = "sm",
    disabled = false,
    /** Match profile quick-action tile layout (full width column) */
    fullWidthTile = false,
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

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

    const wa = buildWhatsAppUrl(phone, whatsappBody);
    const sms = buildSmsUrl(phone, smsBody);
    const mail = buildMailtoUrl(email, emailSubject, emailBody);

    const run = (kind) => {
        if (kind === "email") {
            if (!mail) {
                showToast?.("Add an email address first", "warning");
                return;
            }
            window.location.href = mail;
            setOpen(false);
            showToast?.("Opening email…", "success");
            return;
        }
        if (kind === "whatsapp") {
            if (!wa) {
                showToast?.("Add a valid phone number for WhatsApp", "warning");
                return;
            }
            window.open(wa, "_blank", "noopener,noreferrer");
            setOpen(false);
            showToast?.("Opening WhatsApp…", "success");
            return;
        }
        if (kind === "sms") {
            if (!sms) {
                showToast?.("Add a valid phone number for SMS", "warning");
                return;
            }
            window.location.href = sms;
            setOpen(false);
            showToast?.("Opening messages…", "success");
        }
    };

    const pad = size === "sm" ? "6px 12px" : "9px 16px";
    const fontSize = size === "sm" ? 12 : 13;

    const panel = open && (
        <div
            className={`comm-channel-menu__panel${fullWidthTile ? " comm-channel-menu__panel--block" : ""}`}
            role="menu"
        >
                    <button type="button" className="comm-channel-menu__item" role="menuitem" onClick={() => run("email")}>
                        <Mail size={16} aria-hidden />
                        <span>
                            <strong>Email</strong>
                            <small>Default mail app</small>
                        </span>
                    </button>
                    <button type="button" className="comm-channel-menu__item" role="menuitem" onClick={() => run("whatsapp")}>
                        <MessageCircle size={16} aria-hidden />
                        <span>
                            <strong>WhatsApp</strong>
                            <small>Web or app</small>
                        </span>
                    </button>
                    <button type="button" className="comm-channel-menu__item" role="menuitem" onClick={() => run("sms")}>
                        <Smartphone size={16} aria-hidden />
                        <span>
                            <strong>SMS</strong>
                            <small>Normal text message</small>
                        </span>
                    </button>
                </div>
    );

    if (fullWidthTile) {
        return (
            <div className="comm-channel-menu comm-channel-menu--block" ref={wrapRef} style={{ position: "relative", width: "100%" }}>
                <button
                    type="button"
                    disabled={disabled}
                    className="profile-quick-action-tile"
                    aria-expanded={open}
                    aria-haspopup="menu"
                    onClick={() => setOpen((o) => !o)}
                >
                    <span className="profile-quick-action-tile__icon" style={{ color: "#8b5cf6" }} aria-hidden>
                        <MessageSquare size={20} strokeWidth={2.2} />
                    </span>
                    <span className="profile-quick-action-tile__text">
                        <span className="profile-quick-action-tile__label">{label}</span>
                        <span className="profile-quick-action-tile__hint">Email, WhatsApp, or SMS</span>
                    </span>
                    <ChevronDown size={18} className="profile-quick-action-tile__chev" aria-hidden />
                </button>
                {panel}
            </div>
        );
    }

    return (
        <div className="comm-channel-menu" ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
            <button
                type="button"
                disabled={disabled}
                className="comm-channel-menu__trigger"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: pad,
                    fontSize,
                    fontWeight: 600,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: disabled ? 0.5 : 1,
                }}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((o) => !o)}
            >
                {label}
                <ChevronDown size={14} aria-hidden />
            </button>
            {panel}
        </div>
    );
}
