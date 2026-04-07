import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import {
    FileText,
    Printer,
    TrendingUp,
    TrendingDown,
    DollarSign,
    PieChart,
    Truck,
    Fuel,
    Users,
    ArrowUpRight,
    Calendar,
    ArrowDownRight,
    Briefcase,
    Download,
    BarChart3,
    Activity,
    Target,
    Search as SearchIcon
} from "lucide-react";
import { CATS } from "../constants/nav";
import { fmt, fmtN, fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function PnL({ data, dark, isMobile, truckStats, truckReg, customerName, driverName, showToast }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'statement'

    const totalSalaries = data.payroll.filter(p => p.status === "Paid").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);
    const invoicesPaid = data.invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (+i.paidAmount || 0), 0);
    // Pre-compute statement totals once for reuse in JSX
    const COUNTABLE_STATUSES = ["Accepted", "Loading", "In Transit", "Awaiting Start Verification", "Awaiting Verification", "Completed"];
    const stmtFreightRevenue = data.journeys.filter(j => COUNTABLE_STATUSES.includes(j.status)).reduce((s, j) => s + +j.revenue, 0);
    const stmtFuelCost = data.fuel.reduce((s, f) => s + f.litres * f.pricePerL, 0);
    // Exclude cat='Fuel' expenses — already counted in stmtFuelCost from fuel_logs
    const stmtOtherExp = data.expenses.filter(e => e.cat !== 'Fuel').reduce((s, e) => s + +e.amount, 0);
    const stmtTotalExp = stmtFuelCost + stmtOtherExp + totalSalaries;
    const stmtNetProfit = stmtFreightRevenue - stmtTotalExp;

    // Refine trucks for performance matrix sorting
    const refinedMatrix = data.trucks.map(t => {
        const st = truckStats(t.id);
        const m = st.rev > 0 ? ((st.profit / st.rev) * 100).toFixed(1) : "0.0";
        return {
            ...t,
            _rev: st.rev,
            _fuel: st.fuelCost,
            _other: st.exp - st.fuelCost,
            _profit: st.profit,
            _eff: Number(m)
        };
    });

    const {
        filteredRows: sortedMatrix,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: matrixFilters,
        applyFilter: handleMatrixFilterChange,
        getUniqueValues: getMatrixUniqueValues,
        searchTerm,
        setSearchTerm
    } = useTableFilter(refinedMatrix, {
        namespace: "pnl",
        initialSort: { col: "_rev", dir: "desc" },
        searchColumns: ["reg", "type", "make"]
    });

    const totalRevenueFiltered = sortedMatrix.reduce((s, t) => s + t._rev, 0);
    const totalFuelCostFiltered = sortedMatrix.reduce((s, t) => s + t._fuel, 0);
    const totalOtherExpFiltered = sortedMatrix.reduce((s, t) => s + t._other, 0);
    const totalExpensesFiltered = totalFuelCostFiltered + totalOtherExpFiltered;
    const netProfitFiltered = totalRevenueFiltered - totalExpensesFiltered;
    const marginFiltered = totalRevenueFiltered > 0 ? (netProfitFiltered / totalRevenueFiltered * 100).toFixed(1) : 0;

    const handlePrint = () => {
        const printContent = document.getElementById(activeTab === 'statement' ? "pnl-statement-view" : "pnl-analytics-print");
        const w = window.open("", "_blank");
        w.document.write(`<html><head><title>Segecha Group P&L Report</title><style>
            body{font-family:'Inter', sans-serif;padding:40px;color:#111;line-height:1.5;}
            table{width:100%;border-collapse:collapse;margin:20px 0;}
            th,td{padding:12px 15px;border-bottom:1px solid #eee;text-align:left;}
            th{background:#f9fafb;font-weight:700;font-size:12px;text-transform:uppercase;color:#666;}
            h1{color:#111;margin:0;font-size:24px;}
            .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #111;padding-bottom:20px;margin-bottom:30px;}
            .total-bar{background:#111;color:#fff;padding:15px;display:flex;justify-content:space-between;font-weight:800;font-size:20px;margin-top:20px;}
            .section-title{font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:30px;color:#666;}
            .statement-box { border: 2px solid #10b981; padding: 30px; border-radius: 12px; }
            .green-text { color: #10b981; }
            .orange-text { color: #f97316; }
        </style></head><body>${DOMPurify.sanitize(printContent.innerHTML)}</body></html>`);
        w.document.close();
        w.print();
    };

    const handleExportCSV = useCallback(() => {
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const rows = [
            ["Vehicle", "Type", "Revenue (KES)", "Fuel (KES)", "Other costs (KES)", "Net P&L (KES)", "Margin %"],
            ...sortedMatrix.map((t) => {
                return [t.reg, t.type || "", t._rev, t._fuel, t._other, t._profit, t._eff];
            }),
            ["FILTERED TOTAL", "", totalRevenueFiltered, totalFuelCostFiltered, totalOtherExpFiltered, netProfitFiltered, marginFiltered],
        ];
        const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `segecha-performance-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast?.("CSV downloaded", "success");
    }, [sortedMatrix, totalRevenueFiltered, totalFuelCostFiltered, totalOtherExpFiltered, netProfitFiltered, marginFiltered, showToast]);

    const tabs = [
        { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
        { id: 'statement', label: 'P&L Statement', icon: FileText }
    ];

    const marginNum = Number(marginFiltered);
    const insightHeadline = netProfitFiltered >= 0 ? "Above break-even" : "Below break-even";
    const insightCopy =
        marginNum >= 15
            ? `Operating margin is ${marginFiltered}%. Revenue is covering costs with room to reinvest.`
            : marginNum >= 0
              ? `Operating margin is ${marginFiltered}%. Watch fuel and maintenance to lift contribution per vehicle.`
              : `Operating margin is ${marginFiltered}%. Review high-cost vehicles in the matrix and trip pricing.`;

    const catBreakdown = CATS.filter(c => c !== "Fuel").map(c => ({
        cat: c,
        total: data.expenses.filter(e => e.cat === c).reduce((s, e) => s + +e.amount, 0)
    })).filter(x => x.total > 0);

    const isProfit = netProfitFiltered >= 0;
    const isStmtProfit = stmtNetProfit >= 0;
    const stmtMargin = stmtFreightRevenue > 0 ? (stmtNetProfit / stmtFreightRevenue * 100).toFixed(1) : 0;

    return (
        <div className="page-shell">
            <PageHeader
                icon={BarChart3}
                title="Profit & Loss"
                description="Fleet performance analytics and a printable P&L statement."
                actions={
                    <div style={{ display: "flex", gap: 8 }}>
                        <Button variant="secondary" icon={Download} onClick={handleExportCSV}>
                            Export CSV
                        </Button>
                        <Button variant="primary" icon={Printer} onClick={handlePrint}>
                            Print
                        </Button>
                    </div>
                }
                belowTitle={
                    <div style={{ display: "flex", gap: 4 }} role="tablist" aria-label="P&L views">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                    padding: "7px 16px",
                                    borderRadius: "var(--radius-md)",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    background: activeTab === tab.id ? "var(--brand-muted)" : "transparent",
                                    color: activeTab === tab.id ? "var(--brand-primary)" : "var(--text-muted)",
                                    transition: "all 0.15s",
                                }}
                            >
                                <tab.icon size={15} strokeWidth={2} aria-hidden />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />

            {activeTab === 'analytics' ? (
                <>
                    {/* ── KPI Row ── */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
                        gap: 16,
                        marginBottom: 24,
                    }}>
                        {/* Freight Revenue */}
                        <Card accent="#f97316" style={{ padding: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316" }}>
                                    <TrendingUp size={18} strokeWidth={2} />
                                </div>
                                <Badge status="Active" text="Revenue" />
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                Freight Revenue
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                                {fmt(totalRevenueFiltered)}
                            </div>
                            <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: "var(--border-subtle)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #f97316, #fb923c)", borderRadius: 2 }} />
                            </div>
                        </Card>

                        {/* Total Expenses */}
                        <Card accent="#ef4444" style={{ padding: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                                    <Activity size={18} strokeWidth={2} />
                                </div>
                                <Badge status="Warning" text="Cost base" />
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                Total Expenses
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                                {fmt(totalExpensesFiltered)}
                            </div>
                            <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: "var(--border-subtle)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, totalRevenueFiltered > 0 ? (totalExpensesFiltered / totalRevenueFiltered) * 100 : 0).toFixed(0)}%`, background: "linear-gradient(90deg, #ef4444, #f87171)", borderRadius: 2 }} />
                            </div>
                        </Card>

                        {/* Net Profit */}
                        <Card accent={isProfit ? "#10b981" : "#ef4444"} style={{ padding: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: isProfit ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: isProfit ? "#10b981" : "#ef4444" }}>
                                    {isProfit ? <Target size={18} strokeWidth={2} /> : <TrendingDown size={18} strokeWidth={2} />}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 800, color: isProfit ? "#10b981" : "#ef4444" }}>{marginFiltered}% margin</span>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                Net Profit / Loss
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: isProfit ? "#10b981" : "#ef4444", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                                {fmt(netProfitFiltered)}
                            </div>
                        </Card>

                        {/* Margin % */}
                        <Card accent="#a78bfa" style={{ padding: 20 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa" }}>
                                    <PieChart size={18} strokeWidth={2} />
                                </div>
                                <Badge status={marginNum >= 15 ? "Active" : marginNum >= 0 ? "Warning" : "Overdue"} text={marginNum >= 15 ? "Healthy" : marginNum >= 0 ? "Watch" : "Loss"} />
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                Operating Margin
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#a78bfa", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                                {marginFiltered}%
                            </div>
                            <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: "var(--border-subtle)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, marginNum))}%`, background: "linear-gradient(90deg, #7c3aed, #a78bfa)", borderRadius: 2 }} />
                            </div>
                        </Card>
                    </div>

                    {/* ── Main split: matrix + sidebar ── */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: 20, alignItems: "start" }}>
                        {/* Fleet performance matrix */}
                        <Card style={{ padding: 0, overflow: "hidden" }} id="pnl-analytics-print">
                            {/* Matrix header */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <Truck size={18} color="var(--brand-primary)" strokeWidth={2} aria-hidden />
                                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>Fleet Performance Matrix</span>
                                </div>
                            </div>
                            {/* Search */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
                                <SearchIcon size={16} color="var(--text-muted)" />
                                <input
                                    type="search"
                                    placeholder="Search vehicles..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ border: "none", background: "none", padding: 0, fontSize: 13, flex: 1, color: "var(--text-primary)", fontWeight: 600, outline: "none" }}
                                />
                            </div>
                            <div className="table-container">
                                <table className="table-modern pnl-matrix-table">
                                    <SortableTableHead
                                        requestSort={requestSort}
                                        sortConfig={sortConfig}
                                        filterState={matrixFilters}
                                        onFilterChange={handleMatrixFilterChange}
                                        getUniqueValues={getMatrixUniqueValues}
                                        columns={[
                                            { key: "reg", label: "Vehicle", sortable: true },
                                            { key: "_rev", label: "Revenue", sortable: true, align: "right" },
                                            { key: "_fuel", label: "Fuel", sortable: true, align: "right" },
                                            { key: "_other", label: "Other costs", sortable: true, align: "right" },
                                            { key: "_profit", label: "Net P&L", sortable: true, align: "right" },
                                            { key: "_eff", label: "Efficiency", sortable: true, align: "right" },
                                            { key: "actions", label: "", sortable: false }
                                        ]}
                                    />
                                    <tbody>
                                        {sortedMatrix.map((t) => {
                                            const m = t._eff;
                                            const good = m > 15;
                                            return (
                                                <tr key={t.id} className="hover-scale">
                                                    <td className="sticky-col" title={t.reg}>
                                                        <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{t.reg}</div>
                                                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600 }}>{t.type || "Vehicle"}</div>
                                                    </td>
                                                    <td title={fmt(t._rev)}>
                                                        <div style={{ fontWeight: 700, color: "#34d399", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(t._rev)}</div>
                                                    </td>
                                                    <td title={fmt(t._fuel)}>
                                                        <div style={{ color: "#f97316", fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(t._fuel)}</div>
                                                    </td>
                                                    <td title={fmt(t._other)}>
                                                        <div style={{ color: "#f59e0b", fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(t._other)}</div>
                                                    </td>
                                                    <td title={fmt(t._profit)}>
                                                        <div style={{ fontWeight: 800, color: t._profit >= 0 ? "#34d399" : "#f87171", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(t._profit)}</div>
                                                    </td>
                                                    <td className="status-col" style={{ textAlign: "right" }} title={`${m}% efficiency`}>
                                                        <span style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 4,
                                                            padding: "3px 10px",
                                                            borderRadius: 20,
                                                            fontSize: 12,
                                                            fontWeight: 800,
                                                            background: good ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                                                            color: good ? "#34d399" : "#fbbf24",
                                                        }}>
                                                            {m}%
                                                            {good ? <TrendingUp size={12} strokeWidth={2} /> : <TrendingDown size={12} strokeWidth={2} />}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                        <TableRowActions
                                                            ariaLabel={`Actions for ${t.reg}`}
                                                            items={[
                                                                {
                                                                    id: "view",
                                                                    label: "View vehicle",
                                                                    icon: ArrowUpRight,
                                                                    onClick: () => navigate(`/fleet/${t.id}`),
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

                        {/* Sidebar: expense breakdown + insight */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {/* Expense Breakdown */}
                            <Card style={{ padding: 20 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                                    <PieChart size={17} color="var(--brand-primary)" strokeWidth={2} aria-hidden />
                                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>Expense Breakdown</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                    {[
                                        { label: "Fuel consumption", value: totalFuelCostFiltered, color: "#f97316", icon: Fuel },
                                        { label: "Staff payroll", value: totalSalaries, color: "#a78bfa", icon: Users },
                                        ...catBreakdown.map((c) => ({
                                            label: c.cat,
                                            value: c.total,
                                            color: "#f59e0b",
                                            icon: Briefcase,
                                        })),
                                    ].map((item, idx) => {
                                        const globalExp = totalFuelCostFiltered + totalSalaries + catBreakdown.reduce((s, c) => s + c.total, 0);
                                        const pct = globalExp > 0 ? ((item.value / globalExp) * 100).toFixed(1) : 0;
                                        return (
                                            <div key={idx}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                                                        <item.icon size={13} color={item.color} strokeWidth={2} />
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{item.label}</span>
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                                                </div>
                                                <div style={{ height: 4, borderRadius: 2, background: "var(--border-subtle)", overflow: "hidden", marginBottom: 4 }}>
                                                    <div style={{ height: "100%", width: `${pct}%`, background: item.color, borderRadius: 2 }} />
                                                </div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                    {fmt(item.value)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>

                            {/* Insight card */}
                            <Card style={{ padding: 20, background: isProfit ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)", borderColor: isProfit ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)" }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: isProfit ? "#10b981" : "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                    Filtered Insight
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
                                    {insightHeadline}
                                </div>
                                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                                    {insightCopy}
                                </p>
                            </Card>
                        </div>
                    </div>
                </>
            ) : (
                /* ── P&L Statement view ── */
                <div id="pnl-statement-view">
                    <Card style={{ padding: isMobile ? 20 : 36 }}>
                        {/* Statement header */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border-subtle)" }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                    <FileText size={22} color="var(--brand-primary)" strokeWidth={2} />
                                    <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
                                        Segecha Group — Profit &amp; Loss Statement
                                    </h2>
                                </div>
                                <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                                    Generated: {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                            <div style={{ flexShrink: 0, padding: "4px 12px", borderRadius: "var(--radius-md)", background: "var(--brand-muted)", border: "1px solid var(--brand-border)", fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                                Internal Audit
                            </div>
                        </div>

                        {/* Income + Expense columns */}
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 32 : 48, marginBottom: 28 }}>
                            {/* Income column */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: 10, borderBottom: "2px solid rgba(16,185,129,0.2)", marginBottom: 18 }}>
                                    Income / Revenue
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                    {/* Row: Freight Revenue */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Freight Revenue (Active trips)</span>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: "#10b981", fontVariantNumeric: "tabular-nums" }}>{fmt(stmtFreightRevenue)}</span>
                                    </div>
                                    {/* Row: Cash Collected */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Cash Collected (Invoices paid)</span>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: "#10b981", fontVariantNumeric: "tabular-nums" }}>{fmt(invoicesPaid)}</span>
                                    </div>
                                    {/* Total */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 4px" }}>
                                        <span style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Income</span>
                                        <span style={{ fontSize: 17, fontWeight: 900, color: "#10b981", fontVariantNumeric: "tabular-nums" }}>{fmt(stmtFreightRevenue)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expenditure column */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: 10, borderBottom: "2px solid rgba(249,115,22,0.2)", marginBottom: 18 }}>
                                    Operating Expenditure
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                    {/* Fuel */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316" }} />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Fuel Consumption</span>
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(stmtFuelCost)}</span>
                                    </div>
                                    {/* Dynamic expense categories */}
                                    {catBreakdown.map((c, i) => (
                                        <div key={c.cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{c.cat}</span>
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(c.total)}</span>
                                        </div>
                                    ))}
                                    {/* Payroll */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa" }} />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Payroll (Paid Salaries)</span>
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(totalSalaries)}</span>
                                    </div>
                                    {/* Total expenses */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 4px" }}>
                                        <span style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Expenses</span>
                                        <span style={{ fontSize: 17, fontWeight: 900, color: "#f97316", fontVariantNumeric: "tabular-nums" }}>{fmt(stmtTotalExp)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Net result summary */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 16,
                            padding: "24px 28px",
                            borderRadius: "var(--radius-lg)",
                            background: isStmtProfit ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)",
                            border: `1.5px solid ${isStmtProfit ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                        }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: isStmtProfit ? "#10b981" : "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                    Net Operating {isStmtProfit ? "Profit" : "Loss"}
                                </div>
                                <div style={{ fontSize: 36, fontWeight: 900, color: isStmtProfit ? "#10b981" : "#ef4444", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1 }}>
                                    {fmt(stmtNetProfit)}
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, marginBottom: 4 }}>Operating Margin</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: isStmtProfit ? "#10b981" : "#ef4444" }}>{stmtMargin}%</div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
