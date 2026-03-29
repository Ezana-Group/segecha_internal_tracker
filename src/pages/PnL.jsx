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

export function PnL({ data, dark, isMobile, truckStats, truckReg, customerName, driverName, showToast, adminAuth, S, T }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'statement'

    const totalSalaries = data.payroll.filter(p => p.status === "Paid").reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0);
    const invoicesPaid = data.invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (+i.paidAmount || +i.amount || 0), 0);
    const expectedRevenue = data.journeys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.revenue, 0);


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

    return (
        <div className="page-shell pnl-shell">
            <PageHeader
                icon={BarChart3}
                title="Profit and loss"
                description="Fleet performance analytics and a printable P&amp;L statement."
                actions={
                    <div className="pnl-toolbar">
                        <Button variant="secondary" icon={Download} onClick={handleExportCSV}>
                            Export CSV
                        </Button>
                        <Button variant="primary" icon={Printer} onClick={handlePrint}>
                            Print now
                        </Button>
                    </div>
                }
                belowTitle={
                    <div className="pnl-tab-row" role="tablist" aria-label="P&amp;L views">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                className={`pnl-tab ${activeTab === tab.id ? "is-active" : ""}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <tab.icon size={17} strokeWidth={2} aria-hidden />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />

            {activeTab === 'analytics' ? (
                <>
                    <div className="pnl-kpi-grid">
                        <div className="pnl-kpi-card">
                            <div className="pnl-kpi-top">
                                <div className="pnl-kpi-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#34d399" }}>
                                    <TrendingUp size={22} strokeWidth={2} />
                                </div>
                                <Badge status="Active" text="Revenue" />
                            </div>
                            <div className="pnl-kpi-label">Filtered gross revenue</div>
                            <div className="pnl-kpi-value">{fmt(totalRevenueFiltered)}</div>
                            <div className="pnl-kpi-bar">
                                <div className="pnl-kpi-bar-fill" style={{ width: "100%", background: "linear-gradient(90deg, #10b981, #34d399)" }} />
                            </div>
                        </div>

                        <div className="pnl-kpi-card">
                            <div className="pnl-kpi-top">
                                <div className="pnl-kpi-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24" }}>
                                    <Activity size={22} strokeWidth={2} />
                                </div>
                                <Badge status="Warning" text="Cost base" />
                            </div>
                            <div className="pnl-kpi-label">Filtered op costs</div>
                            <div className="pnl-kpi-value">{fmt(totalExpensesFiltered)}</div>
                            <div className="pnl-kpi-bar">
                                <div
                                    className="pnl-kpi-bar-fill"
                                    style={{
                                        width: `${Math.min(100, (totalExpensesFiltered / (totalRevenueFiltered || 1)) * 100).toFixed(0)}%`,
                                        background: "linear-gradient(90deg, #d97706, #f59e0b)",
                                    }}
                                />
                            </div>
                        </div>

                        <div className="pnl-kpi-card">
                            <div className="pnl-kpi-top">
                                <div
                                    className="pnl-kpi-icon"
                                    style={{
                                        background: netProfitFiltered >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                        color: netProfitFiltered >= 0 ? "#34d399" : "#f87171",
                                    }}
                                >
                                    {netProfitFiltered >= 0 ? <Target size={22} strokeWidth={2} /> : <TrendingDown size={22} strokeWidth={2} />}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 800, color: netProfitFiltered >= 0 ? "#34d399" : "#f87171" }}>{marginFiltered}% margin</span>
                            </div>
                            <div className="pnl-kpi-label">Filtered net profit / loss</div>
                            <div className="pnl-kpi-value" style={{ color: netProfitFiltered >= 0 ? "#34d399" : "#f87171" }}>
                                {fmt(netProfitFiltered)}
                            </div>
                        </div>
                    </div>

                    <div className="pnl-split">
                        <div className="pnl-matrix-card" id="pnl-analytics-print">
                            <div className="pnl-matrix-head">
                                <div className="pnl-matrix-title">
                                    <Truck size={20} color="var(--brand-primary)" strokeWidth={2} aria-hidden />
                                    Fleet performance matrix
                                </div>
                            </div>
                            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                                <SearchIcon size={18} color="var(--text-dim)" />
                                <input
                                    type="search"
                                    placeholder="Search vehicles..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
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
                                                        <div style={{ color: "var(--brand-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(t._fuel)}</div>
                                                    </td>
                                                    <td title={fmt(t._other)}>
                                                        <div style={{ color: "#f59e0b", fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(t._other)}</div>
                                                    </td>
                                                    <td title={fmt(t._profit)}>
                                                        <div style={{ fontWeight: 800, color: t._profit >= 0 ? "var(--brand-primary)" : "#f87171", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(t._profit)}</div>
                                                    </td>
                                                    <td className="status-col" style={{ textAlign: "right" }} title={`${m}% efficiency`}>
                                                        <span
                                                            className="pnl-eff-pill"
                                                            style={{
                                                                background: good ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                                                                color: good ? "#34d399" : "#fbbf24",
                                                            }}
                                                        >
                                                            {m}%
                                                            {good ? <TrendingUp size={13} strokeWidth={2} /> : <TrendingDown size={13} strokeWidth={2} />}
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
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div className="pnl-expense-card">
                                <div className="pnl-expense-title">
                                    <PieChart size={20} color="var(--brand-primary)" strokeWidth={2} aria-hidden />
                                    Expense breakdown (Total)
                                </div>
                                <div>
                                    {[
                                        { label: "Fuel consumption", value: totalFuelCostFiltered, color: "#f97316", icon: Fuel },
                                        { label: "Travel allowances", value: data.expenses.filter(e => e.cat === "Allowance").reduce((s, e) => s + +e.amount, 0), color: "#10b981", icon: TrendingUp },
                                        { label: "Vehicle maintenance", value: data.expenses.filter(e => e.cat === "Maintenance").reduce((s, e) => s + +e.amount, 0), color: "#3b82f6", icon: Briefcase },
                                        { label: "Staff payroll", value: totalSalaries, color: "#a78bfa", icon: Users },
                                        { label: "Other operations", value: data.expenses.filter(e => !["Fuel", "Allowance", "Maintenance"].includes(e.cat)).reduce((s, e) => s + +e.amount, 0), color: "#64748b", icon: PieChart },
                                    ].map((item, idx) => {
                                        const totalOpCosts = totalFuelCostFiltered + data.expenses.reduce((s, e) => s + +e.amount, 0) + totalSalaries;
                                        return (
                                            <div key={idx} className="pnl-expense-row">
                                                <div className="pnl-expense-row-head">
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <item.icon size={15} color={item.color} strokeWidth={2} />
                                                        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{item.label}</span>
                                                    </div>
                                                    <span style={{ color: "var(--text-primary)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                                                        {totalOpCosts > 0 ? ((item.value / totalOpCosts) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                                <div className="pnl-expense-bar">
                                                    <div
                                                        className="pnl-expense-bar-fill"
                                                        style={{
                                                            width: `${totalOpCosts > 0 ? (item.value / totalOpCosts) * 100 : 0}%`,
                                                            background: item.color,
                                                        }}
                                                    />
                                                </div>
                                                <div className="pnl-expense-amt">{fmt(item.value)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="pnl-insight">
                                <div className="pnl-insight-label">Filtered Insight</div>
                                <div className="pnl-insight-title">{insightHeadline}</div>
                                <p className="pnl-insight-body">{insightCopy}</p>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div id="pnl-statement-view">
                    <Card style={{ padding: 40, border: "2px solid #edeff2", borderRadius: 24, background: "var(--bg-card)" }}>
                        <div style={{ border: "2px solid #10b981", borderRadius: 16, padding: "40px", position: "relative" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
                                <div>
                                    <h2 className="pnl-statement-title">
                                        <FileText size={28} strokeWidth={2} aria-hidden />
                                        Segecha Group — Profit &amp; Loss statement
                                    </h2>
                                    <div style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8, fontWeight: 600 }}>
                                        Generated: {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                </div>
                                <div style={{ width: 60, height: 60, borderRadius: 15, background: "#10b98115", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                                    <FileText size={32} />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 60, marginBottom: 40 }}>
                                {/* Income Column */}
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "2px solid #10b98115", paddingBottom: 12, marginBottom: 20 }}>
                                        Income / Revenue
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Expected Freight Revenue</span>
                                            <span style={{ fontWeight: 800, color: "var(--text-dim)" }}>{fmt(expectedRevenue)}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Verified Collections (Paid)</span>
                                            <span style={{ fontWeight: 800, color: "#10b981" }}>{fmt(invoicesPaid)}</span>
                                        </div>
                                        <div style={{ borderTop: "2px solid var(--border-subtle)", paddingTop: 16, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontWeight: 900, color: "var(--text-primary)" }}>TOTAL VERIFIED INCOME</span>
                                            <span style={{ fontWeight: 900, color: "#10b981", fontSize: 18 }}>{fmt(invoicesPaid)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expenditure Column */}
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "2px solid #f9731615", paddingBottom: 12, marginBottom: 20 }}>
                                        Operating Expenditure (All)
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Fuel Consumption</span>
                                            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmt(data.fuel.reduce((s, f) => s + f.litres * f.pricePerL, 0))}</span>
                                        </div>
                                        {catBreakdown.map(c => (
                                            <div key={c.cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{c.cat}</span>
                                                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmt(c.total)}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Payroll (Paid Salaries)</span>
                                            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmt(totalSalaries)}</span>
                                        </div>
                                        
                                        <div style={{ borderTop: "2px solid var(--border-subtle)", paddingTop: 16, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontWeight: 900, color: "var(--text-primary)" }}>TOTAL EXPENSES</span>
                                            <span style={{ fontWeight: 900, color: "#f97316", fontSize: 18 }}>{fmt(data.fuel.reduce((s, f) => s + f.litres * f.pricePerL, 0) + data.expenses.reduce((s, e) => s + +e.amount, 0))}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: "#10b98108", borderRadius: 16, padding: "24px 32px", border: "1px solid #10b98120", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                                        Net Operating Profit
                                    </div>
                                    <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981" }}>
                                        {fmt(data.journeys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.revenue, 0) - (data.fuel.reduce((s, f) => s + f.litres * f.pricePerL, 0) + data.expenses.reduce((s, e) => s + +e.amount, 0)))}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", color: "var(--text-dim)", fontSize: 12, fontWeight: 600 }}>
                                    Operational Efficiency: {((data.journeys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.revenue, 0) - (data.fuel.reduce((s, f) => s + f.litres * f.pricePerL, 0) + data.expenses.reduce((s, e) => s + +e.amount, 0))) / (data.journeys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.revenue, 0) || 1) * 100).toFixed(1)}% <br />
                                    Report Type: Internal Audit
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

        </div>
    );
}
