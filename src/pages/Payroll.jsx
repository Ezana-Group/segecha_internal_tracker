import React, { useState, useEffect } from "react";
import {
    Users,
    DollarSign,
    CheckCircle2,
    Clock,
    Calendar,
    Plus,
    Download,
    CreditCard,
    AlertCircle,
    Info,
    Edit2,
    Trash2,
    Smartphone,
    Search as SearchIcon,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { fmt, monthLabel } from "../utils/formatters";
import { PAYMENT_API } from "../utils/env";
import { fetchWithAuth } from "../utils/api";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";
import { mileageAllowanceForDriverOnJourney } from "../utils/driverAllowance.js";
import { computePayrollKRA } from "../utils/kenyaPayroll.js";

export function Payroll({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, markPayrollPaid, truckReg, customerName, driverName, showToast }) {
    const payrollRows = Array.isArray(data.payroll) ? data.payroll : [];
    const months = [...new Set(payrollRows.map((p) => p.month))].sort().reverse();
    const [selMonth, setSelMonth] = useState(months[0] || new Date().toISOString().slice(0, 7));
    const [dispatchQueue, setDispatchQueue] = useState([]);

    const monthPayroll = payrollRows.filter((p) => p.month === selMonth);

    useEffect(() => {
        if (!PAYMENT_API) return;
        fetchWithAuth(`${PAYMENT_API}/api/admin/payroll/dispatch-queue`)
            .then((r) => r.json())
            .then((d) => setDispatchQueue(d.rows || []))
            .catch(() => setDispatchQueue([]));
    }, [payrollRows.length]);

    const generatePayslip = async (payrollId) => {
        if (!PAYMENT_API) return;
        try {
            const res = await fetchWithAuth(`${PAYMENT_API}/api/admin/payroll/${payrollId}/generate-payslip`, { method: "POST" });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            showToast?.("Payslip generated", "success");
            if (j.payslipUrl) window.open(j.payslipUrl, "_blank", "noopener,noreferrer");
        } catch (e) {
            showToast?.(`Payslip generation failed: ${e.message}`, "error");
        }
    };

    const queuePayslipDispatch = async (payrollId) => {
        if (!PAYMENT_API) return;
        try {
            const res = await fetchWithAuth(`${PAYMENT_API}/api/admin/payroll/${payrollId}/queue-dispatch`, { method: "POST" });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            showToast?.("Payslip queued for dispatch", "success");
            const qRes = await fetchWithAuth(`${PAYMENT_API}/api/admin/payroll/dispatch-queue`);
            const qJson = await qRes.json();
            setDispatchQueue(qJson.rows || []);
        } catch (e) {
            showToast?.(`Queue failed: ${e.message}`, "error");
        }
    };

    const processDispatchQueue = async () => {
        if (!PAYMENT_API) return;
        try {
            const res = await fetchWithAuth(`${PAYMENT_API}/api/admin/payroll/dispatch/process`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: 25 }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
            showToast?.(`Dispatch run complete: ${j.sent} sent, ${j.failed} failed`, j.failed ? "warning" : "success");
            const qRes = await fetchWithAuth(`${PAYMENT_API}/api/admin/payroll/dispatch-queue`);
            const qJson = await qRes.json();
            setDispatchQueue(qJson.rows || []);
        } catch (e) {
            showToast?.(`Dispatch process failed: ${e.message}`, "error");
        }
    };

    // Refine payroll for sorting and filtering
    const refinedPayroll = monthPayroll.map(p => {
        const drv = data.drivers.find(d => d.id === p.driver) || (data.turnboys || []).find(t => t.id === p.driver);
        const journeys = data.journeys.filter(j => (j.driver === p.driver || j.turnboyId === p.driver) && j.date && j.date.startsWith(selMonth) && j.status === 'Completed');
        const calculatedMileage = journeys.reduce((s, j) => {
            if (j.driver === p.driver) return s + mileageAllowanceForDriverOnJourney(j, p.driver, data.expenses);
            if (j.turnboyId === p.driver) return s + (j.turnboyMileage || 0);
            return s;
        }, 0);
        const statutory = computePayrollKRA(p);
        const netPay = Number.isFinite(Number(p.netPay)) ? Number(p.netPay) : statutory.netPay;
        const totalDeductions = Number.isFinite(Number(p.totalDeductions)) ? Number(p.totalDeductions) : statutory.totalDeductions;
        const grossPay = Number.isFinite(Number(p.grossPay)) ? Number(p.grossPay) : statutory.grossPay;

        return {
            ...p,
            _name: drv?.name || p.driver,
            _role: drv?.role || 'Staff',
            _net: netPay,
            _gross: grossPay,
            _base: Number(p.baseSalary || 0),
            _allowance: Number(p.allowance || 0),
            _deductions: totalDeductions,
            _calculatedMileage: calculatedMileage,
            _mpesa: p.mpesaRef || drv?.mpesa || ""
        };
    });

    const {
        filteredRows: sortedPayroll,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: payrollFilters,
        applyFilter: handlePayrollFilterChange,
        getUniqueValues: getPayrollUniqueValues,
        searchTerm,
        setSearchTerm
    } = useTableFilter(refinedPayroll, {
        namespace: "pay",
        initialSort: { col: "_name", dir: "asc" },
        searchColumns: ["_name", "_mpesa"]
    });

    const filteredTotalNet     = sortedPayroll.reduce((s, p) => s + p._net, 0);
    const filteredPaidAmount   = sortedPayroll.filter(p => p.status === "Paid").reduce((s, p) => s + p._net, 0);
    const filteredPendingAmount = sortedPayroll.filter(p => p.status === "Pending").reduce((s, p) => s + p._net, 0);

    // Month navigation helpers
    const monthIdx = months.indexOf(selMonth);
    const prevMonth = () => { if (monthIdx < months.length - 1) setSelMonth(months[monthIdx + 1]); };
    const nextMonth = () => { if (monthIdx > 0) setSelMonth(months[monthIdx - 1]); };

    return (
        <div className="page-shell">
            <PageHeader
                icon={CreditCard}
                title="Payroll"
                description="Monthly runs, disbursements, and pay status."
                actions={
                    <>
                        <Button variant="secondary" icon={FileText} onClick={processDispatchQueue}>
                            Process payslip queue
                        </Button>
                        <Button variant="secondary" icon={Download}>Export paysheets</Button>
                        <Button
                            variant="premium"
                            icon={Plus}
                            onClick={() => openModal("payroll", { month: selMonth, status: "Pending" })}
                        >
                            Add Record
                        </Button>
                    </>
                }
            />

            {/* ── Month selector + summary row ── */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
                {/* Month navigator */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "6px 10px" }}>
                    <button
                        onClick={prevMonth}
                        disabled={monthIdx >= months.length - 1}
                        style={{ background: "none", border: "none", cursor: monthIdx >= months.length - 1 ? "default" : "pointer", color: "var(--text-dim)", display: "flex", padding: 4, borderRadius: 6, opacity: monthIdx >= months.length - 1 ? 0.3 : 1 }}
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140, justifyContent: "center" }}>
                        <Calendar size={15} color="var(--brand-primary)" />
                        <select
                            value={selMonth}
                            onChange={e => setSelMonth(e.target.value)}
                            style={{ border: "none", background: "none", fontSize: 14, fontWeight: 800, color: "var(--text-primary)", cursor: "pointer", outline: "none", appearance: "none" }}
                        >
                            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={nextMonth}
                        disabled={monthIdx <= 0}
                        style={{ background: "none", border: "none", cursor: monthIdx <= 0 ? "default" : "pointer", color: "var(--text-dim)", display: "flex", padding: 4, borderRadius: 6, opacity: monthIdx <= 0 ? 0.3 : 1 }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* Summary chips */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                        { label: "Total",   value: fmt(filteredTotalNet),      color: "var(--brand-primary)" },
                        { label: "Paid",    value: fmt(filteredPaidAmount),    color: "#10b981" },
                        { label: "Pending", value: fmt(filteredPendingAmount), color: "#ef4444" },
                    ].map(({ label, value, color }) => (
                        <div
                            key={label}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                padding: "8px 14px",
                                borderRadius: "var(--radius-md)",
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-subtle)",
                            }}
                        >
                            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Payroll table ── */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: "var(--radius-md)" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                    <SearchIcon size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                    <input
                        type="search"
                        placeholder="Search payroll..."
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
                            filterState={payrollFilters}
                            onFilterChange={handlePayrollFilterChange}
                            getUniqueValues={getPayrollUniqueValues}
                            columns={[
                                { key: "_name",       label: "Driver / Staff", sortable: true },
                                { key: "_base",       label: "Base Salary",    sortable: true, align: "right" },
                                { key: "_allowance",  label: "Allowance",      sortable: true, align: "right" },
                                { key: "_deductions", label: "Deductions",     sortable: true, align: "right" },
                                { key: "_net",        label: "Net Pay",        sortable: true, align: "right" },
                                { key: "status",      label: "Status",         sortable: true },
                                { key: "actions",     label: "",               sortable: false, align: "right" },
                            ]}
                        />
                        <tbody>
                            {sortedPayroll.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", padding: "64px 20px", color: "var(--text-dim)" }}>
                                        <AlertCircle size={40} style={{ opacity: 0.2, display: "block", margin: "0 auto 12px" }} />
                                        <div style={{ fontWeight: 600 }}>No pay records for this period.</div>
                                    </td>
                                </tr>
                            ) : sortedPayroll.map(p => (
                                <tr key={p.id} className="hover-scale">
                                    {/* Driver name + role */}
                                    <td className="sticky-col">
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ width: 34, height: 34, borderRadius: "var(--radius-md)", background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", flexShrink: 0 }}>
                                                <Users size={16} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{p._name}</div>
                                                <div style={{ fontSize: 10, color: "var(--brand-primary)", fontWeight: 700, textTransform: "uppercase" }}>{p._role}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Base salary */}
                                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-secondary)", fontSize: 13 }}>
                                        {fmt(p._base)}
                                    </td>

                                    {/* Allowance */}
                                    <td style={{ textAlign: "right", fontSize: 13 }}>
                                        <span style={{ color: "#10b981", fontWeight: 700 }}>+{fmt(p._allowance)}</span>
                                        {p._calculatedMileage > 0 && (
                                            <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
                                                incl. {fmt(p._calculatedMileage)} mileage
                                            </div>
                                        )}
                                    </td>

                                    {/* Deductions */}
                                    <td style={{ textAlign: "right", fontWeight: 700, color: "#ef4444", fontSize: 13 }}>
                                        {p._deductions > 0 ? `-${fmt(p._deductions)}` : "—"}
                                    </td>

                                    {/* Net pay — bold */}
                                    <td style={{ textAlign: "right" }}>
                                        <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 15 }}>{fmt(p._net)}</div>
                                        {p._mpesa && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#10b981", fontWeight: 600, justifyContent: "flex-end", marginTop: 2 }}>
                                                <Smartphone size={10} />
                                                {p._mpesa}
                                            </div>
                                        )}
                                    </td>

                                    {/* Status badge */}
                                    <td className="status-col">
                                        <Badge status={p.status}>{p.status}</Badge>
                                    </td>

                                    {/* Row actions */}
                                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                        <TableRowActions
                                            ariaLabel={`Payroll actions for ${p._name}`}
                                            items={[
                                                ...(p.status === "Pending"
                                                    ? [{
                                                          id: "b2c",
                                                          label: "M-Pesa B2C pay",
                                                          icon: Smartphone,
                                                          onClick: () => markPayrollPaid(p.id),
                                                      }]
                                                    : []),
                                                {
                                                    id: "payslip-generate",
                                                    label: "Generate payslip PDF",
                                                    icon: FileText,
                                                    onClick: () => generatePayslip(p.id),
                                                },
                                                ...(p.status === "Paid"
                                                    ? [{
                                                        id: "payslip-queue",
                                                        label: "Queue payslip email",
                                                        icon: Clock,
                                                        onClick: () => queuePayslipDispatch(p.id),
                                                    }]
                                                    : []),
                                                {
                                                    id: "edit",
                                                    label: "Edit payroll",
                                                    icon: Edit2,
                                                    onClick: () => openModal("payroll", p),
                                                },
                                                {
                                                    id: "delete",
                                                    label: "Delete entry",
                                                    icon: Trash2,
                                                    danger: true,
                                                    onClick: () => delItem("payroll", p.id, (p._name || "") + " " + p.month),
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

            {/* ── M-Pesa B2C notice if pending records exist ── */}
            {monthPayroll.some(p => p.status === "Pending") && (
                <div style={{
                    marginTop: 28,
                    padding: "20px 24px",
                    background: "rgba(249, 115, 22, 0.05)",
                    border: "1px dashed rgba(249, 115, 22, 0.3)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                }}>
                    <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "rgba(249, 115, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316", flexShrink: 0 }}>
                        <Info size={20} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: 15, fontWeight: 800, color: "#f97316", marginBottom: 4 }}>M-Pesa B2C Disbursement</h4>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                            {(() => {
                                try {
                                    const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
                                    if (s.b2cShortcode) return (
                                        <span>Use shortcode <b style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{s.b2cShortcode}</b> ({s.mpesaBusinessName}) to batch-disburse these salaries. Payments will be marked as paid automatically upon M-Pesa B2C confirmation.</span>
                                    );
                                } catch { /* ignore */ }
                                return <span>Configure your M-Pesa B2C credentials in <b>Settings → M-Pesa</b> to enable instant salary disbursements via the M-Pesa API.</span>;
                            })()}
                        </p>
                    </div>
                </div>
            )}

            <Card style={{ marginTop: 16 }} title="Payslip Dispatch Queue" subtitle="Queued, sent, and failed payslip email jobs">
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Payroll ID</th>
                                <th>Recipient</th>
                                <th>Status</th>
                                <th>Attempts</th>
                                <th>Last error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(dispatchQueue || []).slice(0, 40).map((q) => (
                                <tr key={q.id}>
                                    <td>{q.payroll_id}</td>
                                    <td>{q.recipient_email}</td>
                                    <td><Badge status={q.status === "sent" ? "Paid" : q.status === "failed" ? "Overdue" : "Pending"}>{q.status}</Badge></td>
                                    <td>{q.attempts || 0}</td>
                                    <td style={{ maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.last_error || "-"}</td>
                                </tr>
                            ))}
                            {(dispatchQueue || []).length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-dim)", padding: 18 }}>No dispatch jobs yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
