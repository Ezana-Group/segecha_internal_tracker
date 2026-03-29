import React from "react";
import { 
    Building2, 
    User, 
    Phone, 
    Mail, 
    MapPin, 
    ArrowLeft,
    FileText,
    TrendingUp,
    Clock,
    CheckCircle2,
    Calendar,
    Truck,
    Navigation,
    AlertCircle,
    Plus
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { fmt, today, fmtN, fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";

export function CustomerProfile({ data, isMobile, truckReg, customerName }) {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const customer = (data.customers || []).find(c => c.id === id);
    if (!customer) return <div style={{ padding: 40, textAlign: "center" }}>Customer not found</div>;

    const invoices = (data.invoices || []).filter(i => i.customerId === id);
    const journeys = (data.journeys || []).filter(j => j.customerId === id);
    
    const totalInvoiced = invoices.reduce((s, i) => s + +i.amount, 0);
    const totalPaid = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + +i.amount, 0);
    const totalOverdue = invoices.filter(i => i.status === "Overdue").reduce((s, i) => s + +i.amount, 0);
    
    const [activeTab, setActiveTab] = React.useState("Overview");

    return (
        <div className="page-shell">
            {/* Back Button */}
            <button 
                onClick={() => navigate("/customers")}
                style={{ background: "none", border: "none", color: "var(--brand-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 24, cursor: "pointer", fontSize: 14 }}
            >
                <ArrowLeft size={16} /> Back to Directory
            </button>

            {/* Profile Header */}
            <Card style={{ marginBottom: 12, padding: "10px 14px", height: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.15)" }}>
                            {customer.type === "Company" ? <Building2 size={22} /> : <User size={22} />}
                        </div>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 0 }}>
                                <h1 style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>{customer.name}</h1>
                                <Badge status={customer.type === "Company" ? "Pending" : "Paid"} text={customer.type} />
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 600, fontFamily: "var(--font-mono)", opacity: 0.8 }}>
                                System ID: {customer.uId}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                            <Mail size={13} color="var(--brand-primary)" /> {customer.email || "No email provided"}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                            <Phone size={13} color="var(--brand-primary)" /> {customer.phone}
                        </div>
                        {customer.address && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                                <MapPin size={13} color="var(--brand-primary)" /> {customer.address}
                            </div>
                        )}
                    </div>
                </div>

                {customer.type === "Company" && customer.contactPerson && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase" }}>Primary Contact:</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{customer.contactPerson}</div>
                    </div>
                )}
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "var(--bg-card)", padding: 14, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", letterSpacing: "0.05em" }}>LIFETIME BOOKINGS</div>
                        <TrendingUp size={14} color="var(--brand-primary)" />
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: "var(--brand-primary)" }}>{journeys.length}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>Completed missions</div>
                </div>
                <div style={{ background: "var(--bg-card)", padding: 14, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", letterSpacing: "0.05em" }}>TOTAL INVOICED</div>
                        <FileText size={14} color="#3b82f6" />
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: "var(--text-primary)" }}>{fmt(totalInvoiced)}</div>
                </div>
                <div style={{ background: "var(--bg-card)", padding: 14, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", letterSpacing: "0.05em" }}>PAYMENTS RECEIVED</div>
                        <CheckCircle2 size={14} color="#10b981" />
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: "#10b981" }}>{fmt(totalPaid)}</div>
                </div>
                <div style={{ background: "var(--bg-card)", padding: 14, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", letterSpacing: "0.05em" }}>BALANCE OVERDUE</div>
                        <AlertCircle size={14} color="#ef4444" />
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: totalOverdue > 0 ? "#ef4444" : "var(--text-primary)" }}>{fmt(totalOverdue)}</div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div style={{ display: "flex", gap: 40, borderBottom: "1px solid var(--border-subtle)", marginBottom: 24, overflowX: "auto" }}>
                {["Overview", "Missions", "Invoices", "Documents & SLA"].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: "none",
                            border: "none",
                            padding: "0 0 16px 0",
                            fontSize: 14,
                            fontWeight: activeTab === tab ? 800 : 700,
                            color: activeTab === tab ? "var(--brand-primary)" : "var(--text-dim)",
                            borderBottom: activeTab === tab ? "3px solid var(--brand-primary)" : "3px solid transparent",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            whiteSpace: "nowrap"
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            {activeTab === "Overview" && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "3fr 2fr", gap: 32 }}>
                    {/* Mission History Snippet */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                                <Navigation size={20} color="var(--brand-primary)" /> Recent Transport
                            </h2>
                            <button onClick={() => setActiveTab("Missions")} style={{ background: "none", border: "none", color: "var(--brand-primary)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>View All</button>
                        </div>
                        <Card style={{ padding: 0, overflow: "hidden" }}>
                            <div className="table-container">
                            <table className="table-modern">
                                <thead>
                                    <tr>
                                        <th className="sticky-col" title="Date">Date</th>
                                        <th title="Route">Route</th>
                                        <th title="Vehicle">Vehicle</th>
                                        <th className="status-col" title="Status">Status</th>
                                        <th style={{ textAlign: "right" }} title="Revenue">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {journeys.length === 0 ? (
                                        <tr><td colSpan="5" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>No missions linked to this client yet.</td></tr>
                                    ) : journeys.sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5).map(j => (
                                        <tr key={j.id}>
                                            <td className="sticky-col" style={{ fontSize: 13, fontWeight: 600 }} title={fmtDate(j.date)}>{fmtDate(j.date)}</td>
                                            <td title={`${j.origin} → ${j.dest}`}>
                                                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{j.origin} → {j.dest}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{j.cargo}</div>
                                            </td>
                                            <td title={truckReg(j.truck)}>
                                                <Badge status="Pending" text={truckReg(j.truck)} />
                                            </td>
                                            <td className="status-col" title={j.status}>
                                                <Badge 
                                                    status={j.status === "Completed" ? "Paid" : j.status === "In Transit" ? "Pending" : "Cancelled"} 
                                                    text={j.status}
                                                />
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 800, color: "var(--brand-primary)" }} title={fmt(j.revenue)}>{fmt(j.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </Card>
                    </div>

                    {/* Invoice Trail Snippet */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                                <FileText size={20} color="var(--brand-primary)" /> Recent Invoices
                            </h2>
                            <button onClick={() => setActiveTab("Invoices")} style={{ background: "none", border: "none", color: "var(--brand-primary)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>View All</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {invoices.length === 0 ? (
                                <div style={{ padding: 40, background: "var(--surface-subtle)", borderRadius: 20, textAlign: "center", color: "var(--text-dim)" }}>No invoices found.</div>
                            ) : invoices.sort((a,b) => b.issued.localeCompare(a.issued)).slice(0, 5).map(inv => (
                                <div key={inv.id} style={{ background: "var(--card-bg)", padding: 12, borderRadius: 16, border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>{inv.id}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
                                            <Calendar size={12} /> Issued {fmtDate(inv.issued)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 14, fontWeight: 900, color: "var(--brand-primary)", marginBottom: 2 }}>{fmt(inv.amount)}</div>
                                        <Badge 
                                            status={inv.status === "Paid" ? "Paid" : inv.status === "Overdue" ? "Overdue" : "Pending"} 
                                            text={inv.status} 
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "Missions" && (
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                        <Navigation size={20} color="var(--brand-primary)" /> All Transport History
                    </h2>
                    <Card style={{ padding: 0, overflow: "hidden" }}>
                        <div className="table-container">
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th className="sticky-col" title="Date">Date</th>
                                    <th title="Route">Route</th>
                                    <th title="Vehicle">Vehicle</th>
                                    <th className="status-col" title="Status">Status</th>
                                    <th style={{ textAlign: "right" }} title="Revenue">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {journeys.length === 0 ? (
                                    <tr><td colSpan="5" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>No missions linked to this client yet.</td></tr>
                                ) : journeys.sort((a,b) => b.date.localeCompare(a.date)).map(j => (
                                    <tr key={j.id}>
                                        <td className="sticky-col" style={{ fontSize: 13, fontWeight: 600 }} title={fmtDate(j.date)}>{fmtDate(j.date)}</td>
                                        <td title={`${j.origin} → ${j.dest}`}>
                                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{j.origin} → {j.dest}</div>
                                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{j.cargo}</div>
                                        </td>
                                        <td title={truckReg(j.truck)}>
                                            <Badge status="Pending" text={truckReg(j.truck)} />
                                        </td>
                                        <td className="status-col" title={j.status}>
                                            <Badge 
                                                status={j.status === "Completed" ? "Paid" : j.status === "In Transit" ? "Pending" : "Cancelled"} 
                                                text={j.status}
                                            />
                                        </td>
                                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--brand-primary)" }} title={fmt(j.revenue)}>{fmt(j.revenue)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === "Invoices" && (
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                        <FileText size={20} color="var(--brand-primary)" /> All Invoices
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                        {invoices.length === 0 ? (
                            <div style={{ padding: 40, background: "var(--surface-subtle)", borderRadius: 20, textAlign: "center", color: "var(--text-dim)", gridColumn: "1/-1" }}>No invoices found.</div>
                        ) : invoices.sort((a,b) => b.issued.localeCompare(a.issued)).map(inv => (
                            <div key={inv.id} style={{ background: "var(--bg-card)", padding: 12, borderRadius: 16, border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>{inv.id}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
                                        <Calendar size={12} /> Issued {fmtDate(inv.issued)}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: "var(--brand-primary)", marginBottom: 2 }}>{fmt(inv.amount)}</div>
                                    <Badge 
                                        status={inv.status === "Paid" ? "Paid" : inv.status === "Overdue" ? "Overdue" : "Pending"} 
                                        text={inv.status} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === "Documents & SLA" && (
                <div style={{ background: "var(--card-bg)", borderRadius: 24, padding: "32px 20px", textAlign: "center", border: "1px dashed var(--border-subtle)" }}>
                    <div style={{ width: 52, height: 52, background: "var(--surface-subtle)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <FileText size={24} color="var(--text-muted)" />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: "var(--text-primary)", marginBottom: 4 }}>No Service Level Agreements found</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 13, maxWidth: 400, margin: "0 auto 16px", lineHeight: 1.5 }}>
                        Upload contracts, SLAs, or compliance documents for {customer.name} to quickly access them when reviewing journeys.
                    </div>
                    <Button variant="premium" icon={Plus}>Upload Document</Button>
                </div>
            )}

        </div>
    );
}
