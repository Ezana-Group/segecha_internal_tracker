import { 
    User, 
    Phone, 
    CreditCard, 
    Briefcase, 
    Plus, 
    Edit2, 
    Trash2, 
    ExternalLink,
    Mail
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

export function Drivers({ data, setData, dark, isMobile, modal, form, setForm, openModal, closeModal, saveItem, delItem, truckReg }) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");

    const filteredDrivers = data.drivers.filter(d => 
        (d.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.phone || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.uId || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <div style={{ padding: 20, borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ position: "relative", maxWidth: 400 }}>
                        <SearchIcon size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                        <input 
                            type="text" 
                            placeholder="Search drivers by name, phone, or ID..." 
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
                                <th>Driver Name</th>
                                <th>Contact Information</th>
                                <th>License & Class</th>
                                <th>Assigned Vehicle</th>
                                <th>Monthly Salary</th>
                                <th>Status</th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDrivers.map(d => (
                                <tr key={d.id} onClick={() => navigate(`/drivers/${d.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                    <td>
                                        <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                                            {d.uId}
                                        </div>
                                    </td>
                                    <td>
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
                                    <td>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.phone}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                            <CreditCard size={10} color="#10b981" /> {d.mpesa}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{d.license}</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                                            {(Array.isArray(d.class) ? d.class : [d.class]).filter(Boolean).map(c => (
                                                <span key={c} style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border-subtle)", fontWeight: 600 }}>{c}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ 
                                            fontSize: 13, 
                                            fontWeight: 800, 
                                            color: "var(--brand-primary)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6
                                        }}>
                                            {d.truck ? truckReg(d.truck) : <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>Unassigned</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>{fmt(d.salary)}</div>
                                    </td>
                                    <td><Badge status={d.status} /></td>
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
