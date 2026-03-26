import React, { useState } from 'react';
import { COLORS, S, SC } from '../../constants/theme';
import { fmt, today } from '../../utils/formatters';
import { JourneyCard } from './JourneyCard';

export const JourneysTab = ({
    driver,
    truck,
    tyreInfo,
    activeJourneys = [],
    completedJourneys = [],
    customerDirectory = [],
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
        const result = await apiPost(`/api/driver/journeys/status`, { 
            journeyId: j.id, 
            status: newStatus, 
            ...form 
        });
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

    const firstNameHi = (driver.name || driver.email || 'Driver').split(' ')[0];
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const monthKey = new Date().toISOString().slice(0, 7);
    const journeysThisMonth = [...activeJourneys, ...completedJourneys].filter((j) => j.date && j.date.startsWith(monthKey));
    const monthAllowance = journeysThisMonth.reduce((s, j) => s + (+j.driverMileage || 0) + (+j.roadUserAllowance || 0), 0);
    const totalTrips = activeJourneys.length + completedJourneys.length;
    const pendingCount = activeJourneys.filter((j) => j.status === 'Awaiting Verification').length;
    const openTrip = activeJourneys.some((j) => ['Loading', 'Approved', 'In Transit', 'Awaiting Start Verification', 'Awaiting Verification'].includes(j.status));

    const lastCompletedDest = completedJourneys[0]?.dest || '';

    const [showEmptyReturnForm, setShowEmptyReturnForm] = useState(false);
    const [emptyReturnForm, setEmptyReturnForm] = useState({});
    const [emptyReturnMsg, setEmptyReturnMsg] = useState('');
    const [emptyReturnLoading, setEmptyReturnLoading] = useState(false);

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

    const onSubmitEmptyReturn = async () => {
        if (!emptyReturnForm.origin) { setEmptyReturnMsg('❌ Please confirm your current location (origin)'); return; }
        if (!emptyReturnForm.dest) { setEmptyReturnMsg('❌ Please enter your destination'); return; }
        if (!emptyReturnForm.reason) { setEmptyReturnMsg('❌ Please provide a reason for the empty return'); return; }
        setEmptyReturnLoading(true);
        setEmptyReturnMsg('');
        try {
            const result = await apiPost('/api/driver/journeys/start-placeholder', { 
                date: today(), 
                origin: emptyReturnForm.origin,
                dest: emptyReturnForm.dest,
                returningEmpty: true,
                cargo: 'Empty Return',
                notes: `EMPTY RETURN — Reason: ${emptyReturnForm.reason}${emptyReturnForm.extraNotes ? '. ' + emptyReturnForm.extraNotes : ''}`,
            });
            if (result.success) {
                setEmptyReturnMsg('✅ Empty return trip request submitted — office has been notified.');
                setEmptyReturnForm({});
                await fetchDriverData(token);
                setTimeout(() => setShowEmptyReturnForm(false), 2500);
            } else {
                setEmptyReturnMsg('❌ ' + (result.error || 'Submission failed'));
            }
        } catch (e) {
            setEmptyReturnMsg('❌ Error: ' + (e?.message || String(e)));
        }
        setEmptyReturnLoading(false);
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
                    <b>This Month</b> is the sum of your <b>projected allowances</b> for trips dated this month.
                </div>
            )}
            {openTrip && portalPerm.tripsOpenTripBanner !== false && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 14, color: '#9a3412', lineHeight: 1.45, fontWeight: 600 }}>
                    You have a trip in progress. Complete it and wait for office approval before a new one is assigned.
                </div>
            )}
            {portalPerm.tripsStartNewTrip !== false && (
                <button type="button" style={{ width: '100%', minHeight: 54, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${COLORS.coral} 0%, ${COLORS.coralDark} 100%)`, color: '#fff', fontWeight: 800, fontSize: 16, marginBottom: 10, cursor: 'pointer', boxShadow: '0 6px 20px rgba(249,115,113,.32)' }} onClick={onStartNewTrip}>
                    + Start New Trip
                </button>
            )}
            {!openTrip && (
                <button type="button" onClick={() => {
                    setShowEmptyReturnForm(f => !f);
                    if (!emptyReturnForm.origin && lastCompletedDest) {
                        setEmptyReturnForm({ origin: lastCompletedDest, dest: '', reason: '🔙 Returning to base after delivery', extraNotes: '' });
                    }
                }} style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: `1px dashed ${COLORS.yellow}`, background: 'rgba(245,158,11,0.06)', color: COLORS.yellow, fontWeight: 700, fontSize: 14, marginBottom: 16, cursor: 'pointer' }}>
                    🔙 Request Empty Return Trip
                </button>
            )}
            {showEmptyReturnForm && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#92400e', marginBottom: 12 }}>📋 Empty Return Trip Request</div>
                    <div style={{ fontSize: 12, color: '#78350f', marginBottom: 12, lineHeight: 1.45 }}>
                        Vehicle is returning without cargo. Select your current location (suggested from last delivery), your destination, and give a reason. The office will review and approve.
                    </div>
                    {emptyReturnMsg && <div style={{ padding: '8px 12px', borderRadius: 8, background: emptyReturnMsg.startsWith('✅') ? '#d1fae5' : '#fee2e2', color: emptyReturnMsg.startsWith('✅') ? '#065f46' : '#991b1b', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{emptyReturnMsg}</div>}
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#78350f', marginBottom: 4 }}>Your Current Location (Origin)</label>
                        <input style={S.inp} value={emptyReturnForm.origin || ''} placeholder={lastCompletedDest || 'e.g. Eldoret'} onChange={e => setEmptyReturnForm(f => ({ ...f, origin: e.target.value }))} />
                        {lastCompletedDest && !emptyReturnForm.origin && <div style={{ fontSize: 11, color: '#92400e', marginTop: 3 }}>Suggested: {lastCompletedDest} (your last delivery)</div>}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#78350f', marginBottom: 4 }}>Destination</label>
                        <input style={S.inp} value={emptyReturnForm.dest || ''} placeholder="e.g. Nairobi" onChange={e => setEmptyReturnForm(f => ({ ...f, dest: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#78350f', marginBottom: 4 }}>Reason for Empty Return</label>
                        <select style={S.inp} value={emptyReturnForm.reason || ''} onChange={e => setEmptyReturnForm(f => ({ ...f, reason: e.target.value }))}>
                            <option value="">Select reason...</option>
                            <option value="🔙 Returning to base after delivery">Returning to base after delivery</option>
                            <option value="🔄 Repositioning for next load">Repositioning for next load</option>
                            <option value="🔧 Going to workshop for maintenance">Going to workshop for maintenance</option>
                            <option value="⚡ Emergency — driver or family">Emergency (driver or family)</option>
                            <option value="❌ Load cancelled at source">Load cancelled at source</option>
                            <option value="🏢 Office instruction">Office instruction</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    {emptyReturnForm.reason && (
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#78350f', marginBottom: 4 }}>Additional notes (optional)</label>
                            <input style={S.inp} value={emptyReturnForm.extraNotes || ''} placeholder="Any extra details for the office..." onChange={e => setEmptyReturnForm(f => ({ ...f, extraNotes: e.target.value }))} />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" onClick={onSubmitEmptyReturn} disabled={emptyReturnLoading} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#d97706', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                            {emptyReturnLoading ? '⏳ Sending...' : '📤 Submit to Office'}
                        </button>
                        <button type="button" onClick={() => setShowEmptyReturnForm(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #d97706', background: 'transparent', color: '#92400e', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </div>
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
