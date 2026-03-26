import React, { useState, useEffect } from 'react';
import { COLORS, S } from '../../constants/theme';
import { today } from '../../utils/formatters';
import { PhotoField } from '../common/PhotoField';

export const MaintenanceTab = ({ activeJourneys = [], apiPost, driver, truck, portalPerm, token, maintenanceHistory }) => {
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
        const result = await apiPost('/api/driver/maintenance', payload);
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
