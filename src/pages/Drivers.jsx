import { 
    User, 
    Phone, 
    CreditCard, 
    Briefcase, 
    Plus, 
    Edit2, 
    Trash2, 
    ExternalLink,
    Mail,
    AlertCircle
} from "lucide-react";
import { fmt, uid } from "../utils/formatters";
import { validators } from "../utils/validators";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function Drivers({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, truckReg }) {
    const navigate = useNavigate();

    // Refine drivers for sorting and filtering
    const refinedDrivers = data.drivers.map(d => ({
        ...d,
        _salary: Number(d.salary || 0),
        _vehicle: d.truck ? truckReg(d.truck) : "Unassigned",
        _contact: `${d.phone} ${d.mpesa} ${d.email || ""}`
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

    return (
        <div className="page-shell">
            <PageHeader
                icon={User}
                title="Driver directory"
                description={
                    <>
                        <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>{data.drivers.length}</span> drivers on file
                    </>
                }
                actions={
                    <Button icon={Plus} onClick={() => openModal("driver", { status: "Active", joined: new Date().toISOString().split("T")[0] })}>
                        Add driver
                    </Button>
                }
            />

            <Card className="animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search drivers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500 }}
                    />
                </div>
                <div className="table-container">
                    <table className="table-modern">
                        <SortableTableHead
                            requestSort={requestSort}
                            sortConfig={sortConfig}
                            filterState={driverFilters}
                            onFilterChange={handleDriverFilterChange}
                            getUniqueValues={getDriverUniqueValues}
                            columns={[
                                { key: "uId", label: "ID", sortable: true },
                                { key: "name", label: "Driver Name", sortable: true },
                                { key: "phone", label: "Contact Information", sortable: true },
                                { key: "license", label: "License & Class", sortable: true },
                                { key: "_vehicle", label: "Assigned Vehicle", sortable: true },
                                { key: "_salary", label: "Monthly Salary", sortable: true, align: "right" },
                                { key: "status", label: "Status", sortable: true },
                                { key: "actions", label: "Actions", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {sortedDrivers.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No drivers found matching your filters.</div>
                                    </td>
                                </tr>
                            ) : sortedDrivers.map(d => (
                                <tr key={d.id} onClick={() => navigate(`/drivers/${d.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                    <td className="sticky-col" title={d.uId}>
                                        <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                            {d.uId}
                                        </div>
                                    </td>
                                    <td title={d.name}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ 
                                                width: 40, 
                                                height: 40, 
                                                borderRadius: 12, 
                                                background: "rgba(249, 115, 22, 0.1)", 
                                                display: "flex", 
                                                alignItems: "center", 
                                                justifyContent: "center", 
                                                color: "var(--brand-primary)" 
                                            }}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{d.name}</div>
                                                {d.email && <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                                                    <Mail size={10} /> {d.email}
                                                </div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td title={d.phone}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.phone}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                            <CreditCard size={10} color="#10b981" /> {d.mpesa}
                                        </div>
                                    </td>
                                    <td title={d.license}>
                                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{d.license}</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                            {(Array.isArray(d.class) ? d.class : [d.class]).filter(Boolean).map(c => (
                                                <span key={c} style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border-subtle)", fontWeight: 600 }}>{c}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td title={d._vehicle}>
                                        <div style={{ 
                                            fontSize: 13, 
                                            fontWeight: 800, 
                                            color: d.truck ? "var(--brand-primary)" : "var(--text-dim)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6
                                        }}>
                                            {d._vehicle}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: "right" }} title={fmt(d.salary)}>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>{fmt(d.salary)}</div>
                                    </td>
                                    <td className="status-col" title={d.status}><Badge status={d.status} /></td>
                                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                        <TableRowActions
                                            ariaLabel={`Actions for ${d.name}`}
                                            items={[
                                                {
                                                    id: "profile",
                                                    label: "Open profile",
                                                    icon: ExternalLink,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        navigate(`/drivers/${d.id}`);
                                                    },
                                                },
                                                {
                                                    id: "edit",
                                                    label: "Edit driver",
                                                    icon: Edit2,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        openModal("driver", d);
                                                    },
                                                },
                                                {
                                                    id: "delete",
                                                    label: "Delete driver",
                                                    icon: Trash2,
                                                    danger: true,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        delItem("drivers", d.id);
                                                    },
                                                },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
