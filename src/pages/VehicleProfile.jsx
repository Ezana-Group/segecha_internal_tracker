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
} from "lucide-react";
import { fmt, fmtN, today, fmtDate, fmtKgLabel, displayRecordId } from "../utils/formatters";
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
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
                <Truck size={56} opacity={0.12} />
            </div>
            <h2 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Vehicle Not Found</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>The requested vehicle does not exist in the active registry.</p>
            <Button variant="secondary" onClick={() => navigate('/fleet')}>Return to Fleet</Button>
        </div>
    );

    const tabs = [
        { id: 'overview',    label: 'Overview' },
        { id: 'fuel',        label: 'Fuel Log' },
        { id: 'journeys',    label: 'Journeys' },
        { id: 'maintenance', label: 'Maintenance' },
        { id: 'documents',   label: 'Documents' },
        { id: 'pnl',         label: 'P&L' },
    ];

    // Per-truck data
    const truckJourneys  = data.journeys.filter(j => j.truck === truck.id).sort((a, b) => b.date.localeCompare(a.date));
    const truckFuel      = data.fuel.filter(f => f.truck === truck.id).sort((a, b) => b.date.localeCompare(a.date));
    const truckExpenses  = data.expenses.filter(e => e.truck === truck.id);
    const truckRevenue   = truckJourneys.reduce((s, j) => s + +j.revenue, 0);
    const truckFuelCost  = truckFuel.reduce((s, f) => s + (f.litres * f.pricePerL), 0);
    const truckMaintCost = truckExpenses.filter(e => e.cat === 'Maintenance').reduce((s, e) => s + +e.amount, 0);
    const truckTotalCost = truckExpenses.reduce((s, e) => s + +e.amount, 0);
    const truckProfit    = truckRevenue - truckTotalCost;
    const totalKm        = truckJourneys.reduce((s, j) => s + +j.distance, 0);
    const totalLitres    = truckFuel.reduce((s, f) => s + +f.litres, 0);
    const avgKmPerL      = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : '—';

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

    // Maintenance health summary
    const maintSummary = DEFAULT_SCHEDULE.map(s => {
        const odom = +truck.odom || 0;
        const history = data.expenses.filter(e => e.truck === truck.id && e.cat === 'Maintenance' && e.desc?.toLowerCase().includes(s.task.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
        const lastOdom = history.length > 0 ? +(history[0].odom || 0) : 0;
        const kmSince = odom - lastOdom;
        const remaining = s.intervalKm - kmSince;
        const status = remaining <= 0 ? 'Overdue' : remaining <= s.intervalKm * 0.1 ? 'Due Soon' : 'OK';
        return { ...s, status };
    });
    const overdueCount = maintSummary.filter(s => s.status === 'Overdue').length;
    const dueSoonCount = maintSummary.filter(s => s.status === 'Due Soon').length;
    const healthLabel = overdueCount > 0 ? 'Critical Service' : dueSoonCount > 0 ? 'Service Due' : 'Healthy';
    const healthBadgeStatus = overdueCount > 0 ? 'Overdue' : dueSoonCount > 0 ? 'Pending' : 'Active';

    return (
        <div className="page-shell">
            {/* Back + Header */}
            <div style={{ marginBottom: 28 }}>
                {/* Back button */}
                <button
                    type="button"
                    onClick={() => navigate('/fleet')}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 20,
                        background: "none",
                        border: "none",
                        color: "var(--text-dim)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "4px 0",
                    }}
                >
                    <ArrowLeft size={14} />
                    Fleet
                </button>

                {/* Truck identity header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                        flexWrap: "wrap",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: isMobile ? "20px 16px" : "24px 28px",
                    }}
                >
                    {/* Truck icon */}
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: "var(--brand-primary)18",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--brand-primary)",
                            flexShrink: 0,
                        }}
                    >
                        <Truck size={28} />
                    </div>

                    {/* Title + subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: isMobile ? 24 : 32,
                                fontWeight: 900,
                                color: "var(--text-primary)",
                                lineHeight: 1.1,
                                letterSpacing: "-0.03em",
                                fontFamily: "var(--font-mono)",
                                marginBottom: 6,
                            }}
                        >
                            {truck.reg}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 6 }} title={truck.id !== displayRecordId(truck) ? `Internal id: ${truck.id}` : undefined}>
                            {displayRecordId(truck)}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                flexWrap: "wrap",
                                fontSize: 13,
                                color: "var(--text-dim)",
                                fontWeight: 500,
                            }}
                        >
                            <span>{truck.make || "—"}</span>
                            <span style={{ opacity: 0.3 }}>·</span>
                            <span>{truck.model || "—"}</span>
                            <span style={{ opacity: 0.3 }}>·</span>
                            <span>{truck.type}</span>
                            {truck.year && (
                                <>
                                    <span style={{ opacity: 0.3 }}>·</span>
                                    <span>{truck.year}</span>
                                </>
                            )}
                            <Badge status={truck.status} />
                        </div>
                    </div>

                    {/* Edit button */}
                    <Button
                        variant="premium"
                        icon={Edit2}
                        onClick={() => openModal('truck', truck)}
                    >
                        Edit Profile
                    </Button>
                </div>
            </div>

            {/* 3-card info row */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                    gap: 16,
                    marginBottom: 28,
                }}
            >
                {/* Vehicle Info */}
                <div
                    style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "20px 22px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 16,
                        }}
                    >
                        <Shield size={15} color="var(--brand-primary)" />
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
                            Vehicle Info
                        </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                        {[
                            ["Reg", truck.reg],
                            ["Manufacturer", truck.make || "—"],
                            ["Model", truck.model || "—"],
                            ["Type", truck.type],
                            ["Year", truck.year || "—"],
                            ["Fuel Type", truck.fuelType || "—"],
                            ["Engine (CC)", truck.engineCC || "—"],
                            ["Axles", truck.axleCount || "—"],
                            ["Tare (kg)", truck.tareWeightKg ? Number(truck.tareWeightKg).toLocaleString() : "—"],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Financial Summary */}
                <div
                    style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "20px 22px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 16,
                        }}
                    >
                        <Wallet size={15} color="#10b981" />
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
                            Financial Summary
                        </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                            ["Total Revenue", fmt(truckRevenue), "#10b981"],
                            ["Total Expenses", fmt(truckTotalCost), "#ef4444"],
                            ["Net Profit", fmt(truckProfit), truckProfit >= 0 ? "var(--brand-primary)" : "#ef4444"],
                        ].map(([label, value, color]) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>{label}</span>
                                <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Maintenance Status */}
                <div
                    style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        padding: "20px 22px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 16,
                        }}
                    >
                        <Wrench size={15} color="#8b5cf6" />
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
                            Maintenance Status
                        </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Odometer</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                                {Number(truck.odom || 0).toLocaleString()} km
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Health</span>
                            <Badge status={healthBadgeStatus} text={healthLabel} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Overdue items</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: overdueCount > 0 ? "#ef4444" : "var(--text-primary)" }}>
                                {overdueCount}
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Due soon</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: dueSoonCount > 0 ? "#f59e0b" : "var(--text-primary)" }}>
                                {dueSoonCount}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div
                style={{
                    display: "flex",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 16,
                    padding: 6,
                    gap: 4,
                    marginBottom: 24,
                    overflowX: "auto",
                }}
                className="hide-scrollbar"
            >
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            flex: 1,
                            padding: "9px 16px",
                            borderRadius: 10,
                            border: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.2s ease",
                            background: tab === t.id ? "var(--brand-primary)" : "transparent",
                            color: tab === t.id ? "white" : "var(--text-dim)",
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <Card style={{ padding: 0, overflow: "hidden" }} className="animate-fade-in">
                {/* OVERVIEW */}
                {tab === 'overview' && (
                    <div style={{ padding: isMobile ? 20 : 32 }}>
                        {/* Stat tiles */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
                                gap: 16,
                                marginBottom: 36,
                            }}
                        >
                            {[
                                { l: 'Revenue',     v: fmt(truckRevenue),                      c: '#10b981',               i: Navigation },
                                { l: 'Total Costs', v: fmt(truckTotalCost),                    c: '#f59e0b',               i: Wallet },
                                { l: 'Net Profit',  v: fmt(truckProfit),                       c: truckProfit >= 0 ? 'var(--brand-primary)' : '#ef4444', i: PieChart },
                                { l: 'Trips',       v: truckJourneys.length,                   c: '#3b82f6',               i: Clock },
                                { l: 'Distance',    v: `${totalKm.toLocaleString()} km`,       c: "var(--text-primary)",   i: Navigation },
                                { l: 'Fuel Used',   v: `${totalLitres.toLocaleString()} L`,    c: "var(--text-primary)",   i: Fuel },
                                { l: 'Efficiency',  v: `${avgKmPerL} km/L`,                    c: '#a78bfa',               i: ArrowUpRight },
                                { l: 'Load Capacity', v: fmtKgLabel(truck.capacity), c: "var(--text-primary)", i: Truck },
                            ].map(k => (
                                <div
                                    key={k.l}
                                    style={{
                                        background: "var(--bg-surface)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: 14,
                                        padding: "16px 18px",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {k.l}
                                        </div>
                                        <k.i size={14} color="var(--text-dim)" />
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: k.c }}>{k.v}</div>
                                </div>
                            ))}
                        </div>

                        {/* Technical info + quick actions */}
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 28 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                    <Shield size={17} color="var(--brand-primary)" />
                                    Technical Information
                                </h3>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "20px 24px",
                                        background: "var(--bg-surface)",
                                        padding: "22px 24px",
                                        borderRadius: 18,
                                        border: "1px solid var(--border-subtle)",
                                    }}
                                >
                                    {[
                                        ['Manufacturer',         truck.make || '—'],
                                        ['Model',                truck.model || '—'],
                                        ['Year of Manufacture',  truck.year],
                                        ['Body Type',            truck.type],
                                        ['Fuel Type',            truck.fuelType || '—'],
                                        ['Engine Rating',        truck.engineCC ? `${truck.engineCC} CC` : '—'],
                                        ['Axles',                truck.axleCount || '—'],
                                        ['Tare Weight',          fmtKgLabel(truck.tareWeightKg)],
                                        ['Load Capacity',        fmtKgLabel(truck.capacity)],
                                        ['Gross Weight',         fmtKgLabel(truck.grossWeightKg)],
                                        ['Date Registered',      truck.registeredOn || '—'],
                                        ['Live Odometer',        `${Number(truck.odom || 0).toLocaleString()} km`],
                                        ['Assigned Operator',    driverName(truck.driver)],
                                        ['KRA PIN Ref',          truck.kraPin || 'Unset'],
                                        ['Insurance ID',         truck.insurancePolicy || 'Unset'],
                                    ].map(([l, v]) => (
                                        <div key={l}>
                                            <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>Quick Actions</h3>
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
                        <div
                            style={{
                                padding: "20px 28px",
                                borderBottom: "1px solid var(--border-subtle)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Fuel Consumption Logs</h3>
                            <Button size="sm" icon={Plus} onClick={() => openModal('fuel', { truck: truck.id, date: today() })}>
                                Add Entry
                            </Button>
                        </div>
                        <div style={{ padding: isMobile ? 16 : 28 }}>
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
                                                <td style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }} title={f.odom ? `${Number(f.odom).toLocaleString()} km` : 'None'}>
                                                    {f.odom ? `${Number(f.odom).toLocaleString()} km` : '—'}
                                                </td>
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
                        <div
                            style={{
                                padding: "20px 28px",
                                borderBottom: "1px solid var(--border-subtle)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Journey History</h3>
                            <Button size="sm" icon={Plus} onClick={() => openModal('journey', { truck: truck.id, date: today(), status: 'Loading' })}>
                                Log Journey
                            </Button>
                        </div>
                        <div style={{ padding: isMobile ? 16 : 28 }}>
                            <div className="table-container">
                                <table className="table-modern">
                                    <thead>
                                        <tr>
                                            <th className="sticky-col" title="Date">Date</th>
                                            <th title="Route">Route</th>
                                            <th title="Distance">Distance</th>
                                            <th title="Revenue">Revenue</th>
                                            <th className="status-col" title="Status">Status</th>
                                            <th style={{ textAlign: "right" }} title="Actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {truckJourneys.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: "center", padding: 60, color: "var(--text-dim)" }}>
                                                    <Navigation size={40} opacity={0.12} style={{ margin: "0 auto 12px" }} />
                                                    <div style={{ fontWeight: 600 }}>No journeys recorded yet.</div>
                                                </td>
                                            </tr>
                                        ) : truckJourneys.map(j => (
                                            <tr key={j.id}>
                                                <td className="sticky-col" title={fmtDate(j.date)}>{fmtDate(j.date)}</td>
                                                <td style={{ fontWeight: 800, color: "var(--text-primary)" }} title={`${j.origin} → ${j.dest}`}>
                                                    {j.origin} → {j.dest}
                                                </td>
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
                        <div
                            style={{
                                padding: "20px 28px",
                                borderBottom: "1px solid var(--border-subtle)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Preventive Maintenance Schedule</h3>
                            <Button
                                size="sm"
                                icon={Wrench}
                                onClick={() => openModal('maintenance', { truck: truck.id, task: 'Oil Change', date: today(), odom: truck.odom })}
                            >
                                Log Service
                            </Button>
                        </div>
                        <div style={{ padding: isMobile ? 16 : 28 }}>
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
                                            const history = data.expenses.filter(e =>
                                                e.truck === truck.id &&
                                                e.cat === 'Maintenance' &&
                                                e.desc?.toLowerCase().includes(s.task.toLowerCase())
                                            ).sort((a, b) => b.date.localeCompare(a.date));
                                            const lastDate = history.length > 0 ? history[0].date : null;
                                            const lastOdom = history.length > 0 ? +(history[0].odom || 0) : 0;
                                            const kmSince = odom - lastOdom;
                                            const remaining = s.intervalKm - kmSince;
                                            const status = remaining <= 0 ? 'Overdue' : remaining <= s.intervalKm * 0.1 ? 'Due Soon' : 'OK';

                                            return (
                                                <tr key={s.task}>
                                                    <td className="sticky-col" style={{ fontWeight: 800, color: "var(--text-primary)" }} title={s.task}>
                                                        {s.task}
                                                    </td>
                                                    <td style={{ color: "var(--text-dim)", fontSize: 12 }} title={`Every ${s.intervalKm.toLocaleString()} km`}>
                                                        Every {s.intervalKm.toLocaleString()} km
                                                    </td>
                                                    <td style={{ fontWeight: 600 }} title={`${kmSince.toLocaleString()} km ago`}>
                                                        {kmSince.toLocaleString()} km <small style={{ color: "var(--text-dim)", fontWeight: 500 }}>ago</small>
                                                    </td>
                                                    <td style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }} title={fmtDate(lastDate)}>
                                                        {fmtDate(lastDate)}
                                                    </td>
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
                    <div style={{ padding: isMobile ? 16 : 32 }}>
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
                    <div style={{ padding: isMobile ? 16 : 32 }}>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                                gap: 20,
                                marginBottom: 36,
                            }}
                        >
                            {[
                                ['Operational Revenue',  truckRevenue,   '#10b981'],
                                ['Total Direct Costs',   truckTotalCost, '#ef4444'],
                                ['Net Performance',      truckProfit,    truckProfit >= 0 ? '#3b82f6' : '#ef4444'],
                                ['Fuel Expenditure',     truckFuelCost,  '#f97316'],
                                ['Repair & Maintenance', truckMaintCost, '#f59e0b'],
                                ['Profit Margin',        truckRevenue > 0 ? ((truckProfit / truckRevenue) * 100).toFixed(1) + '%' : '—', truckProfit >= 0 ? '#10b981' : '#ef4444'],
                            ].map(([l, v, c]) => (
                                <div
                                    key={l}
                                    style={{
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: 16,
                                        padding: "20px 22px",
                                        boxShadow: "var(--glass-shadow)",
                                    }}
                                >
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                                        {l}
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: c }}>
                                        {typeof v === 'number' ? fmt(v) : v}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 18 }}>Detailed Expense Ledger</h3>
                        {truckExpenses.length === 0 ? (
                            <div style={{ color: "var(--text-dim)", padding: 60, textAlign: "center" }}>No expenses recorded for this vehicle.</div>
                        ) : (
                            <div className="table-container">
                                <table className="table-modern">
                                    <thead>
                                        <tr>
                                            {['Date', 'Classification', 'Description', 'Amount', 'Status', 'Actions'].map(h => (
                                                <th key={h}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {truckExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                                            <tr key={e.id}>
                                                <td>{fmtDate(e.date)}</td>
                                                <td><Badge status={e.cat} /></td>
                                                <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{e.desc}</td>
                                                <td style={{ color: "#ef4444", fontWeight: 800 }}>{fmt(e.amount)}</td>
                                                <td>{e._pendingApproval ? <Badge status="Pending" /> : <Badge status="Approved" />}</td>
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
