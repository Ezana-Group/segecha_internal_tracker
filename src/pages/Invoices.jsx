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
    DollarSign,
    Search as SearchIcon,
    Printer,
    Download,
    MessageSquare,
} from "lucide-react";
import { fmt, today, fmtDate } from "../utils/formatters";
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

export function Invoices({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, markInvoicePaid, invoicePreview, setInvoicePreview, customerName, ...props }) {
    const navigate = useNavigate();

    const [paymentModal, setPaymentModal] = useState(null);
    const [payReqStatus, setPayReqStatus] = useState({});
    const [paymentReceiptWa, setPaymentReceiptWa] = useState(null);
    const [statusTab, setStatusTab] = useState("All");

    // Refine data for sorting and filtering
    const refinedInvoices = data.invoices.map(i => ({
        ...i,
        _client: i.client || customerName(i.customerId),
        _amount: Number(i.amount || 0),
        _balance: Math.max(0, Number(i.amount || 0) - Number(i.paidAmount || 0)),
        _computedStatus: Number(i.paidAmount || 0) >= Number(i.amount || 0)
            ? "Paid"
            : Number(i.paidAmount || 0) > 0
                ? "Partial"
                : (i.status || "Pending"),
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

    // Apply status tab filter on top of table filter
    const tabFilteredInvoices = statusTab === "All"
        ? sortedInvoices
        : sortedInvoices.filter(i => {
            if (statusTab === "Overdue") {
                return i.status !== "Paid" && new Date(i.dueDate) < new Date();
            }
            return (i._computedStatus || i.status) === statusTab;
        });

    // Summary totals (from all invoices, not just filtered)
    const paidTotal    = data.invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (+i.paidAmount || 0), 0);
    const pendingTotal = data.invoices.filter(i => i.status !== "Paid").reduce((s, i) => s + (+i.amount - (+i.paidAmount || 0)), 0);
    const overdueTotal = data.invoices.filter(i => i.status !== "Paid" && new Date(i.dueDate) < new Date()).reduce((s, i) => s + (+i.amount - (+i.paidAmount || 0)), 0);

    return (
        <div className="page-shell">
            <PageHeader
                icon={FileText}
                title="Invoices"
                description="Billing, payment requests, and settlement status."
                actions={
                    <>
                        <Button variant="secondary" icon={Download}>Export</Button>
                        <Button variant="premium" icon={Plus} onClick={() => openModal("invoice")}>
                            Create Invoice
                        </Button>
                    </>
                }
            />

            {/* ── 3 summary chips ── */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
                {[
                    { label: "Paid",    value: paidTotal,    color: "#10b981", icon: CheckCircle2, id: "Paid"    },
                    { label: "Pending", value: pendingTotal, color: "#f59e0b", icon: Clock,         id: "Pending" },
                    { label: "Overdue", value: overdueTotal, color: "#ef4444", icon: AlertCircle,   id: "Overdue" },
                ].map(({ label, value, color, icon: Icon, id }) => (
                    <button
                        key={id}
                        onClick={() => setStatusTab(t => t === id ? "All" : id)}
                        style={{
                            all: "unset",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            padding: "16px 20px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--bg-card)",
                            border: statusTab === id ? `2px solid ${color}` : "1px solid var(--border-subtle)",
                            transition: "border-color 0.15s",
                        }}
                    >
                        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                            <Icon size={20} />
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                            <div style={{ fontSize: 19, fontWeight: 900, color, marginTop: 1 }}>{fmt(value)}</div>
                        </div>
                    </button>
                ))}
            </div>

            {/* ── Status filter tabs ── */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)", marginBottom: 20 }}>
                {["All", "Pending", "Partial", "Paid", "Overdue"].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setStatusTab(tab)}
                        style={{
                            padding: "9px 16px",
                            border: "none",
                            background: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: statusTab === tab ? "var(--brand-primary)" : "var(--text-dim)",
                            position: "relative",
                            transition: "color 0.15s",
                        }}
                    >
                        {tab}
                        {statusTab === tab && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "var(--brand-primary)", borderRadius: "2px 2px 0 0" }} />
                        )}
                    </button>
                ))}
            </div>

            {/* ── Invoices table ── */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: "var(--radius-md)" }}>
                {/* Search bar */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                    <SearchIcon size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                    <input
                        type="search"
                        placeholder="Search by invoice ID or client..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500, outline: "none" }}
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
                                { key: "id",       label: "Invoice #",    sortable: true },
                                { key: "_client",  label: "Customer",     sortable: true },
                                { key: "_amount",  label: "Amount",       sortable: true, align: "right" },
                                { key: "_balance", label: "Outstanding",  sortable: true, align: "right" },
                                { key: "status",   label: "Status",       sortable: true },
                                { key: "dueDate",  label: "Due Date",     sortable: true },
                                { key: "actions",  label: "",             sortable: false, align: "right" },
                            ]}
                        />
                        <tbody>
                            {tabFilteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", padding: "64px 20px", color: "var(--text-dim)" }}>
                                        <AlertCircle size={40} style={{ opacity: 0.2, display: "block", margin: "0 auto 12px" }} />
                                        <div style={{ fontWeight: 600 }}>No invoices match your filters.</div>
                                    </td>
                                </tr>
                            ) : tabFilteredInvoices.map(inv => {
                                const effectiveStatus = inv._computedStatus || inv.status;
                                const isOverdue = effectiveStatus !== "Paid" && new Date(inv.dueDate) < new Date();
                                return (
                                    <tr
                                        key={inv.id}
                                        onClick={() => setInvoicePreview(inv)}
                                        style={{ cursor: "pointer" }}
                                        className="hover-scale"
                                    >
                                        {/* Invoice # */}
                                        <td className="sticky-col" style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                            {inv.id}
                                        </td>

                                        {/* Customer */}
                                        <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                            {inv._client}
                                        </td>

                                        {/* Amount */}
                                        <td style={{ fontWeight: 800, color: "var(--text-primary)", textAlign: "right" }}>
                                            {fmt(inv.amount)}
                                        </td>

                                        {/* Outstanding */}
                                        <td style={{ fontWeight: 700, textAlign: "right", color: inv._balance > 0 ? "#f59e0b" : "#10b981" }}>
                                            {inv._balance > 0 ? fmt(inv._balance) : "—"}
                                        </td>

                                        {/* Status */}
                                        <td className="status-col">
                                            <Badge status={effectiveStatus}>{effectiveStatus}</Badge>
                                        </td>

                                        {/* Due date */}
                                        <td style={{ color: isOverdue ? "#ef4444" : "var(--text-secondary)", fontWeight: isOverdue ? 700 : 400, fontSize: 13, whiteSpace: "nowrap" }}>
                                            {fmtDate(inv.dueDate)}
                                        </td>

                                        {/* Actions */}
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for invoice ${inv.id}`}
                                                items={[
                                                    {
                                                        id: "preview",
                                                        label: "View invoice",
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
                                                        label: "Record payment",
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── Modals & Overlays ── */}
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
                                                            firstName: (cust?.contactPerson || inv.client || customerName(inv.customerId) || "").trim().split(/\s+/)[0] || "",
                                                            journeyId: journey?.id || jid || "",
                                                            origin: journey?.origin || "",
                                                            destination: journey?.dest || "",
                                                            dest: journey?.dest || "",
                                                            cargo: journey?.cargo || "",
                                                            truckReg: truck?.reg || "",
                                                            driverName: driver?.name || "",
                                                            driverId: driver?.uId || driver?.id || "",
                                                            revenue: journey?.revenue != null ? fmt(journey.revenue) : "",
                                                            waybillNo: journey?.waybillNo || journey?.waybillData?.waybillNo || "",
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
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                        Send a digital receipt to <b>{paymentReceiptWa.name}</b> via WhatsApp?
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Button style={{ flex: 1 }} variant="ghost" onClick={() => setPaymentReceiptWa(null)}>Dismiss</Button>
                        <Button style={{ flex: 1, background: "#25D366", border: "none", color: "white" }} onClick={() => { window.open(paymentReceiptWa.url); setPaymentReceiptWa(null); }}>
                            Send Now
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
