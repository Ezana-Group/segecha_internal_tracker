import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
    TrendingUp, 
    Droplet, 
    AlertTriangle, 
    ShieldCheck, 
    Clock, 
    Truck, 
    Wallet, 
    ArrowUpRight, 
    ChevronRight, 
    LayoutDashboard, 
    ClipboardList, 
    FileText, 
    CreditCard,
    Mail, Briefcase, Users, CheckCircle2, CheckCircle
} from "lucide-react";
import { adminAuth } from '../utils/adminAuth';
import { fmt, fmtN, monthLabel } from "../utils/formatters";
import { STALE_TRANSIT_DAYS, FLEET_ACTIVE_WARN_PCT } from "../constants/nav";
import { PAYMENT_API } from "../utils/env";
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

const BarChart = ({ data, dark }) => {
    const max = Math.max(...data.map(d => Math.max(d.rev, d.exp))) || 1;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180, padding: '20px 0' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', width: '100%', justifyContent: 'center' }}>
                        <div style={{ width: 8, height: `${(d.rev / max) * 100}%`, background: '#3b82f6', borderRadius: '4px 4px 0 0', minHeight: 4 }} title={`Rev: ${fmt(d.rev)}`} />
                        <div style={{ width: 8, height: `${(d.exp / max) * 100}%`, background: '#ec4899', borderRadius: '4px 4px 0 0', minHeight: 4 }} title={`Exp: ${fmt(d.exp)}`} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>{d.label}</span>
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
        const token = adminAuth.getToken();
        fetch(`${PAYMENT_API}/api/documents/expiring?days=30&adminKey=${ADMIN_KEY}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
            .then(res => res.json())
            .then(d => setExpiringDocs(d.documents || []))
            .catch(() => setExpiringDocs([]));
    }, []);

    const totalRevenue = data.journeys.filter(j => j.status === "Completed" && j.date?.startsWith(latestMonth)).reduce((s, j) => s + +j.revenue, 0);
    const totalFuelCost = data.fuel.filter(f => f.date?.startsWith(latestMonth)).reduce((s, f) => s + f.litres * f.pricePerL, 0);
    const totalOtherExp = data.expenses.filter(e => e.date?.startsWith(latestMonth) && e.cat !== 'Fuel').reduce((s, e) => s + +e.amount, 0);
    const totalExpenses = totalFuelCost + totalOtherExp;
    const netProfit = invPaidTotal - totalExpenses;
    const invList = Array.isArray(data.invoices) ? data.invoices : [];
    const invOutstanding = (i) => Math.max(0, +i.amount - (+i.paidAmount || 0));
    const invPaidList = invList.filter((i) => i.status === "Paid" && i.date?.startsWith(latestMonth));
    const invPendingList = invList.filter((i) => i.status === "Pending" && i.date?.startsWith(latestMonth));
    const invOverdueList = invList.filter((i) => i.status === "Overdue" && i.date?.startsWith(latestMonth));
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
        const rev = data.journeys.filter(j => j.status === "Completed" && j.date?.startsWith(m)).reduce((s, j) => s + +j.revenue, 0);
        const fuel = data.fuel.filter(f => f.date?.startsWith(m)).reduce((s, f) => s + f.litres * f.pricePerL, 0);
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


    return (
        <div className="page-shell">
            <PageHeader
                icon={LayoutDashboard}
                title="Operations dashboard"
                description={
                    <>
                        Performance overview for{" "}
                        <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{monthLabel(latestMonth)}</span>
                    </>
                }
                actions={
                    !fleetActiveWarning ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "rgba(16, 185, 129, 0.1)",
                                padding: "8px 16px",
                                borderRadius: 12,
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                            }}
                        >
                            <div
                                className="status-dot-pulse"
                                style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>Fleet healthy</span>
                        </div>
                    ) : null
                }
            />

            {/* Top Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
                <Card 
                    title="Net Profit" 
                    subtitle={`${margin}% profit margin`}
                    icon={TrendingUp} 
                    accent="#3b82f6"
                >
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{fmt(netProfit)}</div>
                        <Sparkline data={[10, 15, 8, 12, 18, 14, 22]} color="#3b82f6" />
                    </div>
                </Card>
                <Card 
                    title="Revenue Collected" 
                    subtitle={`${fmt(invPendingTotal)} outstanding`}
                    icon={Wallet} 
                    accent="#10b981"
                >
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{fmt(invPaidTotal)}</div>
                        <Sparkline data={[5, 12, 18, 14, 20, 25, 30]} color="#10b981" />
                    </div>
                </Card>
                <Card 
                    title="Estimated Fuel" 
                    subtitle={`${totalLitres.toLocaleString()}L consumed`}
                    icon={Droplet} 
                    accent="#f59e0b"
                >
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{fmt(totalFuelCost)}</div>
                        <Sparkline data={[20, 18, 22, 15, 12, 10, 8]} color="#f59e0b" />
                    </div>
                </Card>
                <Card 
                    title="Efficiency" 
                    icon={ArrowUpRight} 
                    accent="#a78bfa"
                >
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{overallKmPerL}<span style={{ fontSize: 13, marginLeft: 4, color: "var(--text-muted)" }}>km/L</span></div>
                        <Sparkline data={[2.1, 2.3, 2.2, 2.5, 2.4, 2.6, 2.8]} color="#a78bfa" />
                    </div>
                </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, marginBottom: 16 }}>
                <Card title="Monthly Performance Comparison" subtitle="Revenue vs Expenses (KES)">
                    <BarChart data={last3Months} />
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: '#3b82f6' }} /> Revenue
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: '#ec4899' }} /> Expenses
                        </div>
                    </div>
                </Card>

                <Card title="Operating Efficiency by Truck" subtitle="Liters per KM comparison">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
                        {data.trucks.map(t => {
                            const st = truckStats(t.id);
                            const lkm = st.kmPerL > 0 ? (1 / st.kmPerL).toFixed(2) : 0;
                            const pct = Math.min(100, (lkm / 1) * 100); // normalized against 1L/km
                            return (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 100, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t.reg}</div>
                                    <div style={{ flex: 1, height: 12, background: 'var(--bg-main)', borderRadius: 6, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: lkm > 0.6 ? '#f59e0b' : '#10b981', borderRadius: 6 }} />
                                    </div>
                                    <div style={{ width: 60, fontSize: 12, fontWeight: 800, textAlign: 'right' }}>{lkm} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>L/km</span></div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "3fr 2fr", gap: 16 }}>
                {/* Fleet performance table */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Card title="Vehicle Performance Summary">
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
                                        { key: "_profPerKm", label: "Prof/KM", sortable: true, align: "right" },
                                        { key: "_kmPerL", label: "Efficiency", sortable: true },
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
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                            <Truck size={16} />
                                                        </div>
                                                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{t.reg}</span>
                                                    </div>
                                                </td>
                                                <td className="status-col" title={t.status}><Badge status={t.status} /></td>
                                                <td style={{ fontWeight: 600, color: "#10b981", textAlign: "right" }} title={fmt(t._rev)}>{fmt(t._rev)}</td>
                                                <td style={{ fontWeight: 600, textAlign: "right" }} title={fmt(profPerKm)}>{fmt(profPerKm)}</td>
                                                <td title={`${fmtN(t._kmPerL, 1)} km/L`}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <div style={{ flex: 1, height: 6, background: "var(--surface-subtle)", borderRadius: 10, overflow: "hidden" }}>
                                                            <div style={{ width: `${Math.min(100, Math.max(0, (t._kmPerL / 5) * 100))}%`, height: "100%", background: "#3b82f6", borderRadius: 10 }} />
                                                        </div>
                                                        <span style={{ fontSize: 11, fontWeight: 600 }}>{fmtN(t._kmPerL, 1)}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                    <button
                                                        type="button"
                                                        className="dashboard-table-icon-btn"
                                                        aria-label={`Open vehicle ${t.reg}`}
                                                        onClick={() => navigate(`/fleet/${t.id}`)}
                                                    >
                                                        <ChevronRight size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Secondary section: Alerts & Small lists */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Card title="Recent Alerts" icon={AlertTriangle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {staleJourneys.slice(0, 3).map(j => (
                                <div key={j.id} style={{ display: "flex", gap: 12, paddingBottom: 16, borderBottom: "var(--border-subtle)" }}>
                                    <Clock size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Journey Overdue</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{truckReg(j.truck)} has been In Transit for {Math.floor((Date.now() - new Date(j.date).getTime()) / 86400000)} days</div>
                                    </div>
                                </div>
                            ))}
                            {tyreAlerts.slice(0, 3).map(t => (
                                <div key={t.id} style={{ display: "flex", gap: 12, paddingBottom: 16, borderBottom: "var(--border-subtle)" }}>
                                    <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Tyre Maintenance</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.reg} is {Math.abs(tyreStatus(t).remaining).toLocaleString()} km overdue</div>
                                    </div>
                                </div>
                            ))}
                            {(staleJourneys.length === 0 && tyreAlerts.length === 0) ? (
                                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "8px 0 4px" }}>No tyre or in-transit alerts right now.</div>
                            ) : null}
                            <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                className="dashboard-card-cta"
                                icon={ArrowUpRight}
                                onClick={() => {
                                    if (staleJourneys.length > 0) {
                                        navigate("/journeys");
                                        return;
                                    }
                                    if (tyreAlerts.length > 0) {
                                        navigate("/tyres");
                                        return;
                                    }
                                    navigate("/journeys");
                                }}
                            >
                                View all operations alerts
                            </Button>
                        </div>
                    </Card>

                    <Card title="Invoice & Payroll Status" icon={ClipboardList} accent="var(--brand-primary)">
                        <div className="dashboard-finance-status">
                            <div className="dashboard-finance-status__section-label">Invoices</div>
                            {[
                                { key: "paid", label: "Paid", list: invPaidList, total: invPaidTotal, color: "#22c55e", badge: "Paid" },
                                { key: "pend", label: "Pending", list: invPendingList, total: invPendingTotal, color: "#ca8a04", badge: "Pending" },
                                { key: "due", label: "Overdue", list: invOverdueList, total: invOverdueTotal, color: "#dc2626", badge: "Overdue" },
                            ].map((row, idx) => (
                                <div
                                    key={row.key}
                                    className="dashboard-finance-status__row"
                                    style={{ borderTop: idx === 0 ? "none" : undefined }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                        <Badge status={row.badge}>{row.label}</Badge>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>({row.list.length})</span>
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: 14, color: row.color, fontVariantNumeric: "tabular-nums" }}>{fmt(row.total)}</div>
                                </div>
                            ))}

                            <div className="dashboard-finance-status__section-label" style={{ marginTop: 20 }}>
                                Payroll — {monthLabel(latestMonth).toUpperCase()}
                            </div>
                            <div className="dashboard-finance-status__payroll" style={{ maxHeight: 220, overflowY: "auto" }}>
                                {payrollForMonth.length === 0 ? (
                                    <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>No payroll records for this month.</div>
                                ) : (
                                    payrollForMonth.map((p) => {
                                        const net = +p.baseSalary + +p.allowance - +p.deductions;
                                        return (
                                            <div key={p.id} className="dashboard-finance-status__row">
                                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{driverName(p.driver)}</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <span style={{ fontWeight: 800, fontSize: 14, color: "#ca8a04", fontVariantNumeric: "tabular-nums" }}>{fmt(net)}</span>
                                                    <Badge status={p.status}>{p.status}</Badge>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="dashboard-card-actions">
                                <Button
                                    type="button"
                                    variant="premium"
                                    size="md"
                                    className="dashboard-card-cta"
                                    icon={FileText}
                                    onClick={() => navigate("/invoices")}
                                >
                                    View invoices
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    className="dashboard-card-cta"
                                    icon={CreditCard}
                                    onClick={() => navigate("/payroll")}
                                >
                                    View payroll
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
