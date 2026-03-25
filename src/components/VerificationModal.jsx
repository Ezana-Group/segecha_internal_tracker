import React from "react";
import { fmt, fmtDate } from "../utils/formatters";
import { X, Shield, Truck, User, MapPin, Package, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";

export function VerificationModal({ 
    journey, setVerifyModal, verifyJourney, verifySubmission, rejectReason, setRejectReason, 
    verifyLoading, verifyMsg, dark, driverName, truckReg, driverPhone, customerName
}) {
    if (!journey) return null;

    const type = journey._itemType || 'journey';

    const normalizePhoneToWa = (raw) => {
        const digits = String(raw || '').replace(/\D/g, '');
        if (!digits) return '';
        return '254' + digits.slice(-9);
    };

    const buildWhatsAppRejectUrl = (item, reason) => {
        const rawPhone = item._driverPhone || (driverPhone ? driverPhone(item.driver || item._submittedBy) : '');
        const phone = normalizePhoneToWa(rawPhone) || '254700000000';
        
        let text = "";
        if (type === 'fuel') {
            text = `*Fuel log rejected*\n\nTruck: ${truckReg(item.truck)}\nDate: ${item.date}\nLitres: ${item.litres}L\n\n*Reason:* ${reason}\n\nPlease correct and re-submit.`;
        } else if (type === 'expense') {
            text = `*Expense claim rejected*\n\nTruck: ${truckReg(item.truck)}\nDate: ${item.date}\nAmount: ${item.amount}\n\n*Reason:* ${reason}\n\nPlease correct and re-submit.`;
        } else if (type === 'incident') {
            text = `*Incident report rejected*\n\nType: ${item.incidentType}\nDate: ${item.date || item.createdAt}\n\n*Reason:* ${reason}\n\nPlease provide more details and re-submit.`;
        } else {
            const isStart = item.status === 'Awaiting Start Verification';
            text = isStart
                ? `*Trip start approval rejected*\n\nRoute: ${item.origin} → ${item.dest}\nTruck: ${truckReg(item.truck)}\n\n*Reason:* ${reason}\n\nPlease re-check details and re-submit.`
                : `*Journey verification rejected*\n\nRoute: ${item.origin} → ${item.dest}\nTruck: ${truckReg(item.truck)}\n\n*Reason:* ${reason}\n\nPlease re-check details and re-submit.`;
        }
        return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    };

    const buildWhatsAppApproveUrl = (item) => {
        const rawPhone = item._driverPhone || (driverPhone ? driverPhone(item.driver || item._submittedBy) : '');
        const phone = normalizePhoneToWa(rawPhone) || '254700000000';
        
        let text = "";
        if (type === 'fuel') {
            text = `*Fuel log approved*\n\nTruck: ${truckReg(item.truck)}\nDate: ${item.date}\nLitres: ${item.litres}L\n\nThank you.`;
        } else if (type === 'expense') {
            text = `*Expense claim approved*\n\nTruck: ${truckReg(item.truck)}\nDate: ${item.date}\nAmount: ${item.amount}\n\nThank you.`;
        } else if (type === 'incident') {
            text = `*Incident report resolved*\n\nType: ${item.incidentType}\nDate: ${item.date || item.createdAt}\n\nThank you for reporting.`;
        } else {
            const isStart = item.status === 'Awaiting Start Verification';
            text = isStart
                ? `*Trip start approved*\n\nRoute: ${item.origin} → ${item.dest}\nTruck: ${truckReg(item.truck)}\n\nProceed to destination.`
                : `*Journey completed*\n\nRoute: ${item.origin} → ${item.dest}\nTruck: ${truckReg(item.truck)}\n\nThank you.`;
        }
        return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    };

    const overlayStyle = {
        position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.85)", backdropFilter: "blur(8px)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto"
    };

    const modalStyle = {
        background: "var(--bg-surface)", borderRadius: 24, width: "min(640px, 100%)", maxHeight: "90vh",
        display: "flex", flexDirection: "column", border: "1px solid var(--border-medium)", overflow: "hidden"
    };

    const isStartApproval = journey.status === 'Awaiting Start Verification';

    return (
        <div style={overlayStyle} onClick={() => !verifyLoading && setVerifyModal(null)}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6" }}>
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                                {type === 'fuel' ? 'Verify fuel log' : type === 'expense' ? 'Verify expense claim' : type === 'incident' ? 'Resolve incident' : isStartApproval ? 'Approve trip start' : 'Verify journey'}
                            </h2>
                            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {type === 'fuel' ? 'Review station, litres, and odometer photo.' : type === 'expense' ? 'Review expense description and receipt photo.' : type === 'incident' ? 'Review incident details and resolve.' : isStartApproval ? 'Review trip details before start.' : 'Review odometer and POD before completion.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ padding: 32, overflowY: "auto", flex: 1 }}>
                    {type === 'fuel' && (
                        <div>
                            <div className="verification-modal-grid" style={{ marginBottom: 32 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Vehicle</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-primary)" }}>{truckReg(journey.truck)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Station</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{journey.station}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Litres</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{journey.litres} L</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Price / L</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{journey.pricePerL}</div>
                                </div>
                            </div>
                            <div className="verification-modal-grid" style={{ marginBottom: 32 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Odometer Photo</div>
                                    <img src={journey.photoOdom || journey.odomPhotoUrl} style={{ width: "100%", borderRadius: 12 }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Receipt Photo</div>
                                    <img src={journey.photoReceipt || journey.receiptUrl} style={{ width: "100%", borderRadius: 12 }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {type === 'expense' && (
                        <div>
                            <div className="verification-modal-grid" style={{ marginBottom: 32 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Vehicle</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-primary)" }}>{truckReg(journey.truck)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Category</div>
                                    <Badge status={journey.cat} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Amount</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(journey.amount)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Description</div>
                                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{journey.desc}</div>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Receipt Photo</div>
                                <img src={journey.receiptUrl} style={{ width: "100%", borderRadius: 12, maxHeight: 400, objectFit: "contain" }} />
                            </div>
                        </div>
                    )}

                    {type === 'incident' && (
                        <div>
                            <div className="verification-modal-grid" style={{ marginBottom: 32 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Type</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444" }}>{journey.incidentType}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Date</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{fmtDate(journey.date || journey.createdAt)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Location</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{journey.location || "N/A"}</div>
                                </div>
                            </div>
                            <div style={{ marginBottom: 32 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Description</div>
                                <div style={{ padding: 16, background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border-subtle)", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                    {journey.description || "No description provided."}
                                </div>
                            </div>
                            {journey.incidentPhotoUrl && (
                                <div style={{ marginBottom: 32 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Incident Photo</div>
                                    <a href={journey.incidentPhotoUrl} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                                        <img src={journey.incidentPhotoUrl} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border-medium)", maxHeight: 400, objectFit: "contain" }} />
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {type === 'journey' && (
                        <>
                            <div className="verification-modal-grid" style={{ marginBottom: 32 }}>
                                {[
                                    { l: 'Commanding Officer', v: driverName(journey.driver), i: User, c: "var(--text-primary)" },
                                    { l: 'Assigned Vehicle', v: truckReg(journey.truck), i: Truck, c: "var(--brand-primary)" },
                                    { l: 'Tactical Route', v: (journey.origin || journey.dest) ? `${journey.origin || "—"} → ${journey.dest || "—"}` : "Unspecified route", i: MapPin, c: "var(--text-secondary)" },
                                    { l: 'Cargo Classification', v: journey.cargo ? (journey.weight ? `${journey.cargo} · ${journey.weight}T` : journey.cargo) : (journey.weight ? `${journey.weight}T` : "General Freight"), i: Package, c: "var(--text-secondary)" },
                                ].map(x => (
                                    <div key={x.l}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                            <x.i size={12} /> {x.l}
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: x.c }}>{x.v}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="verification-modal-grid" style={{ marginBottom: 32 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Deployment Odometer</div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)" }}>{Number(journey.startOdom || 0).toLocaleString()} <span style={{ fontSize: 12, opacity: 0.5 }}>KM</span></div>
                                    {journey.startOdomPhotoUrl && (
                                        <a href={journey.startOdomPhotoUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 12 }}>
                                            <img src={journey.startOdomPhotoUrl} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border-medium)" }} />
                                        </a>
                                    )}
                                </div>
                                {!isStartApproval ? (
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Return Odometer</div>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: "#10b981" }}>{Number(journey.endOdom || 0).toLocaleString()} <span style={{ fontSize: 12, opacity: 0.5 }}>KM</span></div>
                                        {journey.endOdomPhotoUrl && (
                                            <a href={journey.endOdomPhotoUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 12 }}>
                                                <img src={journey.endOdomPhotoUrl} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border-medium)" }} />
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Customers</div>
                                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 800, marginBottom: 6 }}>
                                            Billing: {journey._billingCustomerName || customerName(journey.customerId)}
                                        </div>
                                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 800 }}>
                                            Delivery: {journey._deliveryCustomerName || customerName(journey.deliveryCustomerId)}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {!isStartApproval && journey.deliveryProofUrl && (
                                <div style={{ marginBottom: 32 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Delivery Proof / POD</div>
                                    <a href={journey.deliveryProofUrl} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                                        <img src={journey.deliveryProofUrl} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border-medium)", maxHeight: 400, objectFit: "contain" }} />
                                    </a>
                                </div>
                            )}
                        </>
                    )}

                    {verifyMsg && (
                        <div style={{ padding: 14, borderRadius: 12, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 24, background: verifyMsg.startsWith("Error") ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)", color: verifyMsg.startsWith("Error") ? "#ef4444" : "#10b981" }}>
                            {verifyMsg}
                        </div>
                    )}

                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 32 }}>
                        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
                            <Button 
                                variant="primary" 
                                style={{ flex: 2, minHeight: 48 }} 
                                disabled={verifyLoading}
                                onClick={async () => {
                                    if (type === 'journey') {
                                        const r = await verifyJourney(journey.id, true);
                                        if (r?.success) window.open(buildWhatsAppApproveUrl(journey), "_blank");
                                    } else {
                                        await verifySubmission(journey.id, type, true);
                                        window.open(buildWhatsAppApproveUrl(journey), "_blank");
                                    }
                                }}
                                icon={CheckCircle2}
                            >
                                {verifyLoading ? "Saving…" : "Approve Submission"}
                            </Button>
                        </div>

                        <div style={{ background: "rgba(0,0,0,0.02)", padding: 24, borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 12 }}>Rejection Protocol</div>
                            
                            {/* Problem Areas */}
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12 }}>FLAG PROBLEM AREAS:</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                                    {type === 'fuel' && [
                                        { id: 'fuelDetails', label: 'Fuel Details (Litres/Stn)' },
                                        { id: 'odometer', label: 'Odometer Reading' },
                                        { id: 'photo', label: 'Fuel Slip Photo' },
                                    ].map(area => (
                                        <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "var(--bg-surface)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                                            <input 
                                                type="checkbox" 
                                                checked={(journey._rejectedFields || []).includes(area.id)}
                                                onChange={(e) => {
                                                    const current = journey._rejectedFields || [];
                                                    const next = e.target.checked ? [...current, area.id] : current.filter(x => x !== area.id);
                                                    setVerifyModal({ ...journey, _rejectedFields: next });
                                                }}
                                            />
                                            {area.label}
                                        </label>
                                    ))}
                                    {type === 'expense' && [
                                        { id: 'expenseDetails', label: 'Expense Info (Amt/Cat)' },
                                        { id: 'photo', label: 'Receipt Photo' },
                                    ].map(area => (
                                        <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "var(--bg-surface)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                                            <input 
                                                type="checkbox" 
                                                checked={(journey._rejectedFields || []).includes(area.id)}
                                                onChange={(e) => {
                                                    const current = journey._rejectedFields || [];
                                                    const next = e.target.checked ? [...current, area.id] : current.filter(x => x !== area.id);
                                                    setVerifyModal({ ...journey, _rejectedFields: next });
                                                }}
                                            />
                                            {area.label}
                                        </label>
                                    ))}
                                    {type === 'incident' && [
                                        { id: 'details', label: 'Incident Details' },
                                        { id: 'photo', label: 'Incident Photo' },
                                    ].map(area => (
                                        <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "var(--bg-surface)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                                            <input 
                                                type="checkbox" 
                                                checked={(journey._rejectedFields || []).includes(area.id)}
                                                onChange={(e) => {
                                                    const current = journey._rejectedFields || [];
                                                    const next = e.target.checked ? [...current, area.id] : current.filter(x => x !== area.id);
                                                    setVerifyModal({ ...journey, _rejectedFields: next });
                                                }}
                                            />
                                            {area.label}
                                        </label>
                                    ))}
                                    {type === 'journey' && (journey.status === 'Awaiting Start Verification' ? [
                                        { id: 'customers', label: 'Customer Info' },
                                        { id: 'tripDetails', label: 'Trip Details' },
                                        { id: 'odometer', label: 'Odometer Reading/Photo' },
                                    ] : [
                                        { id: 'odometer', label: 'Final Odometer Reading' },
                                        { id: 'photo', label: 'Delivery Proof / Waybill' },
                                    ]).map(area => (
                                        <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "var(--bg-surface)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                                            <input 
                                                type="checkbox" 
                                                checked={(journey._rejectedFields || []).includes(area.id)}
                                                onChange={(e) => {
                                                    const current = journey._rejectedFields || [];
                                                    const next = e.target.checked ? [...current, area.id] : current.filter(x => x !== area.id);
                                                    setVerifyModal({ ...journey, _rejectedFields: next });
                                                }}
                                            />
                                            {area.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <textarea 
                                className="input-premium"
                                style={{ width: "100%", height: 80, marginBottom: 20 }}
                                placeholder="State the reason for rejection..."
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                            />
                            <Button 
                                variant="danger" 
                                style={{ width: "100%", height: 48 }}
                                disabled={verifyLoading || !rejectReason}
                                onClick={async () => {
                                    if (type === 'journey') {
                                        const r = await verifyJourney(journey.id, false, rejectReason, journey._rejectedFields);
                                        if (r?.success) window.open(buildWhatsAppRejectUrl(journey, rejectReason), "_blank");
                                    } else {
                                        await verifySubmission(journey.id, type, false, rejectReason, journey._rejectedFields);
                                        window.open(buildWhatsAppRejectUrl(journey, rejectReason), "_blank");
                                    }
                                }}
                            >
                                Reject Submission
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
