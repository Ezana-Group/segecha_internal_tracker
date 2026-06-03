import { useState, useEffect, useRef } from "react";

const MESSAGES = [
    "Connecting to database…",
    "Verifying schema integrity…",
    "Syncing operational data…",
    "Preparing your dashboard…",
    "Almost ready…",
];

const POLL_MS    = 1200;   // cycle messages every 1.2s
const TIMEOUT_MS = 10000;  // give up waiting after 10s and proceed anyway
const API_URL    = "/health";

/** Resolve company name from localStorage settings */
function getCompanyName() {
    try {
        const s = JSON.parse(localStorage.getItem("segecha_settings") || "{}");
        return s.companyName || "Segecha Tracking";
    } catch {
        return "Segecha Tracking";
    }
}

/**
 * AppLoadingScreen
 * Shows while the backend DB connection is being verified.
 * Calls onReady() once healthy or after TIMEOUT_MS (with a warning toast).
 */
export function AppLoadingScreen({ onReady, onWarn }) {
    const [msgIdx, setMsgIdx]   = useState(0);
    const [status, setStatus]   = useState("loading"); // "loading" | "ok" | "error"
    const [visible, setVisible] = useState(true);
    const [dots, setDots]       = useState("");
    const companyName           = getCompanyName();
    const timeoutRef            = useRef(null);
    const msgRef                = useRef(null);
    const dotsRef               = useRef(null);

    // Cycle status messages
    useEffect(() => {
        msgRef.current = setInterval(() => {
            setMsgIdx(i => (i + 1) % MESSAGES.length);
        }, POLL_MS);
        return () => clearInterval(msgRef.current);
    }, []);

    // Animate dots
    useEffect(() => {
        dotsRef.current = setInterval(() => {
            setDots(d => d.length >= 3 ? "" : d + ".");
        }, 400);
        return () => clearInterval(dotsRef.current);
    }, []);

    const dismiss = (ok) => {
        setStatus(ok ? "ok" : "error");
        setVisible(false);
        setTimeout(onReady, 420); // wait for fade-out CSS transition
    };

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            try {
                // Electron IPC path
                if (window.electronAPI?.getHealthStatus) {
                    const h = await window.electronAPI.getHealthStatus();
                    if (cancelled) return;
                    if (h?.db === "connected") {
                        dismiss(true);
                    } else {
                        onWarn?.("Database is degraded — some data may not load correctly.");
                        dismiss(false);
                    }
                    return;
                }
                // Browser / web path
                const res = await fetch(API_URL, { cache: "no-store" });
                if (cancelled) return;
                if (res.ok) {
                    const json = await res.json().catch(() => ({}));
                    if (json.db === "connected") {
                        dismiss(true);
                    } else {
                        onWarn?.("Database is degraded — some data may not load correctly.");
                        dismiss(false);
                    }
                } else {
                    throw new Error("non-ok");
                }
            } catch {
                if (!cancelled) {
                    onWarn?.("Could not reach the database server. Running in offline mode.");
                    dismiss(false);
                }
            }
        };

        // Hard timeout — never block the user for more than TIMEOUT_MS
        timeoutRef.current = setTimeout(() => {
            if (!cancelled) {
                onWarn?.("Database sync timed out. Proceeding with cached data.");
                dismiss(false);
            }
        }, TIMEOUT_MS);

        check();

        return () => {
            cancelled = true;
            clearTimeout(timeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            style={{
                position:       "fixed",
                inset:          0,
                zIndex:         9999,
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                background:     "var(--bg-main, #0f0f13)",
                transition:     "opacity 0.4s ease, visibility 0.4s ease",
                opacity:        visible ? 1 : 0,
                visibility:     visible ? "visible" : "hidden",
                userSelect:     "none",
            }}
        >
            {/* Ambient glow blobs */}
            <div style={{
                position: "absolute", width: 480, height: 480, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
                top: "10%", left: "50%", transform: "translateX(-50%)",
                filter: "blur(60px)", pointerEvents: "none",
            }} />
            <div style={{
                position: "absolute", width: 320, height: 320, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
                bottom: "15%", right: "15%",
                filter: "blur(50px)", pointerEvents: "none",
            }} />

            {/* Main card */}
            <div style={{
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           28,
                padding:       "48px 56px",
                borderRadius:  24,
                background:    "rgba(255,255,255,0.03)",
                border:        "1px solid rgba(255,255,255,0.07)",
                backdropFilter:"blur(20px)",
                boxShadow:     "0 32px 80px rgba(0,0,0,0.4)",
                maxWidth:      420,
                width:         "90%",
                textAlign:     "center",
            }}>
                {/* Spinner ring */}
                <div style={{ position: "relative", width: 72, height: 72 }}>
                    <svg
                        width="72" height="72" viewBox="0 0 72 72"
                        style={{ animation: "spin 1.1s linear infinite", display: "block" }}
                    >
                        <circle cx="36" cy="36" r="30" fill="none"
                            stroke="rgba(99,102,241,0.15)" strokeWidth="5" />
                        <circle cx="36" cy="36" r="30" fill="none"
                            stroke="var(--brand-primary, #6366f1)" strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray="110 60"
                            strokeDashoffset="0"
                        />
                    </svg>
                    {/* Center truck icon */}
                    <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                            stroke="var(--brand-primary, #6366f1)" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 3h15v13H1z"/>
                            <path d="M16 8h4l3 3v5h-7V8z"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/>
                            <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                    </div>
                </div>

                {/* Company name */}
                <div>
                    <div style={{
                        fontSize: 22, fontWeight: 900,
                        color: "var(--text-primary, #fff)",
                        letterSpacing: "-0.02em",
                        marginBottom: 4,
                    }}>
                        {companyName}
                    </div>
                    <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: "var(--brand-primary, #6366f1)",
                        textTransform: "uppercase", letterSpacing: "0.15em",
                    }}>
                        Fleet Management System
                    </div>
                </div>

                {/* Status message */}
                <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: "var(--text-dim, rgba(255,255,255,0.4))",
                    minHeight: 20,
                    transition: "opacity 0.3s",
                }}>
                    {MESSAGES[msgIdx]}{dots}
                </div>

                {/* Progress bar */}
                <div style={{
                    width: "100%", height: 3,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 2, overflow: "hidden",
                }}>
                    <div style={{
                        height: "100%",
                        background: "linear-gradient(90deg, var(--brand-primary, #6366f1), #8b5cf6)",
                        borderRadius: 2,
                        animation: "progress-bar 10s linear forwards",
                    }} />
                </div>

                {/* Subtle version hint */}
                <div style={{
                    fontSize: 11, color: "rgba(255,255,255,0.18)",
                    fontFamily: "var(--font-mono, monospace)",
                }}>
                    Syncing with database server…
                </div>
            </div>

            {/* CSS keyframes injected inline */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes progress-bar {
                    from { width: 0%; }
                    to   { width: 100%; }
                }
            `}</style>
        </div>
    );
}
