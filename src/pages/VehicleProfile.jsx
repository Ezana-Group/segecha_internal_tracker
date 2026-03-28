import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    Truck, 
    Calendar, 
    ArrowLeft, 
    Edit2, 
    Fuel, 
    Navigation, 
    Wrench, 
    FileText, 
    PieChart, 
    ArrowUpRight,
    Search,
    Wallet,
    Plus,
    Clock,
    User,
    Shield,
    Pencil,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import { fmt, fmtN, today, fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { DocumentPanel, DOC_TYPES_TRUCK } from "../components/DocumentPanel";
import { TableRowActions } from "../components/TableRowActions";
import { ProfileQuickActionTile } from "../components/ProfileQuickActionTile";

export function VehicleProfile({ data, setData, dark, isMobile, openModal, maintenanceStatus, driverName, truckReg, customerName, truckStats, setVerifyModal }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState('overview');

    const truck = data.trucks.find(t => t.id === id);

    if (!truck) return (
        <div style={{ padding: 80, textAlign: 'center' }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800 }}>Vehicle Profile Not Found</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>The requested vehicle does not exist in the active registry.</p>
            <Button variant="secondary" onClick={() => navigate('/fleet')}>Return to Fleet</Button>
        </div>
    );

    const tabs = [
        { id: 'overview',   label: 'Overview' },
        { id: 'fuel',       label: 'Fuel Log' },
        { id: 'journeys',   label: 'Journeys' },
        { id: 'maintenance', label: 'Maintenance' },
        { id: 'documents',  label: 'Documents' },
        { id: 'pnl',        label: 'P&L' },
    ];

    // ── Per-truck data
    const truckJourneys  = data.journeys.filter(j => j.truck === truck.id).sort((a,b) => b.date.localeCompare(a.date));
    const truckFuel      = data.fuel.filter(f => f.truck === truck.id).sort((a,b) => b.date.localeCompare(a.date));
    const truckExpenses  = data.expenses.filter(e => e.truck === truck.id);
    const truckRevenue   = truckJourneys.reduce((s, j) => s + +j.revenue, 0);
    const truckFuelCost  = truckFuel.reduce((s, f) => s + (f.litres * f.pricePerL), 0);
    const truckMaintCost = truckExpenses.filter(e => e.cat === 'Maintenance').reduce((s, e) => s + +e.amount, 0);
    const truckTotalCost = truckExpenses.reduce((s, e) => s + +e.amount, 0);
    const truckProfit    = truckRevenue - truckTotalCost;
    const totalKm        = truckJourneys.reduce((s, j) => s + +j.distance, 0);
    const totalLitres    = truckFuel.reduce((s, f) => s + +f.litres, 0);
    const avgKmPerL      = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : '—';
    const missingOdomJourneys = truckJourneys.filter(j => j.status === 'Completed' && (j.distance == null || String(j.distance).trim() === '' || isNaN(Number(j.distance))));

    const DEFAULT_SCHEDULE = [
        { task: 'Oil Change',                  intervalKm: 10000 },
        { task: 'Tyre Rotation',               intervalKm: 10000 },
        { task: 'Wheel Alignment & Balancing', intervalKm: 10000 },
        { task: 'Brake Disc Inspection',       intervalKm: 15000 },
        { task: 'Brake Pad Replacement',       intervalKm: 15000 },
        { task: 'Fuel Filter Replacement',     intervalKm: 20000 },
        { task: 'Power Steering Fluid Top-up', intervalKm: 20000 },
        { task: 'Engine Belt Inspection',      intervalKm: 30000 },
        { task: 'Differential Oil Change',     intervalKm: 40000 },
        { task: 'Transmission Fluid Change',   intervalKm: 40000 },
    ];

    return (
        <div className="page-shell">
            {/* Header / Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
                <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/fleet')}>Back</Button>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--brand-primary)15", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--brand-primary)" }}>
                    <Truck size={32} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.04em" }}>{truck.reg}</div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
                        {truck.make} · {truck.type} · {truck.year} · <Badge status={truck.status} />
                    </div>
                </div>
                <Button variant="premium" icon={Edit2} onClick={() => openModal('truck', truck)}>Edit Profile</Button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 6, gap: 4, marginBottom: 32, overflowX: "auto" }} className="hide-scrollbar">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            flex: 1, padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s ease",
                            background: tab === t.id ? "var(--brand-primary)" : "transparent",
                            color: tab === t.id ? "white" : "var(--text-dim)"
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Main Content Card */}
            <Card style={{ padding: 0, overflow: "hidden" }} className="animate-fade-in">
                {/* OVERVIEW */}
                {tab === 'overview' && (
                    <div style={{ padding: 32 }}>
                        {missingOdomJourneys.length > 0 && (
                            <div style={{ padding: "12px 16px", background: "#ef444415", color: "#ef4444", borderRadius: 12, marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 13, border: "1px solid #ef444430" }}>
                                <AlertCircle size={18} />
                                <div>Distance data missing — final odometer not recorded for {missingOdomJourneys.length} completed journey(s).</div>
                            </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 20, marginBottom: 40 }}>
                            {[
                                { l: 'Revenue',        v: fmt(truckRevenue),  c: '#10b981', i: Navigation },
                                { l: 'Total Costs',    v: fmt(truckTotalCost), c: '#f59e0b', i: Wallet },
                                { l: 'Net Profit',     v: fmt(truckProfit),   c: truckProfit >= 0 ? 'var(--brand-primary)' : '#ef4444', i: PieChart },
                                { l: 'Trips',          v: truckJourneys.length, c: '#3b82f6', i: Clock },
                                { l: 'Distance',       v: `${totalKm.toLocaleString()} km`, c: "var(--text-primary)", i: Navigation },
                                { l: 'Fuel Used',      v: `${totalLitres.toLocaleString()} L`, c: "var(--text-primary)", i: Fuel },
                                { l: 'Efficiency',     v: `${avgKmPerL} km/L`, c: '#a78bfa', i: ArrowUpRight },
                                { l: 'Max Payload',    v: `${truck.capacity} kg`, c: "var(--text-primary)", i: Truck },
                            ].map(k => (
                                <div key={k.l} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 20 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.l}</div>
                                        <k.i size={16} color="var(--text-dim)" />
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: k.c }}>{k.v}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: 32 }}>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                                    <Shield size={20} color="var(--brand-primary)" />
                                    Technical Information
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, background: "var(--bg-surface)", padding: 24, borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                                    {[
                                        ['Make / Model', truck.make],
                                        ['Year of Manufacture', truck.year],
                                        ['Body Type', truck.type],
                                        ['Payload Capacity', `${truck.capacity} kg`],
                                        ['Live Odometer', `${Number(truck.odom || 0).toLocaleString()} km`],
                                        ['Assigned Operator', driverName(truck.driver)],
                                        ['KRA PIN Ref', truck.kraPin || 'Unset'],
                                        ['Insurance ID', truck.insurancePolicy || 'Unset'],
                                    ].map(([l, v]) => (
                                        <div key={l}>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Quick Actions</h3>
                                <div className="profile-quick-actions">
                                    <ProfileQuickActionTile
                                        icon={Fuel}
                                        label="Log fuel entry"
                                        hint="Record litres, station, and odometer"
                                        accent="#f97316"
                                        onClick={() => openModal("fuel", { truck: truck.id, date: today() })}
                                    />
                                    <ProfileQuickActionTile
                                        icon={Navigation}
                                        label="Start new journey"
                                        hint="Open journey form with this truck"
                                        accent="#3b82f6"
                                        onClick={() => openModal("journey", { truck: truck.id, date: today(), status: "Loading" })}
                                    />
                                    <ProfileQuickActionTile
                                        icon={Wrench}
                                        label="Manage maintenance"
                                        hint="Schedules, logs, and reminders"
                                        accent="#8b5cf6"
                                        onClick={() => setTab("maintenance")}
                                    />
                                    <ProfileQuickActionTile
                                        icon={FileText}
                                        label="Document repository"
                                        hint="Permits, insurance, and files"
                                        accent="#10b981"
                                        onClick={() => setTab("documents")}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* FUEL LOG */}
                {tab === 'fuel' && (
                    <div>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Fuel Consumption Logs</h3>
                            <Button size="sm" icon={Plus} onClick={() => openModal('fuel', { truck: truck.id, date: today() })}>Add Entry</Button>
                        </div>
                        <div style={{ padding: 32 }}>
                                <div className="table-container">
                                <table className="table-modern">
                                    <thead>
                                        <tr>
                                            <th className="sticky-col" title="Date">Date</th>
                                            <th title="Station">Station</th>
                                            <th title="Litres">Litres</th>
                                            <th title="Price/L">Price/L</th>
                                            <th title="Total Cost">Total Cost</th>
                                            <th title="Odometer">Odometer</th>
                                            <th className="status-col" title="Status">Status</th>
                                            <th style={{ textAlign: "right" }} title="Actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {truckFuel.map(f => (
                                            <tr key={f.id}>
                                                <td className="sticky-col" title={fmtDate(f.date)}>{fmtDate(f.date)}</td>
                                                <td style={{ fontWeight: 700, color: "var(--text-primary)" }} title={f.station}>{f.station}</td>
                                                <td style={{ fontWeight: 600 }} title={`${f.litres} L`}>{f.litres} L</td>
                                                <td style={{ color: "var(--text-muted)" }} title={String(f.pricePerL)}>{f.pricePerL}</td>
                                                <td style={{ color: "#f97316", fontWeight: 800 }} title={fmt(f.litres * f.pricePerL)}>{fmt(f.litres * f.pricePerL)}</td>
                                                <td style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }} title={f.odom ? `${Number(f.odom).toLocaleString()} km` : 'None'}>{f.odom ? `${Number(f.odom).toLocaleString()} km` : '—'}</td>
                                                <td className="status-col" title={f._pendingApproval ? 'Pending' : 'Approved'}>
                                                    {f._pendingApproval ? <Badge status="Pending" /> : <Badge status="Approved" />}
                                                </td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                    <TableRowActions
                                                        ariaLabel={`Fuel entry ${f.id}`}
                                                        items={[
                                                            {
                                                                id: "edit",
                                                                label: "Edit entry",
                                                                icon: Pencil,
                                                                onClick: () => openModal("fuel", f),
                                                            },
                                                            ...(f._pendingApproval ? [{
                                                                id: "verify",
                                                                label: "Verify entry",
                                                                icon: CheckCircle2,
                                                                onClick: () => setVerifyModal({ ...f, _itemType: 'fuel' }),
                                                            }] : []),
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                        </div>
                    </div>
                )}

                {/* JOURNEYS */}
                {tab === 'journeys' && (
                    <div>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Historical Missions</h3>
                            <Button size="sm" icon={Plus} onClick={() => openModal('journey', { truck: truck.id, date: today(), status: 'Loading' })}>Log Journey</Button>
                        </div>
                        <div style={{ padding: 32 }}>
                                <div className="table-container">
                                <table className="table-modern">
                                    <thead>
                                        <tr>
                                            <th className="sticky-col" title="Date">Date</th>
                                            <th title="Strategic Route">Strategic Route</th>
                                            <th title="Distance">Distance</th>
                                            <th title="Revenue">Revenue</th>
                                            <th className="status-col" title="Status">Status</th>
                                            <th style={{ textAlign: "right" }} title="Actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {truckJourneys.map(j => (
                                            <tr key={j.id}>
                                                <td className="sticky-col" title={fmtDate(j.date)}>{fmtDate(j.date)}</td>
                                                <td style={{ fontWeight: 800, color: "var(--text-primary)" }} title={`${j.origin} → ${j.dest}`}>{j.origin} → {j.dest}</td>
                                                <td style={{ fontWeight: 600 }} title={`${j.distance} km`}>{j.distance} km</td>
                                                <td style={{ color: "#10b981", fontWeight: 800 }} title={fmt(j.revenue)}>{fmt(j.revenue)}</td>
                                                <td className="status-col" title={j.status}><Badge status={j.status} /></td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                    <TableRowActions
                                                        ariaLabel={`Journey ${j.id}`}
                                                        items={[
                                                            {
                                                                id: "details",
                                                                label: "View mission",
                                                                icon: ArrowUpRight,
                                                                onClick: () => navigate(`/journeys/${j.id}`),
                                                            },
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                        </div>
                    </div>
                )}

                {/* MAINTENANCE */}
                {tab === 'maintenance' && (
                    <div>
                        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Preventive Maintenance Schedule</h3>
                            <Button size="sm" icon={Wrench} onClick={() => openModal('maintenance', { truck: truck.id, task: 'Oil Change', date: today(), odom: truck.odom })}>Log Service</Button>
                        </div>
                        <div style={{ padding: 32 }}>
                            <div className="table-container">
                            <table className="table-modern">
                                <thead>
                                    <tr>
                                        <th className="sticky-col" title="System Task">System Task</th>
                                        <th title="Interval">Interval</th>
                                        <th title="Metric Since Last">Metric Since Last</th>
                                        <th title="Last Service">Last Service</th>
                                        <th className="status-col" title="Health Status">Health Status</th>
                                        <th style={{ textAlign: "right" }} title="Action">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DEFAULT_SCHEDULE.map(s => {
                                        const odom = +truck.odom || 0;
                                        const history = data.expenses.filter(e => e.truck === truck.id && e.cat === 'Maintenance' && e.desc?.toLowerCase().includes(s.task.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
                                        const lastDate = history.length > 0 ? history[0].date : null;
                                        const lastOdom = history.length > 0 ? +(history[0].odom || 0) : 0;
                                        const kmSince = odom - lastOdom;
                                        const remaining = s.intervalKm - kmSince;
                                        const status = remaining <= 0 ? 'Overdue' : remaining <= s.intervalKm * 0.1 ? 'Due Soon' : 'OK';
                                        
                                        return (
                                            <tr key={s.task}>
                                                <td className="sticky-col" style={{ fontWeight: 800, color: "var(--text-primary)" }} title={s.task}>{s.task}</td>
                                                <td style={{ color: "var(--text-dim)", fontSize: 12 }} title={`Every ${s.intervalKm.toLocaleString()} km`}>Every {s.intervalKm.toLocaleString()} km</td>
                                                <td style={{ fontWeight: 600 }} title={`${kmSince.toLocaleString()} km ago`}>{kmSince.toLocaleString()} km <small style={{ color: "var(--text-dim)", fontWeight: 500 }}>ago</small></td>
                                                <td style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }} title={fmtDate(lastDate)}>{fmtDate(lastDate)}</td>
                                                <td className="status-col" title={status}><Badge status={status} /></td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                    <TableRowActions
                                                        ariaLabel={`Service ${s.task}`}
                                                        items={[
                                                            {
                                                                id: "log",
                                                                label: "Log service",
                                                                icon: Wrench,
                                                                onClick: () =>
                                                                    openModal("maintenance", {
                                                                        truck: truck.id,
                                                                        task: s.task,
                                                                        date: today(),
                                                                        odom: truck.odom,
                                                                    }),
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
                    </div>
                )}

                {/* DOCUMENTS */}
                {tab === 'documents' && (
                    <div style={{ padding: 32 }}>
                        <DocumentPanel 
                            entityType="truck" 
                            entityId={truck.id} 
                            entityLabel={truck.reg} 
                            docTypes={DOC_TYPES_TRUCK} 
                            documents={data.documents}
                            setDocuments={(docs) => setData(d => ({ ...d, documents: typeof docs === 'function' ? docs(d.documents) : docs }))}
                            dark={dark}
                        />
                    </div>
                )}

                {/* P&L */}
                {tab === 'pnl' && (
                    <div style={{ padding: 32 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
                            {[
                                ['Operational Revenue', truckRevenue, '#10b981'], 
                                ['Total Direct Costs', truckTotalCost, '#ef4444'], 
                                ['Net Performance', truckProfit, truckProfit >= 0 ? '#3b82f6' : '#ef4444'], 
                                ['Fuel Expenditure', truckFuelCost, '#f97316'], 
                                ['Repair & Maintenance', truckMaintCost, '#f59e0b'], 
                                ['Profit Margin', truckRevenue > 0 ? ((truckProfit / truckRevenue) * 100).toFixed(1) + '%' : '—', truckProfit >= 0 ? '#10b981' : '#ef4444']
                            ].map(([l, v, c]) => (
                                <div key={l} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24, boxShadow: "var(--glass-shadow)" }}>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{l}</div>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{typeof v === 'number' ? fmt(v) : v}</div>
                                </div>
                            ))}
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Detailed Expense Ledger</h3>
                        {truckExpenses.length === 0 ? <div style={{ color: "var(--text-dim)", padding: 60, textAlign: 'center' }}>No expenses recorded for this vehicle.</div> : (
                        <div className="table-container">
                            <table className="table-modern">
                                <thead><tr>{['Date', 'Classification', 'Description', 'Amount', 'Status', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {truckExpenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e => (
                                        <tr key={e.id}>
                                            <td>{fmtDate(e.date)}</td>
                                            <td><Badge status={e.cat} /></td>
                                            <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{e.desc}</td>
                                            <td style={{ color: "#ef4444", fontWeight: 800 }}>{fmt(e.amount)}</td>
                                            <td>
                                                {e._pendingApproval ? <Badge status="Pending" /> : <Badge status="Approved" />}
                                            </td>
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Expense entry ${e.id}`}
                                                    items={[
                                                        {
                                                            id: "edit",
                                                            label: "Edit entry",
                                                            icon: Pencil,
                                                            onClick: () => openModal("expenses", e),
                                                        },
                                                        ...(e._pendingApproval ? [{
                                                            id: "verify",
                                                            label: "Verify entry",
                                                            icon: CheckCircle2,
                                                            onClick: () => setVerifyModal({ ...e, _itemType: 'expense' }),
                                                        }] : []),
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}
