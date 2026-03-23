import React, { useState } from "react";
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
    Search,
    Trash2,
    FileText,
    Droplet,
    Receipt,
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
    const [searchTerm, setSearchTerm] = useState("");
    const filtered = scopeJourneys
        .filter(j => filterTruck === "ALL" || j.truck === filterTruck)
        .filter(j => jStatusFilter === "ALL" || j.status === jStatusFilter)
        .filter(j => 
            j.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (j.customerId && customerName(j.customerId).toLowerCase().includes(searchTerm.toLowerCase())) ||
            j.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
            j.dest.toLowerCase().includes(searchTerm.toLowerCase())
        );
    const totalKm = scopeJourneys.filter(j => j.status === "Completed").reduce((s, j) => s + +j.distance, 0);

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
                        <div style={{ position: "relative", width: 280, minWidth: 200 }}>
                            <Search
                                style={{
                                    position: "absolute",
                                    left: 12,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--text-dim)",
                                }}
                                size={16}
                            />
                            <input
                                className="input-premium"
                                placeholder="Search routes, clients…"
                                style={{ paddingLeft: 38, height: 42, fontSize: 13, width: "100%" }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
                <Card title="Total Missions" icon={Navigation} accent="#3b82f6">
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{filtered.length}</div>
                </Card>
                <Card title="Ongoing" icon={Clock} accent="#f59e0b">
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{filtered.filter(j => ["Loading", "In Transit", "Awaiting Start Verification"].includes(j.status)).length}</div>
                </Card>
                <Card title="Completed" icon={CheckCircle2} accent="#10b981">
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{filtered.filter(j => j.status === "Completed").length}</div>
                </Card>
                <Card title="Fleet Progress" icon={Truck} accent="#a78bfa">
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{filtered.filter(j => j.status === "Completed").reduce((s, j) => s + +j.distance, 0).toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>KM</span></div>
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
                                        {v._itemType === 'fuel' ? 'Fuel Log' : 'Expense Claim'} · {truckReg(v.truck)}
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

            {/* Filter & Search Bar (Premium UI) */}
            {!isDriverPreview ? (
            <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                marginBottom: 24, 
                flexWrap: "wrap", 
                gap: 16,
                background: "var(--bg-card)",
                padding: "16px 20px",
                borderRadius: 20,
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(12px)"
            }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 450 }}>
                    <Search style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--brand-primary)" }} size={18} />
                    <input 
                        className="input-modern input-modern--filter"
                        placeholder="Search by Mission ID, Route or Client..." 
                        style={{ 
                            paddingLeft: 48, 
                            height: 48, 
                            fontSize: 14, 
                            borderRadius: 14,
                            background: "var(--surface-subtle)",
                            border: "1px solid transparent"
                        }}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ position: "relative" }}>
                        <Truck style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} size={14} />
                        <select 
                            className="input-premium" 
                            style={{ width: 170, fontSize: 13, height: 48, padding: "0 12px 0 34px", borderRadius: 14, background: "var(--surface-subtle)" }}
                            value={filterTruck} 
                            onChange={e => setFilterTruck(e.target.value)}
                        >
                            <option value="ALL">All Vehicles</option>
                            {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                        </select>
                    </div>
                    <div style={{ position: "relative" }}>
                        <Filter style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} size={14} />
                        <select 
                            className="input-premium" 
                            style={{ width: 170, fontSize: 13, height: 48, padding: "0 12px 0 34px", borderRadius: 14, background: "var(--surface-subtle)" }}
                            value={jStatusFilter}
                            onChange={e => setForm(f => ({ ...f, _jStatusFilter: e.target.value }))}
                        >
                            <option value="ALL">All Statuses</option>
                            {["Loading", "In Transit", "Awaiting Start Verification", "Awaiting Verification", "Completed", "Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            ) : null}

            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table-modern journeys-matrix-table">
                        <thead>
                            <tr>
                                {(!isDriverPreview || jpv("colMissionId")) && <th>Mission ID</th>}
                                {(!isDriverPreview || jpv("colDate")) && <th>Departure</th>}
                                {(!isDriverPreview || jpv("colRoute")) && <th>Route</th>}
                                {(!isDriverPreview || jpv("colClient")) && <th>Client</th>}
                                {(!isDriverPreview || jpv("colVehicle")) && <th>Vehicle</th>}
                                {(!isDriverPreview || jpv("colCrew")) && <th>Crew</th>}
                                {(!isDriverPreview || jpv("colCargo")) && <th>Cargo</th>}
                                {(!isDriverPreview || jpv("colDistance")) && <th style={{ textAlign: "right" }}>Distance</th>}
                                {(!isDriverPreview || jpv("colNotes")) && <th>Notes</th>}
                                {(!isDriverPreview || jpv("colRevenue")) && <th style={{ textAlign: "right" }}>Revenue</th>}
                                {(!isDriverPreview || jpv("colStatus")) && <th>Status</th>}
                                {(!isDriverPreview || jpv("actionWaybill") || jpv("actionViewJourney")) && (
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.sort((a, b) => b.date.localeCompare(a.date)).map((j) => (
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
                                        <td>
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    color: "var(--brand-primary)",
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: 11,
                                                    background: "var(--surface-subtle)",
                                                    padding: "2px 8px",
                                                    borderRadius: 6,
                                                    display: "inline-block",
                                                }}
                                            >
                                                {j.uId || j.id.slice(0, 8).toUpperCase()}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colDate")) && (
                                        <td>
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                                <Calendar size={12} color="var(--text-dim)" /> {fmtDate(j.date)}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colRoute")) && (
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "var(--text-primary)", fontSize: 13, flexWrap: "wrap" }}>
                                                <span>{j.origin}</span>
                                                <ChevronRight size={12} color="var(--brand-primary)" style={{ flexShrink: 0 }} aria-hidden />
                                                <span>{j.dest}</span>
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colClient")) && (
                                        <td>
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
                                        <td>
                                            <button
                                                type="button"
                                                className="journeys-table-link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/fleet/${j.truck}`);
                                                }}
                                            >
                                                <Truck size={12} strokeWidth={2} aria-hidden />
                                                {truckReg(j.truck)}
                                            </button>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colCrew")) && (
                                        <td>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                                                <User size={12} color="var(--text-dim)" strokeWidth={2} aria-hidden />
                                                {driverName(j.driver)}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colCargo")) && (
                                        <td>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{j.cargo || "General cargo"}</div>
                                            {j.weight != null && j.weight !== "" ? (
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{j.weight} T</div>
                                            ) : null}
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colDistance")) && (
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                                                {j.distance != null && j.distance !== "" ? `${Number(j.distance).toLocaleString()} km` : "—"}
                                            </div>
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colNotes")) && (
                                        <td className="journeys-col-notes">
                                            {j.notes && String(j.notes).trim() ? (
                                                <span>{String(j.notes).trim()}</span>
                                            ) : (
                                                <span style={{ color: "var(--text-dim)" }}>—</span>
                                            )}
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colRevenue")) && (
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontWeight: 800, color: "#10b981", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{fmt(j.revenue)}</div>
                                            {j.driverMileage && (!isDriverPreview || jpv("colAllowanceSubline")) ? (
                                                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                                                    Allowance {fmt(j.driverMileage)}
                                                </div>
                                            ) : null}
                                        </td>
                                    )}
                                    {(!isDriverPreview || jpv("colStatus")) && (
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                                <Badge status={j.status} />
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
