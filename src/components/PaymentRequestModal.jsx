import React, { useState, useEffect } from "react";
import { 
    Send, 
    MessageSquare, 
    Mail, 
    Smartphone, 
    Share2, 
    Copy, 
    Check,
    Zap,
    ExternalLink
} from "lucide-react";
import { fmt } from "../utils/formatters";
import { Button } from "./Button";
import { Card } from "./Card";

export function PaymentRequestModal({ inv, onClose, payReqStatus, setPayReqStatus, S, T, data, templates, fillTemplate, dark, PAYMENT_API, PORTAL_URL }) {
    const getSettings = () => {
        try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); }
        catch { return {}; }
    };
    
    const s = getSettings();
    const portalUrl = `${PORTAL_URL}?inv=${encodeURIComponent(inv.id)}&amount=${inv.amount}&client=${encodeURIComponent(inv._client || inv.client)}`;
    
    const buildWhatsAppUrl = (invCopy) => {
        // Find the WhatsApp template (t5 by default in seed)
        const waTpl = (templates || []).find(t => t.id === 't5' || (t.type === 'WhatsApp' && t.category === 'Finance'));
        
        if (waTpl && fillTemplate) {
            const ctx = {
                invoiceId: invCopy.id,
                amount: Number(invCopy.amount).toLocaleString('en-KE'),
                dueDate: invCopy.due,
                customerName: invCopy._client || invCopy.client,
                invoiceUrl: portalUrl,
                paymentUrl: portalUrl,
                businessName: s.companyName || "Segecha Group",
            };
            const body = fillTemplate(waTpl.body, ctx);
            const cleanPhone = (invCopy._phone || invCopy.phone || '').replace(/\s/g, '').replace(/^0/, '254').replace(/^\+/, '');
            return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;
        }

        // Fallback to legacy hardcoded template
        const lines = [
            `Hi ${invCopy._client || invCopy.client},`,
            ``,
            `Payment request from *${s.companyName || "Segecha Group"}*.`,
            ``,
            `📋 *Invoice:* ${invCopy.id}`,
            `💰 *Amount Due:* KES ${Number(invCopy.amount).toLocaleString('en-KE')}`,
            `📅 *Due Date:* ${invCopy.due}`,
            ``,
            `Pay securely here 👉 ${portalUrl}`,
            ``,
            `_M-Pesa, Card, Bank Transfer & Pesalink accepted._`,
        ];
        const cleanPhoneFallback = (invCopy._phone || invCopy.phone || '').replace(/\s/g, '').replace(/^0/, '254').replace(/^\+/, '');
        return `https://wa.me/${cleanPhoneFallback}?text=${encodeURIComponent(lines.join('\n'))}`;
    };

    const sendEmailRequest = async (invCopy, emailAddress) => {
        setPayReqStatus(st => ({ ...st, email: { loading: true } }));
        try {
            const res = await fetch(`${PAYMENT_API}/api/send/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: emailAddress, invoice: invCopy, settings: s }),
            });
            const data = await res.json();
            if (data.success) setPayReqStatus(st => ({ ...st, email: { success: true } }));
            else setPayReqStatus(st => ({ ...st, email: { error: data.error || 'Failed to send' } }));
        } catch {
            setPayReqStatus(st => ({ ...st, email: { error: 'Server not reachable' } }));
        }
    };

    const sendSMSRequest = async (invCopy) => {
        setPayReqStatus(st => ({ ...st, sms: { loading: true } }));
        try {
            const res = await fetch(`${PAYMENT_API}/api/send/sms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: invCopy._phone || invCopy.phone, clientName: invCopy._client || invCopy.client, invoiceId: invCopy.id, amount: invCopy.amount }),
            });
            const data = await res.json();
            if (data.success) setPayReqStatus(st => ({ ...st, sms: { success: true } }));
            else setPayReqStatus(st => ({ ...st, sms: { error: data.error || 'Failed to send' } }));
        } catch {
            setPayReqStatus(st => ({ ...st, sms: { error: 'Server not reachable' } }));
        }
    };

    const sendSTKPushToClient = async (invCopy, clientPhone) => {
        setPayReqStatus(st => ({ ...st, stk: { loading: true } }));
        try {
            const res = await fetch(`${PAYMENT_API}/api/mpesa/stk-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: clientPhone, amount: invCopy.amount, invoiceId: invCopy.id, clientName: invCopy._client || invCopy.client }),
            });
            const data = await res.json();
            if (data.success) setPayReqStatus(st => ({ ...st, stk: { success: true } }));
            else setPayReqStatus(st => ({ ...st, stk: { error: data.error || 'STK Push failed' } }));
        } catch {
            setPayReqStatus(st => ({ ...st, stk: { error: 'Server not reachable' } }));
        }
    };

    const [clientEmail, setClientEmail] = useState(inv._email || inv.email || '');
    const [stkPhone, setStkPhone] = useState(inv._phone || inv.phone || '');
    const [smsPhone, setSmsPhone] = useState(inv._phone || inv.phone || "");
    const [copied, setCopied] = useState(false);

    // Synchronize local state if invoice data changes (e.g. from global state update)
    useEffect(() => {
        setClientEmail(inv._email || inv.email || '');
        setStkPhone(inv._phone || inv.phone || '');
        setSmsPhone(inv._phone || inv.phone || "");
    }, [inv]);


    const copyLink = () => {
        navigator.clipboard.writeText(portalUrl).then(() => { 
            setCopied(true); 
            setTimeout(() => setCopied(false), 2200); 
        });
    };

    const statusTag = (key) => {
        const st = payReqStatus[key] || {};
        if (st.loading) return <span style={{ color: "var(--brand-primary)", fontSize: 11, fontWeight: 600 }}>Sending…</span>;
        if (st.success) return <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>Sent</span>;
        if (st.error) return <span style={{ color: "#ef4444", fontSize: 11 }}>❌ {st.error}</span>;
        return null;
    };

    const safePad = "max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))";

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                zIndex: 1000,
                padding: safePad,
                overflowY: "auto",
                overscrollBehavior: "contain",
            }}
            onClick={onClose}
        >
            <Card
                style={{
                    width: "min(600px, calc(100vw - 24px))",
                    maxWidth: "100%",
                    maxHeight: "min(90dvh, 880px)",
                    margin: "24px 0",
                    padding: 32,
                    position: "relative",
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>Request Payment</h2>
                    <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">Close</Button>
                </div>

                {/* Summary */}
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 20, border: "1px solid var(--border-subtle)", marginBottom: 24 }}>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>RECIPIENT: <b>{inv._client || inv.client}</b></div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 4 }}>TOTAL DUE</div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: "var(--brand-primary)" }}>{fmt(inv.amount)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", marginBottom: 4 }}>INVOICE ID</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{inv.id}</div>
                        </div>
                    </div>
                </div>

                {/* Channel List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    
                    {/* Portal Link */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1, position: "relative" }}>
                            <input className="input-premium" style={{ fontSize: 11, fontFamily: "var(--font-mono)", paddingRight: 80 }} value={portalUrl} readOnly />
                            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                                <Button size="sm" variant="ghost" onClick={copyLink} style={{ height: 28 }}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderRadius: 16, border: "1px solid rgba(37, 211, 102, 0.2)", background: "rgba(37, 211, 102, 0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(37, 211, 102, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#25d366" }}>
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>WhatsApp Business</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Send pre-written invite</div>
                            </div>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            style={{ background: "rgba(37, 211, 102, 0.1)", color: "#25d366" }}
                            onClick={() => window.open(buildWhatsAppUrl(inv), "_blank", "noopener,noreferrer")}
                        >
                            Send →
                        </Button>
                    </div>

                    {/* M-Pesa STK Push */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px", borderRadius: 16, border: "1px solid rgba(16, 185, 129, 0.2)", background: "rgba(16, 185, 129, 0.03)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                                    <Zap size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>Instant M-Pesa Prompt</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>STK Push to client's phone</div>
                                </div>
                            </div>
                            {statusTag('stk')}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input className="input-premium" type="tel" placeholder="Phone 07XXXXXXXX" value={stkPhone} onChange={e => setStkPhone(e.target.value)} style={{ height: 38 }} />
                            <Button size="sm" onClick={() => sendSTKPushToClient(inv, stkPhone)} disabled={payReqStatus.stk?.loading} style={{ height: 38 }}>Push Request</Button>
                        </div>
                    </div>

                    {/* Email */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px", borderRadius: 16, border: "1px solid rgba(59, 130, 246, 0.2)", background: "rgba(59, 130, 246, 0.03)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>Email Invoice</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Branded PDF & link</div>
                                </div>
                            </div>
                            {statusTag('email')}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input className="input-premium" type="email" placeholder="client@company.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} style={{ height: 38 }} />
                            <Button size="sm" variant="ghost" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }} onClick={() => sendEmailRequest(inv, clientEmail)} disabled={payReqStatus.email?.loading}>Send Email</Button>
                        </div>
                    </div>

                    {/* SMS */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px", borderRadius: 16, border: "1px solid rgba(234, 179, 8, 0.25)", background: "rgba(234, 179, 8, 0.05)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(234, 179, 8, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ca8a04" }}>
                                    <Smartphone size={20} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>SMS (normal message)</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Text payment link to client phone</div>
                                </div>
                            </div>
                            {statusTag("sms")}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input className="input-premium" type="tel" placeholder="07XXXXXXXX" value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} style={{ height: 38, flex: 1 }} />
                            <Button size="sm" variant="ghost" style={{ background: "rgba(234, 179, 8, 0.12)", color: "#a16207" }} onClick={() => sendSMSRequest({ ...inv, phone: smsPhone })} disabled={payReqStatus.sms?.loading}>
                                Send SMS
                            </Button>
                        </div>
                    </div>

                </div>
            </Card>
        </div>
    );
}
