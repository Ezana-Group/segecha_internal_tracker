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
} from "lucide-react";
import { fmt, uid, fmtDate } from "../utils/formatters";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";

export function Staff({ data, setData, dark, isMobile, openModal, delItem }) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");

    const getRoleColor = (role) => {
        if (role === 'Driver') return '#f97316';
        if (role === 'Turnboy') return '#8b5cf6';
        if (role === 'Office Admin') return '#3b82f6';
        if (role === 'Fleet Manager') return '#10b981';
        return 'var(--text-dim)';
    };

    const _staff = (data.staff || []).map(s => ({ ...s, _type: 'staff' }));
    const _drivers = (data.drivers || []).map(d => ({ ...d, _type: 'driver', role: d.role || 'Driver' }));
    const staffList = [..._staff, ..._drivers].sort((a, b) => a.name.localeCompare(b.name)).filter(s => 
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.uId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.role || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <div style={{ padding: 20, borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ position: "relative", maxWidth: 400 }}>
                        <SearchIcon size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                        <input 
                            type="text" 
                            placeholder="Search staff by name, role, phone, or ID..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: "100%", padding: "12px 16px 12px 48px", borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-card)", fontSize: 14, color: "var(--text-primary)", outline: "none" }}
                        />
                    </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Staff Member</th>
                                <th>Role & Department</th>
                                <th>Contact Information</th>
                                <th>Salary (KES)</th>
                                <th>Joined Date</th>
                                <th>Status</th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffList.map(s => (
                                <tr key={s.id} onClick={() => navigate(s._type === 'driver' ? `/drivers/${s.id}` : `/staff/${s.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                    <td>
                                        <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                            {s.uId}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ 
                                                width: 40, 
                                                height: 40, 
                                                borderRadius: 12, 
                                                background: "var(--bg-surface)", 
                                                display: "flex", 
                                                alignItems: "center", 
                                                justifyContent: "center", 
                                                color: getRoleColor(s.role)
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
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <Briefcase size={14} color="var(--text-dim)" />
                                            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{s.role}</span>
                                        </div>
                                    </td>
                                    <td>
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
                                    <td>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                                            <DollarSign size={14} /> {fmt(s.salary).replace('KES ', '')}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                                            <Calendar size={12} color="var(--text-dim)" /> {fmtDate(s.joined)}
                                        </div>
                                    </td>
                                    <td><Badge status={s.status} /></td>
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
