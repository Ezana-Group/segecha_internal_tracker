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
        const t = truckReg(i.truck_id || i.truck).toLowerCase();
        const type = (i.incidentType || "").toLowerCase();
        const loc = (i.location || "").toLowerCase();
        const q = search.toLowerCase();
        return d.includes(q) || t.includes(q) || type.includes(q) || loc.includes(q);
    }).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    return (
        <div className="page-shell">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(239, 68, 68, 0.1)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "#ef4444" }}>
                    <AlertTriangle size={22} />
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.03em" }}>Incident Reports</h1>
                    <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                        Monitor and resolve safety incidents reported by the fleet.
                    </p>
                </div>
                <div style={{ display: "flex", gap: 6, background: "var(--bg-card)", padding: 4, borderRadius: 14, border: "1px solid var(--border-subtle)" }}>
                    <button 
                        onClick={() => setTab('pending')}
                        style={{
                            padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
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
                            padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                            background: tab === 'resolved' ? "var(--brand-primary)" : "transparent",
                            color: tab === 'resolved' ? "white" : "var(--text-dim)",
                            transition: "all 0.2s ease"
                        }}
                    >
                        Resolved Log
                    </button>
                </div>
            </div>

            <Card style={{ 
                marginBottom: 16, 
                padding: "14px"
            }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
                <div style={{ textAlign: "center", padding: 32, background: "var(--bg-surface)", borderRadius: 24, border: "1px dashed var(--border-subtle)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", margin: "0 auto 12px" }}>
                        <Shield size={20} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>No incidents found</h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 300, margin: "4px auto 0" }}>
                        {search ? "Adjust your search parameters to find matching reports." : (tab === 'pending' ? "All clear! No safety incidents currently awaiting review." : "No resolved incidents recorded yet.")}
                    </p>
                </div>
            ) : (
            <div className="table-container animate-fade-in" style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                <table className="table-modern">
                    <thead>
                        <tr>
                            <th style={{ width: 130 }}>Date / Time</th>
                            <th style={{ width: 160 }}>Classification</th>
                            <th>Resource Context</th>
                            <th>Incident Location</th>
                            <th style={{ width: 140 }}>Verification</th>
                            <th style={{ width: 100, textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(i => (
                            <tr key={i.id} style={{ opacity: i._pendingApproval ? 1 : 0.85 }}>
                                <td style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Calendar size={12} style={{ color: "var(--brand-primary)" }} />
                                        {fmtDate(i.date || i.createdAt)}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{i.incidentType || "General Incident"}</div>
                                </td>
                                <td>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                                            <User size={12} style={{ opacity: 0.5 }} /> {driverName(i.driverId || i.driver)}
                                        </div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
                                            <Truck size={12} style={{ opacity: 0.5 }} /> {truckReg(i.truck_id || i.truck)}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
                                        <MapPin size={13} />
                                        {i.location || "N/A"}
                                    </div>
                                </td>
                                <td>
                                    <Badge status={i._isRejected ? "Rejected" : (i._pendingApproval ? "Warning" : "Success")} text={i._isRejected ? "Rejected" : (i._pendingApproval ? "Pending Review" : "Resolved")} />
                                </td>
                                <td style={{ textAlign: "right" }}>
                                    {i._pendingApproval ? (
                                        <Button 
                                            size="sm"
                                            variant="primary" 
                                            style={{ background: "#ef4444", height: 28, fontSize: 11.5, padding: "0 12px" }}
                                            onClick={() => setVerifyModal({ ...i, _itemType: 'incident' })}
                                        >
                                            Verify
                                        </Button>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, justifyContent: "flex-end" }}>
                                            <Button size="sm" variant="ghost" style={{ width: 28, height: 28, padding: 0 }} title="View details" onClick={() => window.alert(i.description || "No description provided.")}><Eye size={15} /></Button>
                                            {i.journey && <Button size="sm" variant="ghost" style={{ width: 28, height: 28, padding: 0 }} title="Go to journey" onClick={() => navigate(`/journeys/${i.journey}`)}><Navigation size={15} /></Button>}
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
