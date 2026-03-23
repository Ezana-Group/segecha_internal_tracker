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

export function Payroll({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, markPayrollPaid, truckReg, customerName, driverName }) {
    const payrollRows = Array.isArray(data.payroll) ? data.payroll : [];
    const months = [...new Set(payrollRows.map((p) => p.month))].sort().reverse();
    const [selMonth, setSelMonth] = useState(months[0] || new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState("");
    
    const payStatusFilter = form._payStatusFilter || "ALL";
    const monthPayroll = payrollRows.filter((p) => p.month === selMonth);
    const filteredPayroll = monthPayroll.filter((p) => {
        const drv = data.drivers?.find((d) => d.id === p.driver) || (data.turnboys || []).find((t) => t.id === p.driver);
        const name = (drv?.name || p.driver || "").toLowerCase();
        const mpesa = (drv?.mpesa || p.mpesaRef || "").toLowerCase();
        const query = searchTerm.toLowerCase();
        const matchesSearch = name.includes(query) || mpesa.includes(query);
        const matchesStatus = payStatusFilter === "ALL" || p.status === payStatusFilter;
        return matchesSearch && matchesStatus;
    });
        
    const totalNet = monthPayroll.reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);
    const paidAmount = monthPayroll.filter(p => p.status === "Paid").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);
    const pendingAmount = monthPayroll.filter(p => p.status === "Pending").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);

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
                        <Button variant="premium" icon={Plus} onClick={() => openModal("payroll", { month: selMonth, status: "Pending" })}>
                            Add pay record
                        </Button>
                    </>
                }
            />

            {/* Financial Summary */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
                {[
                    { label: "Total Net Liability", value: fmt(totalNet), icon: DollarSign, color: "var(--brand-primary)" },
                    { label: "Successfully Paid", value: fmt(paidAmount), icon: CheckCircle2, color: "#10b981" },
                    { label: "Pending Disbursement", value: fmt(pendingAmount), icon: Clock, color: "#ef4444" }
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

            {/* Filters and Month Selection (Premium Section) */}
            <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
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
                <div style={{ position: "relative", flex: 1, maxWidth: 450 }}>
                    <SearchIcon style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--brand-primary)" }} size={18} />
                    <input 
                        className="input-modern input-modern--filter"
                        placeholder="Search staff or M-Pesa records..." 
                        style={{ 
                            paddingLeft: 48, 
                            height: 48, 
                            fontSize: 14, 
                            borderRadius: 14,
                            background: "var(--surface-subtle)",
                            border: "1px solid transparent"
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                        <Filter style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} size={14} />
                        <select 
                            className="input-premium" 
                            style={{ width: 140, fontSize: 13, height: 44, padding: "0 12px 0 34px", borderRadius: 12, background: "var(--surface-subtle)" }}
                            value={payStatusFilter}
                            onChange={e => setForm(f => ({ ...f, _payStatusFilter: e.target.value }))}
                        >
                            <option value="ALL">All Status</option>
                            {["Pending", "Paid"].map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", gap: 6, background: "var(--surface-subtle)", padding: 4, borderRadius: 14, border: "1px solid var(--border-dim)" }}>
                        {months.slice(0, 3).map(m => (
                            <button 
                                key={m}
                                onClick={() => setSelMonth(m)}
                                style={{ 
                                    padding: "6px 14px", 
                                    borderRadius: 10, 
                                    border: "none", 
                                    background: selMonth === m ? "var(--brand-primary)" : "transparent",
                                    color: selMonth === m ? "#fff" : "var(--text-secondary)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                {monthLabel(m).split(' ')[0]}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: "relative" }}>
                        <Calendar style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} size={14} />
                        <select 
                            className="input-premium"
                            style={{ width: 150, fontSize: 13, height: 44, padding: "0 12px 0 34px", borderRadius: 12, background: "var(--surface-subtle)" }}
                            value={selMonth}
                            onChange={e => setSelMonth(e.target.value)}
                        >
                            <option value={selMonth}>Historical...</option>
                            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Payroll Table */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Staff Member</th>
                                <th>Earnings Detail</th>
                                <th>Deductions</th>
                                <th>Net Amount</th>
                                <th>M-Pesa Trace</th>
                                <th>Status</th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayroll.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No pay records found for the current selection.</div>
                                    </td>
                                </tr>
                            ) : filteredPayroll.map(p => {
                                const drv = data.drivers.find(d => d.id === p.driver) || (data.turnboys || []).find(t => t.id === p.driver);
                                const journeys = data.journeys.filter(j => (j.driver === p.driver || j.turnboyId === p.driver) && j.date.startsWith(selMonth) && j.status === 'Completed');
                                const calculatedMileage = journeys.reduce((s, j) => {
                                    if (j.driver === p.driver) return s + (j.driverMileage || 0);
                                    if (j.turnboyId === p.driver) return s + (j.turnboyMileage || 0);
                                    return s;
                                }, 0);
                                const netPay = +p.baseSalary + +p.allowance - +p.deductions;
                                return (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
                                                    <Users size={18} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{drv?.name || p.driver}</div>
                                                    <div style={{ fontSize: 10, color: "var(--brand-primary)", fontWeight: 700, textTransform: "uppercase" }}>{drv?.role || 'Staff'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Base: {fmt(p.baseSalary)}</div>
                                            <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700 }}>+ Allowance: {fmt(p.allowance)}</div>
                                            {calculatedMileage > 0 && (
                                                <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
                                                    Incl. {fmt(calculatedMileage)} mileage
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{fmt(p.deductions)}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 900, color: "var(--text-primary)", fontSize: 15 }}>{fmt(netPay)}</div>
                                        </td>
                                        <td>
                                            {(p.mpesaRef || drv?.mpesa) ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                                                    <Smartphone size={12} color="#10b981" />
                                                    {p.mpesaRef || drv?.mpesa}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>Not Set</span>
                                            )}
                                        </td>
                                        <td>
                                            <Badge status={p.status} text={p.status} />
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Payroll actions for ${drv?.name || p.id}`}
                                                items={[
                                                    ...(p.status === "Pending"
                                                        ? [
                                                              {
                                                                  id: "b2c",
                                                                  label: "M-Pesa B2C pay",
                                                                  icon: Smartphone,
                                                                  onClick: () => markPayrollPaid(p.id),
                                                              },
                                                          ]
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
                                                        onClick: () => delItem("payroll", p.id, (drv?.name || "") + " " + p.month),
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

            {monthPayroll.some(p => p.status === "Pending") && (
                <div style={{ marginTop: 32, padding: 24, background: "rgba(249, 115, 22, 0.05)", border: "1px dashed rgba(249, 115, 22, 0.3)", borderRadius: 16, display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(249, 115, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316", flexShrink: 0 }}>
                        <Info size={24} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "#f97316", marginBottom: 4 }}>M-Pesa B2C Disbursment</h4>
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
