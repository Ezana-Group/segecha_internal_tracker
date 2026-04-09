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
import { fmt, today, fmtN, fmtDate, displayRecordId } from "../utils/formatters";
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
            {/* Back Link */}
            <button
                type="button"
                onClick={() => navigate("/customers")}
                style={{ background: "none", border: "none", color: "var(--brand-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 24, cursor: "pointer", fontSize: 14, padding: 0 }}
            >
                <ArrowLeft size={16} /> Customers
            </button>

            {/* Profile Header */}
            <Card style={{ marginBottom: 28, padding: 28 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                    {/* Avatar icon */}
                    <div style={{
                        width: 72, height: 72, borderRadius: 18,
                        background: customer.type === "Company" ? "var(--brand-primary)" : "#10b981",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "white", flexShrink: 0,
                    }}>
                        {customer.type === "Company" ? <Building2 size={36} /> : <User size={36} />}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                            <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.03em" }}>{customer.name}</h1>
                            <Badge status={customer.type === "Company" ? "Active" : "Paid"} text={customer.type} />
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 10 }} title={customer.id !== displayRecordId(customer) ? `Internal id: ${customer.id}` : undefined}>
                            ID: {displayRecordId(customer)}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                            <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                <Phone size={13} color="var(--brand-primary)" /> {customer.phone}
                            </span>
                            {customer.email && (
                                <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <Mail size={13} color="var(--brand-primary)" /> {customer.email}
                                </span>
                            )}
                            {customer.address && (
                                <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                                    <MapPin size={13} color="var(--brand-primary)" /> {customer.address}
                                </span>
                            )}
                        </div>
                        {customer.type === "Company" && customer.contactPerson && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-primary)", textTransform: "uppercase" }}>Contact:</span>
                                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{customer.contactPerson}</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
                {[
                    { label: "Lifetime Journeys", value: journeys.length, color: "var(--brand-primary)", icon: TrendingUp },
                    { label: "Total Invoiced", value: fmt(totalInvoiced), color: "var(--text-primary)", icon: FileText },
                    { label: "Payments Received", value: fmt(totalPaid), color: "#10b981", icon: CheckCircle2 },
                    { label: "Balance Overdue", value: fmt(totalOverdue), color: totalOverdue > 0 ? "#ef4444" : "var(--text-primary)", icon: AlertCircle },
                ].map(stat => {
                    const Ic = stat.icon;
                    return (
                        <div key={stat.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md, 12px)", padding: "20px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
                                <Ic size={15} color={stat.color} />
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                        </div>
                    );
                })}
            </div>

            {/* Tab Navigation */}
            <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md, 12px)", padding: 5, gap: 4, marginBottom: 28, overflowX: "auto" }} className="hide-scrollbar">
                {["Overview", "Missions", "Invoices", "Documents & SLA"].map(tab => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1,
                            padding: "9px 18px",
                            borderRadius: 8,
                            border: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s ease",
                            background: activeTab === tab ? "var(--brand-primary)" : "transparent",
                            color: activeTab === tab ? "white" : "var(--text-dim)",
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
                                <div key={inv.id} style={{ background: "var(--card-bg)", padding: 20, borderRadius: 20, border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{inv.id}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
                                            <Calendar size={12} /> Issued {fmtDate(inv.issued)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 16, fontWeight: 900, color: "var(--brand-primary)", marginBottom: 4 }}>{fmt(inv.amount)}</div>
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
                            <div key={inv.id} style={{ background: "var(--card-bg)", padding: 20, borderRadius: 20, border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{inv.id}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
                                        <Calendar size={12} /> Issued {fmtDate(inv.issued)}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 16, fontWeight: 900, color: "var(--brand-primary)", marginBottom: 4 }}>{fmt(inv.amount)}</div>
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
                <div style={{ background: "var(--card-bg)", borderRadius: 24, padding: "60px 20px", textAlign: "center", border: "1px dashed var(--border-subtle)" }}>
                    <div style={{ width: 64, height: 64, background: "var(--surface-subtle)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                        <FileText size={32} color="var(--text-muted)" />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)", marginBottom: 8 }}>No Service Level Agreements found</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 14, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.5 }}>
                        Upload contracts, SLAs, or compliance documents for {customer.name} to quickly access them when reviewing journeys.
                    </div>
                    <Button variant="premium" icon={Plus}>Upload Document</Button>
                </div>
            )}

        </div>
    );
}
