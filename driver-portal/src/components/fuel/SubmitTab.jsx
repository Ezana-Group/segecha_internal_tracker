import React, { useState, useEffect } from 'react';
import { COLORS, S } from '../../constants/theme';
import { fmt, today } from '../../utils/formatters';
import { PhotoField } from '../common/PhotoField';

export const SubmitTab = ({ activeJourneys = [], apiPost, driver, truck, portalPerm, token, fuelEntries = [] }) => {
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
        if (!form.station || !form.litres || !form.pricePerL) {
            setMsg('❌ All fields are required');
            return;
        }
        if (portalPerm.fuelPhotos !== false) {
            if (!form.photoPump || !form.photoReceipt || !form.photoOdom) {
                setMsg('❌ All 3 photos are required');
                return;
            }
        }
        setSubmitting(true);
        setMsg('');
        const payload = { ...form, truck: driver.truck };
        if (fixingId) payload._fixingId = fixingId;

        const result = await apiPost('/api/driver/fuel', payload);
        if (result.success) {
            setMsg('✅ Fuel log submitted for office verification');
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
        const entry = fuelEntries.find(f => f.id === fixingId);
        return entry?._rejectedFields?.includes(area);
    };

    const onFix = (f) => {
        setForm({
            ...f,
            photoPump: f.photoPump,
            photoReceipt: f.photoReceipt,
            photoOdom: f.photoOdom
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
                    Log your fuel purchases. Attach photos of the <b>pump</b>, the <b>receipt</b>, and your <b>odometer</b>.
                </div>
            )}
            
            {portalPerm.fuelToggle !== false && !showForm && (
                <button style={{ ...S.btn('blue'), width: '100%', marginBottom: 16 }} onClick={() => setShowForm(true)}>
                    + New Fuel Log
                </button>
            )}

            {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}

            {showForm && (
            <div style={{ ...S.card(), border: fixingId ? '2px solid #ef4444' : `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: fixingId ? '#ef4444' : COLORS.text }}>{fixingId ? 'Correction for Rejected Log' : 'New Fuel Entry'}</h3>
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

                <label style={S.lbl}>Payment Ref (M-Pesa / Card No)</label>
                <input style={inputStyle('fuelDetails')} placeholder="e.g. QJK1234567" value={form.paymentRef || ''} onChange={(e) => set('paymentRef', e.target.value)} />

                <label style={{ ...S.lbl, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 12 }}>
                    <input 
                        type="checkbox" 
                        checked={!!form.isPetrolCard} 
                        onChange={(e) => set('isPetrolCard', e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: COLORS.primary }}
                    />
                    <span>Paid via Petrol Card</span>
                </label>

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
                                    <div style={{ fontSize: 12, color: COLORS.textDim }}>{f.date} · {f.litres}L · {fmt(+f.litres * +(f.price_per_l || f.pricePerL || 0))}</div>
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
