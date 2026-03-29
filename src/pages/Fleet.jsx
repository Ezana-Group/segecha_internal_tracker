import React, { useState } from "react";
import { 
    Truck, 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    ChevronRight,
    ArrowUpRight,
    AlertCircle,
    Search as SearchIcon
} from "lucide-react";
import { fmt } from "../utils/formatters";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function Fleet({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, truckStats, maintenanceStatus, driverName, customerName, truckReg }) {
    const navigate = useNavigate();
    const [fleetTab, setFleetTab] = useState("trucks");

    // Refine trucks for sorting and filtering
    const refinedTrucks = data.trucks.map(t => {
        const mStatuses = (data.maintenanceSettings || []).map(s => maintenanceStatus ? maintenanceStatus(t, s.id) : { status: 'Healthy' });
        const overdueCount = mStatuses.filter(s => s.status === "Overdue").length;
        const criticalCount = mStatuses.filter(s => s.status === "Due Soon").length;
        return {
            ...t,
            _odom: Number(t.odom || 0),
            _overdue: overdueCount,
            _health: overdueCount > 0 ? "Critical Service" : criticalCount > 0 ? "Service Due" : "Healthy"
        };
    });

    const { 
        filteredRows: sortedTrucks, 
        setSort: requestSortTrucks, 
        sortState: sortConfigTrucks,
        filterState: truckFilters,
        applyFilter: handleTruckFilterChange,
        getUniqueValues: getTruckUniqueValues,
        isFiltered: isTruckFiltered,
        isSorted: isTruckSorted,
        searchTerm: searchTermTrucks,
        setSearchTerm: setSearchTermTrucks
    } = useTableFilter(refinedTrucks, { 
        namespace: "trucks", 
        initialSort: { col: "reg", dir: "asc" },
        searchColumns: ["reg", "uId", "make", "type"]
    });

    // Refine trailers for sorting and filtering
    const refinedTrailers = (data.trailers || []).map(t => {
        const assignedDriver = data.drivers?.find(d => d.assignedTrailer === t.id) || data.staff?.find(s => s.assignedTrailer === t.id);
        return {
            ...t,
            _reg: t.reg || "",
            _truck: truckReg ? truckReg(t.truck) : (t.truck || ""),
            _driver: assignedDriver ? assignedDriver.name : "None"
        };
    });

    const { 
        filteredRows: sortedTrailers, 
        setSort: requestSortTrailers, 
        sortState: sortConfigTrailers,
        filterState: trailerFilters,
        applyFilter: handleTrailerFilterChange,
        getUniqueValues: getTrailerUniqueValues,
        isFiltered: isTrailerFiltered,
        isSorted: isTrailerSorted,
        searchTerm: searchTermTrailers,
        setSearchTerm: setSearchTermTrailers
    } = useTableFilter(refinedTrailers, { 
        namespace: "trailers", 
        initialSort: { col: "reg", dir: "asc" },
        searchColumns: ["reg", "uId", "make", "type"]
    });

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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", gap: 16 }}>
                            {tabBtn(fleetTab === "trucks", () => setFleetTab("trucks"), `Trucks (${data.trucks.length})`)}
                            {tabBtn(fleetTab === "trailers", () => setFleetTab("trailers"), `Trailers (${(data.trailers || []).length})`)}
                        </div>
                    </div>
                }
            />

            <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder={fleetTab === 'trucks' ? "Search fleet..." : "Search trailers..."}
                        value={fleetTab === 'trucks' ? searchTermTrucks : searchTermTrailers}
                        onChange={(e) => fleetTab === 'trucks' ? setSearchTermTrucks(e.target.value) : setSearchTermTrailers(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                    />
                </div>
                <div className="table-container">
                    {fleetTab === 'trucks' ? (
                        <table className="table-modern">
                            <SortableTableHead 
                                requestSort={requestSortTrucks}
                                sortConfig={sortConfigTrucks}
                                filterState={truckFilters}
                                onFilterChange={handleTruckFilterChange}
                                getUniqueValues={getTruckUniqueValues}
                                columns={[
                                    { key: "uId", label: "Vehicle Unique No.", sortable: true },
                                    { key: "reg", label: "Licence Plate", sortable: true },
                                    { key: "type", label: "Vehicle Type", sortable: true },
                                    { key: "isRigid", label: "Rigid", sortable: true },
                                    { key: "make", label: "Manufacturer / Model", sortable: true },
                                    { key: "_odom", label: "Odometer", sortable: true, align: "right" },
                                    { key: "_health", label: "Health", sortable: true },
                                    { key: "_overdue", label: "Overdue", sortable: true, align: "right" },
                                    { key: "actions", label: "Actions", sortable: false, align: "right" }
                                ]}
                            />
                            <tbody>
                                {sortedTrucks.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600 }}>No vehicles found matching your filters.</div>
                                        </td>
                                    </tr>
                                ) : sortedTrucks.map(t => (
                                    <tr key={t.id} onClick={() => navigate(`/fleet/${t.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td className="sticky-col" title={t.uId}>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                                {t.uId}
                                            </div>
                                        </td>
                                        <td title={t.reg}>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{t.reg}</div>
                                        </td>
                                        <td title={t.type}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.type}</div>
                                        </td>
                                        <td title={t.isRigid ? "Rigid" : "Articulated"}>
                                            <Badge status={t.isRigid ? "Active" : "Inactive"}>
                                                {t.isRigid ? "Yes" : "No"}
                                            </Badge>
                                        </td>
                                        <td title={t.make}>
                                            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{t.make}</div>
                                        </td>
                                        <td style={{ textAlign: "right" }} title={`${Number(t.odom || 0).toLocaleString()} KM`}>
                                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                                                {Number(t.odom || 0).toLocaleString()} <span style={{ fontSize: 10 }}>KM</span>
                                            </div>
                                        </td>
                                        <td className="status-col" title={t._health}>
                                            <Badge 
                                                status={t._health === "Critical Service" ? "Overdue" : t._health === "Service Due" ? "Pending" : "Active"} 
                                                text={t._health} 
                                            />
                                        </td>
                                        <td style={{ textAlign: "right" }} title={`${t._overdue} Overdue`}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                                                <div style={{ 
                                                    width: 24, height: 24, borderRadius: 6, 
                                                    background: t._overdue > 0 ? "#ef444415" : "var(--surface-subtle)", 
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: t._overdue > 0 ? "#ef4444" : "var(--text-dim)",
                                                    fontWeight: 800, fontSize: 12
                                                }}>
                                                    {t._overdue}
                                                </div>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: t._overdue > 0 ? "#ef4444" : "var(--text-dim)" }}>
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
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="table-modern">
                            <SortableTableHead 
                                requestSort={requestSortTrailers}
                                sortConfig={sortConfigTrailers}
                                filterState={trailerFilters}
                                onFilterChange={handleTrailerFilterChange}
                                getUniqueValues={getTrailerUniqueValues}
                                columns={[
                                    { key: "uId", label: "Trailer Unique No.", sortable: true },
                                    { key: "reg", label: "Licence Plate", sortable: true },
                                    { key: "type", label: "Trailer Type", sortable: true },
                                    { key: "make", label: "Manufacturer", sortable: true },
                                    { key: "status", label: "Status", sortable: true },
                                    { key: "_truck", label: "Assigned Truck", sortable: true },
                                    { key: "_driver", label: "Assigned Personnel", sortable: true },
                                    { key: "actions", label: "Actions", sortable: false, align: "right" }
                                ]}
                            />
                            <tbody>
                                {sortedTrailers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                            <div style={{ fontWeight: 600 }}>No trailers found matching your filters.</div>
                                        </td>
                                    </tr>
                                ) : sortedTrailers.map(t => (
                                    <tr key={t.id} className="hover-scale">
                                        <td className="sticky-col" title={t.uId}>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                                {t.uId}
                                            </div>
                                        </td>
                                        <td title={t.reg}>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{t.reg}</div>
                                        </td>
                                        <td title={t.type}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.type}</div>
                                        </td>
                                        <td title={t.make || "N/A"}>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.make || "N/A"}</div>
                                        </td>
                                        <td className="status-col" title={t.status}>
                                            <Badge 
                                                status={t.status === 'Active' ? 'Active' : t.status === 'Maintenance' ? 'Pending' : 'Inactive'} 
                                                text={t.status} 
                                            />
                                        </td>
                                        <td title={truckReg(t.truck)}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                                {truckReg(t.truck)}
                                            </div>
                                        </td>
                                        <td title={t._driver}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                                {t._driver}
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
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
