import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
    Wrench, 
    History, 
    Calendar, 
    Truck, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    ArrowRight, 
    ChevronRight, 
    Filter,
    Plus,
    LayoutGrid,
    Search
} from "lucide-react";
import { fmt, today, fmtN, fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";

// Default maintenance schedule — applied to every truck unless overridden
const DEFAULT_SCHEDULE = [
    { task: 'Oil Change',                  intervalKm: 10000, icon: Clock },
    { task: 'Tyre Rotation',               intervalKm: 10000, icon: Clock },
    { task: 'Wheel Alignment & Balancing', intervalKm: 10000, icon: Clock },
    { task: 'Brake Disc Inspection',       intervalKm: 15000, icon: Clock },
    { task: 'Brake Pad Replacement',       intervalKm: 15000, icon: Clock },
    { task: 'Fuel Filter Replacement',     intervalKm: 20000, icon: Clock },
    { task: 'Power Steering Fluid Top-up', intervalKm: 20000, icon: Clock },
    { task: 'Engine Belt Inspection',      intervalKm: 30000, icon: Clock },
    { task: 'Differential Oil Change',     intervalKm: 40000, icon: Clock },
    { task: 'Transmission Fluid Change',   intervalKm: 40000, icon: Clock },
];

export function Maintenance({ data, setData, dark, isMobile, saveItem, truckReg, openModal, customerName }) {
    const navigate = useNavigate();
    const [viewMode, setViewMode]   = useState('schedule'); // 'schedule' | 'history'
    const [filterStatus, setFilter] = useState('all');      // 'all' | 'overdue' | 'due' | 'ok'
    const [filterTruckId, setFilterTruck] = useState('ALL');
    const [expandedTrucks, setExpandedTrucks] = useState(() => new Set(data.trucks.map(t => t.id)));

    // ── Load Custom Schedule from Settings
    const settings = (() => { try { return JSON.parse(localStorage.getItem('segecha_settings') || '{}'); } catch { return {}; } })();
    const customSchedule = settings.maintenanceSchedule || DEFAULT_SCHEDULE;

    // ── Compute schedule row status per truck per task
    const getTaskStatus = (truck, task, intervalKm) => {
        const odom = +truck.odom || 0;
        const history = data.expenses.filter(e =>
            e.truck === truck.id &&
            e.cat === 'Maintenance' &&
            e.desc?.toLowerCase().includes(task.toLowerCase())
        ).sort((a, b) => b.date.localeCompare(a.date));

        const lastServiceOdom = history.length > 0 ? +(history[0].odom || 0) : 0;
        const kmSince = odom - lastServiceOdom;
        const remaining = intervalKm - kmSince;
        const pct = Math.min(100, Math.max(0, (kmSince / intervalKm) * 100));

        let status = 'ok';
        if (remaining <= 0) status = 'overdue';
        else if (remaining <= intervalKm * 0.1) status = 'due';

        return { status, kmSince, remaining, pct, lastServiceOdom, lastServiceDate: history[0]?.date || null, history };
    };

    // ── Aggregate stats
    const allRows = data.trucks.flatMap(truck =>
        customSchedule.map(s => ({ truck, ...s, ...getTaskStatus(truck, s.task, s.intervalKm) }))
    );
    const overdueCount = allRows.filter(r => r.status === 'overdue').length;
    const dueCount     = allRows.filter(r => r.status === 'due').length;
    const okCount      = allRows.filter(r => r.status === 'ok').length;

    const toggleTruck = (id) => {
        setExpandedTrucks(s => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const statusMap = {
        overdue: { color: "#ef4444", label: "Overdue", icon: AlertCircle },
        due: { color: "#f97316", label: "Due Soon", icon: Clock },
        ok: { color: "#10b981", label: "Healthy", icon: CheckCircle2 }
    };

    const visibleTrucks = data.trucks.filter(t => filterTruckId === 'ALL' || t.id === filterTruckId);
    const maintenanceHistory = data.expenses
        .filter(e => e.cat === 'Maintenance')
        .filter(e => filterTruckId === 'ALL' || e.truck === filterTruckId)
        .sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="page-shell">
            <PageHeader
                icon={Wrench}
                title="Maintenance"
                description="Preventive schedule and service history by vehicle."
                actions={
                    <>
                        <div
                            style={{
                                display: "flex",
                                background: "var(--surface-subtle)",
                                borderRadius: 12,
                                padding: 4,
                                border: "1px solid var(--border-subtle)",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setViewMode("schedule")}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    border: "none",
                                    background: viewMode === "schedule" ? "var(--brand-primary)" : "transparent",
                                    color: viewMode === "schedule" ? "white" : "var(--text-dim)",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <LayoutGrid size={16} /> Schedule
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("history")}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    border: "none",
                                    background: viewMode === "history" ? "var(--brand-primary)" : "transparent",
                                    color: viewMode === "history" ? "white" : "var(--text-dim)",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <History size={16} /> History
                            </button>
                        </div>
                        <Button
                            variant="premium"
                            icon={Plus}
                            onClick={() => openModal("maintenance", { truck: data.trucks[0]?.id, date: today() })}
                        >
                            Log service
                        </Button>
                    </>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
                <Card 
                    title="Critical Alert" 
                    icon={AlertCircle} 
                    accent="#ef4444" 
                    onClick={() => setFilter(filterStatus === 'overdue' ? 'all' : 'overdue')}
                    style={{ cursor: 'pointer', border: filterStatus === 'overdue' ? '2px solid #ef4444' : '1px solid var(--border-subtle)', padding: 20, borderRadius: 16 }}
                >
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#ef4444" }}>{overdueCount}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>Critical Tasks</div>
                </Card>
                <Card 
                    title="Upcoming Service" 
                    icon={Clock} 
                    accent="#f97316"
                    onClick={() => setFilter(filterStatus === 'due' ? 'all' : 'due')}
                    style={{ cursor: 'pointer', border: filterStatus === 'due' ? '2px solid #f97316' : '1px solid var(--border-subtle)', padding: 20, borderRadius: 16 }}
                >
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#f97316" }}>{dueCount}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>Due Soon</div>
                </Card>
                <Card 
                    title="System Health" 
                    icon={CheckCircle2} 
                    accent="#10b981"
                    onClick={() => setFilter(filterStatus === 'ok' ? 'all' : 'ok')}
                    style={{ cursor: 'pointer', border: filterStatus === 'ok' ? '2px solid #10b981' : '1px solid var(--border-subtle)', padding: 20, borderRadius: 16 }}
                >
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#10b981" }}>{okCount}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>Healthy Units</div>
                </Card>
                <Card style={{ padding: 20, border: "1px solid var(--border-subtle)", borderRadius: 16, background: "var(--bg-card)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>Quick Vehicle Search</div>
                    <div style={{ position: "relative" }}>
                        <Truck style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--brand-primary)" }} size={16} />
                        <select 
                            className="input-premium" 
                            style={{ width: '100%', fontSize: 13, height: 42, padding: "0 12px 0 34px", borderRadius: 10, background: "var(--surface-subtle)" }}
                            value={filterTruckId} 
                            onChange={e => setFilterTruck(e.target.value)}
                        >
                            <option value="ALL">All Power Units</option>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg} — {t.make}</option>)}
                        </select>
                    </div>
                </Card>
            </div>

            {viewMode === 'schedule' ? (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th>Unique ID</th>
                                    <th>Licence Plate</th>
                                    <th>Vehicle Type</th>
                                    <th>Odometer</th>
                                    <th>Health Status</th>
                                    <th>Overdue Tasks</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTrucks.map(truck => {
                                    const tasks = customSchedule.map(s => ({ ...s, ...getTaskStatus(truck, s.task, s.intervalKm) }));
                                    const truckOverdue = tasks.filter(t => t.status === 'overdue').length;
                                    const truckDue     = tasks.filter(t => t.status === 'due').length;
                                    
                                    // Aggregate status
                                    let aggregateStatus = 'ok';
                                    if (truckOverdue > 0) aggregateStatus = 'overdue';
                                    else if (truckDue > 0) aggregateStatus = 'due';

                                    if (filterStatus !== 'all' && aggregateStatus !== filterStatus) return null;

                                    return (
                                        <tr key={truck.id} onClick={() => navigate(`/fleet/${truck.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                                                {truck.uId || '—'}
                                            </td>
                                            <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                {truck.reg}
                                            </td>
                                            <td style={{ fontSize: 13, color: "var(--text-dim)" }}>
                                                {truck.make} {truck.type}
                                            </td>
                                            <td style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>
                                                {Number(truck.odom || 0).toLocaleString('en-KE')} <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)" }}>KM</span>
                                            </td>
                                            <td>
                                                <Badge 
                                                    status={aggregateStatus === 'overdue' ? 'Overdue' : aggregateStatus === 'due' ? 'Pending' : 'Paid'} 
                                                    text={statusMap[aggregateStatus].label} 
                                                    icon={statusMap[aggregateStatus].icon}
                                                />
                                            </td>
                                            <td>
                                                {truckOverdue > 0 ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontWeight: 700, fontSize: 13 }}>
                                                        <AlertCircle size={14} /> {truckOverdue} Overdue
                                                    </div>
                                                ) : (
                                                    <div style={{ color: "var(--text-dim)", fontSize: 13 }}>0 Critical</div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Maintenance actions for ${truck.reg}`}
                                                    items={[
                                                        {
                                                            id: "profile",
                                                            label: "Vehicle profile",
                                                            icon: Truck,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                navigate(`/fleet/${truck.id}`);
                                                            },
                                                        },
                                                        {
                                                            id: "log",
                                                            label: "Log service",
                                                            icon: Plus,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                openModal("maintenance", {
                                                                    truck: truck.id,
                                                                    date: today(),
                                                                    odom: String(truck.odom || ""),
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
            ) : (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                            <History size={18} color="var(--brand-primary)" />
                            Complete Service History
                        </div>
                    </div>
                    {maintenanceHistory.length === 0 ? (
                        <div style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                            <Wrench size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                            <div style={{ fontSize: 16, fontWeight: 600 }}>No service records found</div>
                            <p style={{ marginTop: 4 }}>Log your first maintenance activity to see it here.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="table-modern">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Vehicle</th>
                                        <th>Task / Description</th>
                                        <th>Odometer</th>
                                        <th>Workshop</th>
                                        <th>Service Cost</th>
                                        <th style={{ width: 80 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {maintenanceHistory.map(e => (
                                        <tr key={e.id} onClick={() => navigate(`/fleet/${e.truck}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td style={{ fontWeight: 600 }}>{fmtDate(e.date)}</td>
                                            <td><Badge status="Pending" text={truckReg(e.truck)} /></td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{e._maintenanceTask || e.desc}</div>
                                                {e._maintenanceDetails?.notes && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{e._maintenanceDetails.notes}</div>}
                                            </td>
                                            <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{e.odom ? `${Number(e.odom).toLocaleString('en-KE')} km` : '—'}</td>
                                            <td style={{ fontSize: 13 }}>{e._maintenanceDetails?.workshop || '—'}</td>
                                            <td style={{ fontWeight: 800, color: "var(--brand-primary)" }}>{fmt(e.amount)}</td>
                                            <td><ChevronRight size={16} color="var(--text-dim)" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: "var(--surface-subtle)", fontWeight: 800 }}>
                                        <td colSpan={5} style={{ textAlign: "right", color: "var(--text-dim)" }}>Total Lifecycle Investment</td>
                                        <td style={{ color: "var(--brand-primary)", fontSize: 16 }}>{fmt(maintenanceHistory.reduce((s, e) => s + +e.amount, 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

