import React, { useState } from "react";
import {
    AlertTriangle,
    Calendar,
    MapPin,
    User,
    Truck,
    Navigation,
    Shield,
    Eye,
    Plus,
    X,
    ClipboardList,
    Search,
} from "lucide-react";
import { fmtDate } from "../utils/formatters";
import { fetchWithAuth } from "../utils/api";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { getIncidentTypes, subscribeSettings } from "../utils/settingsStore.js";

const EMPTY_FORM = {
    date: new Date().toISOString().split('T')[0],
    incidentType: "Accident",
    incidentTypeOther: "",
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
    const [, bumpSettingsVersion] = useState(0);
    const INCIDENT_TYPES = getIncidentTypes();

    React.useEffect(() => subscribeSettings(() => bumpSettingsVersion((n) => n + 1)), []);

    const drivers = data.drivers || [];
    const fleet   = data.trucks  || [];

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
        const effectiveIncidentType = logForm.incidentType === "Other"
            ? logForm.incidentTypeOther.trim()
            : logForm.incidentType;
        if (!effectiveIncidentType || !logForm.description.trim()) return;
        setLogSubmitting(true);
        try {
            const res = await fetchWithAuth('/admin/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...logForm, incidentType: effectiveIncidentType }),
            });
            if (res.ok) {
                const { id } = await res.json();
                setLocalIncidents(prev => [{
                    id,
                    driverId:     logForm.driverId,
                    truck:        logForm.truck,
                    incidentType: effectiveIncidentType,
                    location:     logForm.location,
                    description:  logForm.description,
                    date:         logForm.date,
                    _pendingApproval: false,
                    _isRejected:      false,
                    createdAt:    new Date().toISOString(),
                }, ...prev]);
                setLogModal(false);
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
            <PageHeader
                icon={AlertTriangle}
                title="Incidents"
                description="Monitor and resolve safety incidents reported by the fleet."
                actions={
                    <Button variant="premium" icon={Plus} onClick={openModal}>
                        Log Incident
                    </Button>
                }
                belowTitle={
                    /* Severity / status filter tabs */
                    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
                        {[
                            { id: "pending",  label: `Awaiting Verification (${pendingIncidents.length})`, color: "#ef4444" },
                            { id: "resolved", label: "Resolved Log",                                       color: "var(--brand-primary)" },
                        ].map(({ id, label, color }) => (
                            <button
                                key={id}
                                onClick={() => setTab(id)}
                                style={{
                                    padding: "11px 18px",
                                    border: "none",
                                    background: "none",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    color: tab === id ? color : "var(--text-dim)",
                                    position: "relative",
                                    transition: "color 0.15s",
                                }}
                            >
                                {label}
                                {tab === id && (
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: color, borderRadius: "2px 2px 0 0" }} />
                                )}
                            </button>
                        ))}
                    </div>
                }
            />

            {/* ── Search bar ── */}
            <div style={{ position: "relative", marginBottom: 24 }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} />
                <input
                    placeholder="Search by driver, truck, type, or location..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        height: 42,
                        paddingLeft: 40,
                        paddingRight: 16,
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-card)",
                        fontSize: 14,
                        color: "var(--text-primary)",
                        fontWeight: 500,
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>

            {/* ── Table / Empty state ── */}
            {filtered.length === 0 ? (
                <div style={{
                    textAlign: "center",
                    padding: "64px 20px",
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius-md)",
                    border: "1px dashed var(--border-subtle)",
                }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: "var(--radius-md)",
                        background: "var(--surface-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-dim)",
                        margin: "0 auto 16px",
                    }}>
                        <Shield size={28} />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>No incidents found</h3>
                    <p style={{ color: "var(--text-muted)", maxWidth: 280, margin: "8px auto 0", fontSize: 13 }}>
                        {search
                            ? "Adjust your search to find matching reports."
                            : tab === 'pending'
                                ? "All clear — no incidents awaiting review."
                                : "No resolved incidents recorded yet."}
                    </p>
                    {!search && tab === 'resolved' && (
                        <Button variant="premium" icon={Plus} onClick={openModal} style={{ marginTop: 20 }}>
                            Log first incident
                        </Button>
                    )}
                </div>
            ) : (
                <Card style={{ padding: 0, overflow: "hidden", borderRadius: "var(--radius-md)" }}>
                    <div className="table-container">
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Driver</th>
                                    <th>Vehicle</th>
                                    <th>Location</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right" }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(i => (
                                    <tr
                                        key={i.id}
                                        style={{
                                            opacity: i._isRejected ? 0.6 : 1,
                                            borderLeft: i._isRejected
                                                ? "3px solid #ef444440"
                                                : i._pendingApproval
                                                    ? "3px solid #f59e0b40"
                                                    : "3px solid #10b98140",
                                        }}
                                    >
                                        {/* Date */}
                                        <td style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <Calendar size={13} color="var(--brand-primary)" />
                                                {fmtDate(i.date || i.createdAt)}
                                            </div>
                                        </td>

                                        {/* Incident type */}
                                        <td style={{ fontWeight: 800, color: "var(--text-primary)" }}>
                                            {i.incidentType}
                                        </td>

                                        {/* Driver */}
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", flexShrink: 0 }}>
                                                    <User size={13} />
                                                </div>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>{driverName(i.driverId || i.driver)}</span>
                                            </div>
                                        </td>

                                        {/* Vehicle */}
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", flexShrink: 0 }}>
                                                    <Truck size={13} />
                                                </div>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>{truckReg(i.truck)}</span>
                                            </div>
                                        </td>

                                        {/* Location */}
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-dim)" }}>
                                                <MapPin size={13} />
                                                {i.location || "N/A"}
                                            </div>
                                        </td>

                                        {/* Status badge */}
                                        <td>
                                            <Badge
                                                status={i._isRejected ? "Overdue" : (i._pendingApproval ? "Warning" : "Active")}
                                            >
                                                {i._isRejected ? "Rejected" : (i._pendingApproval ? "Pending Review" : "Resolved")}
                                            </Badge>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ textAlign: "right" }}>
                                            {i._pendingApproval ? (
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    style={{ background: "#ef4444", fontSize: 12 }}
                                                    onClick={() => setVerifyModal({ ...i, _itemType: 'incident' })}
                                                >
                                                    Verify
                                                </Button>
                                            ) : (
                                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        style={{ width: 32, height: 32, padding: 0 }}
                                                        title="View details"
                                                        onClick={() => window.alert(i.description || "No description provided.")}
                                                    >
                                                        <Eye size={15} />
                                                    </Button>
                                                    {i.journey && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            style={{ width: 32, height: 32, padding: 0 }}
                                                            title="Go to journey"
                                                            onClick={() => window.location.href = `/journeys/${i.journey}`}
                                                        >
                                                            <Navigation size={15} />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* ── Log Incident Modal ── */}
            {logModal && (
                <div
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setLogModal(false); }}
                >
                    <div style={{
                        background: "var(--bg-card)",
                        borderRadius: 20,
                        border: "1px solid var(--border-subtle)",
                        width: "100%",
                        maxWidth: 560,
                        maxHeight: "90vh",
                        overflowY: "auto",
                        boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
                    }}>
                        {/* Modal header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
                            <div style={{ width: 38, height: 38, borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", flexShrink: 0 }}>
                                <ClipboardList size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Log Incident</h3>
                                <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>Record a safety incident. Goes straight to the resolved log.</p>
                            </div>
                            <button
                                onClick={() => setLogModal(false)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                            {/* Date + Type */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Date</label>
                                    <input
                                        type="date"
                                        value={logForm.date}
                                        onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))}
                                        style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Incident Type</label>
                                    <select
                                        value={logForm.incidentType}
                                        onChange={e => setLogForm(f => ({ ...f, incidentType: e.target.value, incidentTypeOther: e.target.value === "Other" ? f.incidentTypeOther : "" }))}
                                        style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                    >
                                        {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            {logForm.incidentType === "Other" && (
                                <div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Specify Incident Type</label>
                                    <input
                                        placeholder="e.g. Security breach, strike event"
                                        value={logForm.incidentTypeOther}
                                        onChange={e => setLogForm(f => ({ ...f, incidentTypeOther: e.target.value }))}
                                        style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                    />
                                </div>
                            )}

                            {/* Driver */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Driver</label>
                                {drivers.length > 0 ? (
                                    <select
                                        value={logForm.driverId}
                                        onChange={e => setLogForm(f => ({ ...f, driverId: e.target.value }))}
                                        style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                    >
                                        <option value="">— Select driver —</option>
                                        {drivers.map(d => (
                                            <option key={d.id} value={d.id}>{d.name || d.displayName || d.id}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        placeholder="Driver name or ID"
                                        value={logForm.driverId}
                                        onChange={e => setLogForm(f => ({ ...f, driverId: e.target.value }))}
                                        style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                    />
                                )}
                            </div>

                            {/* Vehicle */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Vehicle</label>
                                {fleet.length > 0 ? (
                                    <select
                                        value={logForm.truck}
                                        onChange={e => setLogForm(f => ({ ...f, truck: e.target.value }))}
                                        style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                    >
                                        <option value="">— Select vehicle —</option>
                                        {fleet.map(v => (
                                            <option key={v.id} value={v.id}>{v.reg || v.registration || v.name || v.id}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        placeholder="Truck registration"
                                        value={logForm.truck}
                                        onChange={e => setLogForm(f => ({ ...f, truck: e.target.value }))}
                                        style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                    />
                                )}
                            </div>

                            {/* Location */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Location</label>
                                <input
                                    placeholder="e.g. Mombasa Rd, near Athi River"
                                    value={logForm.location}
                                    onChange={e => setLogForm(f => ({ ...f, location: e.target.value }))}
                                    style={{ width: "100%", height: 40, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                                    Description <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <textarea
                                    placeholder="Describe what happened..."
                                    rows={4}
                                    value={logForm.description}
                                    onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))}
                                    style={{ width: "100%", background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                                />
                            </div>

                            {/* Modal actions */}
                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                                <Button variant="ghost" onClick={() => setLogModal(false)}>Cancel</Button>
                                <Button
                                    variant="primary"
                                    loading={logSubmitting}
                                    disabled={logSubmitting || !logForm.description.trim() || (logForm.incidentType === "Other" && !logForm.incidentTypeOther.trim())}
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
