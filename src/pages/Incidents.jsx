import React, { useState } from "react";
import { 
    AlertTriangle, 
    Calendar, 
    MapPin, 
    Filter,
    Search,
    ChevronRight,
    CheckCircle2,
    Clock,
    User,
    Truck,
    Navigation,
    Shield,
    Eye
} from "lucide-react";
import { fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";

export function Incidents({ data, dark, isMobile, driverName, truckReg, setVerifyModal }) {
    const [tab, setTab] = useState('pending');
    const [search, setSearch] = useState("");

    const incidents = data.incidents || [];
    const pendingIncidents = incidents.filter(i => i._pendingApproval);
    const resolvedIncidents = incidents.filter(i => !i._pendingApproval);

    const filtered = (tab === 'pending' ? pendingIncidents : resolvedIncidents).filter(i => {
        const d = driverName(i.driverId || i.driver).toLowerCase();
        const t = truckReg(i.truck).toLowerCase();
        const type = (i.incidentType || "").toLowerCase();
        const loc = (i.location || "").toLowerCase();
        const q = search.toLowerCase();
        return d.includes(q) || t.includes(q) || type.includes(q) || loc.includes(q);
    }).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    return (
        <div className="page-shell">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239, 68, 68, 0.1)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "#ef4444" }}>
                    <AlertTriangle size={32} />
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.04em" }}>Incident Reports</h1>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                        Monitor and resolve safety incidents reported by the fleet.
                    </p>
                </div>
                <div style={{ display: "flex", gap: 12, background: "var(--bg-card)", padding: 6, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                    <button 
                        onClick={() => setTab('pending')}
                        style={{
                            padding: "8px 16px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                            background: tab === 'pending' ? "#ef4444" : "transparent",
                            color: tab === 'pending' ? "white" : "var(--text-dim)",
                            transition: "all 0.2s ease"
                        }}
                    >
                        Awaiting Verification ({pendingIncidents.length})
                    </button>
                    <button 
                        onClick={() => setTab('resolved')}
                        style={{
                            padding: "8px 16px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                            background: tab === 'resolved' ? "var(--brand-primary)" : "transparent",
                            color: tab === 'resolved' ? "white" : "var(--text-dim)",
                            transition: "all 0.2s ease"
                        }}
                    >
                        Resolved Log
                    </button>
                </div>
            </div>

            <Card style={{ marginBottom: 32, padding: 20 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                        <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                        <input 
                            placeholder="Search by driver, truck, or incident type..."
                            className="input-premium"
                            style={{ paddingLeft: 44, width: "100%" }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="secondary" icon={Filter}>Filters</Button>
                </div>
            </Card>

            {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 80, background: "var(--bg-surface)", borderRadius: 24, border: "1px dashed var(--border-subtle)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", margin: "0 auto 20px" }}>
                        <Shield size={32} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>No incidents found</h3>
                    <p style={{ color: "var(--text-muted)", maxWidth: 300, margin: "8px auto 0" }}>
                        {search ? "Adjust your search parameters to find matching reports." : (tab === 'pending' ? "All clear! No safety incidents currently awaiting review." : "No resolved incidents recorded yet.")}
                    </p>
                </div>
            ) : (
            <div className="table-container" style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                <table className="table-modern">
                    <thead>
                        <tr>
                            <th style={{ width: 140 }}>Date</th>
                            <th style={{ width: 180 }}>Incident Type</th>
                            <th>Driver</th>
                            <th>Vehicle</th>
                            <th>Location</th>
                            <th style={{ width: 140 }}>Status</th>
                            <th style={{ width: 120 }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(i => (
                            <tr key={i.id} style={{ opacity: i._pendingApproval ? 1 : 0.8 }}>
                                <td style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Calendar size={14} style={{ color: "var(--brand-primary)" }} />
                                        {fmtDate(i.date || i.createdAt)}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{i.incidentType}</div>
                                </td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
                                            <User size={14} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: 14 }}>{driverName(i.driverId || i.driver)}</span>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                                            <Truck size={14} />
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: 14 }}>{truckReg(i.truck)}</span>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
                                        <MapPin size={14} />
                                        {i.location || "N/A"}
                                    </div>
                                </td>
                                <td>
                                    <Badge status={i._isRejected ? "Rejected" : (i._pendingApproval ? "Warning" : "Success")} text={i._isRejected ? "Rejected" : (i._pendingApproval ? "Pending Review" : "Resolved")} />
                                </td>
                                <td>
                                    {i._pendingApproval ? (
                                        <Button 
                                            size="sm"
                                            variant="primary" 
                                            style={{ background: "#ef4444", height: 32, fontSize: 12 }}
                                            onClick={() => setVerifyModal({ ...i, _itemType: 'incident' })}
                                        >
                                            Verify
                                        </Button>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <Button size="sm" variant="ghost" style={{ width: 32, height: 32, padding: 0 }} title="View details" onClick={() => window.alert(i.description || "No description provided.")}><Eye size={16} /></Button>
                                            {i.journey && <Button size="sm" variant="ghost" style={{ width: 32, height: 32, padding: 0 }} title="Go to journey" onClick={() => window.location.href = `/journeys/${i.journey}`}><Navigation size={16} /></Button>}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}
        </div>
    );
}
