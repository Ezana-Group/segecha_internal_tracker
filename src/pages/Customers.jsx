import React, { useState } from "react";
import { 
    Users, 
    Building2, 
    User, 
    Search as SearchIcon, 
    Plus, 
    Phone, 
    Mail, 
    ExternalLink,
    ChevronRight,
    TrendingUp,
    FileText,
    CreditCard,
    Edit2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fmt } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";

export function Customers({ data, isMobile, openModal, customerName, truckReg }) {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    
    const customers = data.customers || [];
    
    const filtered = customers.filter(c => 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    const getCustomerStats = (customerId) => {
        const invoices = (data.invoices || []).filter(i => i.customerId === customerId);
        const journeys = (data.journeys || []).filter(j => 
            invoices.some(inv => inv.journey === j.id)
        );
        const totalRevenue = invoices.reduce((s, i) => s + +i.amount, 0);
        const totalPaid = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + +i.amount, 0);
        
        return {
            journeyCount: journeys.length,
            invoiceCount: invoices.length,
            totalRevenue,
            totalPaid,
            pendingAmount: totalRevenue - totalPaid
        };
    };

    return (
        <div className="page-shell">
            <PageHeader
                icon={Building2}
                title="Customers"
                description="Accounts, contacts, and revenue exposure."
                actions={
                    <Button variant="premium" icon={Plus} onClick={() => openModal("customer", { type: "Company" })}>
                        Add client
                    </Button>
                }
            />

            {/* Top Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
                <Card title="Total Clients" icon={Users} accent="var(--brand-primary)">
                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{customers.length}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                        {customers.filter(c => c.type === "Company").length} Companies • {customers.filter(c => c.type === "Individual").length} Individuals
                    </div>
                </Card>
                <Card title="Revenue Generated" icon={TrendingUp} accent="#10b981">
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#10b981" }}>
                        {fmt((data.invoices || []).reduce((s, i) => s + +i.amount, 0))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Lifetime billing across all clients</div>
                </Card>
                <Card title="Active Invoices" icon={FileText} accent="#f59e0b">
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>
                        {(data.invoices || []).filter(i => i.status !== "Paid").length}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Awaiting payment confirmation</div>
                </Card>
            </div>

            {/* Filters (Search Section) */}
            <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                marginBottom: 24,
                background: "var(--bg-card)",
                padding: "16px 20px",
                borderRadius: 20,
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(12px)"
            }}>
                <div style={{ position: "relative", flex: 1, maxWidth: 450 }}>
                    <SearchIcon style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--brand-primary)" }} size={18} />
                    <input 
                        className="input-modern input-modern--filter"
                        placeholder="Search by name, contact, phone or ID..." 
                        style={{ 
                            paddingLeft: 48, 
                            height: 48, 
                            fontSize: 14, 
                            borderRadius: 14,
                            background: "var(--surface-subtle)",
                            border: "1px solid transparent"
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Customer List */}
            <Card style={{ padding: 0, overflow: "hidden", borderRadius: 24 }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Client ID</th>
                                <th>Client Name</th>
                                <th>Type</th>
                                <th>Contact Info</th>
                                <th>Missions</th>
                                <th>Financials</th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
                                        No customers found.
                                    </td>
                                </tr>
                            ) : filtered.map(c => {
                                const stats = getCustomerStats(c.id);
                                return (
                                    <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} style={{ cursor: "pointer" }} className="hover-scale">
                                        <td>
                                            <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-subtle)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                                                {c.uId || c.id.slice(0, 8).toUpperCase()}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    {c.type === "Company" ? <Building2 size={18} color="var(--brand-primary)" /> : <User size={18} color="#10b981" />}
                                                </div>
                                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{c.name}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge 
                                                status={c.type === "Company" ? "Pending" : "Paid"} 
                                                text={c.type} 
                                            />
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                                <Phone size={12} color="var(--text-dim)" /> {c.phone}
                                            </div>
                                            {c.contactPerson && (
                                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                                                    Attn: {c.contactPerson}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{stats.journeyCount} Missions</div>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{stats.invoiceCount} Invoices generated</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 800, color: "var(--brand-primary)", fontSize: 14 }}>{fmt(stats.totalRevenue)}</div>
                                            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>{stats.totalPaid > 0 ? `Paid: ${fmt(stats.totalPaid)}` : 'No payments yet'}</div>
                                        </td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for ${c.name}`}
                                                items={[
                                                    {
                                                        id: "profile",
                                                        label: "View profile",
                                                        icon: ExternalLink,
                                                        onClick: (e) => {
                                                            e.stopPropagation();
                                                            navigate(`/customers/${c.id}`);
                                                        },
                                                    },
                                                    {
                                                        id: "edit",
                                                        label: "Edit client",
                                                        icon: Edit2,
                                                        onClick: (e) => {
                                                            e.stopPropagation();
                                                            openModal("customer", c);
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
                </div>
            </Card>
        </div>
    );
}
