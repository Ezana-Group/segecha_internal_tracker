import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { mergeFlatPermissionOverrides, mergeProfilePermissions } from '../../src/utils/profilePermissions.js';

const API = import.meta.env.VITE_API_URL || 'https://api.segecha.com';
const fmt = n => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const today = () => new Date().toISOString().split('T')[0];

const COLORS = {
    primary: '#1B3A6B', accent: '#E8501A', green: '#10b981',
    yellow: '#f59e0b', red: '#ef4444', blue: '#3b82f6',
    bg: '#f4f6f8', surface: '#ffffff',
    text: '#0f172a', textDim: '#475569', textFaint: '#94a3b8',
    border: '#e2e8f0',
    coral: '#f97371',
    coralDark: '#ea580c',
};

const SC = {
    'Loading': '#f59e0b',
    'In Transit': '#3b82f6',
    'Awaiting Start Verification': '#f97316',
    'Awaiting Verification': '#8b5cf6',
    'Completed': '#10b981',
    'Cancelled': '#ef4444', 'Paid': '#10b981', 'Pending': '#f59e0b',
    'OK': '#10b981', 'Due Soon': '#f97316', 'Overdue': '#ef4444',
};

/** Bottom navigation — 4 tabs to match mobile / WhatsApp-style app shell */
const PRIMARY_TABS = [
    { id: 'journeys', icon: '🗺️', label: 'My Trips' },
    { id: 'submit', icon: '⛽', label: 'Fuel Log' },
    { id: 'costs', icon: '💸', label: 'Expenses' },
    { id: 'profile', icon: '👤', label: 'Profile' },
];

const TAB_NAV_PERM = { journeys: 'navTrips', submit: 'navFuel', costs: 'navCosts', profile: 'navProfile' };

const TAB_TITLE = {
    journeys: 'My Trips',
    submit: 'Fuel Log',
    costs: 'Expenses',
    profile: 'Profile',
    docs: 'Documents',
    maintenance: 'Maintenance',
    payslips: 'Payments',
};

const S = {
    page: {
        minHeight: '100dvh',
        background: COLORS.bg,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        maxWidth: 480,
        margin: '0 auto',
        WebkitTapHighlightColor: 'transparent',
    },
    topbar: {
        background: '#ffffff',
        padding: 'max(10px, env(safe-area-inset-top)) 14px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: `1px solid ${COLORS.border}`,
        boxShadow: '0 1px 0 rgba(15,23,42,.04)',
    },
    tabBar: {
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: '#fff',
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexWrap: 'nowrap',
        justifyContent: 'space-around',
        zIndex: 100,
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        paddingTop: 6,
        boxSizing: 'border-box',
        boxShadow: '0 -4px 20px rgba(15,23,42,.06)',
    },
    tabBtn: (a) => ({
        flex: '1 1 25%',
        maxWidth: '25%',
        minWidth: 0,
        minHeight: 52,
        padding: '6px 4px 4px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        color: a ? COLORS.accent : COLORS.textFaint,
        fontWeight: a ? 700 : 500,
    }),
    content: { padding: '16px 16px 8px' },
    card: (accent) => ({ background: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${accent ? accent + '33' : COLORS.border}`, borderTop: accent ? `3px solid ${accent}` : undefined, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }),
    sectionTitle: { fontSize: 11, fontWeight: 700, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 4 },
    badge: s => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: (SC[s] || '#64748b') + '22', color: SC[s] || '#64748b', border: `1px solid ${(SC[s] || '#64748b')}44` }),
    kpi: { fontSize: 10, color: COLORS.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    kpiVal: c => ({ fontSize: 24, fontWeight: 800, color: c || COLORS.text, letterSpacing: -0.5 }),
    btn: v => ({ padding: v === 'sm' ? '8px 14px' : '13px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: v === 'sm' ? 12 : 14, background: v === 'ghost' ? '#f1f5f9' : v === 'green' ? 'linear-gradient(135deg,#059669,#10b981)' : v === 'blue' ? 'linear-gradient(135deg,#1B3A6B,#2563eb)' : 'linear-gradient(135deg,#E8501A,#d4400f)', color: v === 'ghost' ? COLORS.textDim : '#fff' }),
    inp: { width: '100%', padding: '14px 14px', borderRadius: 12, border: `1.5px solid ${COLORS.border}`, fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'inherit' },
    lbl: { fontSize: 11, color: COLORS.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, display: 'block' },
    infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 },
    alert: c => ({ background: c + '15', border: `1px solid ${c}44`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }),
    success: msg => ({ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#065f46', fontSize: 13, fontWeight: 600, marginBottom: 12 }),
    errBox: msg => ({ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }),
};

// ── Upload a file to Cloudinary via server ──────────────────────────────────
async function uploadFile(file, folder, filename, token) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('filename', filename);
    const res = await fetch(`${API}/api/driver/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Upload failed');
    return data.url;
}

// ── Photo upload field component ───────────────────────────────────────────
function PhotoField({ label, hint, token, folder, filename, onUploaded }) {
    const [status, setStatus] = useState('idle'); // idle | uploading | done | error
    const [preview, setPreview] = useState('');
    const [errMsg, setErrMsg] = useState('');

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setStatus('uploading');
        setErrMsg('');
        try {
            const url = await uploadFile(file, folder, filename + '_' + Date.now(), token);
            setPreview(URL.createObjectURL(file));
            setStatus('done');
            onUploaded(url);
        } catch (err) {
            setStatus('error');
            setErrMsg(err.message);
        }
    };

    const inp = { 
        width: '100%', 
        padding: '12px 14px', 
        borderRadius: 10, 
        border: `1.5px solid ${COLORS.border}`, 
        background: COLORS.surface,
        color: COLORS.text,
        fontSize: 15, 
        outline: 'none', 
        boxSizing: 'border-box', 
        marginBottom: 12, 
        fontFamily: 'inherit' 
    };
    const lbl = { fontSize: 11, color: COLORS.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, display: 'block' };

    return (
        <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{label}</label>
            {hint && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 6 }}>{hint}</div>}
            {preview && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                    <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: `1px solid ${COLORS.border}` }} />
                    <button 
                        onClick={() => { setStatus('idle'); setPreview(''); onUploaded(''); }}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                    >
                        Remove
                    </button>
                </div>
            )}
            {status === 'done' ? (
                <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, marginBottom: 8 }}>✅ Photo uploaded</div>
            ) : (
                <label style={{ display: 'block', background: COLORS.bg, border: `1.5px dashed ${status === 'error' ? COLORS.red : COLORS.border}`, borderRadius: 10, padding: '12px', textAlign: 'center', cursor: 'pointer', fontSize: 13, color: status === 'uploading' ? COLORS.textFaint : COLORS.textDim }}>
                    {status === 'uploading' ? '⏳ Uploading…' : '📷 Tap to take photo or choose file'}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} disabled={status === 'uploading'} />
                </label>
            )}
            {errMsg && <div style={{ fontSize: 11, color: COLORS.red, marginTop: 4 }}>{errMsg}</div>}
        </div>
    );
}

