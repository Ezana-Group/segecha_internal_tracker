import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Wrench,
    History,
    AlertCircle,
    CheckCircle2,
    Clock,
    ChevronRight,
    Plus,
    LayoutGrid,
    Search as SearchIcon,
    Truck,
} from "lucide-react";
import { fmt, today, fmtDate } from "../utils/formatters";
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
                        {/* View mode toggle */}
                        <div style={{
                            display: "flex",
                            background: "var(--surface-subtle)",
                            borderRadius: "var(--radius-md)",
                            padding: 3,
                            border: "1px solid var(--border-subtle)",
                            gap: 2,
                        }}>
                            {[
                                { id: "schedule", label: "Schedule", Icon: LayoutGrid },
                                { id: "history",  label: "History",  Icon: History },
                            ].map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setViewMode(id)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "7px 14px",
                                        borderRadius: "calc(var(--radius-md) - 2px)",
                                        border: "none",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        background: viewMode === id ? "var(--brand-primary)" : "transparent",
                                        color: viewMode === id ? "#fff" : "var(--text-dim)",
                                        transition: "background 0.15s, color 0.15s",
                                    }}
                                >
                                    <Icon size={15} />
                                    {label}
                                </button>
                            ))}
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

            {/* ── KPI Summary Row ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
                {[
                    {
                        label: "Critical Tasks",
                        value: overdueCountTotal,
                        color: "#ef4444",
                        icon: AlertCircle,
                        filterKey: "Overdue",
                    },
                    {
                        label: "Due Soon",
                        value: dueCountTotal,
                        color: "#f97316",
                        icon: Clock,
                        filterKey: "Due Soon",
                    },
                    {
                        label: "Healthy Units",
                        value: okCountTotal,
                        color: "#10b981",
                        icon: CheckCircle2,
                        filterKey: "Healthy",
                    },
                ].map(({ label, value, color, icon: Icon, filterKey }) => {
                    const active = scheduleFilters._aggStatusLabel?.has(filterKey);
                    return (
                        <Card
                            key={label}
                            onClick={() => handleScheduleFilterChange("_aggStatusLabel", new Set([filterKey]))}
                            style={{
                                padding: "20px 24px",
                                border: active ? `2px solid ${color}` : "1px solid var(--border-subtle)",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                                transition: "border-color 0.15s",
                            }}
                        >
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: "var(--radius-md)",
                                background: `${color}15`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color,
                                flexShrink: 0,
                            }}>
                                <Icon size={22} />
                            </div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{label}</div>
                            </div>
                        </Card>
                    );
                })}

                {/* This-month cost summary */}
                {(() => {
                    const thisMonth = new Date().toISOString().slice(0, 7);
                    const monthCost = data.expenses
                        .filter(e => e.cat === "Maintenance" && (e.date || "").startsWith(thisMonth))
                        .reduce((s, e) => s + +e.amount, 0);
                    return (
                        <Card style={{ padding: "20px 24px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--brand-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)", flexShrink: 0 }}>
                                <Wrench size={22} />
                            </div>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1 }}>{fmt(monthCost)}</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>This Month</div>
                            </div>
                        </Card>
                    );
                })()}
            </div>

            {/* ── SCHEDULE VIEW ── */}
            {viewMode === 'schedule' ? (
                <Card style={{ padding: 0, overflow: "hidden", borderRadius: "var(--radius-md)" }}>
                    {/* Search bar */}
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                        <SearchIcon size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                        <input
                            type="search"
                            placeholder="Search fleet schedule..."
                            value={searchTermSched}
                            onChange={(e) => setSearchTermSched(e.target.value)}
                            style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500, outline: "none" }}
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
                                    { key: "uId",          label: "Unique ID",     sortable: true },
                                    { key: "reg",          label: "Licence Plate", sortable: true },
                                    { key: "make",         label: "Vehicle Type",  sortable: true },
                                    { key: "_odom",        label: "Odometer",      sortable: true, align: "right" },
                                    { key: "_aggStatusLabel", label: "Health Status", sortable: true },
                                    { key: "_overdue",     label: "Overdue Tasks", sortable: true, align: "right" },
                                    { key: "actions",      label: "",              sortable: false, align: "right" },
                                ]}
                            />
                            <tbody>
                                {sortedSchedule.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: "64px 20px", color: "var(--text-dim)" }}>
                                            <AlertCircle size={40} style={{ opacity: 0.2, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
                                            <div style={{ fontWeight: 600 }}>No vehicles match your filters.</div>
                                        </td>
                                    </tr>
                                ) : sortedSchedule.map(truck => {
                                    const aggregateStatus = truck._aggStatus;
                                    const truckOverdue = truck._overdue;

                                    return (
                                        <tr
                                            key={truck.id}
                                            onClick={() => navigate(`/fleet/${truck.id}`)}
                                            style={{ cursor: "pointer" }}
                                            className="hover-scale"
                                        >
                                            <td className="sticky-col" style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                                                {truck.uId || '—'}
                                            </td>
                                            <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                {truck.reg}
                                            </td>
                                            <td style={{ fontSize: 13, color: "var(--text-dim)" }}>
                                                {truck.make} {truck.type}
                                            </td>
                                            <td style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13, textAlign: "right" }}>
                                                {Number(truck._odom || 0).toLocaleString('en-KE')}
                                                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)", marginLeft: 4 }}>km</span>
                                            </td>
                                            <td className="status-col">
                                                <Badge
                                                    status={aggregateStatus === 'overdue' ? 'Overdue' : aggregateStatus === 'due' ? 'Pending' : 'Paid'}
                                                >
                                                    {statusMap[aggregateStatus].label}
                                                </Badge>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                                {truckOverdue > 0 ? (
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#ef4444", fontWeight: 700, fontSize: 13 }}>
                                                        <AlertCircle size={13} />
                                                        {truckOverdue} overdue
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "var(--text-dim)", fontSize: 13 }}>—</span>
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
                /* ── HISTORY VIEW ── */
                <Card style={{ padding: 0, overflow: "hidden", borderRadius: "var(--radius-md)" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "var(--text-primary)", flexShrink: 0 }}>
                            <History size={17} color="var(--brand-primary)" />
                            Service History
                        </div>
                        <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
                            <SearchIcon size={15} color="var(--text-dim)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                            <input
                                type="search"
                                placeholder="Search history..."
                                value={searchTermHist}
                                onChange={(e) => setSearchTermHist(e.target.value)}
                                style={{ border: "1px solid var(--border-subtle)", background: "var(--surface-subtle)", padding: "7px 12px 7px 32px", fontSize: 13, borderRadius: "var(--radius-md)", width: "100%", color: "var(--text-primary)", fontWeight: 500, outline: "none", boxSizing: "border-box" }}
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
                                    { key: "date",      label: "Date",            sortable: true },
                                    { key: "_vehicle",  label: "Vehicle",         sortable: true },
                                    { key: "desc",      label: "Task / Desc",     sortable: true },
                                    { key: "_odom",     label: "Odometer",        sortable: true, align: "right" },
                                    { key: "_workshop", label: "Workshop",        sortable: true },
                                    { key: "_cost",     label: "Cost (KES)",      sortable: true, align: "right" },
                                    { key: "actions",   label: "",                sortable: false },
                                ]}
                            />
                            <tbody>
                                {sortedHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: "64px 20px", color: "var(--text-dim)" }}>
                                            <Wrench size={40} style={{ opacity: 0.1, display: "block", margin: "0 auto 12px" }} />
                                            <div style={{ fontSize: 15, fontWeight: 600 }}>No service records found</div>
                                            <p style={{ marginTop: 4, fontSize: 13 }}>Log a new service to get started.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedHistory.map(e => (
                                        <tr
                                            key={e.id}
                                            onClick={() => navigate(`/fleet/${e.truck}`)}
                                            style={{ cursor: "pointer" }}
                                            className="hover-scale"
                                        >
                                            <td className="sticky-col" style={{ fontWeight: 600 }}>{fmtDate(e.date)}</td>
                                            <td><Badge status="Pending">{e._vehicle}</Badge></td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{e._maintenanceTask || e.desc}</div>
                                                {e._maintenanceDetails?.notes && (
                                                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{e._maintenanceDetails.notes}</div>
                                                )}
                                            </td>
                                            <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "right" }}>
                                                {e.odom ? `${Number(e.odom).toLocaleString('en-KE')} km` : '—'}
                                            </td>
                                            <td style={{ fontSize: 13 }}>{e._maintenanceDetails?.workshop || '—'}</td>
                                            <td style={{ fontWeight: 800, color: "var(--brand-primary)", textAlign: "right" }}>{fmt(e.amount)}</td>
                                            <td style={{ textAlign: "right" }}>
                                                <ChevronRight size={15} color="var(--text-dim)" />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {sortedHistory.length > 0 && (
                                <tfoot>
                                    <tr style={{ background: "var(--surface-subtle)", fontWeight: 800 }}>
                                        <td colSpan={5} style={{ textAlign: "right", color: "var(--text-dim)", padding: "12px 16px" }}>
                                            Total lifecycle investment (filtered)
                                        </td>
                                        <td style={{ color: "var(--brand-primary)", fontSize: 15, textAlign: "right", padding: "12px 16px" }}>
                                            {fmt(sortedHistory.reduce((s, e) => s + +e.amount, 0))}
                                        </td>
                                        <td />
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
