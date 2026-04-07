import {
    User,
    Phone,
    Briefcase,
    Plus,
    Edit2,
    Trash2,
    Mail,
    Key,
    DollarSign,
    Calendar,
    ExternalLink,
    AlertCircle,
    Users,
    Search as SearchIcon,
} from "lucide-react";
import { fmt, fmtDate } from "../utils/formatters";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";
import { SortableTableHead } from "../components/SortableTableHead";
import { useTableFilter } from "../hooks/useTableFilter";

function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROLE_COLORS = {
    Driver: "#f97316",
    Turnboy: "#8b5cf6",
    "Office Admin": "#3b82f6",
    "Fleet Manager": "#10b981",
};

function getRoleColor(role) {
    return ROLE_COLORS[role] || "var(--text-dim)";
}

export function Staff({ data, setData, dark, isMobile, openModal, delItem }) {
    const navigate = useNavigate();

    const _staff = (data.staff || []).map(s => ({ ...s, _type: "staff" }));
    const _drivers = (data.drivers || []).map(d => ({ ...d, _type: "driver", role: d.role || "Driver" }));
    const staffList = [..._staff, ..._drivers];

    const refinedStaff = staffList.map(s => ({
        ...s,
        _salary: Number(s.salary || 0),
        _joined: s.joined || "",
        _contact: `${s.phone} ${s.email || ""}`,
    }));

    const {
        filteredRows: sortedStaff,
        setSort: requestSort,
        sortState: sortConfig,
        filterState: staffFilters,
        applyFilter: handleStaffFilterChange,
        getUniqueValues: getStaffUniqueValues,
        searchTerm,
        setSearchTerm,
    } = useTableFilter(refinedStaff, {
        namespace: "stf",
        initialSort: { col: "name", dir: "asc" },
        searchColumns: ["name", "role", "uId", "phone"],
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
                        Add Staff
                    </Button>
                }
            />

            {/* Staff Grid Cards (mobile) / Table (desktop) */}
            <Card className="animate-fade-in" style={{ padding: 0, overflow: "hidden" }}>
                {/* Search Bar */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                    <SearchIcon size={17} color="var(--text-dim)" />
                    <input
                        type="search"
                        placeholder="Search staff by name, role, or phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ border: "none", background: "none", padding: 0, fontSize: 14, flex: 1, color: "var(--text-primary)", fontWeight: 500, outline: "none" }}
                    />
                </div>

                {isMobile ? (
                    /* Mobile: Grid Cards */
                    <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {sortedStaff.length === 0 ? (
                            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "var(--text-dim)" }}>
                                <AlertCircle size={36} style={{ opacity: 0.2, display: "block", margin: "0 auto 10px" }} />
                                <div style={{ fontWeight: 600, fontSize: 14 }}>No staff found.</div>
                            </div>
                        ) : sortedStaff.map(s => (
                            <div
                                key={s.id}
                                onClick={() => navigate(s._type === "driver" ? `/drivers/${s.id}` : `/staff/${s.id}`)}
                                style={{
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-md, 12px)",
                                    padding: 14,
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: "50%",
                                        background: getRoleColor(s.role),
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "white", fontWeight: 900, fontSize: 14, flexShrink: 0,
                                    }}>
                                        {getInitials(s.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                                        <div style={{ fontSize: 11, color: getRoleColor(s.role), fontWeight: 700 }}>{s.role}</div>
                                    </div>
                                </div>
                                <Badge status={s.status} />
                                {s.phone && (
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
                                        <Phone size={10} /> {s.phone}
                                    </div>
                                )}
                                {s.email && (
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
                                        <Mail size={10} /> {s.email}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Desktop: Table */
                    <div className="table-container">
                        <table className="table-modern">
                            <SortableTableHead
                                requestSort={requestSort}
                                sortConfig={sortConfig}
                                filterState={staffFilters}
                                onFilterChange={handleStaffFilterChange}
                                getUniqueValues={getStaffUniqueValues}
                                columns={[
                                    { key: "name", label: "Staff Member", sortable: true },
                                    { key: "role", label: "Role / Department", sortable: true },
                                    { key: "phone", label: "Contact", sortable: true },
                                    { key: "_salary", label: "Salary (KES)", sortable: true, align: "right" },
                                    { key: "_joined", label: "Joined", sortable: true },
                                    { key: "status", label: "Status", sortable: true },
                                    { key: "actions", label: "Actions", sortable: false, align: "right" },
                                ]}
                            />
                            <tbody>
                                {sortedStaff.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                            <AlertCircle size={40} style={{ opacity: 0.2, display: "block", margin: "0 auto 12px" }} />
                                            <div style={{ fontWeight: 600 }}>No staff members found matching your filters.</div>
                                        </td>
                                    </tr>
                                ) : sortedStaff.map(s => (
                                    <tr key={s.id} onClick={() => navigate(s._type === "driver" ? `/drivers/${s.id}` : `/staff/${s.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td title={`${s.name} (${s.email})`}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: "50%",
                                                    background: getRoleColor(s.role),
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: "white", fontWeight: 900, fontSize: 14, flexShrink: 0,
                                                }}>
                                                    {getInitials(s.name)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{s.name}</div>
                                                    {s.email && (
                                                        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                                            <Mail size={10} /> {s.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td title={s.role}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: getRoleColor(s.role), flexShrink: 0 }} />
                                                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{s.role}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5 }}>
                                                <Phone size={12} color="var(--brand-primary)" /> {s.phone}
                                            </div>
                                            {s.firstLogin && (
                                                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                                    <Key size={10} /> OTP: {s.otp}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>{fmt(s.salary)}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                                                <Calendar size={12} color="var(--text-dim)" /> {fmtDate(s.joined)}
                                            </div>
                                        </td>
                                        <td className="status-col"><Badge status={s.status} /></td>
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
                )}
            </Card>

            {staffList.length === 0 && (
                <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 20, border: "1px dashed var(--border-subtle)", marginTop: 24 }}>
                    <Users size={48} color="var(--text-dim)" style={{ opacity: 0.2, marginBottom: 16 }} />
                    <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>No staff members registered yet.</div>
                </div>
            )}
        </div>
    );
}