function openWaybillWindow(j, truckReg) {
    const f = j.waybillData;
    if (f && typeof f === 'object') {
        const w = window.open('', '_blank');
        const esc = (s) => String(s ?? '—').replace(/</g, '&lt;');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Waybill</title>
        <style>body{font-family:system-ui,sans-serif;padding:16px;max-width:720px;margin:0 auto;font-size:15px;line-height:1.5;color:#111}h1{font-size:1.1rem;margin:0 0 12px}.r{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #e5e7eb}footer{margin-top:20px;font-size:12px;color:#64748b}.btn{margin-top:16px;padding:12px 20px;background:#1B3A6B;color:#fff;border:none;border-radius:10px;font-weight:700;width:100%}</style></head><body>
        <h1>Road waybill</h1>
        <div class="r"><span>Waybill no.</span><b>${esc(f.waybillNo)}</b></div>
        <div class="r"><span>Vehicle</span><b>${esc(f.vehicleReg || truckReg)}</b></div>
        <div class="r"><span>Trailer</span><b>${esc(f.trailerReg)}</b></div>
        <div class="r"><span>Route</span><b>${esc(j.origin)} → ${esc(j.dest)}</b></div>
        <div class="r"><span>Carrier</span><b>${esc(f.carrierName)}</b></div>
        <div class="r"><span>Driver</span><b>${esc(f.driverName)}</b></div>
        <footer>Generated from driver portal · use browser menu to print or save as PDF.</footer>
        <button class="btn" onclick="window.print()">Print / Save as PDF</button>
        </body></html>`);
        w.document.close();
        return;
    }
    if (j.waybillNo) {
        window.alert(`Waybill ${j.waybillNo} — ask the office to open the full waybill in the main tracker if you need all copies.`);
    } else {
        window.alert('No waybill yet. The office generates the waybill from the main tracker for this trip.');
    }
}

const JourneyCard = ({
    j,
    truck,
    driver,
    token,
    portalPerm,
    allowUpdate,
    expandedId,
    setExpandedId,
    odomForms,
    setOdom,
    getParty,
    setParty,
    submitTripStart,
    updateStatus,
    customerDirectory,
    fetchDriverData,
    notifyOffice,
    updating,
    msgs,
}) => {
    const isExpanded = expandedId === j.id;
    const [showForm, setShowForm] = useState(false);
    const form = odomForms[j.id] || {};
    const cargoLabel = j.cargo && String(j.cargo).trim() ? `${j.cargo}${j.weight ? ` · ${j.weight}T` : ''}` : 'No cargo specified';
    return (
        <div
            style={{
                background: '#fff',
                borderRadius: 16,
                marginBottom: 14,
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 2px 14px rgba(15,23,42,.06)',
                overflow: 'hidden',
            }}
        >
            <div
                style={{ padding: 16, cursor: portalPerm.tripExpandDetails !== false ? 'pointer' : 'default' }}
                onClick={() => portalPerm.tripExpandDetails !== false && setExpandedId(isExpanded ? null : j.id)}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    {portalPerm.tripCardSummary !== false ? (
                        <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text, lineHeight: 1.25, flex: 1 }}>
                            {j.origin} → {j.dest}
                        </div>
                    ) : (
                        <div style={{ flex: 1 }} />
                    )}
                    <span style={S.badge(j.status)}>{j.status}</span>
                </div>
                {portalPerm.tripCardSummary !== false && <div style={{ fontSize: 13, color: COLORS.textFaint, marginBottom: 10 }}>{j.date || '—'} · {cargoLabel}</div>}
                {portalPerm.tripCardTruckReg !== false && (
                    <div style={{ fontSize: 13, color: COLORS.green, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span aria-hidden>🚛</span>
                        <span>{truck?.reg || '—'}</span>
                    </div>
                )}
                {portalPerm.tripCardMileageLine !== false && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, color: COLORS.textFaint, fontWeight: 600 }}>Mileage allowance</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.green }}>{fmt(j.driverMileage || 0)}</span>
                    </div>
                )}
                {portalPerm.tripExpandDetails !== false && (
                    <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 10, textAlign: 'center', fontWeight: 600 }}>{isExpanded ? '▲ Hide details' : '▼ Tap for trip actions'}</div>
                )}
            </div>

            {isExpanded && portalPerm.tripExpandDetails !== false && (
                <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 16, background: COLORS.bg }} onClick={(e) => e.stopPropagation()}>
                    {portalPerm.tripDetailAllowanceNote !== false && (
                        <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 12, lineHeight: 1.4 }}>
                            Trip allowance <b>{fmt(j.driverMileage || 0)}</b> — not customer freight charges.
                        </div>
                    )}
                    {portalPerm.tripDetailDistance !== false && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Distance</span>
                            <span>{j.distance != null ? `${j.distance} km` : '—'}</span>
                        </div>
                    )}
                    {portalPerm.tripDetailNotes !== false && j.notes && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Notes</span>
                            <span style={{ fontSize: 12 }}>{j.notes}</span>
                        </div>
                    )}
                    {portalPerm.tripDetailTrailer !== false && j._trailerReg ? (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Trailer</span>
                            <span style={{ fontWeight: 700 }}>{j._trailerReg}</span>
                        </div>
                    ) : null}
                    {portalPerm.tripDetailTurnboy !== false && j._turnboyDisplay ? (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Crew / turnboy</span>
                            <span>{j._turnboyDisplay}</span>
                        </div>
                    ) : null}
                    {portalPerm.tripDetailCustomers !== false && (j._billingCustomerName || j._deliveryCustomerName || j.customerId || j.deliveryCustomerId) && (
                        <>
                            <div style={S.infoRow}>
                                <span style={{ color: COLORS.textFaint }}>Billing customer</span>
                                <span style={{ fontWeight: 600 }}>{j._billingCustomerName || '—'}</span>
                            </div>
                            <div style={S.infoRow}>
                                <span style={{ color: COLORS.textFaint }}>Delivery customer</span>
                                <span style={{ fontWeight: 600 }}>{j._deliveryCustomerName || '—'}</span>
                            </div>
                        </>
                    )}
                    {portalPerm.tripDetailOdomRecorded !== false && j.startOdom && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Start Odom</span>
                            <span>{Number(j.startOdom).toLocaleString()} km</span>
                        </div>
                    )}
                    {portalPerm.tripDetailOdomRecorded !== false && j.endOdom && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>End Odom</span>
                            <span>{Number(j.endOdom).toLocaleString()} km</span>
                        </div>
                    )}

                    {(j.waybillData || j.waybillNo) && portalPerm.tripWaybillButton !== false && (
                        <button
                            type="button"
                            style={{ ...S.btn('ghost'), width: '100%', marginTop: 10, marginBottom: 4, fontSize: 13 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                openWaybillWindow(j, truck?.reg);
                            }}
                        >
                            📄 View / print waybill
                        </button>
                    )}

                    {allowUpdate && (j.status === 'Loading' || j.status === 'In Transit') && (
                        !showForm ? (
                            <button style={{ ...S.btn('blue'), width: '100%', marginTop: 14 }} onClick={(e) => { e.stopPropagation(); setShowForm(true); }}>
                                {j.status === 'Loading' ? '+ Log Trip Start' : '+ Log Arrival / End Trip'}
                            </button>
                        ) : (
                        <div style={{ marginTop: 14, padding: 14, background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16, color: COLORS.text }}>
                                    {j.status === 'Loading' ? 'Log Trip Start' : 'Log Arrival / End Trip'}
                                </h3>
                                <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.textFaint }} onClick={(e) => { e.stopPropagation(); setShowForm(false); }}>✕</button>
                            </div>
                            
                            {portalPerm.tripRejectionNotice !== false && j._rejectionReason && (
                                <div style={{ ...S.errBox(), marginBottom: 12, fontWeight: 700 }}>
                                    ⚠️ REJECTED: {j._rejectionReason}
                                    <div style={{ fontWeight: 400, marginTop: 4, fontSize: 11 }}>
                                        The office has flagged the sections in red for correction. Please review and re-submit.
                                    </div>
                                </div>
                            )}

                            {j.status === 'Loading' && portalPerm.tripCustomersBeforeDepart !== false && (
                                <>
                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('customers') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('customers') ? `2px solid ${COLORS.red}` : 'none',
                                        marginBottom: (j._rejectedFields || []).includes('customers') ? 16 : 0,
                                        background: (j._rejectedFields || []).includes('customers') ? '#fff1f2' : 'transparent'
                                    }}>
                                        <div style={{ fontWeight: 800, color: COLORS.text, marginBottom: 10, fontSize: 14 }}>📍 Stage 1 — Customer Information</div>
                                        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12, lineHeight: 1.45 }}>
                                            Who is paying (billing) and who receives the goods (delivery).
                                        </div>

                                        <label style={S.lbl}>Billing type</label>
                                        <select style={S.inp} value={getParty(j).billType} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { billType: e.target.value })}>
                                            <option value="Company">Company</option>
                                            <option value="Individual">Individual</option>
                                        </select>

                                        <label style={S.lbl}>Billing customer</label>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewBill ? 0.5 : 1 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewBill: false }); }}
                                            >
                                                From list
                                            </button>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewBill ? 1 : 0.5 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewBill: true }); }}
                                            >
                                                New customer
                                            </button>
                                        </div>
                                        {!getParty(j).useNewBill ? (
                                            <select style={S.inp} value={getParty(j).customerId} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { customerId: e.target.value })}>
                                                <option value="">Select…</option>
                                                {customerDirectory.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                <input
                                                    style={S.inp}
                                                    placeholder="Company or person name"
                                                    value={getParty(j).newBillName}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newBillName: e.target.value })}
                                                />
                                                <input
                                                    style={S.inp}
                                                    placeholder="Phone (optional)"
                                                    inputMode="tel"
                                                    value={getParty(j).newBillPhone}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newBillPhone: e.target.value })}
                                                />
                                                {getParty(j).billType === 'Company' && (
                                                    <input
                                                        style={S.inp}
                                                        placeholder="Email (required for companies)"
                                                        type="email"
                                                        value={getParty(j).newBillEmail}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => setParty(j, { newBillEmail: e.target.value })}
                                                    />
                                                )}
                                            </>
                                        )}

                                        <label style={S.lbl}>Delivery type</label>
                                        <select style={S.inp} value={getParty(j).delType} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { delType: e.target.value })}>
                                            <option value="Company">Company</option>
                                            <option value="Individual">Individual</option>
                                        </select>

                                        <label style={{ ...S.lbl, marginTop: 12 }}>Delivery customer</label>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewDel ? 0.5 : 1 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewDel: false }); }}
                                            >
                                                From list
                                            </button>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewDel ? 1 : 0.5 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewDel: true }); }}
                                            >
                                                New customer
                                            </button>
                                        </div>
                                        {!getParty(j).useNewDel ? (
                                            <select style={S.inp} value={getParty(j).deliveryCustomerId} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { deliveryCustomerId: e.target.value })}>
                                                <option value="">Select…</option>
                                                {customerDirectory.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                <input
                                                    style={S.inp}
                                                    placeholder="Receiver name or site"
                                                    value={getParty(j).newDelName}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newDelName: e.target.value })}
                                                />
                                                <input
                                                    style={S.inp}
                                                    placeholder="Phone (optional)"
                                                    inputMode="tel"
                                                    value={getParty(j).newDelPhone}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newDelPhone: e.target.value })}
                                                />
                                            </>
                                        )}
                                    </div>

                                    <div style={{ marginTop: 24, marginBottom: 10, height: 1, background: COLORS.border }} />

                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('tripDetails') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('tripDetails') ? `2px solid ${COLORS.red}` : 'none',
                                        marginBottom: (j._rejectedFields || []).includes('tripDetails') ? 16 : 0,
                                        background: (j._rejectedFields || []).includes('tripDetails') ? '#fff1f2' : 'transparent'
                                    }}>
                                        <div style={{ fontWeight: 800, color: COLORS.text, marginBottom: 10, fontSize: 14 }}>📍 Stage 2 — Trip Details</div>

                                        <label style={S.lbl}>Origin</label>
                                        <input style={S.inp} placeholder="e.g. Nairobi" value={form.origin ?? j.origin ?? ''} onChange={(e) => setOdom(j.id, 'origin', e.target.value)} />

                                        <label style={S.lbl}>Destination</label>
                                        <input style={S.inp} placeholder="e.g. Mombasa" value={form.dest ?? j.dest ?? ''} onChange={(e) => setOdom(j.id, 'dest', e.target.value)} />

                                        <label style={S.lbl}>Cargo Description</label>
                                        <input style={S.inp} placeholder="e.g. Electronics" value={form.cargo ?? j.cargo ?? ''} onChange={(e) => setOdom(j.id, 'cargo', e.target.value)} />

                                        <label style={S.lbl}>Weight (Tonnes)</label>
                                        <input style={S.inp} type="number" inputMode="decimal" placeholder="e.g. 5.5" value={form.weight ?? j.weight ?? ''} onChange={(e) => setOdom(j.id, 'weight', e.target.value)} />

                                        <label style={S.lbl}>Notes</label>
                                        <input style={S.inp} placeholder="Optional notes for the office" value={form.notes ?? j.notes ?? ''} onChange={(e) => setOdom(j.id, 'notes', e.target.value)} />
                                    </div>

                                    {portalPerm.tripStartOdomPhotos !== false && (
                                        <div style={{ 
                                            padding: (j._rejectedFields || []).includes('odometer') ? 10 : 0,
                                            borderRadius: 10,
                                            border: (j._rejectedFields || []).includes('odometer') ? `2px solid ${COLORS.red}` : 'none',
                                            background: (j._rejectedFields || []).includes('odometer') ? '#fff1f2' : 'transparent',
                                            marginTop: 12
                                        }}>
                                            <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13, marginTop: 12 }}>📍 Record your start odometer</div>
                                            <label style={S.lbl}>Start Odometer Reading (km)</label>
                                            <input
                                                style={S.inp}
                                                type="number"
                                                placeholder="e.g. 142300"
                                                value={form.startOdom ?? j.startOdom ?? ''}
                                                onChange={(e) => setOdom(j.id, 'startOdom', e.target.value)}
                                            />
                                            <PhotoField
                                                label="📷 Photo of Odometer"
                                                hint="Take a clear photo of the dashboard odometer reading"
                                                token={token}
                                                folder="odometer"
                                                filename={`${j.id}_start`}
                                                onUploaded={(url) => setOdom(j.id, 'startOdomPhotoUrl', url)}
                                            />
                                        </div>
                                    )}

                                    {msgs[j.id] && <div style={{ color: msgs[j.id].startsWith('✅') ? COLORS.green : COLORS.red, fontSize: 12, marginBottom: 10, marginTop: 10 }}>{msgs[j.id]}</div>}

                                    {portalPerm.tripMarkInTransit !== false && (
                                        <button
                                            style={{ ...S.btn('blue'), width: '100%', marginTop: 20 }}
                                            disabled={updating[j.id]}
                                            onClick={() => submitTripStart(j)}
                                        >
                                            {updating[j.id] ? '⏳ Submitting…' : '🛡️ Submit Trip for Office Approval'}
                                        </button>
                                    )}
                                </>
                            )}

                            {j.status === 'In Transit' && portalPerm.tripEndOdomAndProof !== false && (
                                <>
                                    <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13 }}>🏁 On arrival — record your end odometer and upload delivery proof</div>
                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('endOdometer') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('endOdometer') ? `2px solid ${COLORS.red}` : 'none',
                                        background: (j._rejectedFields || []).includes('endOdometer') ? '#fff1f2' : 'transparent',
                                        marginBottom: 16
                                    }}>
                                        <label style={S.lbl}>End Odometer Reading (km)</label>
                                        <input
                                            style={S.inp}
                                            type="number"
                                            placeholder="e.g. 142300"
                                            value={form.endOdom ?? j.endOdom ?? ''}
                                            onChange={(e) => setOdom(j.id, 'endOdom', e.target.value)}
                                        />
                                        <PhotoField
                                            label="📷 Final Odometer Photo"
                                            hint="Take photo of odometer at destination"
                                            token={token}
                                            folder="odometer"
                                            filename={`${j.id}_end`}
                                            onUploaded={(url) => setOdom(j.id, 'endOdomPhotoUrl', url)}
                                        />
                                    </div>
                                    
                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('deliveryProof') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('deliveryProof') ? `2px solid ${COLORS.red}` : 'none',
                                        background: (j._rejectedFields || []).includes('deliveryProof') ? '#fff1f2' : 'transparent',
                                        marginBottom: 16
                                    }}>
                                        <PhotoField
                                            label="📄 Delivery Proof / Waybill"
                                            hint="Photo of signed delivery note or waybill"
                                            token={token}
                                            folder="delivery"
                                            filename={`${j.id}_proof`}
                                            onUploaded={(url) => setOdom(j.id, 'deliveryProofUrl', url)}
                                        />
                                    </div>

                                    {msgs[j.id] && <div style={{ color: msgs[j.id].startsWith('✅') ? COLORS.green : COLORS.red, fontSize: 12, marginBottom: 10 }}>{msgs[j.id]}</div>}

                                    <button
                                        style={{ ...S.btn('green'), width: '100%', marginTop: 10 }}
                                        disabled={updating[j.id]}
                                        onClick={() => updateStatus(j, 'Awaiting Verification')}
                                    >
                                        {updating[j.id] ? '⏳ Submitting…' : '🏁 Mark Journey Completed'}
                                    </button>
                                </>
                            )}
                        </div>
                        )
                    )}

                    {j.status === 'Awaiting Start Verification' && portalPerm.tripAwaitingBanner !== false && (
                        <div style={{ marginTop: 14, padding: 14, background: '#fff7ed', border: '1px dashed #fb923c', borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                            <div style={{ fontWeight: 700, color: '#f97316', fontSize: 14 }}>Awaiting Office Start Approval</div>
                            <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                                Your trip start details have been sent. The office will review your odometer photo and customer details shortly.
                            </div>
                            <button style={{ ...S.btn('ghost'), marginTop: 12, width: '100%' }} onClick={() => fetchDriverData(token)}>
                                Refresh Status
                            </button>
                        </div>
                    )}

                    {j.status === 'Awaiting Verification' && portalPerm.tripAwaitingBanner !== false && (
                        <div style={{ marginTop: 14, padding: 14, background: COLORS.blue + '10', border: `1px dashed ${COLORS.blue}`, borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                            <div style={{ fontWeight: 700, color: COLORS.blue, fontSize: 14 }}>Awaiting Office Verification</div>
                            <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                                Your arrival details have been sent. The office will review your odometer reading and delivery proof shortly.
                            </div>
                            <button style={{ ...S.btn('ghost'), marginTop: 12, width: '100%' }} onClick={() => fetchDriverData(token)}>
                                Refresh Status
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const JourneysTab = ({
    driver,
    truck,
    tyreInfo,
    activeJourneys,
    completedJourneys,
    customerDirectory,
    token,
    portalPerm,
    fetchDriverData,
    apiPost
}) => {
    const [updating, setUpdating] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [odomForms, setOdomForms] = useState({});
    const setOdom = (jid, key, val) => setOdomForms(f => ({ ...f, [jid]: { ...(f[jid] || {}), [key]: val } }));
    const [msgs, setMsgs] = useState({});
    const [partyDraft, setPartyDraft] = useState({});

    const getParty = (j) =>
        partyDraft[j.id] || {
            customerId: j.customerId || '',
            deliveryCustomerId: j.deliveryCustomerId || '',
            newBillName: '',
            newBillPhone: '',
            newBillEmail: '',
            newDelName: '',
            newDelPhone: '',
            newDelEmail: '',
            useNewBill: false,
            useNewDel: false,
            billType: customerDirectory.find(c => c.id === (j.customerId || ''))?.type || 'Individual',
            delType: customerDirectory.find(c => c.id === (j.deliveryCustomerId || ''))?.type || 'Individual',
            billEmail: customerDirectory.find(c => c.id === (j.customerId || ''))?.email || '',
            delEmail: customerDirectory.find(c => c.id === (j.deliveryCustomerId || ''))?.email || '',
        };

    const setParty = (j, patch) =>
        setPartyDraft((d) => ({
            ...d,
            [j.id]: { ...getParty(j), ...patch },
        }));

    const submitTripStart = async (j) => {
        const p = getParty(j);
        const form = odomForms[j.id] || {};

        // 1. Validate Customer Info
        if (p.useNewBill && !p.newBillName?.trim()) {
            setMsgs((m) => ({ ...m, [j.id]: '❌ Enter billing customer name (Stage 1)' }));
            return;
        }
        if (p.useNewDel && !p.newDelName?.trim()) {
            setMsgs((m) => ({ ...m, [j.id]: '❌ Enter delivery customer name (Stage 1)' }));
            return;
        }
        if (!p.useNewBill && !p.customerId) {
            setMsgs((m) => ({ ...m, [j.id]: '❌ Select billing customer (Stage 1)' }));
            return;
        }
        if (!p.useNewDel && !p.deliveryCustomerId) {
            setMsgs((m) => ({ ...m, [j.id]: '❌ Select delivery customer (Stage 1)' }));
            return;
        }

        // 2. Validate Trip Details (Odometer)
        if (portalPerm.tripStartOdomPhotos !== false) {
            if (!form.startOdom) {
                setMsgs((m) => ({ ...m, [j.id]: '❌ Enter start odometer reading (Stage 2)' }));
                return;
            }
            if (!form.startOdomPhotoUrl) {
                setMsgs((m) => ({ ...m, [j.id]: '❌ Upload odometer photo (Stage 2)' }));
                return;
            }
        }

        setUpdating((u) => ({ ...u, [j.id]: true }));
        setMsgs((m) => ({ ...m, [j.id]: '' }));

        try {
            // A. Save Customers
            const custBody = {};
            if (p.useNewBill) {
                custBody.newBillingCustomer = {
                    name: p.newBillName.trim(),
                    phone: (p.newBillPhone || '').trim(),
                    email: (p.newBillEmail || '').trim(),
                    type: p.billType === 'Company' ? 'Company' : 'Individual',
                };
            } else {
                custBody.customerId = p.customerId;
                custBody.billingType = p.billType === 'Company' ? 'Company' : 'Individual';
                custBody.billingEmail = (p.billEmail || '').trim();
            }

            if (p.useNewDel) {
                custBody.newDeliveryCustomer = {
                    name: p.newDelName.trim(),
                    phone: (p.newDelPhone || '').trim(),
                    email: (p.newDelEmail || '').trim(),
                    type: p.delType === 'Company' ? 'Company' : 'Individual',
                };
            } else {
                custBody.deliveryCustomerId = p.deliveryCustomerId;
                custBody.deliveryType = p.delType === 'Company' ? 'Company' : 'Individual';
                custBody.deliveryEmail = (p.delEmail || '').trim();
            }

            const custRes = await apiPost(`/api/driver/journey/${j.id}/customers`, custBody);
            if (!custRes.success) {
                setMsgs((m) => ({ ...m, [j.id]: '❌ Customer save failed: ' + custRes.error }));
                setUpdating((u) => ({ ...u, [j.id]: false }));
                return;
            }

            // B. Update Status
            const statusRes = await apiPost(`/api/driver/journey/${j.id}/status`, { 
                status: 'Awaiting Start Verification', 
                ...form 
            });

            if (statusRes.success) {
                setMsgs((m) => ({ ...m, [j.id]: '✅ Submitted for office approval' }));
                await fetchDriverData(token);
            } else {
                setMsgs((m) => ({ ...m, [j.id]: '❌ Status update failed: ' + statusRes.error }));
            }
        } catch (e) {
            setMsgs((m) => ({ ...m, [j.id]: '❌ Error: ' + (e.message || 'Unknown error') }));
        } finally {
            setUpdating((u) => ({ ...u, [j.id]: false }));
        }
    };

    const updateStatus = async (j, newStatus) => {
        const form = odomForms[j.id] || {};
        if (newStatus === 'In Transit') {
            if (!form.startOdom) { setMsgs(m => ({ ...m, [j.id]: '❌ Enter your starting odometer reading' })); return; }
            if (!form.startOdomPhotoUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload a photo of the odometer before departing' })); return; }
        }
        if (newStatus === 'Awaiting Verification') {
            if (!form.endOdom) { setMsgs(m => ({ ...m, [j.id]: '❌ Enter your final odometer reading' })); return; }
            if (!form.endOdomPhotoUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload photo of odometer showing ' + form.endOdom + ' km' })); return; }
            if (!form.deliveryProofUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload delivery proof (signed waybill/receipt)' })); return; }
        }

        setUpdating(u => ({ ...u, [j.id]: true }));
        const result = await apiPost(`/api/driver/journey/${j.id}/status`, { status: newStatus, ...form });
        if (result.success) {
            const msg = newStatus === 'Awaiting Verification'
                ? '✅ Submitted for office verification'
                : `✅ Status updated to ${newStatus}`;
            setMsgs(m => ({ ...m, [j.id]: msg }));
            await fetchDriverData(token);
        } else {
            setMsgs(m => ({ ...m, [j.id]: '❌ ' + result.error }));
        }
        setUpdating(u => ({ ...u, [j.id]: false }));
    };

    const firstNameHi = driver.name.split(' ')[0] || driver.name;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const monthKey = new Date().toISOString().slice(0, 7);
    const journeysThisMonth = [...activeJourneys, ...completedJourneys].filter((j) => j.date && j.date.startsWith(monthKey));
    const monthAllowance = journeysThisMonth.reduce((s, j) => s + (+j.driverMileage || 0), 0);
    const totalTrips = activeJourneys.length + completedJourneys.length;
    const pendingCount = activeJourneys.filter((j) => j.status === 'Awaiting Verification').length;
    const openTrip = activeJourneys.some((j) => ['Loading', 'In Transit', 'Awaiting Start Verification', 'Awaiting Verification'].includes(j.status));

    const onStartNewTrip = () => {
        if (openTrip) {
            window.alert('You have an open trip. Submit it for verification and wait for the office to approve completion before asking for a new assignment.');
            return;
        }
        (async () => {
            try {
                const result = await apiPost('/api/driver/journeys/start-placeholder', { date: today() });
                if (result.success) {
                    await fetchDriverData(token);
                    window.alert('Trip request created. Open it in My Trips and submit for office start approval.');
                } else {
                    window.alert('Could not create trip request: ' + (result.error || 'Unknown error'));
                }
            } catch (e) {
                window.alert('Could not create trip request: ' + (e?.message || String(e)));
            }
        })();
    };

    const kpiCard = (label, child, accentColor) => (
        <div style={{ background: '#fff', borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}`, boxShadow: '0 2px 10px rgba(15,23,42,.05)' }}>
            <div style={{ fontSize: 10, color: COLORS.textFaint, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: accentColor || COLORS.text, letterSpacing: -0.5, lineHeight: 1.1 }}>{child}</div>
        </div>
    );

    return (
        <div style={S.content}>
            {portalPerm.tripsGreeting !== false && (
                <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, letterSpacing: -0.5 }}>{greet}, {firstNameHi}! 👋</div>
                    <div style={{ fontSize: 13, color: COLORS.textFaint, marginTop: 6 }}>{new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                </div>
            )}
            {portalPerm.tripsKpiRow !== false && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {kpiCard('Total Trips', totalTrips, COLORS.text)}
                    {kpiCard('This Month', fmt(monthAllowance), COLORS.green)}
                    {kpiCard('Pending', pendingCount, COLORS.yellow)}
                </div>
            )}
            {portalPerm.tripsMonthExplainer !== false && (
                <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: -8, marginBottom: 16, lineHeight: 1.35 }}>
                    <b>This Month</b> is the sum of your <b>mileage allowances</b> for trips dated this month — not customer freight charges.
                </div>
            )}
            {openTrip && portalPerm.tripsOpenTripBanner !== false && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 14, color: '#9a3412', lineHeight: 1.45, fontWeight: 600 }}>
                    You have a trip in progress. Complete it and wait for office approval before a new one is assigned.
                </div>
            )}
            {portalPerm.tripsStartNewTrip !== false && (
                <button type="button" style={{ width: '100%', minHeight: 54, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${COLORS.coral} 0%, ${COLORS.coralDark} 100%)`, color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 22, cursor: 'pointer', boxShadow: '0 6px 20px rgba(249,115,113,.32)' }} onClick={onStartNewTrip}>
                    + Start New Trip
                </button>
            )}
            {truck && portalPerm.tripsTruckTyreStrip !== false && (
                <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 16, padding: '10px 12px', background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                    <b style={{ color: COLORS.text }}>Your truck</b> · {truck.reg}
                    {tyreInfo ? <span style={{ color: COLORS.textFaint }}> · Tyres: <span style={{ fontWeight: 700, color: SC[tyreInfo.status] }}>{tyreInfo.status}</span></span> : null}
                </div>
            )}
            {activeJourneys.length > 0 && portalPerm.tripsSectionActive !== false && (
                <>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: COLORS.text }}>Active</div>
                    {activeJourneys.map(j => (
                        <JourneyCard 
                            key={j.id} 
                            j={j} 
                            truck={truck} 
                            driver={driver} 
                            token={token} 
                            portalPerm={portalPerm} 
                            allowUpdate={true} 
                            expandedId={expandedId}
                            setExpandedId={setExpandedId}
                            odomForms={odomForms}
                            setOdom={setOdom}
                            getParty={getParty}
                            setParty={setParty}
                            submitTripStart={submitTripStart}
                            updateStatus={updateStatus}
                            customerDirectory={customerDirectory}
                            fetchDriverData={fetchDriverData}
                            updating={updating}
                            msgs={msgs}
                        />
                    ))}
                </>
            )}
            {completedJourneys.length > 0 && portalPerm.tripsSectionCompleted !== false && (
                <>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, marginTop: activeJourneys.length ? 6 : 0, color: COLORS.text }}>Completed</div>
                    {completedJourneys.slice(0, 30).map(j => (
                        <JourneyCard 
                            key={j.id} 
                            j={j} 
                            truck={truck} 
                            driver={driver} 
                            token={token} 
                            portalPerm={portalPerm} 
                            allowUpdate={false} 
                            expandedId={expandedId}
                            setExpandedId={setExpandedId}
                            odomForms={odomForms}
                            setOdom={setOdom}
                            getParty={getParty}
                            setParty={setParty}
                            submitTripStart={submitTripStart}
                            updateStatus={updateStatus}
                            customerDirectory={customerDirectory}
                            fetchDriverData={fetchDriverData}
                            updating={updating}
                            msgs={msgs}
                        />
                    ))}
                </>
            )}
            {activeJourneys.length === 0 && completedJourneys.length === 0 && portalPerm.tripsEmptyState !== false && (
                <div style={{ ...S.card(), textAlign: 'center', padding: 32, color: COLORS.textFaint }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>No trips yet</div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>When the office assigns a journey, it will appear here.</div>
                </div>
            )}
        </div>
    );
};

const SubmitTab = ({ activeJourneys, apiPost, driver, truck, portalPerm, token, fuelEntries = [] }) => {
    const [form, setForm] = useState({ date: today() });
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [fixingId, setFixingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const firstActiveId = activeJourneys.length === 1 ? activeJourneys[0].id : '';

    useEffect(() => {
        if (firstActiveId && !form.journey) setForm((f) => ({ ...f, journey: firstActiveId }));
    }, [firstActiveId, form.journey]);

    const submit = async () => {
        if (!form.litres || !form.pricePerL || !form.station || !form.odom) {
            setMsg('❌ Station, litres, price, and odometer are required');
            return;
        }
        if (!form.photoPump || !form.photoReceipt || !form.photoOdom) {
            setMsg('❌ Upload pump display, receipt, and odometer photos');
            return;
        }
        setSubmitting(true);
        setMsg('');
        
        const payload = { ...form, truck: driver.truck };
        if (fixingId) payload._fixingId = fixingId; 

        const result = await apiPost('/api/driver/submit/fuel', payload);
        if (result.success) {
            setMsg('✅ ' + result.message);
            setForm({ date: today(), journey: firstActiveId || '' });
            setFixingId(null);
            setShowForm(false);
        } else {
            setMsg('❌ ' + (result.error || 'Submission failed'));
        }
        setSubmitting(false);
    };

    const isRejected = (area) => {
        if (!fixingId) return false;
        const item = fuelEntries.find(f => f.id === fixingId);
        return item?._rejectedFields?.includes(area);
    };

    const onFix = (f) => {
        setForm({
            ...f,
            photoPump: f.photoPump || f.photoPumpUrl,
            photoReceipt: f.photoReceipt || f.receiptUrl,
            photoOdom: f.photoOdom || f.odomPhotoUrl,
        });
        setFixingId(f.id);
        setShowForm(true);
        setMsg('⚠️ Correction Mode: Please fix the highlighted fields below.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const inputStyle = (area) => ({
        ...S.inp,
        border: isRejected(area) ? '2px solid #ef4444' : S.inp.border,
        background: isRejected(area) ? '#fff1f2' : S.inp.background
    });

    return (
        <div style={S.content}>
            {portalPerm.fuelIntro !== false && (
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 14, lineHeight: 1.5 }}>
                Log each fill-up with <b>odometer reading</b>, <b>pump display</b>, and <b>receipt</b> photos. Linked to your current trip when you have one active.
            </div>
            )}
            {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}
            {portalPerm.fuelForm === false ? (
                <div style={{ ...S.card(), color: COLORS.textFaint, textAlign: 'center', padding: 24 }}>Fuel logging is turned off for your account.</div>
            ) : !showForm ? (
                <button style={{ ...S.btn('blue'), width: '100%', marginBottom: 16 }} onClick={() => setShowForm(true)}>
                    + Log Fuel
                </button>
            ) : (
            <div style={{ ...S.card(), border: fixingId ? '2px solid #ef4444' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: fixingId ? '#ef4444' : COLORS.text }}>{fixingId ? 'Correction for Rejected Log' : 'New Fuel Log'}</h3>
                    <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.textFaint }} onClick={() => { setShowForm(false); setFixingId(null); setMsg(''); }}>✕</button>
                </div>
                
                <label style={S.lbl}>Date (Today)</label>
                <div style={{ ...S.inp, background: '#f1f5f9', color: COLORS.textDim, cursor: 'not-allowed' }}>{form.date || today()}</div>
                
                <label style={S.lbl}>Station Name</label>
                <input style={inputStyle('fuelDetails')} placeholder="e.g. Total Mlolongo" value={form.station || ''} onChange={(e) => set('station', e.target.value)} />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={S.lbl}>Litres</label>
                        <input style={inputStyle('fuelDetails')} type="number" inputMode="decimal" placeholder="120" value={form.litres || ''} onChange={(e) => set('litres', e.target.value)} />
                    </div>
                    <div>
                        <label style={S.lbl}>KES / litre</label>
                        <input style={inputStyle('fuelDetails')} type="number" inputMode="decimal" placeholder="176" value={form.pricePerL || ''} onChange={(e) => set('pricePerL', e.target.value)} />
                    </div>
                </div>
                {form.litres && form.pricePerL && <div style={{ ...S.success(), marginBottom: 12 }}>⛽ {fmt(+form.litres * +form.pricePerL)}</div>}

                <label style={S.lbl}>Odometer (km)</label>
                <input style={inputStyle('odometer')} type="number" inputMode="numeric" placeholder="Reading now" value={form.odom || ''} onChange={(e) => set('odom', e.target.value)} />

                {portalPerm.fuelPhotos !== false && (
                <div style={{ background: isRejected('photo') ? '#fff1f2' : '#f8fafc', padding: 12, borderRadius: 10, border: isRejected('photo') ? '2px solid #ef4444' : `1px solid ${COLORS.border}`, marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: isRejected('photo') ? '#ef4444' : COLORS.primary }}>
                        📸 {isRejected('photo') ? 'Resubmit required photos' : 'All three required'}
                    </div>
                    <PhotoField label="1. Pump display" hint="Litres and price visible" token={token} folder="fuel_pump" filename={`pump_${Date.now()}`} onUploaded={(url) => set('photoPump', url)} />
                    <PhotoField label="2. Receipt" hint="Station receipt" token={token} folder="fuel_receipts" filename={`fuel_${Date.now()}`} onUploaded={(url) => set('photoReceipt', url)} />
                    <PhotoField label="3. Odometer" hint="After fill" token={token} folder="odometer" filename={`odom_${Date.now()}`} onUploaded={(url) => set('photoOdom', url)} />
                </div>
                )}
                <div style={{ marginTop: 12 }}>
                    <label style={S.lbl}>Trip (link for office)</label>
                    <select style={S.inp} value={form.journey || ''} onChange={(e) => set('journey', e.target.value)}>
                        <option value="">None / No trip fueling</option>
                        {activeJourneys.map((j) => (
                            <option key={j.id} value={j.id}>
                                {j.origin} → {j.dest}
                            </option>
                        ))}
                    </select>
                </div>
                {portalPerm.fuelSubmit !== false && (
                <button style={{ ...S.btn('blue'), width: '100%', borderRadius: 12, minHeight: 48, ...(fixingId && { background: '#ef4444' }) }} onClick={submit} disabled={submitting}>
                    {submitting ? '⏳ Sending…' : fixingId ? 'Submit Corrected Log' : 'Submit fuel claim'}
                </button>
                )}
            </div>
            )}

            {/* Recent Submissions */}
            <div style={{ marginTop: 24 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: COLORS.text }}>Recent History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(fuelEntries || []).map(f => (
                        <div key={f.id} style={{ ...S.card(), padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{f.station}</div>
                                    <div style={{ fontSize: 12, color: COLORS.textDim }}>{f.date} · {f.litres}L · {fmt(+f.litres * +f.pricePerL)}</div>
                                </div>
                                {f._pendingApproval ? (
                                    <span style={{ fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>PENDING</span>
                                ) : f._isRejected ? (
                                    <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>REJECTED</span>
                                ) : (
                                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>APPROVED</span>
                                )}
                            </div>
                            {f._isRejected && (
                                <div style={{ marginTop: 10, padding: 10, background: '#fff1f2', borderRadius: 8, border: '1px solid #fee2e2' }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>OFFICE FEEDBACK:</div>
                                    <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.4 }}>{f._rejectionReason}</div>
                                    <button 
                                        onClick={() => onFix(f)}
                                        style={{ marginTop: 8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Fix & Re-submit
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {(!fuelEntries || fuelEntries.length === 0) && (
                        <div style={{ fontSize: 13, color: COLORS.textFaint, textAlign: 'center', padding: 12 }}>No recent submissions.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CostsTab = ({ portalPerm, activeJourneys, apiPost, driver, truck, token, expenseEntries = [] }) => {
    const [subType, setSubType] = useState('expense');
    const [form, setForm] = useState({ date: today() });
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [fixingId, setFixingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const firstActiveId = activeJourneys.length === 1 ? activeJourneys[0].id : '';

    useEffect(() => {
        if (firstActiveId && !form.journey) setForm((f) => ({ ...f, journey: firstActiveId }));
    }, [firstActiveId, form.journey]);

    const EXPENSE_CATS = ['Toll', 'Maintenance', 'Parking', 'Police', 'Other'];
    const INCIDENT_TYPES = ['Breakdown', 'Accident', 'Cargo Damage', 'Theft', 'Road Closure', 'Other'];

    const submit = async () => {
        if (subType === 'expense') {
            if (!form.cat || !form.amount) {
                setMsg('❌ Category and amount are required');
                return;
            }
        } else if (!form.incidentType) {
            setMsg('❌ Select incident type');
            return;
        }
        if (subType === 'expense' && !form.journey) {
            setMsg('❌ You must link this expense to an active trip');
            return;
        }
        setSubmitting(true);
        setMsg('');
        const url = subType === 'expense' ? '/api/driver/submit/expense' : '/api/driver/submit/incident';
        
        const payload = { ...form, truck: driver.truck };
        if (fixingId && subType === 'expense') payload._fixingId = fixingId; 

        const result = await apiPost(url, payload);
        if (result.success) {
            setMsg('✅ ' + result.message);
            setForm({ date: today(), journey: firstActiveId || '' });
            setFixingId(null);
            setShowForm(false);
        } else {
            setMsg('❌ ' + (result.error || 'Failed'));
        }
        setSubmitting(false);
    };

    const isRejected = (area) => {
        if (!fixingId || subType !== 'expense') return false;
        const item = expenseEntries.find(e => e.id === fixingId);
        return item?._rejectedFields?.includes(area);
    };

    const onFix = (e) => {
        setSubType('expense');
        setForm({
            ...e,
            receiptUrl: e.receiptUrl,
        });
        setFixingId(e.id);
        setShowForm(true);
        setMsg('⚠️ Correction Mode: Please fix the highlighted fields below.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const inputStyle = (area) => ({
        ...S.inp,
        border: isRejected(area) ? '2px solid #ef4444' : S.inp.border,
        background: isRejected(area) ? '#fff1f2' : S.inp.background
    });

    return (
        <div style={S.content}>
            {portalPerm.costsIntro !== false && (
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 14, lineHeight: 1.5 }}>
                Trip costs: <b>Toll</b>, road <b>maintenance</b>, or <b>other</b> — link to your active trip and attach a receipt when you have one.
            </div>
            )}
            {portalPerm.costsToggle !== false && !showForm && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button style={{ ...S.btn('blue'), flex: 1 }} onClick={() => { setSubType('expense'); setShowForm(true); }}>
                    + Add Expense
                </button>
                <button style={{ ...S.btn('ghost'), flex: 1, color: COLORS.textDim, border: '2px solid #e2e8f0' }} onClick={() => { setSubType('incident'); setShowForm(true); }}>
                    + Log Incident
                </button>
            </div>
            )}
            {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}
            
            {showForm && (
                portalPerm.costsExpenseForm === false && portalPerm.costsIncidentForm === false ? (
                    <div style={{ ...S.card(), color: COLORS.textFaint, textAlign: 'center', padding: 24 }}>Expenses and incidents are turned off for your account.</div>
                ) : (
                <div style={{ ...S.card(), border: fixingId ? '2px solid #ef4444' : `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 16, color: fixingId ? '#ef4444' : COLORS.text }}>{fixingId ? 'Correction for Rejected Claim' : (subType === 'expense' ? 'New Expense' : 'Log Incident')}</h3>
                        <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.textFaint }} onClick={() => { setShowForm(false); setFixingId(null); setMsg(''); }}>✕</button>
                    </div>
                
                {subType === 'expense' && portalPerm.costsExpenseForm !== false && (
                    <>
                        <label style={S.lbl}>Date (Today)</label>
                        <div style={{ ...S.inp, background: '#f1f5f9', color: COLORS.textDim, cursor: 'not-allowed' }}>{form.date || today()}</div>
                        
                        <label style={S.lbl}>Category</label>
                        <select style={inputStyle('expenseDetails')} value={form.cat || ''} onChange={(e) => set('cat', e.target.value)}>
                            <option value="">Select…</option>
                            {EXPENSE_CATS.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>

                        {form.cat === 'Maintenance' && portalPerm.costsMaintenanceSubCategory !== false && (
                            <>
                                <label style={S.lbl}>Service Type (Maintenance)</label>
                                <select 
                                    style={inputStyle('expenseDetails')} 
                                    value={form.task || ''} 
                                    onChange={(e) => set('task', e.target.value)}
                                >
                                    <option value="">Select task…</option>
                                    {(driverData?.settings?.maintenanceSchedule || [
                                        { task: 'Oil Change' },
                                        { task: 'Tyre Rotation' },
                                        { task: 'Wheel Alignment & Balancing' },
                                        { task: 'Brake Disc Inspection' },
                                        { task: 'Brake Pad Replacement' },
                                        { task: 'Fuel Filter Replacement' },
                                        { task: 'Power Steering Fluid Top-up' },
                                        { task: 'Engine Belt Inspection' },
                                        { task: 'Differential Oil Change' },
                                        { task: 'Transmission Fluid Change' },
                                    ]).map((s) => (
                                        <option key={s.task} value={s.task}>{s.task}</option>
                                    ))}
                                    <option value="Other">Other / Not Listed</option>
                                </select>
                            </>
                        )}
                        
                        <label style={S.lbl}>Amount (KES)</label>
                        <input style={inputStyle('expenseDetails')} type="number" inputMode="numeric" placeholder="e.g. 500" value={form.amount || ''} onChange={(e) => set('amount', e.target.value)} />
                        
                        <label style={S.lbl}>Details / Notes</label>
                        <textarea style={{ ...inputStyle('expenseDetails'), height: 88, resize: 'vertical' }} placeholder="Workshop name, specific part, etc." value={form.desc || ''} onChange={(e) => set('desc', e.target.value)} />
                        
                        <div style={{ background: isRejected('photo') ? '#fff1f2' : '#f8fafc', padding: 12, borderRadius: 10, border: isRejected('photo') ? '2px solid #ef4444' : `1px solid ${COLORS.border}`, marginBottom: 14 }}>
                            <PhotoField label={isRejected('photo') ? '📸 Resubmit Receipt' : '📷 Receipt (recommended)'} hint="Photo of toll slip or invoice" token={token} folder="expense_receipts" filename={`exp_${Date.now()}`} onUploaded={(url) => set('receiptUrl', url)} />
                        </div>
                        
                        <div style={{ marginTop: 12 }}>
                            <label style={S.lbl}>Associated Trip (Required)</label>
                            {activeJourneys.length > 0 ? (
                                <select style={S.inp} value={form.journey || ''} onChange={(e) => set('journey', e.target.value)}>
                                    <option value="">Select trip…</option>
                                    {activeJourneys.map((j) => (
                                        <option key={j.id} value={j.id}>
                                            {j.origin} → {j.dest}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div style={{ ...S.errBox(), background: '#fef2f2', color: '#b91c1c', fontSize: 13, padding: 10, marginBottom: 16 }}>
                                    ⚠️ You must have an active trip to submit an expense. If no trip is showing, contact the office.
                                </div>
                            )}
                        </div>
                    </>
                )}
                {subType === 'incident' && portalPerm.costsIncidentForm !== false && (
                    <>
                        <label style={S.lbl}>Type</label>
                        <select style={S.inp} value={form.incidentType || ''} onChange={(e) => set('incidentType', e.target.value)}>
                            <option value="">Select…</option>
                            {INCIDENT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                        <label style={S.lbl}>Location</label>
                        <input style={S.inp} placeholder="Road / landmark" value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
                        <label style={S.lbl}>What happened?</label>
                        <textarea style={{ ...S.inp, height: 120, resize: 'vertical' }} placeholder="Describe…" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
                        <PhotoField label="📷 Photo (optional)" token={token} folder="incidents" filename={`incident_${Date.now()}`} onUploaded={(url) => set('incidentPhotoUrl', url)} />
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#b91c1c' }}>
                            You can also message the office on WhatsApp after submitting.
                        </div>
                    </>
                )}
                {portalPerm.costsSubmit !== false && (
                <button 
                    style={{ ...S.btn('blue'), width: '100%', borderRadius: 12, minHeight: 48, ...(fixingId && { background: '#ef4444' }) }} 
                    onClick={submit} 
                    disabled={submitting || (subType === 'expense' && activeJourneys.length === 0)}
                >
                    {submitting ? '⏳ …' : fixingId ? 'Submit Corrected Claim' : subType === 'expense' ? 'Submit expense' : 'Submit incident'}
                </button>
                )}
            </div>
            )
            )}

            {/* Recent History */}
            {subType === 'expense' && (
                <div style={{ marginTop: 24 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: COLORS.text }}>Recent History</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(expenseEntries || []).map(e => (
                            <div key={e.id} style={{ ...S.card(), padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700 }}>{e.cat} · {fmt(e.amount)}</div>
                                        <div style={{ fontSize: 12, color: COLORS.textDim }}>{e.date} · {e.desc}</div>
                                    </div>
                                    {e._pendingApproval ? (
                                        <span style={{ fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>PENDING</span>
                                    ) : e._isRejected ? (
                                        <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>REJECTED</span>
                                    ) : (
                                        <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>APPROVED</span>
                                    )}
                                </div>
                                {e._isRejected && (
                                    <div style={{ marginTop: 10, padding: 10, background: '#fff1f2', borderRadius: 8, border: '1px solid #fee2e2' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>OFFICE FEEDBACK:</div>
                                        <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.4 }}>{e._rejectionReason}</div>
                                        <button 
                                            onClick={() => onFix(e)}
                                            style={{ marginTop: 8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            Fix & Re-submit
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {(!expenseEntries || expenseEntries.length === 0) && (
                            <div style={{ fontSize: 13, color: COLORS.textFaint, textAlign: 'center', padding: 12 }}>No recent claims found.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const MaintenanceTab = ({ activeJourneys, apiPost, driver, truck, portalPerm, token, maintenanceHistory }) => {
    const [form, setForm] = useState({ date: today() });
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const firstActiveId = activeJourneys.length === 1 ? activeJourneys[0].id : '';

    useEffect(() => {
        if (firstActiveId && !form.journey) setForm((f) => ({ ...f, journey: firstActiveId }));
    }, [firstActiveId, form.journey]);

    const TASKS = ['Oil Change', 'Tyre Replacement', 'Brake Pad Replacement', 'Brake Disc Inspection', 'Coolant Flush', 'Air Filter', 'Fuel Filter', 'Battery Replacement', 'Windscreen Repair', 'Other'];

    const submit = async () => {
        if (!form.task) {
            setMsg('❌ Select a task');
            return;
        }
        setSubmitting(true);
        setMsg('');
        const payload = { ...form, truck: driver.truck };
        const result = await apiPost('/api/driver/submit/maintenance', payload);
        if (result.success) {
            setMsg('✅ Maintenance log submitted for office review');
            setForm({});
        } else {
            setMsg('❌ ' + (result.error || 'Submission failed'));
        }
        setSubmitting(false);
    };

    return (
        <div style={S.content}>
            {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}

            {portalPerm.maintLogForm !== false && (
                <>
                    <div style={S.sectionTitle}>Log New Maintenance</div>
                    <div style={S.card()}>
                        <label style={S.lbl}>Task Performed</label>
                        <select style={S.inp} value={form.task || ''} onChange={(e) => set('task', e.target.value)}>
                            <option value="">Select task…</option>
                            {TASKS.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                        <label style={S.lbl}>Date (Today)</label>
                        <div style={{ ...S.inp, background: '#f1f5f9', color: COLORS.textDim, cursor: 'not-allowed' }}>{form.date || today()}</div>
                        <label style={S.lbl}>Workshop / Garage Name</label>
                        <input style={S.inp} placeholder="e.g. Nairobi Auto Centre" value={form.workshop || ''} onChange={(e) => set('workshop', e.target.value)} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={S.lbl}>Cost (KES)</label>
                                <input style={S.inp} type="number" placeholder="e.g. 12000" value={form.cost || ''} onChange={(e) => set('cost', e.target.value)} />
                            </div>
                            <div>
                                <label style={S.lbl}>Odometer (km)</label>
                                <input style={S.inp} type="number" placeholder="Current reading" value={form.odomReading || ''} onChange={(e) => set('odomReading', e.target.value)} />
                            </div>
                        </div>
                        <label style={S.lbl}>Notes (optional)</label>
                        <textarea style={{ ...S.inp, height: 72, resize: 'vertical' }} placeholder="Any additional details…" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
                        <PhotoField label="📷 Receipt / Workshop Invoice" hint="Photo of the maintenance receipt or invoice" token={token} folder="maintenance_receipts" filename={`maint_${Date.now()}`} onUploaded={(url) => set('receiptUrl', url)} />
                        {activeJourneys.length > 0 && portalPerm.maintJourneyLink !== false && (
                            <>
                                <label style={S.lbl}>Linked Journey (optional)</label>
                                <select style={S.inp} value={form.journey || ''} onChange={(e) => set('journey', e.target.value)}>
                                    <option value="">None</option>
                                    {activeJourneys.map((j) => (
                                        <option key={j.id} value={j.id}>
                                            {j.origin} → {j.dest}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}
                        <button style={{ ...S.btn(), width: '100%', borderRadius: 10 }} onClick={submit} disabled={submitting}>
                            {submitting ? '⏳ Submitting…' : '🔧 Submit Maintenance Log'}
                        </button>
                    </div>
                </>
            )}

            {maintenanceHistory?.length > 0 && portalPerm.maintHistory !== false && (
                <>
                    <div style={{ ...S.sectionTitle, marginTop: 16 }}>History — {truck?.reg}</div>
                    {maintenanceHistory.map((m) => (
                        <div key={m.id} style={S.card()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: COLORS.text }}>{m.task}</div>
                                    <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>
                                        {m.date} · {m.workshop}
                                    </div>
                                    <div style={{ marginTop: 8, fontWeight: 700, color: COLORS.primary }}>KES {Number(m.cost || 0).toLocaleString()}</div>
                                </div>
                                {m.receiptUrl && (
                                    <a href={m.receiptUrl} target="_blank" rel="noreferrer" style={{ ...S.btn('sm'), background: COLORS.bg, color: COLORS.primary, textDecoration: 'none' }}>
                                        👁 Receipt
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

const PayslipsTab = ({ portalPerm, payslips }) => (
    <div style={S.content}>
        {portalPerm.payslipsIntro !== false && (
            <div style={{ fontSize: 14, color: COLORS.textDim, marginBottom: 16, lineHeight: 1.5 }}>
                Payment <b>status</b> by month only. Amounts are handled by the office.
            </div>
        )}
        {portalPerm.payslipsList === false ? (
            <div style={{ ...S.card(), textAlign: 'center', padding: 24, color: COLORS.textFaint }}>Payment status is hidden for your account.</div>
        ) : payslips.length === 0 ? (
            <div style={{ ...S.card(), textAlign: 'center', padding: 28, color: COLORS.textFaint }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div>No payment records yet</div>
            </div>
        ) : (
            payslips.map((p) => (
                <div key={p.id} style={S.card(p.status === 'Paid' ? COLORS.green : COLORS.yellow)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>{new Date(p.month + '-01').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</div>
                        <span style={S.badge(p.status)}>{p.status}</span>
                    </div>
                    {portalPerm.payslipsPaidDate !== false && p.status === 'Paid' && p.paidDate && <div style={{ fontSize: 12, color: COLORS.textDim }}>Paid {p.paidDate}</div>}
                    {portalPerm.payslipsMpesaRef !== false && p.mpesaRef && (
                        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textFaint }}>
                            Ref: <span style={{ fontFamily: 'monospace' }}>{p.mpesaRef}</span>
                        </div>
                    )}
                </div>
            ))
        )}
    </div>
);

const MyDocsTab = ({ token, portalPerm }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadForm, setUploadForm] = useState({ docType: '', label: '', expiryDate: '' });
    const [msg, setMsg] = useState('');
    const [uploading, setUploading] = useState(false);

    const DOC_TYPES = [
        { v: 'psv_licence', l: 'PSV Driving Licence' },
        { v: 'medical_certificate', l: 'Medical Certificate' },
        { v: 'id_card', l: 'ID / Passport' },
    ];

    const fetchMyDocs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/documents/mine`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const d = await res.json();
            setDocs(d.documents || []);
        } catch {
            setDocs([]);
        }
        setLoading(false);
    }, [token]);

    useEffect(() => {
        fetchMyDocs();
    }, [fetchMyDocs]);

    const handleUpload = async (file) => {
        if (!uploadForm.docType) {
            setMsg('❌ Select document type first');
            return;
        }
        setUploading(true);
        setMsg('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('docType', uploadForm.docType);
            formData.append('label', uploadForm.label || file.name);
            if (uploadForm.expiryDate) formData.append('expiryDate', uploadForm.expiryDate);

            const res = await fetch(`${API}/api/documents/driver-upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const result = await res.json();
            if (result.success) {
                setMsg('✅ Document uploaded successfully');
                setUploadForm({ docType: '', label: '', expiryDate: '' });
                fetchMyDocs();
            } else {
                setMsg('❌ ' + (result.error || 'Upload failed'));
            }
        } catch (err) {
            setMsg('❌ Connection error');
        }
        setUploading(false);
    };

    const expiryLabel = (doc) => {
        if (!doc.expiryDate) return { text: 'No expiry set', color: COLORS.textFaint };
        if (doc.isExpired) return { text: `EXPIRED (${Math.abs(doc.daysUntilExpiry)}d ago)`, color: COLORS.red };
        if (doc.daysUntilExpiry <= 30) return { text: `Expires in ${doc.daysUntilExpiry}d`, color: COLORS.yellow };
        return { text: `Valid until ${doc.expiryDate}`, color: COLORS.green };
    };

    return (
        <div style={S.content}>
            <div style={S.sectionTitle}>My Documents</div>
            {portalPerm.docsUploadSection !== false && (
                <div style={S.card()}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📤 Upload Personal Document</div>
                    {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}

                    <label style={S.lbl}>Document Type</label>
                    <select style={S.inp} value={uploadForm.docType} onChange={(e) => setUploadForm((f) => ({ ...f, docType: e.target.value }))}>
                        <option value="">Select type…</option>
                        {DOC_TYPES.map((t) => (
                            <option key={t.v} value={t.v}>
                                {t.l}
                            </option>
                        ))}
                    </select>

                    <label style={S.lbl}>Expiry Date (if applicable)</label>
                    <input style={S.inp} type="date" value={uploadForm.expiryDate} onChange={(e) => setUploadForm((f) => ({ ...f, expiryDate: e.target.value }))} />

                    <div style={{ marginTop: 12, marginBottom: 12 }}>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={S.inp} onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])} disabled={uploading} />
                    </div>

                    <div style={{ fontSize: 11, color: COLORS.textFaint }}>Upload your PSV licence, medical certificate, or ID card for office records.</div>
                </div>
            )}

            {portalPerm.docsList !== false && (
                <>
                    <div style={S.sectionTitle}>Uploaded Files</div>
                    {loading && <div style={{ textAlign: 'center', padding: 20, color: COLORS.textFaint }}>Loading documents…</div>}
                    {!loading && docs.length === 0 && <div style={{ ...S.card(), textAlign: 'center', color: COLORS.textFaint, padding: 24 }}>No documents uploaded yet</div>}
                    {docs.map((doc) => {
                        const status = expiryLabel(doc);
                        const isVehicleDoc = doc.entityType === 'truck';
                        return (
                            <div key={doc.id} style={S.card()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: COLORS.text }}>{doc.label}</div>
                                        {isVehicleDoc && <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.accent, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Assigned vehicle (office)</div>}
                                        <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 2 }}>
                                            {doc.filename} · {String(doc.docType || '').replace(/_/g, ' ')}
                                        </div>
                                        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: status.color, background: status.color + '15', display: 'inline-block', padding: '2px 8px', borderRadius: 4 }}>{status.text}</div>
                                    </div>
                                    {portalPerm.docsViewFile !== false && (
                                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ ...S.btn('sm'), textDecoration: 'none', background: COLORS.bg, color: COLORS.primary }}>
                                            👁 View
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};


const ProfileTab = ({ driver, truck, portalPerm, token, fetchDriverData, apiPost, setTab }) => {
    const [phone, setPhone] = useState(driver.phone || '');
    const [license, setLicense] = useState(driver.license || '');
    const [msg, setMsg] = useState('');
    const [saving, setSaving] = useState(false);
    const [resetBusy, setResetBusy] = useState(false);
    const licClass = Array.isArray(driver.class) && driver.class.length ? driver.class.join(', ') : driver.class || '—';

    useEffect(() => {
        setPhone(driver.phone || '');
        setLicense(driver.license || '');
    }, [driver.phone, driver.license]);

    const save = async () => {
        setSaving(true);
        setMsg('');
        const r = await apiPost('/api/driver/profile', { phone: phone.trim(), license: license.trim() });
        if (r.success) {
            setMsg('✅ Saved');
            await fetchDriverData(token);
        } else {
            setMsg('❌ ' + (r.error || 'Could not save'));
        }
        setSaving(false);
    };

    const requestPasswordReset = async () => {
        const accountId = driver.email || driver.phone;
        if (!accountId) {
            window.alert('No phone/email on file. Contact the office to reset your password.');
            return;
        }
        setResetBusy(true);
        try {
            const res = await fetch(`${API}/api/driver/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: accountId }),
            });
            const data = await res.json();
            window.alert(data.message || (res.ok ? 'Check your email for a reset link.' : 'Could not send reset email.'));
        } catch {
            window.alert('Could not connect. Try again later.');
        }
        setResetBusy(false);
    };

    const profileRow = (label, value, bold) => (
        <div style={{ ...S.infoRow, borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 12, color: COLORS.textFaint, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: bold ? 800 : 600, color: COLORS.text, textAlign: 'right', maxWidth: '62%' }}>{value}</span>
        </div>
    );

    return (
        <div style={S.content}>
            {portalPerm.profileIdentityCard !== false && (
                <div style={{ ...S.card(), padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${COLORS.border}` }}>
                        <div style={{ fontWeight: 800, fontSize: 17, color: COLORS.text }}>My Profile</div>
                    </div>
                    <div style={{ padding: '4px 16px 16px' }}>
                        {portalPerm.profileFieldName !== false && profileRow('Name', driver.name, true)}
                        {portalPerm.profileFieldPhone !== false && profileRow('Phone', phone || '—')}
                        {portalPerm.profileFieldLicense !== false && profileRow('Licence number', license || '—')}
                        {portalPerm.profileFieldLicenceClass !== false && profileRow('Licence class', licClass)}
                        {portalPerm.profileFieldTruck !== false && profileRow('Assigned truck', truck?.reg || '—', true)}
                        {portalPerm.profileFieldStatus !== false && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                                <span style={{ fontSize: 12, color: COLORS.textFaint, fontWeight: 600 }}>Status</span>
                                <span
                                    style={{
                                        display: 'inline-block',
                                        padding: '4px 12px',
                                        borderRadius: 20,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: (driver.status === 'Active' ? '#10b981' : COLORS.textFaint) + '22',
                                        color: driver.status === 'Active' ? '#059669' : COLORS.textDim,
                                        border: `1px solid ${driver.status === 'Active' ? '#10b981' : COLORS.textFaint}44`,
                                    }}
                                >
                                    {driver.status || '—'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(portalPerm.profileEditPhone !== false || portalPerm.profileEditLicense !== false || portalPerm.profileSaveButton !== false || portalPerm.profileOfficeNote !== false) && (
                <div style={{ ...S.card() }}>
                    {portalPerm.profileOfficeNote !== false && <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12, lineHeight: 1.45 }}>Update your phone and licence number. Name, email, truck, and pay are set by the office.</div>}
                    {portalPerm.profileEditPhone !== false && (
                        <>
                            <label style={S.lbl}>Phone</label>
                            <input style={S.inp} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </>
                    )}
                    {portalPerm.profileEditLicense !== false && (
                        <>
                            <label style={S.lbl}>Licence number</label>
                            <input style={S.inp} value={license} onChange={(e) => setLicense(e.target.value)} />
                        </>
                    )}
                    {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}
                    {portalPerm.profileSaveButton !== false && (
                        <button type="button" style={{ ...S.btn(), width: '100%', borderRadius: 12, minHeight: 48 }} onClick={save} disabled={saving}>
                            {saving ? '⏳ Saving…' : 'Save changes'}
                        </button>
                    )}
                </div>
            )}

            <div style={{ ...S.sectionTitle, marginTop: 8 }}>More</div>
            {portalPerm.profileLinkDocs !== false && (
                <button type="button" style={{ ...S.btn('ghost'), width: '100%', marginBottom: 10, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setTab('docs')}>
                    📁 Documents
                </button>
            )}
            {portalPerm.profileLinkMaintenance !== false && (
                <button type="button" style={{ ...S.btn('ghost'), width: '100%', marginBottom: 10, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setTab('maintenance')}>
                    🔧 Maintenance log
                </button>
            )}
            {portalPerm.profileLinkPayslips !== false && (
                <button type="button" style={{ ...S.btn('ghost'), width: '100%', marginBottom: 10, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setTab('payslips')}>
                    💳 Payment status
                </button>
            )}

            {portalPerm.profilePasswordReset !== false && (
                <button
                    type="button"
                    disabled={resetBusy}
                    style={{
                        width: '100%',
                        minHeight: 48,
                        marginTop: 8,
                        borderRadius: 12,
                        border: `2px solid ${COLORS.accent}`,
                        background: '#fff',
                        color: COLORS.accent,
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: resetBusy ? 'wait' : 'pointer',
                    }}
                    onClick={requestPasswordReset}
                >
                    {resetBusy ? '⏳ Sending…' : 'Reset password'}
                </button>
            )}
            {portalPerm.profileSignOut !== false && (
                <button
                    type="button"
                    style={{
                        width: '100%',
                        minHeight: 48,
                        marginTop: 10,
                        borderRadius: 12,
                        border: `2px solid ${COLORS.red}`,
                        background: '#fff',
                        color: COLORS.red,
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        if (window.confirm('Are you sure you want to log out?')) {
                            localStorage.removeItem('portalToken');
                            window.location.reload();
                        }
                    }}
                >
                    Log out
                </button>
            )}
        </div>
    );
};

export default function DriverPortal() {
    const [token, setToken] = useState(() => localStorage.getItem('driver_token') || '');
    const [driverData, setDriverData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('login'); // login | forgot | reset
    const [resetToken, setResetToken] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [tab, setTab] = useState('journeys');

    const portalPerm = useMemo(() => {
        const merged = mergeProfilePermissions(driverData?.profilePermissions);
        return mergeFlatPermissionOverrides(merged.driverPortal, driverData?.driver?.permissionOverrides?.driverPortal);
    }, [driverData]);
    const visiblePrimaryTabs = useMemo(
        () => PRIMARY_TABS.filter((t) => portalPerm[TAB_NAV_PERM[t.id]] !== false),
        [portalPerm]
    );
    const canDocsTab = portalPerm.docsUploadSection !== false || portalPerm.docsList !== false || portalPerm.docsViewFile !== false;
    const canMaintTab = portalPerm.maintLogForm !== false || portalPerm.maintHistory !== false;
    const canPayslipsTab = portalPerm.payslipsIntro !== false || portalPerm.payslipsList !== false;

    useEffect(() => {
        if (!token || !driverData) return;
        const onPrimary = PRIMARY_TABS.some((t) => t.id === tab);
        const allowedPrimary = visiblePrimaryTabs.some((t) => t.id === tab);
        if (onPrimary && !allowedPrimary && visiblePrimaryTabs.length) {
            setTab(visiblePrimaryTabs[0].id);
            return;
        }
        if (tab === 'docs' && !canDocsTab && visiblePrimaryTabs.length) setTab(visiblePrimaryTabs[0].id);
        else if (tab === 'maintenance' && !canMaintTab && visiblePrimaryTabs.length) setTab(visiblePrimaryTabs[0].id);
        else if (tab === 'payslips' && !canPayslipsTab && visiblePrimaryTabs.length) setTab(visiblePrimaryTabs[0].id);
    }, [tab, token, driverData, visiblePrimaryTabs, canDocsTab, canMaintTab, canPayslipsTab]);

    const fetchDriverData = useCallback(async (tok) => {
        if (!tok) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/driver/me`, { headers: { Authorization: `Bearer ${tok}` } });
            if (res.status === 401) {
                setToken('');
                setDriverData(null);
                setView('login');
                setLoginError('Session expired. Please log in again.');
                localStorage.removeItem('driver_token');
                setLoading(false);
                return;
            }
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.driver) {
                setToken('');
                setDriverData(null);
                setView('login');
                setLoginError(payload?.error || 'Driver profile not found. Contact your office.');
                localStorage.removeItem('driver_token');
                setLoading(false);
                return;
            }
            setDriverData(payload);
        } catch {
            setLoginError('Could not connect to server. Please try again.');
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tok = params.get('token');
        if (tok) {
            setResetToken(tok);
            setView('reset');
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    useEffect(() => { if (token) fetchDriverData(token); }, [token, fetchDriverData]);

    const login = async () => {
        if (!identifier || !password) { setLoginError('Enter your phone/email and password'); return; }
        setLoginLoading(true); setLoginError('');
        try {
            const res = await fetch(`${API}/api/driver/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password }),
            });
            const data = await res.json();
            if (data.requirePasswordChange && data.setupToken) {
                setResetToken(data.setupToken);
                setView('reset');
                setLoginError('Use this step to set your new password/PIN.');
            } else if (data.token) {
                localStorage.setItem('driver_token', data.token);
                setToken(data.token);
            } else setLoginError(data.error || 'Login failed — contact your office');
        } catch { setLoginError('Could not connect to server. Try again.'); }
        setLoginLoading(false);
    };

    const forgotPassword = async () => {
        if (!identifier) { setLoginError('Enter your phone or email first'); return; }
        setLoginLoading(true); setLoginError('');
        try {
            const res = await fetch(`${API}/api/driver/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier }),
            });
            const data = await res.json();
            setLoginError(data.message);
            if (res.ok) setView('login');
        } catch { setLoginError('Could not connect to server'); }
        setLoginLoading(false);
    };

    const logout = () => { localStorage.removeItem('driver_token'); setToken(''); setDriverData(null); };

    const apiPost = async (url, body) => {
        const res = await fetch(`${API}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
        return res.json();
    };



    // ── SET PASSWORD PAGE ─────────────────────────────────────────────────────
    const SetPasswordPage = () => {
        const [pw, setPw] = useState('');
        const [confirm, setConfirm] = useState('');
        const [status, setStatus] = useState('');
        const [busy, setBusy] = useState(false);

        const strength = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : 3;
        const sColor = ['#e2e8f0', '#ef4444', '#f59e0b', '#10b981'][strength];
        const sLabel = ['', 'Weak', 'Good', 'Strong'][strength];

        const save = async () => {
            if (pw.length < 8) { setStatus('❌ Password must be at least 8 characters'); return; }
            if (pw !== confirm) { setStatus('❌ Passwords do not match'); return; }
            setBusy(true); setStatus('');
            try {
                const res = await fetch(`${API}/api/driver/set-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: resetToken, password: pw }),
                });
                const data = await res.json();
                if (data.success) {
                    setStatus('✅ Password set successfully! Logging you in…');
                    setTimeout(() => {
                        localStorage.setItem('driver_token', data.token);
                        setToken(data.token);
                        setView('login');
                    }, 1500);
                } else setStatus('❌ ' + data.error);
            } catch { setStatus('❌ Server error'); }
            setBusy(false);
        };

        return (
            <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 20px 50px rgba(0,0,0,.1)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.primary }}>Set Your Password</div>
                        <div style={{ fontSize: 13, color: COLORS.textFaint, marginTop: 4 }}>Choose a secure password for your account</div>
                    </div>
                    {status && <div style={status.startsWith('✅') ? S.success() : S.errBox()}>{status}</div>}
                    <label style={S.lbl}>New Password</label>
                    <input style={S.inp} type="password" placeholder="Min 8 characters" value={pw} onChange={e => setPw(e.target.value)} />
                    {pw && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: (strength / 3) * 100 + '%', background: sColor, transition: 'all .3s' }} />
                            </div>
                            <div style={{ fontSize: 10, color: sColor, fontWeight: 700, marginTop: 4, textAlign: 'right' }}>{sLabel}</div>
                        </div>
                    )}
                    <label style={S.lbl}>Confirm Password</label>
                    <input style={S.inp} type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                    <button style={{ ...S.btn(), width: '100%', marginTop: 10 }} onClick={save} disabled={busy}>
                        {busy ? '⏳ Saving…' : 'Secure Account'}
                    </button>
                </div>
            </div>
        );
    };

    // ── AUTH SCREEN ──────────────────────────────────────────────────────────
    if (!token || !driverData) {
        if (view === 'reset') return <SetPasswordPage />;
        const authInp = { ...S.inp, background: '#ffffff', color: '#0f172a' };

        return (
            <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, #0d1b35, ${COLORS.primary} 60%, #0d2347)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ fontSize: 44, marginBottom: 10 }}>🚛</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary, marginBottom: 4 }}>{view === 'forgot' ? 'Reset Password' : 'Segecha Group Ltd'}</div>
                        <div style={{ fontSize: 13, color: COLORS.textFaint }}>Driver Portal · driver.segecha.com</div>
                    </div>
                    
                    {loginError && <div style={S.errBox()}>{loginError}</div>}
                    
                    <label style={S.lbl}>Phone Number or Email</label>
                    <input
                        style={authInp}
                        type="text"
                        placeholder="07XXXXXXXX or name@segecha.com"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        autoComplete="username"
                    />
                    
                    {view === 'login' && (
                        <>
                            <label style={S.lbl}>Password / OTP / Temporary Password</label>
                            <input style={authInp} type="password" placeholder="Enter password or OTP" value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && login()} />
                            
                            <button style={{ ...S.btn(), width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 4 }}
                                onClick={login} disabled={loginLoading}>
                                {loginLoading ? '⏳ Logging in…' : 'Log In'}
                            </button>
                            
                            <div style={{ textAlign: 'center', marginTop: 16 }}>
                                <button style={{ background: 'none', border: 'none', color: COLORS.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                                    onClick={() => setView('forgot')}>Forgot your password?</button>
                            </div>
                        </>
                    )}

                    {view === 'forgot' && (
                        <>
                            <button style={{ ...S.btn(), width: '100%', padding: 14, fontSize: 16, borderRadius: 12, marginTop: 4 }}
                                onClick={forgotPassword} disabled={loginLoading}>
                                {loginLoading ? '⏳ Sending…' : 'Send Reset Link'}
                            </button>
                            <div style={{ textAlign: 'center', marginTop: 16 }}>
                                <button style={{ background: 'none', border: 'none', color: COLORS.textFaint, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                                    onClick={() => setView('login')}>← Back to Login</button>
                            </div>
                        </>
                    )}

                    <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: COLORS.textFaint, lineHeight: 1.5 }}>
                        Segecha Internal Tracker<br />v3.0.1
                    </div>
                </div>
            </div>
        );
    }

    const {
        driver,
        truck,
        tyreInfo,
        activeJourneys,
        completedJourneys,
        fuelEntries,
        expenses = [],
        payslips,
        maintenanceHistory,
        customers: customerDirectory = [],
    } = driverData;

    const JourneysTabWrapper = () => (
        <JourneysTab 
            driver={driver}
            truck={truck}
            tyreInfo={tyreInfo}
            activeJourneys={activeJourneys}
            completedJourneys={completedJourneys}
            customerDirectory={customerDirectory}
            token={token}
            portalPerm={portalPerm}
            fetchDriverData={fetchDriverData}
            apiPost={apiPost}
        />
    );

    const SubmitTabWrapper = () => (
        <SubmitTab 
            activeJourneys={activeJourneys}
            apiPost={apiPost}
            driver={driver}
            truck={truck}
            portalPerm={portalPerm}
            token={token}
            fuelEntries={fuelEntries}
        />
    );
    const CostsTabWrapper = () => (
        <CostsTab 
            portalPerm={portalPerm}
            activeJourneys={activeJourneys}
            apiPost={apiPost}
            driver={driver}
            truck={truck}
            token={token}
            expenseEntries={expenses}
        />
    );
    const MaintenanceTabWrapper = () => (
        <MaintenanceTab 
            activeJourneys={activeJourneys}
            apiPost={apiPost}
            driver={driver}
            truck={truck}
            portalPerm={portalPerm}
            token={token}
            maintenanceHistory={maintenanceHistory}
        />
    );
    const PayslipsTabWrapper = () => (
        <PayslipsTab portalPerm={portalPerm} payslips={payslips} />
    );
    const MyDocsTabWrapper = () => (
        <MyDocsTab token={token} portalPerm={portalPerm} />
    );
    const ProfileTabWrapper = () => (
        <ProfileTab 
            driver={driver}
            truck={truck}
            portalPerm={portalPerm}
            token={token}
            fetchDriverData={fetchDriverData}
            apiPost={apiPost}
            setTab={setTab}
        />
    );


    const TAB_COMPONENTS = {
        profile: ProfileTabWrapper,
        journeys: JourneysTabWrapper,
        submit: SubmitTabWrapper,
        costs: CostsTabWrapper,
        maintenance: MaintenanceTabWrapper,
        docs: MyDocsTabWrapper,
        payslips: PayslipsTabWrapper,
    };
    if (!driver) {
        return (
            <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>Driver profile unavailable</div>
                    <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 14 }}>
                        Your session is active but no driver profile was returned. Please sign in again or contact the office.
                    </div>
                    <button style={{ ...S.btn(), width: '100%' }} onClick={logout}>Back to login</button>
                </div>
            </div>
        );
    }
    const ActiveTab = TAB_COMPONENTS[tab] || JourneysTab;
    const isPrimaryTab = visiblePrimaryTabs.some((t) => t.id === tab);
    const firstName = driver?.name?.split(' ')[0] || 'Driver';

    if (!visiblePrimaryTabs.length) {
        return (
            <div style={{ ...S.page, padding: 24, textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: COLORS.textDim, fontWeight: 600, lineHeight: 1.5 }}>No driver portal sections are enabled for your account. Ask the office to turn on tabs under Settings → Profile permissions, then push a server snapshot.</p>
                <button type="button" style={{ ...S.btn(), alignSelf: 'center' }} onClick={logout}>
                    Sign out
                </button>
            </div>
        );
    }

    return (
        <div
            style={{
                ...S.page,
                paddingBottom: isPrimaryTab ? S.page.paddingBottom : 'max(20px, env(safe-area-inset-bottom, 0px))',
            }}
        >
            <div style={S.topbar}>
                <div style={{ flex: '0 0 auto', minWidth: 120, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isPrimaryTab ? (
                        <>
                            <span
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: `linear-gradient(135deg, ${COLORS.primary}, #2563eb)`,
                                    color: '#fff',
                                    fontSize: 13,
                                    fontWeight: 900,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                S
                            </span>
                            <span style={{ color: COLORS.text, fontWeight: 800, fontSize: 14, letterSpacing: -0.3 }}>Segecha Group</span>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                const p = visiblePrimaryTabs.find((x) => x.id === 'profile');
                                setTab(p ? 'profile' : visiblePrimaryTabs[0].id);
                            }}
                            style={{
                                background: COLORS.bg,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: 10,
                                color: COLORS.text,
                                fontSize: 13,
                                fontWeight: 700,
                                padding: '8px 12px',
                                cursor: 'pointer',
                            }}
                        >
                            ← Back
                        </button>
                    )}
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: COLORS.text, fontWeight: 800, fontSize: 16 }}>{TAB_TITLE[tab] || 'Driver'}</div>
                <div style={{ flex: '0 0 auto', minWidth: 72, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        type="button"
                        title="Refresh"
                        style={{
                            background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 10,
                            color: COLORS.textDim,
                            fontSize: 16,
                            padding: '6px 10px',
                            cursor: 'pointer',
                            lineHeight: 1,
                        }}
                        onClick={() => fetchDriverData(token)}
                    >
                        ↻
                    </button>
                    <span style={{ color: COLORS.text, fontWeight: 800, fontSize: 15 }}>{firstName}</span>
                </div>
            </div>
            {loading && <div style={{ textAlign: 'center', padding: 40, color: COLORS.textFaint }}>⏳ Loading…</div>}
            {!loading && <ActiveTab />}
            {isPrimaryTab && (
                <div style={S.tabBar}>
                    {visiblePrimaryTabs.map((t) => (
                        <button key={t.id} type="button" style={S.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>
                            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.2, textTransform: 'none', lineHeight: 1.2, textAlign: 'center' }}>{t.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
