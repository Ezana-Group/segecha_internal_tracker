import React from "react";
import DOMPurify from "dompurify";
import { 
    FileText, 
    Download, 
    Printer, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    MapPin, 
    Truck, 
    User,
    CreditCard
} from "lucide-react";
import { fmt, canonicalTemplateType } from "../utils/formatters";

const VAT_RATE = 0.16;

export function InvoiceView({ inv, data, dark, fillTemplate }) {
    const s = (() => { try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); } catch { return {}; } })();
    const journey = data.journeys.find(j => j.id === inv.journey);
    const truck = journey ? data.trucks.find(t => t.id === journey.truck) : null;
    const driver = journey ? data.drivers.find(d => d.id === journey.driver) : null;
    const vat = Math.round(inv.amount * 0.16);
    const subtotal = inv.amount - vat;

    // Template Logic
    const templateId = s.defaultInvoiceTemplate;
    const template = templateId ? data.templates.find((t) => t.id === templateId) : null;
    const usePdfTemplate = template && canonicalTemplateType(template.type) === "PDF" && fillTemplate;

    if (usePdfTemplate) {
        const payments = (data.finance || []).filter(f => f.invoiceId === inv.id);
        const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const balanceAmount = (inv.amount || 0) - totalPaid;

        const context = {
            invoiceId: inv.id,
            customerName: inv.client || "Valued Customer",
            amount: Number(inv.amount).toLocaleString("en-KE", { maximumFractionDigits: 0 }),
            dueDate: inv.due,
            mpesaRef: inv.mpesaRef || "",
            customerPhone: inv.phone || "",
            businessName: s.companyName || "Segecha Group",
            businessAddress: s.address || s.companyAddress || "",
            businessPhone: s.phone || s.companyPhone || "",
            origin: journey?.origin || "N/A",
            destination: journey?.dest || "N/A",
            dest: journey?.dest || "N/A",
            journeyId: journey?.id || inv.journey || "",
            cargo: journey?.cargo || "",
            truckReg: truck?.reg || "N/A",
            driverName: driver?.name || "",
            driverId: driver?.uId || driver?.id || "",
            revenue: journey?.revenue != null ? Number(journey.revenue).toLocaleString("en-KE") : "",
            waybillNo: journey?.waybillNo || journey?.waybillData?.waybillNo || "",
            borderPoint: journey?.waybillData?.borderPoint || "",
            today: new Date().toISOString().split("T")[0],
            paidAmount: totalPaid.toLocaleString("en-KE"),
            totalPaid: totalPaid.toLocaleString("en-KE"),
            balanceAmount: balanceAmount.toLocaleString("en-KE"),
            balanceDue: balanceAmount.toLocaleString("en-KE"),
            paymentStatus: inv.status || "Pending",
        };
        const renderedBody = fillTemplate(template.body, context);
        
        return (
            <div 
                style={{ 
                    background: "white", 
                    color: "black", 
                    padding: "40px", 
                    minHeight: "100%", 
                    boxShadow: "0 0 20px rgba(0,0,0,0.1)",
                    borderRadius: 8
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderedBody) }}
            />
        );
    }

    return (
        <div style={{ 
            background: "var(--bg-card)", 
            color: "var(--text-primary)", 
            padding: "48px", 
            borderRadius: "24px", 
            fontFamily: "var(--font-primary)",
            boxShadow: "var(--shadow-premium)",
            border: "1px solid var(--border-subtle)",
            position: "relative",
            overflow: "hidden"
        }}>
            {/* Header / Brand */}
            {/* ... rest of the original premium layout ... */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 48, alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    {s.companyLogo ? (
                        <img src={s.companyLogo} style={{ width: 80, height: 80, objectFit: "contain" }} alt="Logo" />
                    ) : (
                        <div style={{ 
                            width: 64, 
                            height: 64, 
                            background: "linear-gradient(135deg, #f97316, #ea580c)", 
                            borderRadius: 16, 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            color: "#fff", 
                            fontWeight: 900, 
                            fontSize: 32,
                            boxShadow: "0 8px 16px rgba(234, 88, 12, 0.2)"
                        }}>S</div>
                    )}
                    <div>
                        <h1 style={{ fontSize: 40, fontWeight: 900, color: "var(--brand-primary)", letterSpacing: "-0.04em", lineHeight: 1 }}>INVOICE</h1>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{inv.id}</div>
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: "var(--text-primary)", marginBottom: 6 }}>{s.companyName}</div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{s.address || s.companyAddress || 'Nairobi, Kenya'}</div>
                    <div style={{ fontSize: 14, color: "var(--brand-primary)", fontWeight: 600, marginTop: 4 }}>{s.phone || s.companyPhone || '+254 700 000 000'}</div>
                </div>
            </div>

            {/* Bill To & Status */}
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr", 
                gap: 48, 
                marginBottom: 48, 
                background: "rgba(255,255,255,0.02)", 
                padding: "32px", 
                borderRadius: "20px",
                border: "1px solid var(--border-subtle)"
            }}>
                <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 12 }}>Billed To</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>{inv.client}</div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <CreditCard size={14} /> {inv.phone}
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Issued: <b style={{ color: "var(--text-primary)" }}>{inv.issued}</b></div>
                        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Due: <b style={{ color: "#ef4444" }}>{inv.due}</b></div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <span style={{ 
                            background: inv.status === "Paid" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", 
                            color: inv.status === "Paid" ? "#10b981" : "#ef4444", 
                            padding: "6px 16px", 
                            borderRadius: "100px", 
                            fontSize: 12, 
                            fontWeight: 800,
                            border: `1px solid ${inv.status === "Paid" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`
                        }}>{inv.status.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            {journey && (
                <div style={{ marginBottom: 48 }}>
                    <table className="table-modern" style={{ width: "100%" }}>
                        <thead>
                            <tr>
                                <th style={{ background: "transparent", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", padding: "12px 16px" }}>Description</th>
                                <th style={{ background: "transparent", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", padding: "12px 16px" }}>Route</th>
                                <th style={{ background: "transparent", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", padding: "12px 16px" }}>Truck</th>
                                <th style={{ background: "transparent", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", padding: "12px 16px", textAlign: "right" }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <td style={{ padding: "24px 16px" }}>
                                    <div style={{ fontWeight: 800, fontSize: 15 }}>Freight Services</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{journey.cargo}</div>
                                </td>
                                <td style={{ padding: "24px 16px" }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{journey.origin} → {journey.dest}</div>
                                </td>
                                <td style={{ padding: "24px 16px" }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{truck?.reg || "—"}</div>
                                </td>
                                <td style={{ padding: "24px 16px", textAlign: "right", fontWeight: 800, fontSize: 15 }}>
                                    KES {subtotal.toLocaleString()}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 64 }}>
                <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>Subtotal</span>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>KES {subtotal.toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>VAT (16%)</span>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>KES {vat.toLocaleString()}</span>
                    </div>
                    <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        paddingTop: 16, 
                        marginTop: 8, 
                        borderTop: "2px solid var(--border-subtle)" 
                    }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "var(--brand-primary)" }}>TOTAL</span>
                        <span style={{ fontSize: 24, fontWeight: 900, color: "var(--brand-primary)" }}>KES {Number(inv.amount).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Settlement History */}
            {inv.payments && inv.payments.length > 0 && (
                <div style={{ marginBottom: 48, background: "rgba(255,255,255,0.01)", padding: 24, borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                    <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 16 }}>Settlement History</h4>
                    <table style={{ width: "100%", fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                                <th style={{ paddingBottom: 12, fontWeight: 700 }}>Date</th>
                                <th style={{ paddingBottom: 12, fontWeight: 700 }}>Method</th>
                                <th style={{ paddingBottom: 12, fontWeight: 700 }}>Reference</th>
                                <th style={{ paddingBottom: 12, fontWeight: 700, textAlign: "right" }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inv.payments.map((p, idx) => (
                                <tr key={p.id || idx} style={{ borderBottom: idx === inv.payments.length - 1 ? "none" : "1px solid var(--border-subtle)20" }}>
                                    <td style={{ padding: "12px 0", color: "var(--text-primary)" }}>{p.date}</td>
                                    <td style={{ padding: "12px 0", color: "var(--text-primary)" }}>{p.method}</td>
                                    <td style={{ padding: "12px 0", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{p.ref || "—"}</td>
                                    <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 700, color: "#10b981" }}>KES {Number(p.amount).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: "2px solid var(--border-subtle)", fontWeight: 800 }}>
                                <td colSpan="3" style={{ paddingTop: 12, color: "var(--text-muted)" }}>Total Paid</td>
                                <td style={{ paddingTop: 12, textAlign: "right", color: "#10b981" }}>KES {Number(inv.paidAmount || 0).toLocaleString()}</td>
                            </tr>
                            <tr style={{ fontWeight: 900 }}>
                                <td colSpan="3" style={{ paddingTop: 4, color: "var(--brand-primary)" }}>Balance Outstanding</td>
                                <td style={{ paddingTop: 4, textAlign: "right", color: "var(--brand-primary)" }}>KES {Number((inv.amount || 0) - (inv.paidAmount || 0)).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Payment Info & Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px solid var(--border-subtle)", paddingTop: 32 }}>
                <div style={{ maxWidth: 400 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 12 }}>Payment Instructions</h4>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                        {(() => {
                            let footer = 'Payment via M-Pesa Paybill';
                            if (s.paybillNumber) footer += ` (Paybill: ${s.paybillNumber}, Acc: ${s.paybillAccount || 'Invoice No.'})`;
                            if (s.bankName) footer += `\nBank Transfer: ${s.bankName}, A/C ${s.bankAccount || ''}${s.bankBranch ? ', ' + s.bankBranch : ''}`;
                            return footer;
                        })()}
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    {s.companySignature && (
                        <img src={s.companySignature} style={{ height: 60, objectFit: "contain", marginBottom: 12, opacity: 0.8 }} alt="Signature" />
                    ) || <div style={{ height: 60 }} />}
                    <div style={{ borderTop: "1px solid var(--text-muted)", paddingTop: 8, marginTop: 8, width: 200, marginLeft: "auto" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>{s.companyContact || 'Authorized Signatory'}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Operations Dept</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
