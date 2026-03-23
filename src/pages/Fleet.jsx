import React, { useState } from "react";
import { 
    Truck, 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    ChevronRight,
    ArrowUpRight
} from "lucide-react";
import { fmt } from "../utils/formatters";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";

export function Fleet({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, truckStats, maintenanceStatus, driverName, customerName, truckReg }) {
    const navigate = useNavigate();
    const [fleetTab, setFleetTab] = useState("trucks");

    const tabBtn = (active, onClick, label) => (
        <button
            type="button"
            onClick={onClick}
            style={{
                border: "none",
                background: "none",
                padding: "0 0 8px 0",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 800,
                color: active ? "var(--brand-primary)" : "var(--text-dim)",
                borderBottom: `2px solid ${active ? "var(--brand-primary)" : "transparent"}`,
                transition: "all 0.2s",
            }}
        >
            {label}
        </button>
    );

    return (
        <div className="page-shell">
            <PageHeader
                icon={Truck}
                title="Fleet management"
                description="Vehicles, trailers, and assignment overview."
                actions={
                    fleetTab === "trucks" ? (
                        <Button icon={Plus} onClick={() => openModal("truck", { status: "Active" })}>
                            Add truck
                        </Button>
                    ) : (
                        <Button icon={Plus} variant="premium" onClick={() => openModal("trailer", { status: "Active" })}>
                            Add trailer
                        </Button>
                    )
                }
                belowTitle={
                    <div style={{ display: "flex", gap: 24 }}>
                        {tabBtn(fleetTab === "trucks", () => setFleetTab("trucks"), `Trucks (${data.trucks.length})`)}
                        {tabBtn(fleetTab === "trailers", () => setFleetTab("trailers"), `Trailers (${(data.trailers || []).length})`)}
                    </div>
                }
            />

            <Card className="animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    {fleetTab === 'trucks' ? (
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th>Vehicle Unique No.</th>
                                    <th>Licence Plate</th>
                                    <th>Vehicle Type</th>
                                    <th>Odometer</th>
                                    <th>Maintenance Status</th>
                                    <th>Overdue Tasks</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.trucks.map(t => {
                                    const mStatuses = data.maintenanceSettings.map(s => maintenanceStatus(t, s.id));
                                    const overdueCount = mStatuses.filter(s => s.status === "Overdue").length;
                                    const criticalCount = mStatuses.filter(s => s.status === "Due Soon").length;
                                    
                                    return (
                                    <tr key={t.id} onClick={() => navigate(`/fleet/${t.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                                {t.uId}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                                    {t.reg}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.type}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.make}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                                                    {Number(t.odom || 0).toLocaleString()} <span style={{ fontSize: 10 }}>KM</span>
                                                </div>
                                            </td>
                                            <td>
                                                <Badge 
                                                    status={overdueCount > 0 ? "Overdue" : criticalCount > 0 ? "Pending" : "Paid"} 
                                                    text={overdueCount > 0 ? "Critical Service" : criticalCount > 0 ? "Service Due" : "Healthy"} 
                                                />
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div style={{ 
                                                        width: 24, height: 24, borderRadius: 6, 
                                                        background: overdueCount > 0 ? "#ef444415" : "var(--surface-subtle)", 
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        color: overdueCount > 0 ? "#ef4444" : "var(--text-dim)",
                                                        fontWeight: 800, fontSize: 12
                                                    }}>
                                                        {overdueCount}
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: overdueCount > 0 ? "#ef4444" : "var(--text-dim)" }}>
                                                        Overdue
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Actions for vehicle ${t.reg}`}
                                                    items={[
                                                        {
                                                            id: "view",
                                                            label: "View vehicle",
                                                            icon: ArrowUpRight,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                navigate(`/fleet/${t.id}`);
                                                            },
                                                        },
                                                        {
                                                            id: "edit",
                                                            label: "Edit vehicle",
                                                            icon: Edit2,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                openModal("truck", t);
                                                            },
                                                        },
                                                        {
                                                            id: "delete",
                                                            label: "Delete vehicle",
                                                            icon: Trash2,
                                                            danger: true,
                                                            onClick: (e) => {
                                                                e.stopPropagation();
                                                                delItem("trucks", t.id, t.reg);
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
                    ) : (
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th>Trailer Unique No.</th>
                                    <th>Licence Plate</th>
                                    <th>Trailer Type</th>
                                    <th>Manufacturer</th>
                                    <th>Status</th>
                                    <th>Assigned Truck</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.trailers || []).map(t => (
                                    <tr key={t.id} className="hover-scale">
                                        <td>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                                {t.uId}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{t.reg}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.type}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.make || "N/A"}</div>
                                        </td>
                                        <td>
                                            <Badge 
                                                status={t.status === 'Active' ? 'Active' : t.status === 'Maintenance' ? 'Pending' : 'Inactive'} 
                                                text={t.status} 
                                            />
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                                {truckReg(t.truck)}
                                            </div>
                                        </td>
                                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for trailer ${t.reg}`}
                                                items={[
                                                    {
                                                        id: "edit",
                                                        label: "Edit trailer",
                                                        icon: Edit2,
                                                        onClick: () => openModal("trailer", t),
                                                    },
                                                    {
                                                        id: "delete",
                                                        label: "Delete trailer",
                                                        icon: Trash2,
                                                        danger: true,
                                                        onClick: () => delItem("trailers", t.id, t.reg),
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {(!data.trailers || data.trailers.length === 0) && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
                                            No trailers found. Click "Add New Trailer" to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
