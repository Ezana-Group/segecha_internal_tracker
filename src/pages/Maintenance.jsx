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
    Search as SearchIcon
} from "lucide-react";
import { fmt, today, fmtN, fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

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

    // ── Compute all task rows for KPI cards
    const allRowsForKpi = data.trucks.flatMap(truck =>
        customSchedule.map(s => ({ truck, ...s, ...getTaskStatus(truck, s.task, s.intervalKm) }))
    );
    const overdueCountTotal = allRowsForKpi.filter(r => r.status === 'overdue').length;
    const dueCountTotal     = allRowsForKpi.filter(r => r.status === 'due').length;
    const okCountTotal      = allRowsForKpi.filter(r => r.status === 'ok').length;

    const statusMap = {
        overdue: { color: "#ef4444", label: "Overdue", icon: AlertCircle },
        due: { color: "#f97316", label: "Due Soon", icon: Clock },
        ok: { color: "#10b981", label: "Healthy", icon: CheckCircle2 }
    };

    // ── SCHEDULE TABLE DATA
    const refinedSchedule = data.trucks.map(truck => {
        const tasks = customSchedule.map(s => ({ ...s, ...getTaskStatus(truck, s.task, s.intervalKm) }));
        const truckOverdue = tasks.filter(t => t.status === 'overdue').length;
        const truckDue     = tasks.filter(t => t.status === 'due').length;
        let aggregateStatus = 'ok';
        if (truckOverdue > 0) aggregateStatus = 'overdue';
        else if (truckDue > 0) aggregateStatus = 'due';
        
        return {
            ...truck,
            _odom: Number(truck.odom || 0),
            _overdue: truckOverdue,
            _aggStatus: aggregateStatus,
            _aggStatusLabel: statusMap[aggregateStatus].label
        };
    });

    const { 
        filteredRows: sortedSchedule, 
        setSort: requestSortSchedule, 
        sortState: sortConfigSchedule,
        filterState: scheduleFilters,
        applyFilter: handleScheduleFilterChange,
        getUniqueValues: getScheduleUniqueValues,
        searchTerm: searchTermSched,
        setSearchTerm: setSearchTermSched
    } = useTableFilter(refinedSchedule, { 
        namespace: "msched", 
        initialSort: { col: "reg", dir: "asc" },
        searchColumns: ["reg", "uId", "make"]
    });

    // ── HISTORY TABLE DATA
    const refinedHistory = data.expenses
        .filter(e => e.cat === 'Maintenance')
        .map(e => ({
            ...e,
            _vehicle: truckReg(e.truck),
            _cost: Number(e.amount || 0),
            _odom: Number(e.odom || 0),
            _workshop: e._maintenanceDetails?.workshop || '—'
        }));

    const { 
        filteredRows: sortedHistory, 
        setSort: requestSortHistory, 
        sortState: sortConfigHistory,
        filterState: historyFilters,
        applyFilter: handleHistoryFilterChange,
        getUniqueValues: getHistoryUniqueValues,
        searchTerm: searchTermHist,
        setSearchTerm: setSearchTermHist
    } = useTableFilter(refinedHistory, { 
        namespace: "mhist", 
        initialSort: { col: "date", dir: "desc" },
        searchColumns: ["_reg", "desc", "_workshop"]
    });

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
                    onClick={() => handleScheduleFilterChange("_aggStatusLabel", new Set(["Overdue"]))}
                    style={{ cursor: 'pointer', border: scheduleFilters._aggStatusLabel?.has("Overdue") ? '2px solid #ef4444' : '1px solid var(--border-subtle)', padding: 20, borderRadius: 16 }}
                >
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#ef4444" }}>{overdueCountTotal}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>Critical Tasks</div>
                </Card>
                <Card 
                    title="Upcoming Service" 
                    icon={Clock} 
                    accent="#f97316"
                    onClick={() => handleScheduleFilterChange("_aggStatusLabel", new Set(["Due Soon"]))}
                    style={{ cursor: 'pointer', border: scheduleFilters._aggStatusLabel?.has("Due Soon") ? '2px solid #f97316' : '1px solid var(--border-subtle)', padding: 20, borderRadius: 16 }}
                >
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#f97316" }}>{dueCountTotal}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>Due Soon</div>
                </Card>
                <Card 
                    title="System Health" 
                    icon={CheckCircle2} 
                    accent="#10b981"
                    onClick={() => handleScheduleFilterChange("_aggStatusLabel", new Set(["Healthy"]))}
                    style={{ cursor: 'pointer', border: scheduleFilters._aggStatusLabel?.has("Healthy") ? '2px solid #10b981' : '1px solid var(--border-subtle)', padding: 20, borderRadius: 16 }}
                >
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#10b981" }}>{okCountTotal}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>Healthy Units</div>
                </Card>
                <Card style={{ padding: 20, border: "1px solid var(--border-subtle)", borderRadius: 16, background: "var(--bg-card)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Filter Tip</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                        Use column headers to filter by vehicle or workshop.
                    </div>
                </Card>
            </div>

            {viewMode === 'schedule' ? (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                        <SearchIcon size={18} color="var(--text-dim)" />
                        <input
                            type="search"
                            placeholder="Search fleet schedule..."
                            value={searchTermSched}
                            onChange={(e) => setSearchTermSched(e.target.value)}
                            style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                        />
                    </div>
                    <div className="table-container">
                        <table className="table-modern">
                            <SortableTableHead 
                                requestSort={requestSortSchedule}
                                sortConfig={sortConfigSchedule}
                                filterState={scheduleFilters}
                                onFilterChange={handleScheduleFilterChange}
                                getUniqueValues={getScheduleUniqueValues}
                                columns={[
                                    { key: "uId", label: "Unique ID", sortable: true },
                                    { key: "reg", label: "Licence Plate", sortable: true },
                                    { key: "make", label: "Vehicle Type", sortable: true },
                                    { key: "_odom", label: "Odometer", sortable: true, align: "right" },
                                    { key: "_aggStatusLabel", label: "Health Status", sortable: true },
                                    { key: "_overdue", label: "Overdue Tasks", sortable: true, align: "right" },
                                    { key: "actions", label: "Actions", sortable: false, align: "right" }
                                ]}
                            />
                            <tbody>
                                {sortedSchedule.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600 }}>No vehicles found matching your filters.</div>
                                        </td>
                                    </tr>
                                ) : sortedSchedule.map(truck => {
                                    const tasks = customSchedule.map(s => ({ ...s, ...getTaskStatus(truck, s.task, s.intervalKm) }));
                                    const truckOverdue = tasks.filter(t => t.status === 'overdue').length;
                                    const aggregateStatus = truck._aggStatus;

                                    return (
                                        <tr key={truck.id} onClick={() => navigate(`/fleet/${truck.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td className="sticky-col" title={truck.uId || '—'} style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                                                {truck.uId || '—'}
                                            </td>
                                            <td title={truck.reg} style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                {truck.reg}
                                            </td>
                                            <td title={`${truck.make} ${truck.type}`} style={{ fontSize: 13, color: "var(--text-dim)" }}>
                                                {truck.make} {truck.type}
                                            </td>
                                            <td title={`${Number(truck._odom || 0).toLocaleString('en-KE')} KM`} style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13, textAlign: "right" }}>
                                                {Number(truck._odom || 0).toLocaleString('en-KE')} <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)" }}>KM</span>
                                            </td>
                                            <td className="status-col" title={statusMap[aggregateStatus].label}>
                                                <Badge 
                                                    status={aggregateStatus === 'overdue' ? 'Overdue' : aggregateStatus === 'due' ? 'Pending' : 'Paid'} 
                                                    text={statusMap[aggregateStatus].label} 
                                                    icon={statusMap[aggregateStatus].icon}
                                                />
                                            </td>
                                            <td style={{ textAlign: "right" }} title={`${truckOverdue} Overdue`}>
                                                {truckOverdue > 0 ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontWeight: 700, fontSize: 13, justifyContent: "flex-end" }}>
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
                    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <History size={18} color="var(--brand-primary)" />
                            Complete Service History
                        </div>
                        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                            <SearchIcon size={16} color="var(--text-dim)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                            <input
                                type="search"
                                placeholder="Search history..."
                                value={searchTermHist}
                                onChange={(e) => setSearchTermHist(e.target.value)}
                                style={{ border: "1px solid var(--border-subtle)", background: "var(--surface-subtle)", padding: "8px 12px 8px 36px", fontSize: 13, borderRadius: 12, width: "100%", color: "var(--text-primary)", fontWeight: 500 }}
                            />
                        </div>
                    </div>
                    <div className="table-container">
                        <table className="table-modern">
                            <SortableTableHead 
                                requestSort={requestSortHistory}
                                sortConfig={sortConfigHistory}
                                filterState={historyFilters}
                                onFilterChange={handleHistoryFilterChange}
                                getUniqueValues={getHistoryUniqueValues}
                                columns={[
                                    { key: "date", label: "Date", sortable: true },
                                    { key: "_vehicle", label: "Vehicle", sortable: true },
                                    { key: "desc", label: "Task / Description", sortable: true },
                                    { key: "_odom", label: "Odometer", sortable: true, align: "right" },
                                    { key: "_workshop", label: "Workshop", sortable: true },
                                    { key: "_cost", label: "Service Cost", sortable: true, align: "right" },
                                    { key: "actions", label: "", sortable: false }
                                ]}
                            />
                            <tbody>
                                {sortedHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><Wrench size={48} opacity={0.1} /></div>
                                            <div style={{ fontSize: 16, fontWeight: 600 }}>No service records found</div>
                                            <p style={{ marginTop: 4 }}>Try adjusting your filters or log a new service.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedHistory.map(e => (
                                        <tr key={e.id} onClick={() => navigate(`/fleet/${e.truck}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                            <td className="sticky-col" title={fmtDate(e.date)} style={{ fontWeight: 600 }}>{fmtDate(e.date)}</td>
                                            <td title={e._vehicle}><Badge status="Pending" text={e._vehicle} /></td>
                                            <td title={e._maintenanceTask || e.desc}>
                                                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{e._maintenanceTask || e.desc}</div>
                                                {e._maintenanceDetails?.notes && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{e._maintenanceDetails.notes}</div>}
                                            </td>
                                            <td title={e.odom ? `${Number(e.odom).toLocaleString('en-KE')} km` : '—'} style={{ fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "right" }}>{e.odom ? `${Number(e.odom).toLocaleString('en-KE')} km` : '—'}</td>
                                            <td title={e._maintenanceDetails?.workshop || '—'} style={{ fontSize: 13 }}>{e._maintenanceDetails?.workshop || '—'}</td>
                                            <td title={fmt(e.amount)} style={{ fontWeight: 800, color: "var(--brand-primary)", textAlign: "right" }}>{fmt(e.amount)}</td>
                                            <td style={{ textAlign: "right" }}><ChevronRight size={16} color="var(--text-dim)" /></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {sortedHistory.length > 0 && (
                                <tfoot>
                                    <tr style={{ background: "var(--surface-subtle)", fontWeight: 800 }}>
                                        <td colSpan={5} style={{ textAlign: "right", color: "var(--text-dim)" }}>Total Lifecycle Investment (Filtered)</td>
                                        <td style={{ color: "var(--brand-primary)", fontSize: 16, textAlign: "right" }}>{fmt(sortedHistory.reduce((s, e) => s + +e.amount, 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
