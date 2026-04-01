import React, { useState } from "react";
import {
    AlertTriangle,
    Calendar,
    MapPin,
    Filter,
    Search,
    User,
    Truck,
    Navigation,
    Shield,
    Eye,
    Plus,
    X,
    ClipboardList,
} from "lucide-react";
import { fmtDate } from "../utils/formatters";
import { fetchWithAuth } from "../utils/api";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";

const INCIDENT_TYPES = [
    "Accident",
    "Breakdown",
    "Theft",
    "Near Miss",
    "Vehicle Damage",
    "Road Incident",
    "Cargo Damage",
    "Driver Incident",
    "Other",
];

const EMPTY_FORM = {
    date: new Date().toISOString().split('T')[0],
    incidentType: "Accident",
    driverId: "",
    truck: "",
    location: "",
    description: "",
};

export function Incidents({ data, dark, isMobile, driverName, truckReg, setVerifyModal, showToast }) {
    const [tab, setTab] = useState('pending');
    const [search, setSearch] = useState("");
    const [logModal, setLogModal] = useState(false);
    const [logForm, setLogForm] = useState(EMPTY_FORM);
    const [logSubmitting, setLogSubmitting] = useState(false);
    const [localIncidents, setLocalIncidents] = useState([]);

    const drivers = data.drivers || [];
    const fleet   = data.fleet   || [];

    // Merge server incidents with any locally-added ones (show immediately after submit)
    const allIncidents = [...localIncidents, ...(data.incidents || [])];
    const pendingIncidents  = allIncidents.filter(i => i._pendingApproval);
    const resolvedIncidents = allIncidents.filter(i => !i._pendingApproval);

    const filtered = (tab === 'pending' ? pendingIncidents : resolvedIncidents).filter(i => {
        const d    = driverName(i.driverId || i.driver).toLowerCase();
        const t    = truckReg(i.truck).toLowerCase();
        const type = (i.incidentType || "").toLowerCase();
        const loc  = (i.location || "").toLowerCase();
        const q    = search.toLowerCase();
        return d.includes(q) || t.includes(q) || type.includes(q) || loc.includes(q);
    }).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    const openModal = () => {
        setLogForm(EMPTY_FORM);
        setLogModal(true);
    };

    const submitIncident = async () => {
        if (!logForm.incidentType || !logForm.description.trim()) return;
        setLogSubmitting(true);
        try {
            const res = await fetchWithAuth('/admin/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logForm),
            });
            if (res.ok) {
                const { id } = await res.json();
                // Add optimistic entry so it shows immediately in the Resolved Log
                setLocalIncidents(prev => [{
                    id,
                    driverId:     logForm.driverId,
                    truck:        logForm.truck,
                    incidentType: logForm.incidentType,
                    location:     logForm.location,
                    description:  logForm.description,
                    date:         logForm.date,
                    _pendingApproval: false,
                    _isRejected:      false,
                    createdAt:    new Date().toISOString(),
                }, ...prev]);
                setLogModal(false);
                // Switch to resolved tab so the user sees the new entry
                setTab('resolved');
                showToast?.("Incident logged successfully", "success");
            } else {
                showToast?.("Failed to log incident", "error");
            }
        } catch {
            showToast?.("Network error — incident not saved", "error");
        } finally {
            setLogSubmitting(false);
        }
    };

    return (
        <div className="page-shell">
            {/* ── Header ── */}
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
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <Button variant="premium" icon={Plus} onClick={openModal}>
                        Log Incident
                    </Button>
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
            </div>

            {/* ── Search bar ── */}
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

            {/* ── Table / Empty state ── */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 80, background: "var(--bg-surface)", borderRadius: 24, border: "1px dashed var(--border-subtle)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", margin: "0 auto 20px" }}>
                        <Shield size={32} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>No incidents found</h3>
                    <p style={{ color: "var(--text-muted)", maxWidth: 300, margin: "8px auto 0" }}>
                        {search
                            ? "Adjust your search parameters to find matching reports."
                            : tab === 'pending'
                                ? "All clear! No safety incidents currently awaiting review."
                                : "No resolved incidents recorded yet."}
                    </p>
                    {!search && tab === 'resolved' && (
                        <Button variant="premium" icon={Plus} onClick={openModal} style={{ marginTop: 20 }}>
                            Log first incident
                        </Button>
                    )}
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
                                        <Badge
                                            status={i._isRejected ? "Rejected" : (i._pendingApproval ? "Warning" : "Success")}
                                            text={i._isRejected ? "Rejected" : (i._pendingApproval ? "Pending Review" : "Resolved")}
                                        />
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

            {/* ── Log Incident Modal ── */}
            {logModal && (
                <div
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setLogModal(false); }}
                >
                    <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-subtle)", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
                        {/* Modal header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", flexShrink: 0 }}>
                                <ClipboardList size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Log Incident</h3>
                                <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>Record a safety incident directly. Goes straight to the resolved log.</p>
                            </div>
                            <button onClick={() => setLogModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                            {/* Date + Type */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Date</label>
                                    <input
                                        type="date"
                                        className="input-premium"
                                        value={logForm.date}
                                        onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))}
                                        style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Incident Type</label>
                                    <select
                                        className="input-premium"
                                        value={logForm.incidentType}
                                        onChange={e => setLogForm(f => ({ ...f, incidentType: e.target.value }))}
                                        style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}
                                    >
                                        {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Driver */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Driver</label>
                                {drivers.length > 0 ? (
                                    <select
                                        className="input-premium"
                                        value={logForm.driverId}
                                        onChange={e => setLogForm(f => ({ ...f, driverId: e.target.value }))}
                                        style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}
                                    >
                                        <option value="">— Select driver —</option>
                                        {drivers.map(d => (
                                            <option key={d.id} value={d.id}>{d.name || d.displayName || d.id}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="input-premium"
                                        placeholder="Driver name or ID"
                                        value={logForm.driverId}
                                        onChange={e => setLogForm(f => ({ ...f, driverId: e.target.value }))}
                                        style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}
                                    />
                                )}
                            </div>

                            {/* Vehicle */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Vehicle</label>
                                {fleet.length > 0 ? (
                                    <select
                                        className="input-premium"
                                        value={logForm.truck}
                                        onChange={e => setLogForm(f => ({ ...f, truck: e.target.value }))}
                                        style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}
                                    >
                                        <option value="">— Select vehicle —</option>
                                        {fleet.map(v => (
                                            <option key={v.id} value={v.id}>{v.reg || v.registration || v.name || v.id}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="input-premium"
                                        placeholder="Truck registration"
                                        value={logForm.truck}
                                        onChange={e => setLogForm(f => ({ ...f, truck: e.target.value }))}
                                        style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}
                                    />
                                )}
                            </div>

                            {/* Location */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Location</label>
                                <input
                                    className="input-premium"
                                    placeholder="e.g. Mombasa Rd, near Athi River"
                                    value={logForm.location}
                                    onChange={e => setLogForm(f => ({ ...f, location: e.target.value }))}
                                    style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Description <span style={{ color: "#ef4444" }}>*</span></label>
                                <textarea
                                    className="input-premium"
                                    placeholder="Describe what happened..."
                                    rows={4}
                                    value={logForm.description}
                                    onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))}
                                    style={{ width: "100%", background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", fontWeight: 600, resize: "vertical" }}
                                />
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 4 }}>
                                <Button variant="ghost" onClick={() => setLogModal(false)}>Cancel</Button>
                                <Button
                                    variant="primary"
                                    loading={logSubmitting}
                                    disabled={logSubmitting || !logForm.description.trim()}
                                    onClick={submitIncident}
                                    style={{ background: "#ef4444" }}
                                >
                                    Log Incident
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
