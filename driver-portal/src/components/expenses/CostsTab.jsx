import React, { useState, useEffect } from 'react';
import { COLORS, S } from '../../constants/theme';
import { fmt, today } from '../../utils/formatters';
import { PhotoField } from '../common/PhotoField';

// Helper component for incident status (from line 1563 in App.jsx analysis)
const Badge = ({ status, text }) => {
    const s = status === 'Success' ? 'OK' : status === 'Warning' ? 'Pending' : 'Cancelled';
    return <span style={S.badge(s)}>{text}</span>;
};

// Toolbelt date formatter helper (used in Incident history)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : '—';

export const CostsTab = ({ portalPerm, activeJourneys = [], apiPost, driver, truck, token, expenseEntries = [], driverData }) => {
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
    }, [firstActiveId, form.journey, subType]);

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
        const url = subType === 'expense' ? '/api/driver/expense' : '/api/driver/incident';
        
        const payload = { ...form, truck: driver.truck };
        if (fixingId && subType === 'expense') payload._fixingId = fixingId; 

        const result = await apiPost(url, payload);
        if (result.success) {
            setMsg('✅ ' + (result.message || (subType === 'expense' ? 'Expense claim submitted' : 'Incident report submitted')));
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
                        <div style={{ marginTop: 12 }}>
                            <label style={S.lbl}>Associated Trip (Optional)</label>
                            <select style={S.inp} value={form.journey || ''} onChange={(e) => set('journey', e.target.value)}>
                                <option value="">None / Specific Trip N/A</option>
                                {activeJourneys.map((j) => (
                                    <option key={j.id} value={j.id}>
                                        {j.origin} → {j.dest}
                                    </option>
                                ))}
                            </select>
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

            {subType === 'incident' && (
                <div style={{ marginTop: 24 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: COLORS.text }}>Recent Incident History</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(driverData?.incidents || []).map(i => (
                            <div key={i.id} style={{ ...S.card(), padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700 }}>{i.incidentType}</div>
                                        <div style={{ fontSize: 12, color: COLORS.textDim }}>{fmtDate(i.createdAt || i.date)} · {i.location}</div>
                                        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4, fontStyle: 'italic' }}>{i.description}</div>
                                    </div>
                                    <Badge 
                                        status={i._isRejected ? "Rejected" : (i._pendingApproval ? "Warning" : "Success")} 
                                        text={i._isRejected ? "Rejected" : (i._pendingApproval ? "Pending" : "Resolved")} 
                                    />
                                </div>
                            </div>
                        ))}
                        {(!driverData?.incidents || driverData.incidents.length === 0) && (
                            <div style={{ fontSize: 13, color: COLORS.textFaint, textAlign: 'center', padding: 12 }}>No recent incidents recorded.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
