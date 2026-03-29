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
    Filter,
    ChevronRight,
    Search as SearchIcon,
    Trash2,
    FileText,
    Droplet,
    Receipt,
    DollarSign,
    ExternalLink,
    AlertTriangle
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

    // Refine data for sorting and filtering
    const refinedJourneys = scopeJourneys.map(j => ({
        ...j,
        _customer: customerName(j.customerId),
        _vehicle: truckReg(j.truck_id || j.truck),
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

    return (
        <div className="page-shell">
            <PageHeader
                icon={RouteIcon}
                title={isDriverPreview ? "My trips" : "Journey operations"}
                description={
                    isDriverPreview ? (
                        jpv("pageDescription") ? (
                        <>
                            <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{scopeJourneys.length}</span>{" "}
                            trips assigned to you (preview)
                        </>
                        ) : (
                            <>
                                <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{scopeJourneys.length}</span> trips
                            </>
                        )
                    ) : (
                        <>
                            <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{data.journeys.length}</span> trips on record
                        </>
                    )
                }
                actions={
                    !isDriverPreview ? (
                    <>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <select
                                className="input-premium"
                                style={{ width: 160, fontSize: 13, height: 42 }}
                                value={filterTruck}
                                onChange={(e) => setFilterTruck(e.target.value)}
                            >
                                <option value="ALL">All vehicles</option>
                                {data.trucks.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.reg}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="input-premium"
                                style={{ width: 160, fontSize: 13, height: 42 }}
                                value={jStatusFilter}
                                onChange={(e) => setForm((f) => ({ ...f, _jStatusFilter: e.target.value }))}
                            >
                                <option value="ALL">All statuses</option>
                                {["Loading", "In Transit", "Awaiting Start Verification", "Awaiting Verification", "Completed", "Cancelled"].map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button
                            icon={Plus}
                            onClick={() => openModal("journey", { date: new Date().toISOString().split("T")[0], status: "Loading" })}
                        >
                            New journey
                        </Button>
                    </>
                    ) : null
                }
            />

            {/* Quick Stats */}
            {(!isDriverPreview || jpv("statsRow")) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 32 }}>
                <Card title="Filtered Missions" icon={Navigation} accent="#3b82f6" className="card-premium">
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{sortedItems.length} missions</div>
                </Card>
                <Card title="Filtered Distance" icon={Navigation} accent="#a78bfa" className="card-premium">
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{totalDistanceFiltered.toLocaleString()} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>KM</span></div>
                </Card>
                <Card title="Filtered Revenue" icon={DollarSign} accent="#10b981" className="card-premium">
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{fmt(totalRevenueFiltered)}</div>
                </Card>
                <Card title="Ongoing trips" icon={Clock} accent="#f59e0b" className="card-premium">
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{sortedItems.filter(j => ["Loading", "In Transit", "Awaiting Start Verification"].includes(j.status)).length} active</div>
                </Card>
            </div>
            )}

            {/* Pending Approvals (Fuel/Expenses) */}
            {(!isDriverPreview && data.pendingVerifications?.some(v => v._itemType !== 'journey')) && (
                <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6' }}></div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Pending Fuel & Expense Approvals</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                        {data.pendingVerifications.filter(v => v._itemType !== 'journey').map(v => (
                            <div
                                key={v.id}
                                onClick={() => setVerifyModal(v)}
                                style={{
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 16,
                                    padding: 16,
                                    cursor: "pointer",
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                    transition: 'all 0.2s'
                                }}
                                className="hover-scale"
                            >
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6" }}>
                                    {v._itemType === 'fuel' ? <Droplet size={20} /> : <Receipt size={20} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>
                                        {v._itemType === 'fuel' ? 'Fuel Log' : 'Expense Claim'} · {truckReg(v.truck_id || v.truck)}
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                                        {v._itemType === 'fuel' ? `${v.litres}L at ${v.station}` : `${fmt(v.amount)} for ${v.cat}`}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(v.date)}</div>
                                </div>
                                <ChevronRight size={16} color="var(--text-dim)" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search journeys..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                    />
                </div>
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
                                { key: "uId", label: "ID", sortable: !isDriverPreview || jpv("colMissionId") },
                                { key: "isReturn", label: "Type", sortable: !isDriverPreview || jpv("colType") },
                                { key: "date", label: "Date", sortable: !isDriverPreview || jpv("colDate") },
                                { key: "origin", label: "Route", sortable: !isDriverPreview || jpv("colRoute") },
                                { key: "_customer", label: "Client", sortable: !isDriverPreview || jpv("colClient") },
                                { key: "_vehicle", label: "Vehicle", sortable: !isDriverPreview || jpv("colVehicle") },
                                { key: "driver", label: "Crew", sortable: !isDriverPreview || jpv("colCrew") },
                                { key: "cargoType", label: "Cargo", className: "hide-laptop", sortable: !isDriverPreview || jpv("colCargo") },
                                { key: "_distance", label: "Dist", className: "hide-laptop", sortable: !isDriverPreview || jpv("colDistance"), align: "right" },
                                { key: "notes", label: "Notes", className: "hide-laptop", sortable: !isDriverPreview || jpv("colNotes") },
                                { key: "_revenue", label: "Revenue", sortable: !isDriverPreview || jpv("colRevenue"), align: "right" },
                                { key: "status", label: "Status", sortable: !isDriverPreview || jpv("colStatus") },
                                { key: "actions", label: "Actions", sortable: false, align: "right" }
                            ].filter(c => c.sortable !== false || c.key === 'actions')}
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
                                    {(!isDriverPreview || jpv("colMissionId")) && (
                                        <td className="sticky-col" title={j.uId || j.id.slice(0, 8).toUpperCase()}>
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    color: "var(--brand-primary)",
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: 10,
                                                    background: "var(--surface-subtle)",
                                                    padding: "1px 6px",
                                                    borderRadius: 4,
                                                    display: "inline-block",
                                                }}
                                            >
                                                {j.uId || j.id.slice(0, 8).toUpperCase()}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colType")) && (
                                        <td title={j.isReturn ? "Return Trip" : "Standard Trip"}>
                                            <div style={{ 
                                                fontSize: 10, 
                                                fontWeight: 800, 
                                                textTransform: "uppercase", 
                                                background: j.isReturn ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)", 
                                                color: j.isReturn ? "#f59e0b" : "#10b981",
                                                padding: "2px 6px",
                                                borderRadius: 4,
                                                width: "fit-content"
                                            }}>
                                                {j.isReturn ? "Return" : "Standard"}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colDate")) && (
                                        <td title={fmtDate(j.date)}>
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                                                <Calendar size={11} color="var(--text-dim)" /> {fmtDate(j.date)}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colRoute")) && (
                                        <td title={`${j.origin} → ${j.dest}`}>
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span>{j.origin}</span>
                                                <span style={{ opacity: 0.4, fontSize: 10 }}>→</span>
                                                <span>{j.dest}</span>
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colClient")) && (
                                        <td title={customerName(j.customerId)}>
                                            {j.customerId ? (
                                                <button
                                                    type="button"
                                                    className="journeys-table-link"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/customers/${j.customerId}`);
                                                    }}
                                                >
                                                    <User size={12} strokeWidth={2} aria-hidden />
                                                    {customerName(j.customerId)}
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>—</span>
                                            )}
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colVehicle")) && (
                                        <td title={truckReg(j.truck_id || j.truck)}>
                                            <button
                                                type="button"
                                                className="journeys-table-link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/fleet/${j.truck}`);
                                                }}
                                            >
                                                <Truck size={12} strokeWidth={2} aria-hidden />
                                                {truckReg(j.truck_id || j.truck)}
                                            </button>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colCrew")) && (
                                        <td title={driverName(j.driver)}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                                                <User size={12} color="var(--text-dim)" strokeWidth={2} aria-hidden />
                                                {driverName(j.driver)}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colCargo")) && (
                                        <td className="hide-laptop" title={`${j.cargo || "General cargo"} ${j.weight ? `(${j.weight} T)` : ""}`}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{j.cargo || "General cargo"}</div>
                                            {j.weight != null && j.weight !== "" ? (
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{j.weight} T</div>
                                            ) : null}
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colDistance")) && (
                                        <td className="hide-laptop" style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }} title={j.distance != null && j.distance !== "" ? `${Number(j.distance).toLocaleString()} km` : "—"}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                                                {j.distance != null && j.distance !== "" ? `${Number(j.distance).toLocaleString()} km` : "—"}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colNotes")) && (
                                        <td className="journeys-col-notes hide-laptop" title={j.notes && String(j.notes).trim() ? String(j.notes).trim() : "—"}>
                                            {j.notes && String(j.notes).trim() ? (
                                                <span>{String(j.notes).trim()}</span>
                                            ) : (
                                                <span style={{ color: "var(--text-dim)" }}>—</span>
                                            )}
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colRevenue")) && (
                                        <td className="journeys-col-revenue" style={{ textAlign: "right" }} title={fmt(j._revenue)}>
                                            <div style={{ fontWeight: 800, color: (j.status === 'Completed' && !j.isReturn && (!j._revenue || Number(j._revenue) === 0)) ? "#ef4444" : "#10b981", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                                                {fmt(j._revenue)}
                                            </div>
                                            {(j.status === 'Completed' && !j.isReturn && (!j._revenue || Number(j._revenue) === 0)) && (
                                                <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, padding: "2px 6px", background: "#ef444415", borderRadius: 4, width: "fit-content", marginLeft: "auto" }}>
                                                    <AlertTriangle size={12} /> Missing Revenue
                                                </div>
                                            )}
                                            {j.driverMileage && (!isDriverPreview || jpv("colAllowanceSubline")) ? (
                                                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                                    Allowance {fmt(j.driverMileage)}
                                                    {j.mileageRouteOverride && (
                                                        <span style={{ background: "var(--brand-primary)15", color: "var(--brand-primary)", padding: "1px 4px", borderRadius: 4, fontSize: 8, fontWeight: 800 }}>ROUTE RATE</span>
                                                    )}
                                                </div>
                                            ) : null}
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colStatus")) && (
                                        <td className="status-col" title={j._isRejected ? "Rejected" : j.status}>
                                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                                <Badge status={j._isRejected ? "Rejected" : j.status} />
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("actionWaybill") || jpv("actionViewJourney")) && (
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for journey ${j.uId || j.id}`}
                                                items={[
                                                    ...(openWaybillGenerator && (!isDriverPreview || jpv("actionWaybill"))
                                                        ? [
                                                              {
                                                                  id: "waybill",
                                                                  label: j.waybillGenerated && j.waybillNo ? `Waybill · ${j.waybillNo}` : "Waybill",
                                                                  icon: FileText,
                                                                  onClick: (e) => {
                                                                      e.stopPropagation();
                                                                      openWaybillGenerator(j);
                                                                  },
                                                              },
                                                          ]
                                                        : []),
                                                    ...(j.tr_form_url
                                                        ? [
                                                              {
                                                                  id: "view-tr",
                                                                  label: "View TR Form",
                                                                  icon: ExternalLink,
                                                                  onClick: (e) => {
                                                                      e.stopPropagation();
                                                                      window.open(j.tr_form_url, "_blank");
                                                                  },
                                                              },
                                                          ]
                                                        : []),
                                                    ...(j.t1_form_url
                                                        ? [
                                                              {
                                                                  id: "view-t1",
                                                                  label: "View T1 Form",
                                                                  icon: ExternalLink,
                                                                  onClick: (e) => {
                                                                      e.stopPropagation();
                                                                      window.open(j.t1_form_url, "_blank");
                                                                  },
                                                              },
                                                          ]
                                                        : []),
                                                    ...(["Awaiting Verification", "Awaiting Start Verification"].includes(j.status) && !isDriverPreview
                                                        ? [
                                                              {
                                                                  id: "verify",
                                                                  label: j.status === "Awaiting Start Verification" ? "Review trip start" : "Verify journey",
                                                                  icon: CheckCircle2,
                                                                  onClick: (e) => {
                                                                      e.stopPropagation();
                                                                      setVerifyModal(j);
                                                                  },
                                                              },
                                                          ]
                                                        : []),
                                                    ...(!isDriverPreview || jpv("actionViewJourney")
                                                        ? [
                                                              {
                                                                  id: "view",
                                                                  label: "View journey",
                                                                  icon: ChevronRight,
                                                                  onClick: (e) => {
                                                                      e.stopPropagation();
                                                                      navigate(`/journeys/${j.id}`);
                                                                  },
                                                              },
                                                          ]
                                                        : []),
                                                    ...(!isDriverPreview
                                                        ? [
                                                              {
                                                                  id: "delete",
                                                                  label: "Delete journey",
                                                                  icon: Trash2,
                                                                  danger: true,
                                                                  onClick: (e) => {
                                                                      e.stopPropagation();
                                                                      delItem("journeys", j.id, j.origin + "→" + j.dest);
                                                                  },
                                                              },
                                                          ]
                                                        : []),
                                                ]}
                                            />
                                        </td>
                                    )}
                                    </tr>
                                ))
                        ) : (
                            <tr>
                                <td colSpan={13} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)", fontStyle: "italic" }}>
                                    No results match your filters
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            </Card>
        </div>
    );
}
