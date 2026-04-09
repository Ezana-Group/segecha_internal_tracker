import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Truck, Weight, Hash, ArrowUpRight } from "lucide-react";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { DocumentPanel, DOC_TYPES_TRUCK } from "../components/DocumentPanel";
import { TableRowActions } from "../components/TableRowActions";
import { fmtDate, fmtKgDisplay, fmtKgLabel } from "../utils/formatters";

export function TrailerProfile({ data, setData, openModal, truckReg, dark }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState("overview");
    const trailer = (data.trailers || []).find((t) => t.id === id);

    if (!trailer) {
        return (
            <div style={{ padding: 80, textAlign: "center" }}>
                <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
                    <Truck size={56} opacity={0.12} />
                </div>
                <h2 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Trailer Not Found</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>The requested trailer does not exist in the active registry.</p>
                <Button variant="secondary" onClick={() => navigate("/fleet")}>Return to Fleet</Button>
            </div>
        );
    }

    const trailerJourneys = (data.journeys || []).filter((j) => j.trailer === trailer.id).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    return (
        <div className="page-shell">
            <button
                type="button"
                onClick={() => navigate("/fleet")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20, background: "none", border: "none", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}
            >
                <ArrowLeft size={14} />
                Fleet
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "24px 28px", marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--brand-primary)18", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)", flexShrink: 0 }}>
                    <Truck size={28} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.03em", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
                        {trailer.reg}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>
                        <span>{trailer.make || "—"}</span>
                        <span style={{ opacity: 0.3 }}>·</span>
                        <span>{trailer.model || "—"}</span>
                        <span style={{ opacity: 0.3 }}>·</span>
                        <span>{trailer.type || "—"}</span>
                        <Badge status={trailer.status} />
                    </div>
                </div>
                <Button variant="premium" icon={Edit2} onClick={() => openModal("trailer", trailer)}>Edit Profile</Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <Card style={{ padding: 18 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", marginBottom: 10 }}>Configuration</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
                        {[["Axles", trailer.axleCount || "—"], ["Tare (kg)", fmtKgDisplay(trailer.tareWeightKg)], ["Load (kg)", fmtKgDisplay(trailer.capacity)], ["Gross (kg)", fmtKgDisplay(trailer.grossWeightKg)]].map(([k, v]) => (
                            <div key={k}>
                                <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{v}</div>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card style={{ padding: 18 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", marginBottom: 10 }}>Assignment</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Assigned Truck</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{truckReg(trailer.truck)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Date Registered</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{trailer.registeredOn || "—"}</span>
                        </div>
                    </div>
                </Card>
                <Card style={{ padding: 18 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 800, textTransform: "uppercase", marginBottom: 10 }}>Utilization</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>Trips linked</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)" }}>{trailerJourneys.length}</span>
                    </div>
                </Card>
            </div>

            <div style={{ display: "flex", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 6, gap: 4, marginBottom: 24 }}>
                {["overview", "journeys", "documents"].map((k) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        style={{ flex: 1, padding: "9px 16px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease", background: tab === k ? "var(--brand-primary)" : "transparent", color: tab === k ? "white" : "var(--text-dim)" }}
                    >
                        {k[0].toUpperCase() + k.slice(1)}
                    </button>
                ))}
            </div>

            <Card style={{ padding: 0, overflow: "hidden" }}>
                {tab === "overview" && (
                    <div style={{ padding: 24 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                            {[{ l: "Load Capacity", v: fmtKgLabel(trailer.capacity), i: Weight }, { l: "Gross Weight", v: fmtKgLabel(trailer.grossWeightKg), i: Weight }, { l: "Tare Weight", v: fmtKgLabel(trailer.tareWeightKg), i: Weight }, { l: "Axles", v: trailer.axleCount || "—", i: Hash }].map((k) => (
                                <div key={k.l} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "14px 16px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.l}</div>
                                        <k.i size={14} color="var(--text-dim)" />
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{k.v}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === "journeys" && (
                    <div className="table-container">
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Route</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trailerJourneys.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: "center", padding: 60, color: "var(--text-dim)" }}>No journeys linked to this trailer yet.</td>
                                    </tr>
                                ) : trailerJourneys.map((j) => (
                                    <tr key={j.id}>
                                        <td>{fmtDate(j.date)}</td>
                                        <td>{j.origin} → {j.dest}</td>
                                        <td><Badge status={j.status} /></td>
                                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                            <TableRowActions
                                                ariaLabel={`Journey ${j.id}`}
                                                items={[{ id: "open", label: "Open journey", icon: ArrowUpRight, onClick: () => navigate(`/journeys/${j.id}`) }]}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === "documents" && (
                    <div style={{ padding: 24 }}>
                        <DocumentPanel
                            entityType="trailer"
                            entityId={trailer.id}
                            entityLabel={trailer.reg}
                            docTypes={DOC_TYPES_TRUCK}
                            documents={data.documents}
                            setDocuments={(docs) => setData((d) => ({ ...d, documents: typeof docs === "function" ? docs(d.documents) : docs }))}
                            dark={dark}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
