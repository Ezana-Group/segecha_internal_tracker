import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    TrendingUp,
    Droplet,
    AlertTriangle,
    Clock,
    Truck,
    Wallet,
    ArrowUpRight,
    ChevronRight,
    LayoutDashboard,
    ClipboardList,
    FileText,
    CreditCard,
    TrendingDown,
    Activity,
} from "lucide-react";
import { fmt, fmtN, monthLabel } from "../utils/formatters";
import { STALE_TRANSIT_DAYS, FLEET_ACTIVE_WARN_PCT } from "../constants/nav";
import { PAYMENT_API } from "../utils/env";
import { fetchWithAuth } from "../utils/api";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

const Sparkline = ({ data, color, width = 60, height = 24 }) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => ({
        x: (i / (data.length - 1)) * width,
        y: height - ((v - min) / range) * height
    }));
    const d = `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
    return (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

const BarChart = ({ data }) => {
    const max = Math.max(...data.map(d => Math.max(d.rev, d.exp))) || 1;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, padding: '8px 0 0' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', width: '100%', justifyContent: 'center' }}>
                        <div
                            style={{ width: 18, height: `${Math.max(4, (d.rev / max) * 100)}%`, background: 'var(--brand-primary)', borderRadius: '4px 4px 0 0', minHeight: 4 }}
                            title={`Rev: ${fmt(d.rev)}`}
                        />
                        <div
                            style={{ width: 18, height: `${Math.max(4, (d.exp / max) * 100)}%`, background: '#6366f1', borderRadius: '4px 4px 0 0', minHeight: 4, opacity: 0.8 }}
                            title={`Exp: ${fmt(d.exp)}`}
                        />
                    </div>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center' }}>{d.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
                            {fmt(d.rev - d.exp, true)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export function Dashboard({ data, dark, truckStats, tyreStatus, truckReg, driverName, setVerifyModal, pendingVerifications, isMobile }) {
    const navigate = useNavigate();
    const [expiringDocs, setExpiringDocs] = useState([]);

    // Determine the latest month from payroll, or fallback to current month
    const payrollRows = Array.isArray(data.payroll) ? data.payroll : [];
    const latestMonth = payrollRows.length > 0
        ? [...payrollRows].sort((a, b) => b.month.localeCompare(a.month))[0]?.month
        : new Date().toISOString().substring(0, 7);

    useEffect(() => {
        fetchWithAuth(`${PAYMENT_API}/api/documents/expiring?days=30`)
            .then(res => res.json())
            .then(d => setExpiringDocs(d.documents || []))
            .catch(() => setExpiringDocs([]));
    }, []);

    const COUNTABLE_STATUSES = ["Accepted", "Loading", "In Transit", "Awaiting Start Verification", "Awaiting Verification", "Completed"];
    const totalRevenue = data.journeys.filter(j => COUNTABLE_STATUSES.includes(j.status) && j.date?.startsWith(latestMonth)).reduce((s, j) => s + +j.revenue, 0);
    const totalFuelCost = data.fuel.filter(f => f.date?.startsWith(latestMonth)).reduce((s, f) => s + f.litres * f.pricePerL, 0);
    // Exclude cat='Fuel' expenses — fuel cost is already counted from data.fuel (fuel_logs).
    const totalOtherExp = data.expenses.filter(e => e.date?.startsWith(latestMonth) && e.cat !== 'Fuel').reduce((s, e) => s + +e.amount, 0);
    const totalPayrollCost = payrollRows
        .filter((p) => p.month === latestMonth)
        .reduce((s, p) => s + (+p.grossPay || (+p.baseSalary || 0) + (+p.allowance || 0)), 0);
    const monthlyDepreciation = (data.assets || []).reduce((sum, asset) => {
        const cost = Number(asset.cost) || 0;
        if (cost <= 0) return sum;
        const salvage = Math.max(0, Math.min(Number(asset.salvageValue) || 0, cost));
        const lifeYears = Math.max(1, Number(asset.usefulLifeYears) || 5);
        return sum + (cost - salvage) / (lifeYears * 12);
    }, 0);
    const totalExpenses = totalFuelCost + totalOtherExp + totalPayrollCost + monthlyDepreciation;
    const netProfit = totalRevenue - totalExpenses;
    const invList = Array.isArray(data.invoices) ? data.invoices : [];
    const invOutstanding = (i) => Math.max(0, +i.amount - (+i.paidAmount || 0));
    const deriveInvoiceStatus = (i) => {
        const paid = Number(i.paidAmount || 0);
        const amount = Number(i.amount || 0);
        if (paid >= amount && amount > 0) return "Paid";
        if (paid > 0 && paid < amount) return "Partial";
        return i.status || "Pending";
    };
    const invPaidList = invList.filter((i) => deriveInvoiceStatus(i) === "Paid" && i.date?.startsWith(latestMonth));
    const invPendingList = invList.filter((i) => ["Pending", "Partial"].includes(deriveInvoiceStatus(i)) && i.date?.startsWith(latestMonth));
    const invOverdueList = invList.filter((i) => deriveInvoiceStatus(i) === "Overdue" && i.date?.startsWith(latestMonth));
    const invPaidTotal = invPaidList.reduce((s, i) => s + (+i.amount || 0), 0);
    const invPendingTotal = invPendingList.reduce((s, i) => s + invOutstanding(i), 0);
    const invOverdueTotal = invOverdueList.reduce((s, i) => s + invOutstanding(i), 0);

    const tyreAlerts = data.trucks.filter(t => { const ts = tyreStatus(t); return ts.status !== "OK"; });
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : 0;
    const totalLitres = data.fuel.filter(f => f.date?.startsWith(latestMonth)).reduce((s, f) => s + f.litres, 0);
    const totalKm = data.journeys.filter(j => j.status === "Completed" && j.date?.startsWith(latestMonth)).reduce((s, j) => s + +j.distance, 0);
    const overallKmPerL = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : 0;

    const staleJourneys = data.journeys.filter(j => j.status === "In Transit" && (Date.now() - new Date(j.date).getTime()) > STALE_TRANSIT_DAYS * 86400000);

    // Refine data for sorting
    const refinedTrucks = data.trucks.map(t => {
        const st = truckStats(t.id);
        const profPerKm = st.totalKm > 0 ? Number((st.profit / st.totalKm).toFixed(2)) : 0;
        return {
            ...t,
            _rev: st.rev,
            _profPerKm: profPerKm,
            _kmPerL: st.kmPerL,
            _st: st
        };
    });

    const {
        filteredRows: sortedTrucks,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: dashboardFilters,
        applyFilter: handleDashboardFilterChange,
        getUniqueValues: getDashboardUniqueValues
    } = useTableFilter(refinedTrucks, { namespace: "db", initialSort: { col: "_rev", dir: "desc" } });

    const activeTrucks = data.trucks.filter(t => t.status === "Active").length;
    const fleetActivePct = data.trucks.length > 0 ? (activeTrucks / data.trucks.length) * 100 : 100;
    const fleetActiveWarning = data.trucks.length > 0 && fleetActivePct < FLEET_ACTIVE_WARN_PCT;

    const getMonthData = (m) => {
        const rev = data.journeys.filter(j => COUNTABLE_STATUSES.includes(j.status) && j.date?.startsWith(m)).reduce((s, j) => s + +j.revenue, 0);
        const fuel = data.fuel.filter(f => f.date?.startsWith(m)).reduce((s, f) => s + f.litres * f.pricePerL, 0);
        // Exclude cat='Fuel' expenses to avoid double-counting with fuel_logs
        const exp = data.expenses.filter(e => e.date?.startsWith(m) && e.cat !== 'Fuel').reduce((s, e) => s + +e.amount, 0);
        return { rev, exp: fuel + exp };
    };

    const last3Months = [];
    for (let i = 2; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.toISOString().substring(0, 7);
        const { rev, exp } = getMonthData(m);
        last3Months.push({ label: d.toLocaleString('default', { month: 'short' }), rev, exp });
    }

    const payrollForMonth = payrollRows
        .filter((p) => p.month === latestMonth)
        .slice()
        .sort((a, b) => (driverName(a.driver) || "").localeCompare(driverName(b.driver) || ""));

    const kpiCards = [
        {
            label: "Net Profit",
            value: fmt(netProfit),
            sub: `${margin}% margin`,
            icon: netProfit >= 0 ? TrendingUp : TrendingDown,
            accent: netProfit >= 0 ? "#10b981" : "#ef4444",
            spark: [10, 15, 8, 12, 18, 14, 22],
            sparkColor: "#10b981",
        },
        {
            label: "Revenue",
            value: fmt(totalRevenue),
            sub: `${fmt(invPendingTotal + invOverdueTotal)} receivables`,
            icon: Wallet,
            accent: "var(--brand-primary)",
            spark: [5, 12, 18, 14, 20, 25, 30],
            sparkColor: "var(--brand-primary)",
        },
        {
            label: "Fuel Cost",
            value: fmt(totalFuelCost),
            sub: `${totalLitres.toLocaleString()} L consumed (${fmt(totalExpenses)} total cost base)`,
            icon: Droplet,
            accent: "#f59e0b",
            spark: [20, 18, 22, 15, 12, 10, 8],
            sparkColor: "#f59e0b",
        },
        {
            label: "Fleet Efficiency",
            value: `${overallKmPerL}`,
            sub: "km per litre (fleet avg)",
            icon: Activity,
            accent: "#a78bfa",
            spark: [2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.8],
            sparkColor: "#a78bfa",
        },
    ];

    return (
        <div className="page-shell">
            <PageHeader
                icon={LayoutDashboard}
                title="Operations Dashboard"
                description={
                    <>
                        Performance overview for{" "}
                        <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{monthLabel(latestMonth)}</span>
                    </>
                }
                actions={
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Button size="sm" variant="secondary" icon={CreditCard} onClick={() => navigate("/pnl")}>
                            Finance and Payments
                        </Button>
                        {!fleetActiveWarning ? (
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "rgba(16, 185, 129, 0.08)",
                                padding: "6px 14px",
                                borderRadius: 10,
                                border: "1px solid rgba(16, 185, 129, 0.18)",
                            }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>Fleet healthy</span>
                            </div>
                        ) : (
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "rgba(245, 158, 11, 0.08)",
                                padding: "6px 14px",
                                borderRadius: 10,
                                border: "1px solid rgba(245, 158, 11, 0.22)",
                            }}>
                                <AlertTriangle size={14} color="#f59e0b" />
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
                                    {Math.round(fleetActivePct)}% active
                                </span>
                            </div>
                        )}
                    </div>
                }
            />

            {/* KPI Row */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginBottom: 24,
            }}>
                {kpiCards.map((k) => {
                    const Icon = k.icon;
                    return (
                        <div key={k.label} style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 16,
                            padding: "20px 24px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            position: "relative",
                            overflow: "hidden",
                        }}>
                            <div style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: k.accent,
                                borderRadius: "16px 16px 0 0",
                                opacity: 0.7,
                            }} />
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    {k.label}
                                </span>
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: `${k.accent}18`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <Icon size={16} color={k.accent} />
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                                    {k.value}
                                    {k.label === "Fleet Efficiency" && (
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginLeft: 4 }}>km/L</span>
                                    )}
                                </div>
                                <Sparkline data={k.spark} color={k.sparkColor} />
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{k.sub}</div>
                        </div>
                    );
                })}
            </div>

            {/* Charts Row */}
            <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
                marginBottom: 24,
            }}>
                <Card title="Monthly Performance" subtitle="Revenue vs. expenses (last 3 months)">
                    <BarChart data={last3Months} />
                    <div style={{ display: "flex", gap: 20, marginTop: 16, justifyContent: "center" }}>
                        {[
                            { color: "var(--brand-primary)", label: "Revenue" },
                            { color: "#6366f1", label: "Expenses" },
                        ].map(({ color, label }) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                                {label}
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Truck Efficiency" subtitle="L/km consumption per vehicle">
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 }}>
                        {data.trucks.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-dim)", fontSize: 13 }}>No trucks on file.</div>
                        ) : data.trucks.map(t => {
                            const st = truckStats(t.id);
                            const lkm = st.kmPerL > 0 ? (1 / st.kmPerL).toFixed(2) : 0;
                            const pct = Math.min(100, (+lkm / 0.8) * 100);
                            const barColor = +lkm > 0.55 ? "#ef4444" : +lkm > 0.4 ? "#f59e0b" : "#10b981";
                            return (
                                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{
                                        width: 90,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "var(--text-primary)",
                                        fontFamily: "var(--font-mono)",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}>{t.reg}</div>
                                    <div style={{ flex: 1, height: 8, background: "var(--surface-subtle)", borderRadius: 6, overflow: "hidden" }}>
                                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 6, transition: "width 0.4s ease" }} />
                                    </div>
                                    <div style={{ width: 54, fontSize: 11, fontWeight: 700, textAlign: "right", color: "var(--text-secondary)" }}>
                                        {lkm > 0 ? `${lkm} L/km` : "—"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Vehicle Performance Table */}
            <Card title="Vehicle Performance" subtitle={`All ${data.trucks.length} vehicles · sorted by revenue`} style={{ marginBottom: 24 }}>
                <div className="table-container">
                    <table className="table-modern">
                        <SortableTableHead
                            requestSort={requestSort}
                            sortConfig={sortConfig}
                            filterState={dashboardFilters}
                            onFilterChange={handleDashboardFilterChange}
                            getUniqueValues={getDashboardUniqueValues}
                            columns={[
                                { key: "reg", label: "Vehicle", sortable: true },
                                { key: "status", label: "Status", sortable: true },
                                { key: "_rev", label: "Revenue", sortable: true, align: "right" },
                                { key: "_profPerKm", label: "Profit / km", sortable: true, align: "right" },
                                { key: "_kmPerL", label: "km/L", sortable: true },
                                { key: "actions", label: "", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {sortedTrucks.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>No vehicles found.</td>
                                </tr>
                            ) : sortedTrucks.map(t => {
                                const profPerKm = t._profPerKm;
                                return (
                                    <tr key={t.id} className="hover-scale">
                                        <td className="sticky-col" title={t.reg}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 10,
                                                    background: "var(--brand-muted)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "var(--brand-primary)",
                                                    flexShrink: 0,
                                                }}>
                                                    <Truck size={16} />
                                                </div>
                                                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{t.reg}</span>
                                            </div>
                                        </td>
                                        <td className="status-col" title={t.status}>
                                            <Badge status={t.status} />
                                        </td>
                                        <td style={{ fontWeight: 700, color: "#10b981", textAlign: "right", fontVariantNumeric: "tabular-nums" }} title={fmt(t._rev)}>
                                            {fmt(t._rev)}
                                        </td>
                                        <td style={{ fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }} title={fmt(profPerKm)}>
                                            {fmt(profPerKm)}
                                        </td>
                                        <td title={`${fmtN(t._kmPerL, 1)} km/L`}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ flex: 1, height: 6, background: "var(--surface-subtle)", borderRadius: 10, overflow: "hidden" }}>
                                                    <div style={{
                                                        width: `${Math.min(100, Math.max(0, (t._kmPerL / 5) * 100))}%`,
                                                        height: "100%",
                                                        background: "var(--brand-primary)",
                                                        borderRadius: 10,
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 28, textAlign: "right" }}>{fmtN(t._kmPerL, 1)}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <button
                                                type="button"
                                                className="dashboard-table-icon-btn"
                                                aria-label={`Open vehicle ${t.reg}`}
                                                onClick={() => navigate(`/fleet/${t.id}`)}
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Bottom Row: Alerts + Invoice & Payroll */}
            <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
            }}>
                {/* Recent Alerts */}
                <Card title="Recent Alerts" icon={AlertTriangle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {staleJourneys.length === 0 && tyreAlerts.length === 0 ? (
                            <div style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 8,
                                padding: "32px 0",
                                color: "var(--text-dim)",
                            }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Activity size={20} color="#10b981" />
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>All clear — no active alerts</div>
                            </div>
                        ) : (
                            <>
                                {staleJourneys.slice(0, 3).map(j => (
                                    <div key={j.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <Clock size={16} color="#f59e0b" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Journey Overdue</div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                                                {truckReg(j.truck)} — in transit for {Math.floor((Date.now() - new Date(j.date).getTime()) / 86400000)} days
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {tyreAlerts.slice(0, 3).map(t => (
                                    <div key={t.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <AlertTriangle size={16} color="#ef4444" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Tyre Maintenance</div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                                                {t.reg} — {Math.abs(tyreStatus(t).remaining).toLocaleString()} km overdue
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                        <div style={{ paddingTop: 16 }}>
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                icon={ArrowUpRight}
                                onClick={() => {
                                    if (staleJourneys.length > 0) { navigate("/journeys"); return; }
                                    if (tyreAlerts.length > 0) { navigate("/tyres"); return; }
                                    navigate("/journeys");
                                }}
                                style={{ width: "100%" }}
                            >
                                View all operations alerts
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Invoice & Payroll */}
                <Card title="Invoice & Payroll" icon={ClipboardList} accent="var(--brand-primary)">
                    <div className="dashboard-finance-status">
                        <div className="dashboard-finance-status__section-label">Invoices — {monthLabel(latestMonth)}</div>

                        {[
                            { key: "paid", label: "Paid", list: invPaidList, total: invPaidTotal, color: "#22c55e", badge: "Paid" },
                            { key: "pend", label: "Pending/Partial", list: invPendingList, total: invPendingTotal, color: "#ca8a04", badge: "Pending" },
                            { key: "due", label: "Overdue", list: invOverdueList, total: invOverdueTotal, color: "#dc2626", badge: "Overdue" },
                        ].map((row, idx) => (
                            <div
                                key={row.key}
                                className="dashboard-finance-status__row"
                                style={{ borderTop: idx === 0 ? "none" : undefined }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <Badge status={row.badge}>{row.label}</Badge>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>({row.list.length})</span>
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: row.color, fontVariantNumeric: "tabular-nums" }}>{fmt(row.total)}</div>
                            </div>
                        ))}

                        <div className="dashboard-finance-status__section-label" style={{ marginTop: 20 }}>
                            Payroll — {monthLabel(latestMonth).toUpperCase()}
                        </div>
                        <div className="dashboard-finance-status__payroll" style={{ maxHeight: 200, overflowY: "auto" }}>
                            {payrollForMonth.length === 0 ? (
                                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>No payroll records for this month.</div>
                            ) : (
                                payrollForMonth.map((p) => {
                                    const net = +p.baseSalary + +p.allowance - +p.deductions;
                                    return (
                                        <div key={p.id} className="dashboard-finance-status__row">
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{driverName(p.driver)}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ fontWeight: 800, fontSize: 13, color: "#ca8a04", fontVariantNumeric: "tabular-nums" }}>{fmt(net)}</span>
                                                <Badge status={p.status}>{p.status}</Badge>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="dashboard-card-actions" style={{ display: "flex", gap: 10, paddingTop: 16 }}>
                            <Button
                                type="button"
                                variant="premium"
                                size="md"
                                icon={FileText}
                                onClick={() => navigate("/invoices")}
                                style={{ flex: 1 }}
                            >
                                Invoices
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                icon={CreditCard}
                                onClick={() => navigate("/payroll")}
                                style={{ flex: 1 }}
                            >
                                Payroll
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
