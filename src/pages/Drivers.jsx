import {
    User,
    Phone,
    CreditCard,
    Plus,
    Edit2,
    Trash2,
    ExternalLink,
    Mail,
    AlertCircle,
    Search as SearchIcon,
} from "lucide-react";
import { fmt } from "../utils/formatters";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

const STATUS_TABS = ["All", "Active", "Suspended"];

function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Drivers({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, truckReg }) {
    const navigate = useNavigate();
    const [statusTab, setStatusTab] = useState("All");

    const refinedDrivers = data.drivers.map(d => ({
        ...d,
        _salary: Number(d.salary || 0),
        _vehicle: d.truck ? truckReg(d.truck) : "Unassigned",
        _contact: `${d.phone} ${d.mpesa} ${d.email || ""}`,
        _journeyCount: data.journeys.filter(j => j.driver === d.id).length,
    }));

    const {
        filteredRows: sortedDrivers,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: driverFilters,
        applyFilter: handleDriverFilterChange,
        getUniqueValues: getDriverUniqueValues,
        searchTerm,
        setSearchTerm
    } = useTableFilter(refinedDrivers, {
        namespace: "drv",
        initialSort: { col: "name", dir: "asc" },
        searchColumns: ["name", "license", "uId", "phone"]
    });

    const visibleDrivers = statusTab === "All"
        ? sortedDrivers
        : sortedDrivers.filter(d => d.status === statusTab);

    return (
        <div className="page-shell">
            <PageHeader
                icon={User}
                title="Drivers"
                description={
                    <>
                        <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{data.drivers.length}</span> drivers on file
                    </>
                }
                actions={
                    <Button icon={Plus} onClick={() => openModal("driver", { status: "Active", joined: new Date().toISOString().split("T")[0] })}>
                        Add Driver
                    </Button>
                }
            />

            {/* Search + Status Filter */}
            <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }} className="animate-fade-in">
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={17} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search by name, license, or phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500, outline: "none" }}
                    />
                </div>
                <div style={{ display: "flex", gap: 4, padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setStatusTab(tab)}
                            style={{
                                padding: "6px 16px",
                                borderRadius: "var(--radius-md, 8px)",
                                border: "none",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                background: statusTab === tab ? "var(--brand-primary)" : "transparent",
                                color: statusTab === tab ? "white" : "var(--text-dim)",
                            }}
                        >
                            {tab}
                            {tab !== "All" && (
                                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
                                    {refinedDrivers.filter(d => d.status === tab).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Desktop Table */}
                {!isMobile ? (
                    <div className="table-container">
                        <table className="table-modern">
                            <SortableTableHead
                                requestSort={requestSort}
                                sortConfig={sortConfig}
                                filterState={driverFilters}
                                onFilterChange={handleDriverFilterChange}
                                getUniqueValues={getDriverUniqueValues}
                                columns={[
                                    { key: "name", label: "Driver Name", sortable: true },
                                    { key: "phone", label: "Phone", sortable: true },
                                    { key: "license", label: "License #", sortable: true },
                                    { key: "status", label: "Status", sortable: true },
                                    { key: "_journeyCount", label: "Journeys", sortable: true, align: "right" },
                                    { key: "_salary", label: "Salary (KES)", sortable: true, align: "right" },
                                    { key: "actions", label: "Actions", sortable: false, align: "right" },
                                ]}
                            />
                            <tbody>
                                {visibleDrivers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <AlertCircle size={40} style={{ opacity: 0.2, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
                                            <div style={{ fontWeight: 600 }}>No drivers found matching your filters.</div>
                                        </td>
                                    </tr>
                                ) : visibleDrivers.map(d => (
                                    <tr key={d.id} onClick={() => navigate(`/drivers/${d.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td title={d.name}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: "50%",
                                                    background: "var(--brand-primary)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: "white", fontWeight: 800, fontSize: 14, flexShrink: 0,
                                                }}>
                                                    {getInitials(d.name)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{d.name}</div>
                                                    {d.email && (
                                                        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                                            <Mail size={10} /> {d.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td title={d.phone}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5 }}>
                                                <Phone size={12} color="var(--text-dim)" /> {d.phone}
                                            </div>
                                            {d.mpesa && (
                                                <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                                    <CreditCard size={10} color="#10b981" /> {d.mpesa}
                                                </div>
                                            )}
                                        </td>
                                        <td title={d.license}>
                                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{d.license || "—"}</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                                {(Array.isArray(d.class) ? d.class : [d.class]).filter(Boolean).map(c => (
                                                    <span key={c} style={{ fontSize: 10, background: "var(--bg-surface)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border-subtle)", fontWeight: 600 }}>{c}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="status-col"><Badge status={d.status} /></td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{d._journeyCount}</div>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>{fmt(d.salary)}</div>
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for ${d.name}`}
                                                items={[
                                                    {
                                                        id: "profile",
                                                        label: "Open profile",
                                                        icon: ExternalLink,
                                                        onClick: (e) => { e.stopPropagation(); navigate(`/drivers/${d.id}`); },
                                                    },
                                                    {
                                                        id: "edit",
                                                        label: "Edit driver",
                                                        icon: Edit2,
                                                        onClick: (e) => { e.stopPropagation(); openModal("driver", d); },
                                                    },
                                                    {
                                                        id: "delete",
                                                        label: "Delete driver",
                                                        icon: Trash2,
                                                        danger: true,
                                                        onClick: (e) => { e.stopPropagation(); delItem("drivers", d.id); },
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* Mobile Grid Cards */
                    <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {visibleDrivers.length === 0 ? (
                            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "var(--text-dim)" }}>
                                <AlertCircle size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                                <div style={{ fontWeight: 600, fontSize: 14 }}>No drivers found.</div>
                            </div>
                        ) : visibleDrivers.map(d => (
                            <div
                                key={d.id}
                                onClick={() => navigate(`/drivers/${d.id}`)}
                                style={{
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-md, 12px)",
                                    padding: 16,
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: "50%",
                                        background: "var(--brand-primary)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "white", fontWeight: 900, fontSize: 15, flexShrink: 0,
                                    }}>
                                        {getInitials(d.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                                        <Badge status={d.status} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
                                    <Phone size={11} color="var(--text-dim)" /> {d.phone}
                                </div>
                                {d.license && (
                                    <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", fontWeight: 700 }}>
                                        {d.license}
                                    </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{d._journeyCount} journeys</span>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); openModal("driver", d); }}
                                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }}
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
