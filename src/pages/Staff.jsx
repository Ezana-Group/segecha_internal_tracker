import { 
    User, 
    Phone, 
    Briefcase, 
    Plus, 
    Edit2, 
    Trash2, 
    Mail, 
    Shield, 
    Key, 
    DollarSign, 
    Calendar, 
    ExternalLink, 
    AlertCircle,
    Users,
    Search as SearchIcon
} from "lucide-react";
import { fmt, uid, fmtDate } from "../utils/formatters";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

export function Staff({ data, setData, dark, isMobile, openModal, delItem }) {
    const navigate = useNavigate();

    const getRoleColor = (role) => {
        if (role === 'Driver') return '#f97316';
        if (role === 'Turnboy') return '#8b5cf6';
        if (role === 'Office Admin') return '#3b82f6';
        if (role === 'Fleet Manager') return '#10b981';
        return 'var(--text-dim)';
    };

    const _staff = (data.staff || []).map(s => ({ ...s, _type: 'staff' }));
    const _drivers = (data.drivers || []).map(d => ({ ...d, _type: 'driver', role: d.role || 'Driver' }));
    const staffList = [..._staff, ..._drivers];

    // Refine staff for sorting and filtering
    const refinedStaff = staffList.map(s => ({
        ...s,
        _salary: Number(s.salary || 0),
        _joined: s.joined || "",
        _contact: `${s.phone} ${s.email || ""}`
    }));

    const { 
        filteredRows: sortedStaff, 
        setSort: requestSort, 
        sortState: sortConfig,
        filterState: staffFilters,
        applyFilter: handleStaffFilterChange,
        getUniqueValues: getStaffUniqueValues,
        searchTerm,
        setSearchTerm
    } = useTableFilter(refinedStaff, { 
        namespace: "stf", 
        initialSort: { col: "name", dir: "asc" },
        searchColumns: ["name", "role", "uId", "phone"]
    });

    return (
        <div className="page-shell">
            <PageHeader
                icon={Briefcase}
                title="Staff"
                description="Office roles, fleet managers, and linked driver records."
                actions={
                    <Button
                        icon={Plus}
                        onClick={() => {
                            const otp = Math.floor(100000 + Math.random() * 900000).toString();
                            openModal("staff", {
                                status: "Active",
                                joined: new Date().toISOString().split("T")[0],
                                firstLogin: true,
                                otp,
                            });
                        }}
                    >
                        Add staff
                    </Button>
                }
            />

            <Card className="animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={18} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search staff..."
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
                            filterState={staffFilters}
                            onFilterChange={handleStaffFilterChange}
                            getUniqueValues={getStaffUniqueValues}
                            columns={[
                                { key: "uId", label: "ID", sortable: true },
                                { key: "name", label: "Staff Member", sortable: true },
                                { key: "role", label: "Role & Department", sortable: true },
                                { key: "phone", label: "Contact Information", sortable: true },
                                { key: "_salary", label: "Salary (KES)", sortable: true, align: "right" },
                                { key: "_joined", label: "Joined Date", sortable: true },
                                { key: "status", label: "Status", sortable: true },
                                { key: "actions", label: "Actions", sortable: false, align: "right" }
                            ]}
                        />
                        <tbody>
                            {sortedStaff.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 16 }}><AlertCircle size={48} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No staff members found matching your filters.</div>
                                    </td>
                                </tr>
                            ) : sortedStaff.map(s => (
                                <tr key={s.id} onClick={() => navigate(s._type === 'driver' ? `/drivers/${s.id}` : `/staff/${s.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                    <td className="sticky-col" title={s.uId}>
                                        <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                            {s.uId}
                                        </div>
                                    </td>
                                    <td title={`${s.name} (${s.email})`}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ 
                                                width: 40, 
                                                height: 40, 
                                                borderRadius: 12, 
                                                background: "var(--bg-surface)", 
                                                display: "flex", 
                                                alignItems: "center", 
                                                justifyContent: "center", 
                                                color: getRoleColor(s.role) || "var(--brand-primary)"
                                            }}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{s.name}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                                                    <Mail size={10} /> {s.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td title={s.role}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <Briefcase size={14} color="var(--text-dim)" />
                                            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{s.role}</span>
                                        </div>
                                    </td>
                                    <td title={`${s.phone} ${s.otp ? `(OTP: ${s.otp})` : ""}`}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                                                <Phone size={12} color="var(--brand-primary)" /> {s.phone}
                                            </div>
                                            {s.firstLogin && (
                                                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                                                    <Key size={10} /> Temp OTP: {s.otp}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: "right" }} title={fmt(s.salary)}>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                                            <DollarSign size={14} /> {fmt(s.salary).replace('KES ', '')}
                                        </div>
                                    </td>
                                    <td title={fmtDate(s.joined)}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                                            <Calendar size={12} color="var(--text-dim)" /> {fmtDate(s.joined)}
                                        </div>
                                    </td>
                                    <td className="status-col" title={s.status}><Badge status={s.status} /></td>
                                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                        <TableRowActions
                                            ariaLabel={`Actions for ${s.name}`}
                                            items={[
                                                {
                                                    id: "profile",
                                                    label: "Open profile",
                                                    icon: ExternalLink,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        navigate(s._type === "driver" ? `/drivers/${s.id}` : `/staff/${s.id}`);
                                                    },
                                                },
                                                {
                                                    id: "edit",
                                                    label: s._type === "driver" ? "Edit driver" : "Edit staff",
                                                    icon: Edit2,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        if (s._type === "driver") openModal("driver", s);
                                                        else openModal("staff", s);
                                                    },
                                                },
                                                {
                                                    id: "delete",
                                                    label: s._type === "driver" ? "Remove driver" : "Remove staff",
                                                    icon: Trash2,
                                                    danger: true,
                                                    onClick: (e) => {
                                                        e.stopPropagation();
                                                        if (s._type === "driver") delItem("drivers", s.id, s.name);
                                                        else delItem("staff", s.id, s.name);
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

            {staffList.length === 0 && (
                <div style={{ padding: 60, textAlign: 'center', background: "var(--bg-card)", borderRadius: 20, border: "1px dashed var(--border-subtle)", marginTop: 24 }}>
                    <Users size={48} color="var(--text-dim)" style={{ opacity: 0.2, marginBottom: 16 }} />
                    <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>No staff members registered yet.</div>
                </div>
            )}
        </div>
    );
}
