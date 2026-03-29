import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    MapPin, 
    Calendar, 
    ArrowLeft, 
    Edit2, 
    Navigation, 
    TrendingUp, 
    FileText, 
    PieChart, 
    Plus,
    Clock,
    Shield,
    Truck,
    User,
    ChevronRight,
    Fuel,
    Wallet,
    Info,
    CheckCircle2
} from "lucide-react";
import { fmt, fmtDate } from "../utils/formatters";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { DocumentPanel, DOC_TYPES_JOURNEY } from "../components/DocumentPanel";
import { ProfileQuickActionTile } from "../components/ProfileQuickActionTile";

export function JourneyProfile({ 
    data, setData, dark, isMobile, driverName, truckReg, openModal, openWaybillGenerator,
    verifyJourney, verifyLoading, verifyMsg, rejectReason, setRejectReason, rejectedFields, setRejectedFields
}) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState('overview');

    const journey = data.journeys.find(j => j.id === id);

    if (!journey) return (
        <div style={{ padding: 80, textAlign: 'center' }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 24, fontWeight: 800 }}>Journey Not Found</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>The requested mission does not exist in the operations ledger.</p>
            <Button variant="secondary" onClick={() => navigate('/journeys')}>Return to Operations</Button>
        </div>
    );

    const truck = data.trucks.find(t => t.id === journey.truck);
    const driver = data.drivers.find(d => d.id === journey.driver);
    const turnboy = journey.turnboyId ? data.turnboys?.find(t => t.id === journey.turnboyId) : null;

    // ── Related data
    const relatedFuel = data.fuel.filter(f => f.journey === journey.id);
    const relatedExpenses = data.expenses.filter(e => e.journey === journey.id && e.cat !== 'Fuel');
    const totalExpenses = relatedExpenses.reduce((s, e) => s + +e.amount, 0);
    const totalFuelCost = relatedFuel.reduce((s, f) => s + (f.litres * f.pricePerL), 0);
    const totalVariableCosts = totalExpenses + totalFuelCost + Number(journey.driverMileage || 0) + Number(journey.turnboyMileage || 0);
    const netProfit = Number(journey.revenue || 0) - totalVariableCosts;

    // Permissions for editing completed trips
    const isCompleted = journey.status === 'Completed';
    const operatorEmail = String(data.operatorEmail || data.user?.email || "").trim().toLowerCase();
    const localS = data?.settings?.access || {};
    const configuredSuperAdminUsers = Array.isArray(localS.superAdminUsers) ? localS.superAdminUsers : [];
    const configuredAdminUsers = Array.isArray(localS.adminUsers) ? localS.adminUsers : [];
    const hasConfiguredAccessLists = configuredAdminUsers.length > 0 || configuredSuperAdminUsers.length > 0;
    const isSuperAdmin = !!operatorEmail && configuredSuperAdminUsers.some((u) => String(u?.email || "").trim().toLowerCase() === operatorEmail);
    const canRunSuperAdminActions = !hasConfiguredAccessLists || isSuperAdmin;
    const disableEdit = isCompleted && !canRunSuperAdminActions;

    const relatedIncidents = [...(data.incidents || []), ...(data.pendingVerifications || []).filter(v => v._itemType === 'incident')].filter(i => i.journey === journey.id);

    const tabs = [
        { id: 'overview', label: 'Route & Assets' },
        { id: 'financials', label: 'Mission Financials' },
        { id: 'documents', label: 'Documentation' },
        { id: 'waybill', label: 'Waybill' },
        { id: 'fuel', label: 'Fuel' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'incidents', label: 'Incidents' },
    ];

    const isPendingVerif = journey.status === 'Awaiting Start Verification' || journey.status === 'Awaiting Verification';

    return (
        <div className="page-shell">
            {/* Header / Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
                <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/journeys')}>Back</Button>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--brand-primary)15", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--brand-primary)" }}>
                    <Navigation size={26} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.1, letterSpacing: "-0.04em" }}>{journey.origin} <ChevronRight size={20} style={{ verticalAlign: 'middle', opacity: 0.3 }} /> {journey.dest}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                        Mission ID: {journey.id.split('-')[0].toUpperCase()} · {fmtDate(journey.date)} · <Badge status={journey._isRejected ? "Rejected" : journey.status} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <Button variant="secondary" icon={Edit2} disabled={disableEdit} title={disableEdit ? "Only Super Admins can edit a completed trip" : ""} onClick={() => openModal('journey', journey)}>Edit Journey</Button>
                </div>
            </div>

            {/* Verification Alert Bar */}
            {isPendingVerif && (
                <div style={{ 
                    background: "rgba(139, 92, 246, 0.08)", 
                    border: "1px solid rgba(139, 92, 246, 0.2)", 
                    borderRadius: 20, 
                    padding: 24, 
                    marginBottom: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 20,
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#8b5cf6", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "white" }}>
                            <Shield size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                                {journey.status === 'Awaiting Start Verification' ? 'Trip Start Approval Required' : 'Journey Verification Required'}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                The driver has submitted this mission for {journey.status === 'Awaiting Start Verification' ? 'start' : 'completion'}. Review photos and details below.
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Button 
                            variant="primary" 
                            icon={CheckCircle2} 
                            disabled={verifyLoading}
                            onClick={() => verifyJourney(journey.id, true)}
                        >
                            {verifyLoading ? 'Processing…' : 'Approve Trip'}
                        </Button>
                        <Button 
                            variant="secondary" 
                            style={{ borderColor: "#ef4444", color: "#ef4444" }}
                            disabled={verifyLoading}
                            onClick={() => {
                                const reason = prompt("Enter rejection reason:");
                                if (reason) verifyJourney(journey.id, false, reason);
                            }}
                        >
                            Reject
                        </Button>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 6, gap: 4, marginBottom: 32, overflowX: "auto" }} className="hide-scrollbar">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            flex: 1, padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s ease",
                            background: tab === t.id ? "var(--brand-primary)" : "transparent",
                            color: tab === t.id ? "white" : "var(--text-dim)"
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Main Content Card */}
            <Card style={{ padding: 0, overflow: "hidden" }} className="animate-fade-in">
                {/* OVERVIEW */}
                {tab === 'overview' && (
                    <div style={{ padding: 32 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
                            {[
                                { l: 'Gross Revenue',  v: fmt(journey.revenue),  c: '#10b981', i: TrendingUp },
                                { l: 'Estimated Profit', v: fmt(netProfit),       c: netProfit >= 0 ? 'var(--brand-primary)' : '#ef4444', i: PieChart },
                                { l: 'Mission Distance', v: `${journey.distance || 0} km`, c: "var(--text-primary)", i: Navigation },
                                { l: 'Journey Status',   v: journey._isRejected ? "Rejected" : journey.status,        c: journey._isRejected ? "#dc2626" : '#3b82f6', i: CheckCircle2 },
                            ].map(k => (
                                <div key={k.l} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 16 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.l}</div>
                                        <k.i size={14} color="var(--text-dim)" />
                                    </div>
                                    <div style={{ fontSize: 19, fontWeight: 900, color: k.c }}>{k.v}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: 32 }}>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                                    <Info size={20} color="var(--brand-primary)" />
                                    Strategic Route Details
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 12 : 16, background: "var(--bg-surface)", padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                                    {[
                                        { l: 'Consignor (Billing)', v: data.customers.find(c => c.id === journey.customerId)?.name || '—' },
                                        { l: 'Consignee (Delivery)', v: data.customers.find(c => c.id === journey.deliveryCustomerId)?.name || '—' },
                                        { l: 'Origin Point', v: journey.origin },
                                        { l: 'Destination Point', v: journey.dest },
                                        { l: 'Pickup Address', v: journey.pickupAddress || '—' },
                                        { l: 'Delivery Address', v: journey.deliveryAddress || '—' },
                                        { l: 'Deployment Date', v: fmtDate(journey.date) },
                                        { l: 'Completion Date', v: fmtDate(journey.endDate) || 'Active Mission' },
                                        { l: 'Cargo Classification', v: journey.cargo || 'General Freight' },
                                        { l: 'Payload Weight', v: `${journey.weight || '—'} kg` },
                                        { l: 'Waybill Number', v: journey.waybillNo || journey.waybill || 'N/A' },
                                        { l: 'KRA Booking No', v: journey.booking_no || '—' },
                                        { l: 'Operational Status', v: journey.status },
                                        { l: 'Start Odometer', v: `${journey.startOdom || '—'} km`, img: journey.startOdomPhotoUrl || journey.photoOdomStart },
                                        { l: 'Final Odometer', v: `${journey.finalOdom || '—'} km`, img: journey.finalOdomPhotoUrl || journey.photoOdomEnd },
                                        { l: 'Net Distance', v: `${journey.distance || 0} km` },
                                    ].map((row) => (
                                        <div key={row.l}>
                                            <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{row.l}</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{row.v || row.val}</div>
                                            {row.img && (
                                                <div style={{ marginTop: 8 }}>
                                                    <a href={row.img} target="_blank" rel="noreferrer">
                                                        <img src={row.img} alt={row.l} style={{ width: "100%", maxWidth: 100, borderRadius: 8, border: "1px solid var(--border-subtle)" }} />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 24, padding: 20, background: "var(--bg-surface)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                        <FileText size={14} /> Mission Intelligence / Notes
                                    </div>
                                    <div style={{ fontSize: 14, color: "var(--text-secondary)", fontStyle: 'italic', lineHeight: 1.6 }}>
                                        {journey.notes || 'No operational notes recorded for this mission.'}
                                    </div>
                                </div>

                                {(journey.tr_form_url || journey.t1_form_url) && (
                                    <div style={{ marginTop: 24, padding: 20, background: "rgba(16, 185, 129, 0.05)", borderRadius: 16, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                                        <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                                            <FileText size={14} /> Mission Documentation
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            {journey.tr_form_url && (
                                                <a href={journey.tr_form_url} target="_blank" rel="noreferrer" style={{ 
                                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'white', border: '1px solid #d1fae5', borderRadius: 8, textDecoration: 'none', color: '#065f46', fontSize: 13, fontWeight: 700
                                                }}>
                                                    <FileText size={16} /> TR Form (KRA)
                                                </a>
                                            )}
                                            {journey.t1_form_url && (
                                                <a href={journey.t1_form_url} target="_blank" rel="noreferrer" style={{ 
                                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'white', border: '1px solid #d1fae5', borderRadius: 8, textDecoration: 'none', color: '#065f46', fontSize: 13, fontWeight: 700
                                                }}>
                                                    <FileText size={16} /> T1 Form (Domestic)
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Crew & Asset Allocation</h3>
                                <div style={{ display: 'grid', gap: 16, background: "var(--bg-surface)", padding: 24, borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                                    {[
                                        { l: 'Assigned Vehicle', v: truckReg(journey.truck), id: journey.truck, path: 'fleet', i: Truck },
                                        { l: 'Assigned Trailer', v: (data.trailers?.find(t => t.id === journey.trailer)?.reg) || 'No Trailer', id: journey.trailer, path: 'fleet', i: Truck },
                                        { l: 'Lead Operator', v: driverName(journey.driver), id: journey.driver, path: 'drivers', i: User },
                                        { l: 'Support Turnboy', v: turnboy?.name || journey.turnboyName || 'None', id: journey.turnboyId, path: 'drivers', i: User },
                                    ].map(x => (
                                        <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: x.id ? 'pointer' : 'default' }} onClick={() => x.id && navigate(`/${x.path}/${x.id}`)}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--brand-primary)" }}>
                                                <x.i size={20} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>{x.l}</div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                                                    {x.v} {x.id && <ChevronRight size={14} style={{ opacity: 0.3 }} />}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 24 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Mission Controls</h3>
                                    <div className="profile-quick-actions">
                                        {openWaybillGenerator ? (
                                            <ProfileQuickActionTile
                                                icon={FileText}
                                                label={journey.waybillGenerated ? "View waybill" : "Generate waybill"}
                                                hint="PDF waybill for this trip"
                                                accent="#6366f1"
                                                onClick={() => openWaybillGenerator(journey)}
                                            />
                                        ) : null}
                                        <ProfileQuickActionTile
                                            icon={Fuel}
                                            label="Log journey fuel"
                                            hint="Link fill-up to this mission"
                                            accent="#f97316"
                                            onClick={() =>
                                                openModal("fuel", {
                                                    journey: journey.id,
                                                    truck: journey.truck,
                                                    driver: journey.driver,
                                                    date: journey.date,
                                                })
                                            }
                                        />
                                        <ProfileQuickActionTile
                                            icon={FileText}
                                            label="Proof of delivery"
                                            hint="Upload POD and journey documents"
                                            accent="#10b981"
                                            onClick={() => setTab("documents")}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* FINANCIALS */}
                {tab === 'financials' && (
                    <div style={{ padding: 32 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1.8fr', gap: 32 }}>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Financial Summary</h3>
                                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: 24, marginBottom: 24 }}>
                                    <div style={{ display: 'grid', gap: 16 }}>
                                        {[
                                            { l: 'Gross Revenue', v: journey.revenue, c: '#10b981', i: TrendingUp },
                                            { l: 'Variable Trip Costs', v: -(totalFuelCost + totalExpenses), c: '#ef4444', i: Wallet },
                                            { l: 'Personnel Allowances', v: -(Number(journey.driverMileage || 0) + Number(journey.turnboyMileage || 0)), c: '#3b82f6', i: User },
                                        ].map(row => (
                                            <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <row.i size={16} color="var(--text-dim)" />
                                                    <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>{row.l}</div>
                                                </div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: row.c }}>{fmt(row.v)}</div>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                                            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>Net Mission Profit</div>
                                            <div style={{ fontSize: 24, fontWeight: 900, color: netProfit >= 0 ? 'var(--brand-primary)' : '#ef4444' }}>{fmt(netProfit)}</div>
                                        </div>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Invoicing & Settlements</h3>
                                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 20, padding: 24 }}>
                                    {(() => {
                                        const invoice = data.invoices?.find(inv => (inv.journeyId === journey.id || inv.journey === journey.id));
                                        if (!invoice) return (
                                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                                <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>No invoice has been generated for this mission yet.</div>
                                                <Button variant="premium" size="sm" onClick={() => openModal('invoice', { journey: journey.id, customerId: journey.customerId, amount: journey.revenue })}>Generate Invoice</Button>
                                            </div>
                                        );
                                        // Use either embedded payments or filter from global payments table
                                        const payments = invoice.payments || data.payments?.filter(p => p.journeyId === journey.id || p.invoiceId === invoice.id) || [];
                                        const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
                                        const balance = Number(invoice.amount || 0) - paid;
                                        return (
                                            <div style={{ display: 'grid', gap: 16 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>Invoice ID</div>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>{invoice.id}</div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Invoiced</div>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(invoice.amount)}</div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>Amount Paid (Deposits)</div>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>{fmt(paid)}</div>
                                                </div>
                                                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>Balance Due</div>
                                                    <div style={{ fontSize: 18, fontWeight: 900, color: balance > 0 ? '#f59e0b' : '#10b981' }}>{fmt(balance)}</div>
                                                </div>
                                                <div style={{ marginTop: 8 }}>
                                                    <Badge status={invoice.status} />
                                                </div>

                                                {payments && payments.length > 0 && (
                                                    <div style={{ marginTop: 16 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>Payment History</div>
                                                        <div style={{ display: 'grid', gap: 10 }}>
                                                            {payments.map((p, idx) => (
                                                                <div key={p.id || idx} style={{ background: 'var(--surface-subtle)', borderRadius: 12, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(p.amount)}</div>
                                                                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{fmtDate(p.date)}</div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)', background: 'var(--brand-primary-faded)', padding: '2px 6px', borderRadius: 4 }}>{p.method}</div>
                                                                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.ref}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Detailed Expenditure</h3>
                                {relatedExpenses.length === 0 && relatedFuel.length === 0 ? (
                                    <div style={{ color: "var(--text-dim)", padding: 60, textAlign: 'center', background: "var(--bg-surface)", borderRadius: 20, border: "1px dotted var(--border-subtle)" }}>
                                        No linked transactions found for this mission.
                                    </div>
                                                                ) : (
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        {relatedFuel.map(f => (
                                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', background: "var(--bg-surface)", padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                                                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f9731615", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "#f97316", marginRight: 16 }}>
                                                    <Fuel size={20} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>Fuel Log: {f.station}</div>
                                                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{fmtDate(f.date)} · {f.litres} L @ {f.pricePerL}/L</div>
                                                </div>
                                                <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 15 }}>-{fmt(f.litres * f.pricePerL)}</div>
                                            </div>
                                        ))}
                                        {relatedExpenses.map(e => (
                                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', background: "var(--bg-surface)", padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                                                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#3b82f615", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "#3b82f6", marginRight: 16 }}>
                                                    <Wallet size={20} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{e.desc}</div>
                                                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{fmtDate(e.date)} · {e.cat}</div>
                                                </div>
                                                <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 15 }}>-{fmt(e.amount)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* DOCUMENTS */}
                {tab === 'documents' && (
                    <div style={{ padding: 32 }}>
                        {journey.deliveryProofUrl && (
                            <div style={{ marginBottom: 32 }}>
                                <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>Delivery Proof (POD)</h4>
                                <a href={journey.deliveryProofUrl} target="_blank" rel="noreferrer">
                                    <img src={journey.deliveryProofUrl} alt="POD" style={{ width: "100%", maxWidth: 640, borderRadius: 16, border: "1px solid var(--border-subtle)" }} />
                                </a>
                            </div>
                        )}
                        <DocumentPanel 
                            entityType="journey" 
                            entityId={journey.id} 
                            entityLabel={`${journey.origin}→${journey.dest}`} 
                            docTypes={DOC_TYPES_JOURNEY} 
                            documents={data.documents}
                            setDocuments={(docs) => setData(d => ({ ...d, documents: typeof docs === 'function' ? docs(d.documents) : docs }))}
                            dark={dark}
                        />
                    </div>
                )}

                {/* WAYBILL HISTORY */}
                {tab === 'waybill' && (
                    <div style={{ padding: 32 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>Road freight waybill</h3>
                        <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
                            Each generated waybill is stored on this journey. Open the modal to view, print, or update delivery receipt fields.
                        </p>
                        {journey.waybillGenerated && journey.waybillData ? (
                            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Active waybill</div>
                                <div style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 20, fontWeight: 800, color: "var(--brand-primary)", marginBottom: 8 }}>{journey.waybillNo}</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                                    Issued {journey.waybillData.generatedAt ? new Date(journey.waybillData.generatedAt).toLocaleString("en-KE") : "—"}
                                    {journey.waybillData.isCrossBorder ? " · Cross-border" : " · Domestic"}
                                </div>
                                {openWaybillGenerator && (
                                    <Button variant="primary" icon={FileText} onClick={() => openWaybillGenerator(journey)}>
                                        Open waybill
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-subtle)", borderRadius: 16, padding: 32, textAlign: "center" }}>
                                <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>No waybill has been generated for this journey yet.</p>
                                {openWaybillGenerator && (
                                    <Button variant="premium" icon={FileText} onClick={() => openWaybillGenerator(journey)}>
                                        Generate waybill
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'fuel' && (
                    <div style={{ padding: 32 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Fuel Logs</h3>
                        {relatedFuel.length === 0 ? (
                            <div style={{ color: "var(--text-dim)", padding: 60, textAlign: 'center', background: "var(--bg-surface)", borderRadius: 20, border: "1px dotted var(--border-subtle)" }}>
                                No fuel logs recorded for this trip.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {relatedFuel.map(f => (
                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', background: "var(--bg-surface)", padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f9731615", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "#f97316", marginRight: 16 }}>
                                            <Fuel size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{f.station}</div>
                                            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                                                {fmtDate(f.date)} · {f.litres}L @ {f.pricePerL}/L · Odometer: {f.odom || 'N/A'} km
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>{fmt(f.litres * f.pricePerL)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'expenses' && (
                    <div style={{ padding: 32 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Expenses</h3>
                        {relatedExpenses.length === 0 ? (
                            <div style={{ color: "var(--text-dim)", padding: 60, textAlign: 'center', background: "var(--bg-surface)", borderRadius: 20, border: "1px dotted var(--border-subtle)" }}>
                                No other operational expenses recorded for this trip.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {relatedExpenses.map(e => (
                                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', background: "var(--bg-surface)", padding: 16, borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#3b82f615", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "#3b82f6", marginRight: 16 }}>
                                            <Wallet size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>{e.cat} - {e.desc}</div>
                                            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
                                                {fmtDate(e.date)}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>{fmt(e.amount)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'incidents' && (
                    <div style={{ padding: 32 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Incident Reports</h3>
                        {relatedIncidents.length === 0 ? (
                            <div style={{ color: "var(--text-dim)", padding: 60, textAlign: 'center', background: "var(--bg-surface)", borderRadius: 20, border: "1px dotted var(--border-subtle)" }}>
                                No incidents reported for this trip.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {relatedIncidents.map(i => (
                                    <div key={i.id} style={{ background: "var(--bg-surface)", padding: 20, borderRadius: 16, border: "1px solid var(--coralDark)", borderLeft: "4px solid var(--coralDark)" }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{i.incidentType}</div>
                                                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                                                    {fmtDate(i.date || i.createdAt)} · Location: {i.location || 'Unknown'}
                                                </div>
                                            </div>
                                            {i.incidentPhotoUrl && (
                                                <a href={i.incidentPhotoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--brand-primary)", fontWeight: 700 }}>
                                                    View Photo
                                                </a>
                                            )}
                                        </div>
                                        <div style={{ padding: 16, background: "var(--bg-card)", borderRadius: 10, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, border: "1px solid var(--border-subtle)" }}>
                                            {i.description || 'No additional details provided.'}
                                        </div>
                                        {i._pendingApproval && (
                                            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                                                <Badge status="Warning" text="Pending Review" />
                                                <Button 
                                                    variant="primary" 
                                                    size="small" 
                                                    style={{ background: "#ef4444", fontSize: 12, padding: "4px 12px" }}
                                                    onClick={() => setVerifyModal({ ...i, _itemType: 'incident' })}
                                                >
                                                    Review & Resolve
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}
