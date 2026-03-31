import React, { useState } from "react";
import { useTableFilter } from "../hooks/useTableFilter";
import {
    Route as RouteIcon,
    Truck,
    User,
    Calendar,
    Navigation,
    Clock,
    CheckCircle2,
    Plus,
    ChevronRight,
    Search as SearchIcon,
    Trash2,
    FileText,
    Droplet,
    Receipt,
    DollarSign,
    ArrowRight,
    MapPin,
    Filter
} from "lucide-react";
import { fmt, today, uid, fmtDate } from "../utils/formatters";
import { STATUSES_JOURNEY, CARGO_TYPES } from "../constants/nav";
import { validators } from "../utils/validators";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { mergeFlatPermissionOverrides, useMergedProfilePermissions } from "../utils/profilePermissions.js";

export function Journeys({ data, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, filterTruck, setFilterTruck, driverName, truckReg, customerName, setVerifyModal, openWaybillGenerator, previewMode }) {
    const navigate = useNavigate();
    const isDriverPreview = previewMode?.role === "driver";
    const mergedPerm = useMergedProfilePermissions();
    const previewDriver = isDriverPreview ? data.drivers?.find((d) => d.id === previewMode.entityId) : null;
    const jp = isDriverPreview
        ? mergeFlatPermissionOverrides(mergedPerm.driverPreviewJourneys, previewDriver?.permissionOverrides?.driverPreviewJourneys)
        : null;
    const jpv = (key) => !jp || jp[key] !== false;
    const scopeJourneys = isDriverPreview
        ? data.journeys.filter((j) => j.driver === previewMode.entityId)
        : data.journeys;

    const jStatusFilter = form._jStatusFilter || "ALL";

    const refinedJourneys = scopeJourneys.map(j => ({
        ...j,
        _customer: customerName(j.customerId),
        _vehicle: truckReg(j.truck),
        _distance: Number(j.distance || 0),
        _revenue: Number(j.revenue || 0)
    })).filter(j => {
        const matchesTruck = filterTruck === "ALL" || j.truck === filterTruck;
        const matchesStatus = jStatusFilter === "ALL" || j.status === jStatusFilter;
        return matchesTruck && matchesStatus;
    });

    const {
        filteredRows: sortedItems,
        applyFilter: handleJourneyFilterChange,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: journeyFilters,
        getUniqueValues,
        isFiltered,
        isSorted,
        searchTerm,
        setSearchTerm
    } = useTableFilter(refinedJourneys, {
        namespace: "missions",
        initialSort: { col: 'date', dir: 'desc' },
        searchColumns: ["id", "origin", "dest", "cargo", "_customer", "waybillNo"]
    });

    const totalDistanceFiltered = sortedItems.reduce((s, j) => s + (j._distance || 0), 0);
    const totalRevenueFiltered = sortedItems.reduce((s, j) => s + (j._revenue || 0), 0);
    const ongoingCount = sortedItems.filter(j => ["Loading", "In Transit", "Awaiting Start Verification"].includes(j.status)).length;

    const stats = [
        { label: "Missions", value: sortedItems.length, unit: "filtered", icon: RouteIcon, color: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
        { label: "Distance", value: totalDistanceFiltered.toLocaleString(), unit: "km", icon: Navigation, color: "#8b5cf6", bg: "rgba(139,92,246,0.10)" },
        { label: "Revenue", value: fmt(totalRevenueFiltered), unit: "earned", icon: DollarSign, color: "#10b981", bg: "rgba(16,185,129,0.10)" },
        { label: "Active trips", value: ongoingCount, unit: "ongoing", icon: Clock, color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
    ];

    return (
        <div className="page-shell">
            <PageHeader
                icon={RouteIcon}
                title={isDriverPreview ? "My trips" : "Journey operations"}
                description={
                    isDriverPreview ? (
                        jpv("pageDescription") ? (
                            <><span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{scopeJourneys.length}</span>{" "}trips assigned to you (preview)</>
                        ) : (
                            <><span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{scopeJourneys.length}</span> trips</>
                        )
                    ) : (
                        <><span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{data.journeys.length}</span> trips on record</>
                    )
                }
                actions={
                    !isDriverPreview ? (
                        <Button
                            icon={Plus}
                            onClick={() => openModal("journey", { date: new Date().toISOString().split("T")[0], status: "Loading" })}
                        >
                            New journey
                        </Button>
                    ) : null
                }
            />

            {/* ── Stats row ─────────────────────────────────────── */}
            {(!isDriverPreview || jpv("statsRow")) && (
                <div className="journeys-stats">
                    {stats.map(({ label, value, unit, icon: Icon, color, bg }) => (
                        <div key={label} style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 18,
                            padding: "20px 22px",
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            boxShadow: "var(--shadow-xs)",
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 14,
                                background: bg, color,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                            }}>
                                <Icon size={22} strokeWidth={2} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{unit}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Pending Fuel & Expense Approvals ──────────────── */}
            {(!isDriverPreview && data.pendingVerifications?.some(v => v._itemType !== 'journey')) && (
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 8px #8b5cf6", display: "inline-block", flexShrink: 0 }} />
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Pending approvals
                        </h3>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                        {data.pendingVerifications.filter(v => v._itemType !== 'journey').map(v => (
                            <div
                                key={v.id}
                                onClick={() => setVerifyModal(v)}
                                className="hover-scale"
                                style={{
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 14,
                                    padding: "14px 16px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                    transition: "all 0.18s",
                                }}
                            >
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: "rgba(139,92,246,0.10)",
                                    color: "#8b5cf6",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    {v._itemType === "fuel" ? <Droplet size={18} /> : <Receipt size={18} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                                        {v._itemType === "fuel" ? "Fuel log" : "Expense"} · {truckReg(v.truck)}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {v._itemType === "fuel" ? `${v.litres}L at ${v.station}` : `${fmt(v.amount)} — ${v.cat}`}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(v.date)}</div>
                                </div>
                                <ChevronRight size={15} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Journeys table ────────────────────────────────── */}
            <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 20,
                overflow: "clip",
                boxShadow: "var(--shadow-xs)",
            }}>
                {/* Toolbar: search + filters */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    flexWrap: "wrap",
                    background: "var(--surface-subtle)",
                }}>
                    {/* Search */}
                    <div style={{
                        flex: "1 1 200px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 10,
                        padding: "8px 12px",
                    }}>
                        <SearchIcon size={15} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                        <input
                            type="search"
                            placeholder="Search missions, routes, clients…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                border: "none", background: "none", padding: 0,
                                fontSize: 13, flex: 1,
                                color: "var(--text-primary)", fontWeight: 500,
                                outline: "none",
                            }}
                        />
                    </div>

                    {/* Filters */}
                    {!isDriverPreview && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Filter size={13} color="var(--text-dim)" />
                                <select
                                    className="input-premium"
                                    style={{ fontSize: 12, height: 36, paddingTop: 0, paddingBottom: 0, minWidth: 130 }}
                                    value={filterTruck}
                                    onChange={(e) => setFilterTruck(e.target.value)}
                                >
                                    <option value="ALL">All vehicles</option>
                                    {data.trucks.map((t) => (
                                        <option key={t.id} value={t.id}>{t.reg}</option>
                                    ))}
                                </select>
                            </div>
                            <select
                                className="input-premium"
                                style={{ fontSize: 12, height: 36, paddingTop: 0, paddingBottom: 0, minWidth: 140 }}
                                value={jStatusFilter}
                                onChange={(e) => setForm((f) => ({ ...f, _jStatusFilter: e.target.value }))}
                            >
                                <option value="ALL">All statuses</option>
                                {["Loading", "In Transit", "Awaiting Start Verification", "Awaiting Verification", "Completed", "Cancelled"].map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="table-container">
                    <table className="table-modern journeys-matrix-table">
                        <SortableTableHead
                            requestSort={requestSort}
                            sortConfig={sortConfig}
                            filterState={journeyFilters}
                            onFilterChange={handleJourneyFilterChange}
                            getUniqueValues={getUniqueValues}
                            isFiltered={isFiltered}
                            isSorted={isSorted}
                            columns={[
                                { key: "uId",       label: "Mission ID",  sortable: !isDriverPreview || jpv("colMissionId") },
                                { key: "date",      label: "Departure",   sortable: !isDriverPreview || jpv("colDate") },
                                { key: "origin",    label: "Origin",      sortable: !isDriverPreview || jpv("colRoute") },
                                { key: "dest",      label: "Destination", sortable: !isDriverPreview || jpv("colRoute") },
                                { key: "_customer", label: "Client",      sortable: !isDriverPreview || jpv("colClient"),   className: "col-hide-lg" },
                                { key: "_vehicle",  label: "Vehicle",     sortable: !isDriverPreview || jpv("colVehicle"),  className: "col-hide-md" },
                                { key: "driver",    label: "Crew",        sortable: !isDriverPreview || jpv("colCrew"),     className: "col-hide-lg" },
                                { key: "cargoType", label: "Cargo",       sortable: !isDriverPreview || jpv("colCargo"),    className: "col-hide-xl" },
                                { key: "_distance", label: "Distance",    sortable: !isDriverPreview || jpv("colDistance"), className: "col-hide-xl", align: "right" },
                                { key: "notes",     label: "Notes",       sortable: !isDriverPreview || jpv("colNotes"),    className: "col-hide-xl" },
                                { key: "_revenue",  label: "Revenue",     sortable: !isDriverPreview || jpv("colRevenue"),  className: "col-hide-md", align: "right" },
                                { key: "status",    label: "Status",      sortable: !isDriverPreview || jpv("colStatus") },
                                { key: "actions",   label: "Actions",     sortable: false, align: "right" },
                            ].filter(c => c.sortable !== false || c.key === "actions")}
                        />
                        <tbody>
                            {sortedItems.length > 0 ? (
                                sortedItems.map((j) => (
                                    <tr
                                        key={j.id}
                                        onClick={() => {
                                            if (isDriverPreview && !jpv("actionViewJourney")) return;
                                            navigate(`/journeys/${j.id}`);
                                        }}
                                        style={{ cursor: isDriverPreview && !jpv("actionViewJourney") ? "default" : "pointer" }}
                                        className="hover-scale"
                                    >
                                        {/* Mission ID — sticky */}
                                        {(!isDriverPreview || jpv("colMissionId")) && (
                                            <td className="sticky-col" title={j.uId || j.id.slice(0, 8).toUpperCase()}>
                                                <span style={{
                                                    fontWeight: 700,
                                                    color: "var(--brand-primary)",
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: 11,
                                                    background: "var(--surface-subtle)",
                                                    padding: "3px 8px",
                                                    borderRadius: 6,
                                                    display: "inline-block",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {j.uId || j.id.slice(0, 8).toUpperCase()}
                                                </span>
                                            </td>
                                        )}

                                        {/* Departure */}
                                        {(!isDriverPreview || jpv("colDate")) && (
                                            <td title={fmtDate(j.date)}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--text-primary)", fontSize: 13, whiteSpace: "nowrap" }}>
                                                    <Calendar size={12} color="var(--text-dim)" />
                                                    {fmtDate(j.date)}
                                                </div>
                                            </td>
                                        )}

                                        {/* Origin */}
                                        {(!isDriverPreview || jpv("colRoute")) && (
                                            <td title={j.origin}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                                                    <MapPin size={11} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                                                    {j.origin}
                                                </div>
                                            </td>
                                        )}

                                        {/* Destination */}
                                        {(!isDriverPreview || jpv("colRoute")) && (
                                            <td title={j.dest}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                                                    <ArrowRight size={11} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                                                    {j.dest}
                                                </div>
                                            </td>
                                        )}

                                        {/* Client */}
                                        {(!isDriverPreview || jpv("colClient")) && (
                                            <td className="col-hide-lg" title={customerName(j.customerId)}>
                                                {j.customerId ? (
                                                    <button
                                                        type="button"
                                                        className="journeys-table-link"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/customers/${j.customerId}`); }}
                                                    >
                                                        <User size={12} strokeWidth={2} aria-hidden />
                                                        {customerName(j.customerId)}
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>—</span>
                                                )}
                                            </td>
                                        )}

                                        {/* Vehicle */}
                                        {(!isDriverPreview || jpv("colVehicle")) && (
                                            <td className="col-hide-md" title={truckReg(j.truck)}>
                                                <button
                                                    type="button"
                                                    className="journeys-table-link"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/fleet/${j.truck}`); }}
                                                >
                                                    <Truck size={12} strokeWidth={2} aria-hidden />
                                                    {truckReg(j.truck)}
                                                </button>
                                            </td>
                                        )}

                                        {/* Crew */}
                                        {(!isDriverPreview || jpv("colCrew")) && (
                                            <td className="col-hide-lg" title={driverName(j.driver)}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                                                    <User size={12} color="var(--text-dim)" strokeWidth={2} aria-hidden />
                                                    {driverName(j.driver)}
                                                </div>
                                            </td>
                                        )}

                                        {/* Cargo */}
                                        {(!isDriverPreview || jpv("colCargo")) && (
                                            <td className="col-hide-xl" title={`${j.cargo || "General cargo"} ${j.weight ? `(${j.weight} T)` : ""}`}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{j.cargo || "General cargo"}</div>
                                                {j.weight != null && j.weight !== "" && (
                                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{j.weight} T</div>
                                                )}
                                            </td>
                                        )}

                                        {/* Distance */}
                                        {(!isDriverPreview || jpv("colDistance")) && (
                                            <td className="col-hide-xl" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }} title={j.distance != null && j.distance !== "" ? `${Number(j.distance).toLocaleString()} km` : "—"}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                                                    {j.distance != null && j.distance !== "" ? `${Number(j.distance).toLocaleString()} km` : "—"}
                                                </div>
                                            </td>
                                        )}

                                        {/* Notes */}
                                        {(!isDriverPreview || jpv("colNotes")) && (
                                            <td className="journeys-col-notes col-hide-xl" title={j.notes && String(j.notes).trim() ? String(j.notes).trim() : "—"}>
                                                {j.notes && String(j.notes).trim() ? (
                                                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{String(j.notes).trim()}</span>
                                                ) : (
                                                    <span style={{ color: "var(--text-dim)" }}>—</span>
                                                )}
                                            </td>
                                        )}

                                        {/* Revenue */}
                                        {(!isDriverPreview || jpv("colRevenue")) && (
                                            <td className="col-hide-md" style={{ textAlign: "right" }} title={fmt(j.revenue)}>
                                                <div style={{ fontWeight: 800, color: "#10b981", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{fmt(j.revenue)}</div>
                                                {j.driverMileage && (!isDriverPreview || jpv("colAllowanceSubline")) && (
                                                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                                        Allowance {fmt(j.driverMileage)}
                                                        {j.mileageRouteOverride && (
                                                            <span style={{ background: "var(--brand-primary)15", color: "var(--brand-primary)", padding: "1px 4px", borderRadius: 4, fontSize: 8, fontWeight: 800 }}>ROUTE RATE</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        )}

                                        {/* Status */}
                                        {(!isDriverPreview || jpv("colStatus")) && (
                                            <td className="status-col" title={j._isRejected ? "Rejected" : j.status}>
                                                <Badge status={j._isRejected ? "Rejected" : j.status} />
                                            </td>
                                        )}

                                        {/* Actions */}
                                        {(!isDriverPreview || jpv("actionWaybill") || jpv("actionViewJourney")) && (
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Actions for journey ${j.uId || j.id}`}
                                                    items={[
                                                        ...(openWaybillGenerator && (!isDriverPreview || jpv("actionWaybill"))
                                                            ? [{ id: "waybill", label: j.waybillGenerated && j.waybillNo ? `Waybill · ${j.waybillNo}` : "Waybill", icon: FileText, onClick: (e) => { e.stopPropagation(); openWaybillGenerator(j); } }]
                                                            : []),
                                                        ...(["Awaiting Verification", "Awaiting Start Verification"].includes(j.status) && !isDriverPreview
                                                            ? [{ id: "verify", label: j.status === "Awaiting Start Verification" ? "Review trip start" : "Verify journey", icon: CheckCircle2, onClick: (e) => { e.stopPropagation(); setVerifyModal(j); } }]
                                                            : []),
                                                        ...(!isDriverPreview || jpv("actionViewJourney")
                                                            ? [{ id: "view", label: "View journey", icon: ChevronRight, onClick: (e) => { e.stopPropagation(); navigate(`/journeys/${j.id}`); } }]
                                                            : []),
                                                        ...(!isDriverPreview
                                                            ? [{ id: "delete", label: "Delete journey", icon: Trash2, danger: true, onClick: (e) => { e.stopPropagation(); delItem("journeys", j.id, j.origin + "→" + j.dest); } }]
                                                            : []),
                                                    ]}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={13}>
                                        <div style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: "56px 24px",
                                            gap: 12,
                                        }}>
                                            <div style={{
                                                width: 52, height: 52, borderRadius: 16,
                                                background: "var(--surface-subtle)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                            }}>
                                                <RouteIcon size={24} color="var(--text-dim)" />
                                            </div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)" }}>No journeys found</div>
                                            <div style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", maxWidth: 300 }}>
                                                {searchTerm || filterTruck !== "ALL" || jStatusFilter !== "ALL"
                                                    ? "No results match your current filters. Try adjusting your search or filter criteria."
                                                    : "No journeys have been recorded yet. Create the first one to get started."}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
