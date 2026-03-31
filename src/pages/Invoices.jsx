import React, { useState } from "react";
import { 
    FileText, 
    Plus, 
    Send, 
    CreditCard, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    TrendingUp, 
    TrendingDown,
    DollarSign,
    Search,
    Printer,
    Download,
    MessageSquare,
    ArrowUpRight,
    ArrowDownRight,
    Search as SearchIcon,
    Filter,
    Share2,
    Calendar
} from "lucide-react";
import { fmt, uid, today, fmtDate } from "../utils/formatters";
import { validators } from "../utils/validators";
import { useNavigate } from "react-router-dom";
import { INVOICE_PREFIX, PAYMENT_TERMS_DAYS } from "../constants/nav";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { InvoiceView } from "../components/InvoiceView";
import { PaymentRequestModal } from "../components/PaymentRequestModal";
import { PAYMENT_API, PORTAL_URL } from "../utils/env";
import { fetchWithAuth } from "../utils/api";
import { readSettings } from "../utils/settingsStore.js";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { CommunicationChannelMenu } from "../components/CommunicationChannelMenu";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

// const PORTAL_URL = 'https://payment.example.com'; removed, imported from env.js above

export function Invoices({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, markInvoicePaid, invoicePreview, setInvoicePreview, customerName, ...props }) {
    const navigate = useNavigate();
    
    const [paymentModal, setPaymentModal] = useState(null);
    const [payReqStatus, setPayReqStatus] = useState({});
    const [paymentReceiptWa, setPaymentReceiptWa] = useState(null);

    const handleLogPayment = (payment) => {
        const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
        const inv = modal === "logPayment" ? data.invoices.find(i => i.id === form.invoiceId) : null;
        if (!inv) return;

        const newPayments = [...(inv.payments || []), { ...payment, id: uid().slice(0, 8) }];
        const newPaidAmount = newPayments.reduce((s, p) => s + +p.amount, 0);
        const newStatus = newPaidAmount >= +inv.amount ? "Paid" : "Partial";
        
        setData(d => ({
            ...d,
            invoices: d.invoices.map(i => i.id === inv.id ? {
                ...i,
                paidAmount: newPaidAmount,
                status: newStatus,
                payments: newPayments,
                paidDate: newStatus === "Paid" ? today() : i.paidDate
            } : i)
        }));

        if (inv.email && payment.method) {
            fetchWithAuth(`${PAYMENT_API}/api/invoices/send-receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId: inv.id,
                    payment: { ...payment, id: payment.id || Date.now() },
                    settings: s,
                }),
            }).catch(err => console.warn('Receipt email failed:', err.message));
        }

        const waMsg = [
            `✅ *Payment Receipt — ${inv.id}*`,
            ``,
            `Dear ${inv.client},`,
            `We have received your payment of *KES ${Number(payment.amount).toLocaleString()}*.`,
            ``,
            `Method: ${payment.method}`,
            `Ref: *${payment.ref || 'N/A'}*`,
            `Status: ${newStatus === "Paid" ? "Fully Settled ✅" : "Balance Outstanding"}`,
            ``,
            `Thank you — ${s.companyName || 'Segecha Group Ltd'}`,
        ].join('\n');

        const clientPhone = (inv.phone || '').replace(/\D/g, '').replace(/^0/, '254');
        if (clientPhone) {
            setPaymentReceiptWa({ url: `https://wa.me/${clientPhone}?text=${encodeURIComponent(waMsg)}`, name: inv.client });
        }
        closeModal();
    };

    // Refine data for sorting and filtering
    const refinedInvoices = data.invoices.map(i => ({
        ...i,
        _client: i.client || customerName(i.customerId),
        _amount: Number(i.amount || 0),
        _balance: Number(i.amount || 0) - Number(i.paidAmount || 0),
        _contact: `${i.phone || ""} ${i.email || ""}`
    }));

    const {
        filteredRows: sortedInvoices,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: invoiceFilters,
        applyFilter: handleInvoiceFilterChange,
        getUniqueValues: getInvoiceUniqueValues,
        searchTerm,
        setSearchTerm
    } = useTableFilter(refinedInvoices, { 
        namespace: "inv", 
        initialSort: { col: "date", dir: "desc" },
        searchColumns: ["id", "_client"]
    });

    const totalInvoicedFiltered = sortedInvoices.reduce((s, i) => s + +i.amount, 0);
    const totalPaidFiltered = sortedInvoices.reduce((s, i) => s + +i.paidAmount || 0, 0);
    const totalPendingFiltered = sortedInvoices.filter(i => i.status !== "Paid").reduce((s, i) => s + (+i.amount - (+i.paidAmount || 0)), 0);

    return (
        <div className="page-shell">
            <PageHeader
                icon={FileText}
                title="Invoices"
                description="Billing, payment requests, and settlement status."
                actions={
                    <>
                        <Button variant="secondary" icon={Download}>
                            Export
                        </Button>
                        <Button variant="premium" icon={Plus} onClick={() => openModal("invoice")}>
                            New invoice
                        </Button>
                    </>
                }
            />

            {/* Financial Status Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                {[
                    { label: "Filtered Revenue", value: fmt(totalInvoicedFiltered), icon: TrendingUp, color: "var(--brand-primary)" },
                    { label: "Filtered Settlements", value: fmt(totalPaidFiltered), icon: CheckCircle2, color: "#10b981" },
                    { label: "Filtered Receivables", value: fmt(totalPendingFiltered), icon: Clock, color: "#f59e0b" }
                ].map((kpi, idx) => (
                    <Card key={idx} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}10`, display: "flex", alignItems: "center", justifyContent: "center", color: kpi.color }}>
                                <kpi.icon size={20} />
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{kpi.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>{kpi.value}</div>
                    </Card>
                ))}
            </div>

            {/* Main Ledger Table */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search invoices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                    />
                </div>
                <div className="table-container">
                    <table className="table-modern">
                        <SortableTableHead
                            requestSort={requestSort}
                            sortConfig={sortConfig}
                            filterState={invoiceFilters}
                            onFilterChange={handleInvoiceFilterChange}
                            getUniqueValues={getInvoiceUniqueValues}
                            columns={[
                                { key: "id", label: "Invoice ID", sortable: true },
                                { key: "_client", label: "Client Name", sortable: true },
                                { key: "date", label: "Issue Date", sortable: true },
                                { key: "dueDate", label: "Due Date", sortable: true },
                                { key: "_amount", label: "Total Amount", sortable: true, align: "right" },
                                { key: "_balance", label: "Balance Owed", sortable: true, align: "right" },
                                { key: "status", label: "Status", sortable: true },
                                { key: "actions", label: "Actions", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {sortedInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No invoices found matching your filters.</div>
                                    </td>
                                </tr>
                            ) : sortedInvoices.map(inv => (
                                <tr key={inv.id} onClick={() => setInvoicePreview(inv)} style={{ cursor: "pointer" }} className="hover-scale">
                                    <td className="sticky-col" title={inv.id} style={{ fontWeight: 800, color: "var(--brand-primary)" }}>{inv.id}</td>
                                    <td title={inv._client}>
                                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                            {inv._client}
                                        </div>
                                    </td>
                                    <td title={fmtDate(inv.date)}>{fmtDate(inv.date)}</td>
                                    <td title={fmtDate(inv.dueDate)} style={{ color: (new Date(inv.dueDate) < new Date() && inv.status !== 'Paid') ? '#ef4444' : 'inherit', fontWeight: (new Date(inv.dueDate) < new Date() && inv.status !== 'Paid') ? 700 : 400 }}>
                                        {fmtDate(inv.dueDate)}
                                    </td>
                                    <td title={fmt(inv.amount)} style={{ fontWeight: 800, color: "var(--text-primary)", textAlign: "right" }}>{fmt(inv.amount)}</td>
                                    <td title={fmt(inv._balance)} style={{ color: "#f59e0b", fontWeight: 700, textAlign: "right" }}>{fmt(inv._balance)}</td>
                                    <td className="status-col" title={inv.status}><Badge status={inv.status} /></td>
                                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                        <TableRowActions
                                            ariaLabel={`Actions for invoice ${inv.id}`}
                                            items={[
                                                {
                                                    id: "preview",
                                                    label: "Preview invoice",
                                                    icon: FileText,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        setInvoicePreview(inv);
                                                    },
                                                },
                                                {
                                                    id: "payreq",
                                                    label: "Request payment",
                                                    icon: Send,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        setPaymentModal(inv);
                                                    },
                                                },
                                                {
                                                    id: "logpay",
                                                    label: "Log payment",
                                                    icon: DollarSign,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        openModal("logPayment", {
                                                            invoiceId: inv.id,
                                                            amount: inv._balance,
                                                            client: inv._client,
                                                        });
                                                    },
                                                },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modals & Overlays */}
            {paymentModal && (
                <PaymentRequestModal 
                    inv={paymentModal} 
                    onClose={() => setPaymentModal(null)}
                    payReqStatus={payReqStatus}
                    setPayReqStatus={setPayReqStatus}
                    PAYMENT_API={PAYMENT_API}
                    PORTAL_URL={PORTAL_URL}
                />
            )}

            {invoicePreview && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'center', padding: isMobile ? 0 : 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))', overflowY: isMobile ? 'hidden' : 'auto', overscrollBehavior: 'contain' }}>
                    <div style={{ width: '100%', maxWidth: 1000, height: isMobile ? '100dvh' : 'min(90dvh, 900px)', maxHeight: isMobile ? '100dvh' : 'min(90dvh, 900px)', margin: isMobile ? 0 : '24px 0', background: 'white', display: 'flex', flexDirection: 'column', borderRadius: isMobile ? 0 : 20, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 20px', background: '#111', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>INVOICE PREVIEW — {invoicePreview.id}</div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                {(() => {
                                    const inv = invoicePreview;
                                    const cust = inv.customerId ? data.customers?.find((c) => c.id === inv.customerId) : null;
                                    const custEmail = (cust?.email || "").trim();
                                    const co = readSettings().companyName || "Segecha Group";
                                    const plain = `Hi ${inv.client || customerName(inv.customerId)},\n\nInvoice ${inv.id} — amount due KES ${Number(inv.amount).toLocaleString("en-KE")}. Due ${inv.due}.\n\nThank you,\n${co}`;
                                    return (
                                        <>
                                            <CommunicationChannelMenu
                                                phone={inv.phone}
                                                email={custEmail}
                                                emailSubject={`Invoice ${inv.id} — ${inv.client || customerName(inv.customerId)}`}
                                                emailBody={plain}
                                                smsBody={plain}
                                                whatsappBody={plain}
                                                showToast={props.showToast}
                                                label="Send message"
                                                size="sm"
                                            />
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                icon={MessageSquare}
                                                onClick={() => {
                                                    const jid = inv.journey || inv.journeyId;
                                                    const journey = jid ? data.journeys?.find((j) => j.id === jid) : null;
                                                    const truck = journey ? data.trucks?.find((t) => t.id === journey.truck) : null;
                                                    const driver = journey ? data.drivers?.find((d) => d.id === journey.driver) : null;
                                                    openModal("templateSelector", {
                                                        type: "invoice",
                                                        entityData: {
                                                            invoiceId: inv.id,
                                                            customerName: inv.client || customerName(inv.customerId),
                                                            amount: fmt(inv.amount),
                                                            dueDate: inv.due,
                                                            mpesaRef: inv.mpesaRef || "",
                                                            customerPhone: inv.phone || "",
                                                            customerEmail: (cust?.email || "").trim(),
                                                            firstName: (cust?.contactPerson || inv.client || customerName(inv.customerId) || "")
                                                                .trim()
                                                                .split(/\s+/)[0] || "",
                                                            journeyId: journey?.id || jid || "",
                                                            origin: journey?.origin || "",
                                                            destination: journey?.dest || "",
                                                            dest: journey?.dest || "",
                                                            cargo: journey?.cargo || "",
                                                            truckReg: truck?.reg || "",
                                                            driverName: driver?.name || "",
                                                            driverId: driver?.uId || driver?.id || "",
                                                            revenue:
                                                                journey?.revenue != null ? fmt(journey.revenue) : "",
                                                            waybillNo:
                                                                journey?.waybillNo ||
                                                                journey?.waybillData?.waybillNo ||
                                                                "",
                                                            borderPoint: journey?.waybillData?.borderPoint || "",
                                                            businessName: readSettings().companyName || "",
                                                        },
                                                    });
                                                }}
                                            >
                                                Templates
                                            </Button>
                                        </>
                                    );
                                })()}
                                <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
                                <Button size="sm" variant="primary" onClick={() => setInvoicePreview(null)}>Close</Button>
                            </div>
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: '#f5f5f5', padding: isMobile ? 12 : 40 }}>
                            <InvoiceView inv={invoicePreview} data={data} dark={dark} fillTemplate={props.fillTemplate} />
                        </div>
                    </div>
                </div>
            )}

            {paymentReceiptWa && (
                <div className="animate-fade-in" style={{ position: 'fixed', bottom: 'max(16px, env(safe-area-inset-bottom))', right: 'max(16px, env(safe-area-inset-right))', left: 'auto', width: 'min(320px, calc(100vw - 32px))', maxWidth: 'calc(100vw - 32px)', background: "var(--bg-card)", border: "1px solid var(--border-subtle)", padding: 24, borderRadius: 20, boxShadow: "var(--glass-shadow)", zIndex: 1100, boxSizing: 'border-box' }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                            <MessageSquare size={20} />
                        </div>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>Payment Logged!</div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Would you like to send a digital receipt to <b>{paymentReceiptWa.name}</b> via WhatsApp?</p>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Button style={{ flex: 1 }} variant="ghost" onClick={() => setPaymentReceiptWa(null)}>Dismiss</Button>
                        <Button style={{ flex: 1, background: "#25D366", border: "none", color: "white" }} onClick={() => { window.open(paymentReceiptWa.url); setPaymentReceiptWa(null); }}>Send Now</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
