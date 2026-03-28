import React, { useState } from "react";
import { 
    Users, 
    DollarSign, 
    CheckCircle2, 
    Clock, 
    Calendar, 
    Plus, 
    Briefcase, 
    TrendingUp,
    ShieldCheck,
    Smartphone,
    Search as SearchIcon,
    ChevronRight,
    ArrowUpRight,
    Info,
    Download,
    CreditCard,
    AlertCircle,
    CheckCircle,
    Filter,
    Edit2,
    Trash2,
} from "lucide-react";
import { fmt, monthLabel } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function Payroll({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, markPayrollPaid, truckReg, customerName, driverName }) {
    const payrollRows = Array.isArray(data.payroll) ? data.payroll : [];
    const months = [...new Set(payrollRows.map((p) => p.month))].sort().reverse();
    const [selMonth, setSelMonth] = useState(months[0] || new Date().toISOString().slice(0, 7));
    
    const monthPayroll = payrollRows.filter((p) => p.month === selMonth);

    // 1. Get all active staff/drivers who should be in payroll
    const allPayees = [
        ...(data.drivers || []),
        ...(data.turnboys || []),
        ...(data.staff || [])
    ];

    const refinedPayroll = allPayees.map(payee => {
        const existing = monthPayroll.find(p => p.driver === payee.id);
        const journeys = (data.journeys || []).filter(j => (j.driver === payee.id || j.turnboyId === payee.id) && j.date && j.date.startsWith(selMonth) && j.status === 'Completed');
        const _tripCount = journeys.length;
        const calculatedMileage = journeys.reduce((s, j) => {
            // Priority: Manual Expense Adjustment > Journey Metadata
            const linkedExpenses = (data.expenses || []).filter(e => e.journey === j.id && e.cat === "Allowance");
            const payeeExpense = linkedExpenses.find(e => e.driver_id === payee.id || e.desc?.includes(payee.name));
            
            if (payeeExpense) return s + Number(payeeExpense.amount);
            
            if (j.driver === payee.id) return s + (j.driverMileage || 0);
            if (j.turnboyId === payee.id) return s + (j.turnboyMileage || 0);
            return s;
        }, 0);

        if (existing) {
            return {
                ...existing,
                _name: payee.name || existing.driver,
                _role: payee.role || (data.staff?.find(s => s.id === existing.driver) ? 'Staff' : 'Driver'),
                _net: Number(existing.baseSalary || 0) + Number(existing.allowance || 0) - Number(existing.deductions || 0),
                _base: Number(existing.baseSalary || 0),
                _allowance: Number(existing.allowance || 0),
                _deductions: Number(existing.deductions || 0),
                _calculatedMileage: calculatedMileage,
                _tripCount,
                _mpesa: existing.mpesaRef || payee.mpesa || "",
                _isVirtual: false
            };
        }

        // Virtual record for staff without a pay record this month
        return {
            id: `virtual-${payee.id}`,
            driver: payee.id,
            month: selMonth,
            status: "Not Configured",
            baseSalary: payee.basicSalary || 0,
            allowance: calculatedMileage, // Default to calculated mileage
            deductions: 0,
            _name: payee.name,
            _role: payee.role || (data.drivers?.find(d => d.id === payee.id) ? 'Driver' : 'Staff'),
            _net: Number(payee.basicSalary || 0) + calculatedMileage,
            _base: Number(payee.basicSalary || 0),
            _allowance: calculatedMileage,
            _deductions: 0,
            _calculatedMileage: calculatedMileage,
            _tripCount,
            _mpesa: payee.mpesa || "",
            _isVirtual: true
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
        
    const filteredTotalNet = sortedPayroll.reduce((s, p) => s + p._net, 0);
    const filteredPaidAmount = sortedPayroll.filter(p => p.status === "Paid").reduce((s, p) => s + p._net, 0);
    const filteredPendingAmount = sortedPayroll.filter(p => p.status === "Pending").reduce((s, p) => s + p._net, 0);

    return (
        <div className="page-shell">
            <PageHeader
                icon={CreditCard}
                title="Payroll"
                description="Monthly runs, disbursements, and pay status."
                actions={
                    <>
                        <Button variant="secondary" icon={Download}>
                            Export paysheets
                        </Button>
                        {!monthPayroll.every(p => p.finalized) && monthPayroll.length > 0 && (
                            <Button 
                                variant="primary" 
                                icon={ShieldCheck} 
                                onClick={async () => {
                                    if (window.confirm(`Finalize all payroll records for ${monthLabel(selMonth)}? This will lock all linked trip and expense data.`)) {
                                        for (const p of monthPayroll) {
                                            if (!p.finalized) await saveItem("payroll", { ...p, finalized: true }, { silent: true });
                                        }
                                        showToast?.("Payroll period finalized and locked.", "success");
                                    }
                                }}
                            >
                                Finalize Period
                            </Button>
                        )}
                        <Button variant="premium" icon={Plus} onClick={() => openModal("payroll", { month: selMonth, status: "Pending" })}>
                            Add pay record
                        </Button>
                    </>
                }
            />

            {/* Financial Summary */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
                {[
                    { label: "Filtered Net Liability", value: fmt(filteredTotalNet), icon: DollarSign, color: "var(--brand-primary)" },
                    { label: "Filtered Paid", value: fmt(filteredPaidAmount), icon: CheckCircle2, color: "#10b981" },
                    { label: "Filtered Pending", value: fmt(filteredPendingAmount), icon: Clock, color: "#ef4444" }
                ].map((kpi, idx) => (
                    <Card key={idx} style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${kpi.color}10`, display: "flex", alignItems: "center", justifyContent: "center", color: kpi.color }}>
                                <kpi.icon size={20} />
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", background: "var(--surface-subtle)", padding: "4px 8px", borderRadius: 6 }}>{monthLabel(selMonth)}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{kpi.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{kpi.value}</div>
                    </Card>
                ))}
            </div>

            {/* Month Selection */}
            <div style={{ 
                display: "flex", 
                justifyContent: "flex-end", 
                alignItems: "center", 
                marginBottom: 24, 
                flexWrap: "wrap", 
                gap: 16,
                background: "var(--bg-card)",
                padding: "16px 20px",
                borderRadius: 20,
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(12px)"
            }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <Calendar size={18} color="var(--brand-primary)" />
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>Select Payroll Month:</div>
                    </div>
                    <div style={{ position: "relative" }}>
                        <Calendar style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} size={14} />
                        <select 
                            className="input-premium"
                            style={{ width: 180, fontSize: 13, height: 44, padding: "0 12px 0 34px", borderRadius: 12, background: "var(--surface-subtle)" }}
                            value={selMonth}
                            onChange={e => setSelMonth(e.target.value)}
                        >
                            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Payroll Table */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search payroll..."
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
                            filterState={payrollFilters}
                            onFilterChange={handlePayrollFilterChange}
                            getUniqueValues={getPayrollUniqueValues}
                            columns={[
                                { key: "_name", label: "Staff Member", sortable: true },
                                { key: "_base", label: "Earnings Detail", sortable: true },
                                { key: "_calculatedMileage", label: "Trip Allowances", sortable: true, align: "right" },
                                { key: "_deductions", label: "Deductions", sortable: true, align: "right" },
                                { key: "_net", label: "Net Amount", sortable: true, align: "right" },
                                { key: "status", label: "Status", sortable: true },
                                { key: "actions", label: "Actions", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {sortedPayroll.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No pay records found matching your filters.</div>
                                    </td>
                                </tr>
                            ) : sortedPayroll.map(p => (
                                <tr key={p.id} className="hover-scale">
                                    <td className="sticky-col" title={p._name}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
                                                <Users size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{p._name}</div>
                                                <div style={{ fontSize: 10, color: "var(--brand-primary)", fontWeight: 700, textTransform: "uppercase" }}>{p._role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td title={`Base: ${fmt(p._base)}, Allowance: ${fmt(p._allowance)}`}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Base: {fmt(p._base)}</div>
                                        <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>+ Allowance: {fmt(p._allowance)}</div>
                                    </td>
                                    <td title={fmt(p._calculatedMileage)}>
                                        <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13, textAlign: "right" }}>{fmt(p._calculatedMileage)}</div>
                                        <div style={{ fontSize: 9, color: "var(--text-dim)", textAlign: "right" }}>{p._tripCount} trips this month</div>
                                    </td>
                                    <td title={fmt(p._deductions)}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", textAlign: "right" }}>{fmt(p._deductions)}</div>
                                    </td>
                                    <td title={fmt(p._net)}>
                                        <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 15, textAlign: "right" }}>{fmt(p._net)}</div>
                                    </td>
                                    <td title={p._mpesa || "Not Set"}>
                                        {p._mpesa ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                                                <Smartphone size={12} color="#10b981" />
                                                {p._mpesa}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>Not Set</span>
                                        )}
                                    </td>
                                    <td className="status-col" title={p.status}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Badge status={p.status} text={p.status} />
                                            {p.finalized && <ShieldCheck size={16} color="var(--brand-primary)" title="Finalized & Locked" />}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                        <TableRowActions
                                            ariaLabel={`Payroll actions for ${p._name}`}
                                            items={[
                                                ...(p._isVirtual && !p.finalized ? [
                                                    {
                                                        id: "configure",
                                                        label: "Configure pay",
                                                        icon: Plus,
                                                        onClick: () => openModal("payroll", {
                                                            driver: p.driver,
                                                            month: p.month,
                                                            baseSalary: p.baseSalary,
                                                            allowance: p.allowance,
                                                            status: "Pending"
                                                        }),
                                                    }
                                                ] : []),
                                                ...(!p._isVirtual && p.status === "Pending" && !p.finalized
                                                    ? [
                                                          {
                                                              id: "b2c",
                                                              label: "M-Pesa B2C pay",
                                                              icon: Smartphone,
                                                              onClick: () => markPayrollPaid(p.id),
                                                          },
                                                      ]
                                                    : []),
                                                ...(!p._isVirtual && !p.finalized ? [
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
                                                    }
                                                ] : []),
                                                ...(p.finalized ? [
                                                    {
                                                        id: "locked",
                                                        label: "Record Locked",
                                                        icon: ShieldCheck,
                                                        disabled: true,
                                                        onClick: () => {}
                                                    }
                                                ] : [])
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {monthPayroll.some(p => p.status === "Pending") && (
                <div style={{ marginTop: 32, padding: 24, background: "rgba(249, 115, 22, 0.05)", border: "1px dashed rgba(249, 115, 22, 0.3)", borderRadius: 16, display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(249, 115, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316", flexShrink: 0 }}>
                        <Info size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "#f97316", marginBottom: 4 }}>M-Pesa B2C Disbursement</h4>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                            {(() => {
                                try {
                                    const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
                                    if (s.b2cShortcode) return <span>Use shortcode <b style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{s.b2cShortcode}</b> ({s.mpesaBusinessName}) to batch-disburse these salaries. Payments will be marked as paid automatically upon M-Pesa B2C confirmation.</span>;
                                } catch { /* ignore */ }
                                return <span>Configure your M-Pesa B2C credentials in <b>Settings → M-Pesa</b> to enable instant salary disbursements via the M-Pesa API.</span>;
                            })()}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
