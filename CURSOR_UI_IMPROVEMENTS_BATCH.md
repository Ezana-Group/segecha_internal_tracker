# Segecha — UI Improvements Batch
# Cursor AI Prompt — File: src/App.jsx only
# 6 improvements in one session

Work through each section in order. Run `npm run dev` after each section.
Do not remove any existing functionality.

---

# IMPROVEMENT 1 — Maintenance Hub redesign

## Problems to fix
1. Every task for every truck is shown as individual rows — with 3 trucks × 10 tasks = 30 rows, all overdue, all the same
2. Odometer readings are concatenated (bug: `142,300,142,350 km` instead of `142,300 km`)
3. No way to group by truck or collapse sections
4. No rich "Log Service" modal

## 1.1 — Fix the odometer concatenation bug

Find the Maintenance component. Locate where `odom` or `currentUsage` is calculated and displayed. The bug is likely that the truck odometer and the last service odometer are being concatenated as strings instead of subtracted as numbers.

Find the line that calculates km since last service. It likely looks like:
```js
const kmSince = truck.odom + lastService.odom
```
or is being passed as a string concatenation. Fix it to:
```js
const kmSince = +truck.odom - +(lastService?.odom || 0);
const remaining = +schedule.intervalKm - kmSince;
```

Wherever `currentUsage` is displayed, ensure it uses:
```js
{Number(truck.odom).toLocaleString('en-KE')} km
```
not a raw string concatenation.

## 1.2 — Replace the Maintenance component

Find:
```jsx
// ══════════════════════════════════════════════════════════════════════════
// MAINTENANCE
// ══════════════════════════════════════════════════════════════════════════
const Maintenance = () => {
```

Replace the entire component with:

```jsx
// ══════════════════════════════════════════════════════════════════════════
// MAINTENANCE
// ══════════════════════════════════════════════════════════════════════════

// Default maintenance schedule — applied to every truck unless overridden
const DEFAULT_SCHEDULE = [
    { task: 'Oil Change',                  intervalKm: 10000 },
    { task: 'Tyre Rotation',               intervalKm: 10000 },
    { task: 'Wheel Alignment & Balancing', intervalKm: 10000 },
    { task: 'Brake Disc Inspection',       intervalKm: 15000 },
    { task: 'Brake Pad Replacement',       intervalKm: 15000 },
    { task: 'Fuel Filter Replacement',     intervalKm: 20000 },
    { task: 'Power Steering Fluid Top-up', intervalKm: 20000 },
    { task: 'Engine Belt Inspection',      intervalKm: 30000 },
    { task: 'Differential Oil Change',     intervalKm: 40000 },
    { task: 'Transmission Fluid Change',   intervalKm: 40000 },
];

const Maintenance = () => {
    const [viewMode, setViewMode]   = useState('schedule'); // 'schedule' | 'history'
    const [filterStatus, setFilter] = useState('all');      // 'all' | 'overdue' | 'due' | 'ok'
    const [filterTruckId, setFilterTruck] = useState('ALL');
    const [expandedTrucks, setExpandedTrucks] = useState(() => {
        // Start with all trucks expanded
        return new Set(data.trucks.map(t => t.id));
    });
    const [logModal, setLogModal]   = useState(null); // { truck, task, intervalKm }
    const [logForm, setLogForm]     = useState({});
    const [loggingStatus, setLoggingStatus] = useState('');

    // ── Compute schedule row status per truck per task
    const getTaskStatus = (truck, task, intervalKm) => {
        const odom = +truck.odom || 0;
        // Find last service expense for this truck + task
        const history = data.expenses.filter(e =>
            e.truck === truck.id &&
            e.cat === 'Maintenance' &&
            e.desc?.toLowerCase().includes(task.toLowerCase())
        ).sort((a, b) => b.date.localeCompare(a.date));

        const lastServiceOdom = history.length > 0 ? +(history[0].odom || 0) : 0;
        const kmSince = odom - lastServiceOdom;
        const remaining = intervalKm - kmSince;
        const pct = Math.min(100, Math.max(0, (kmSince / intervalKm) * 100));

        let status = 'ok';
        if (remaining <= 0) status = 'overdue';
        else if (remaining <= intervalKm * 0.1) status = 'due'; // within 10% of interval

        return {
            status,
            kmSince,
            remaining,
            pct,
            lastServiceOdom,
            lastServiceDate: history[0]?.date || null,
            history,
        };
    };

    // ── Aggregate stats
    const allRows = data.trucks.flatMap(truck =>
        DEFAULT_SCHEDULE.map(s => ({ truck, ...s, ...getTaskStatus(truck, s.task, s.intervalKm) }))
    );
    const overdueCount = allRows.filter(r => r.status === 'overdue').length;
    const dueCount     = allRows.filter(r => r.status === 'due').length;
    const okCount      = allRows.filter(r => r.status === 'ok').length;

    // ── Toggle truck expansion
    const toggleTruck = (id) => {
        setExpandedTrucks(s => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    // ── Log Service submit
    const submitLog = () => {
        if (!logForm.date || !logForm.odom) {
            setLoggingStatus('❌ Date and odometer reading are required');
            return;
        }
        const entry = {
            truck: logModal.truck.id,
            date: logForm.date,
            cat: 'Maintenance',
            amount: +(logForm.cost || 0),
            odom: +logForm.odom,
            desc: `${logModal.task}${logForm.notes ? ' — ' + logForm.notes : ''}`,
            _maintenanceTask: logModal.task,
            _maintenanceDetails: {
                task: logModal.task,
                workshop: logForm.workshop || '',
                cost: +(logForm.cost || 0),
                odomReading: +logForm.odom,
                receiptUrl: logForm.receiptUrl || '',
                notes: logForm.notes || '',
            },
        };
        saveItem('expenses', entry);

        // Update truck odometer if new reading is higher
        if (+logForm.odom > +(logModal.truck.odom || 0)) {
            setData(d => ({
                ...d,
                trucks: d.trucks.map(t => t.id === logModal.truck.id ? { ...t, odom: +logForm.odom } : t),
            }));
        }

        setLoggingStatus('✅ Service logged successfully');
        setTimeout(() => { setLogModal(null); setLogForm({}); setLoggingStatus(''); }, 1200);
    };

    // ── Status styling helpers
    const statusColor = s => ({ overdue: '#ef4444', due: '#f97316', ok: '#10b981' }[s] || T.textFaint);
    const statusBg    = s => ({ overdue: '#ef444418', due: '#f9731618', ok: '#10b98118' }[s] || T.bg);
    const statusLabel = (r) => {
        if (r.status === 'overdue') return `Overdue ${Math.abs(r.remaining).toLocaleString('en-KE')} km`;
        if (r.status === 'due')     return `Due in ${r.remaining.toLocaleString('en-KE')} km`;
        return `${r.remaining.toLocaleString('en-KE')} km remaining`;
    };

    // ── Visible trucks after filter
    const visibleTrucks = data.trucks.filter(t => filterTruckId === 'ALL' || t.id === filterTruckId);

    // ── Maintenance history (all service expenses)
    const maintenanceHistory = data.expenses
        .filter(e => e.cat === 'Maintenance')
        .sort((a, b) => b.date.localeCompare(a.date));

    // ── Render
    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div style={S.ph}>🔧 Maintenance Hub</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Truck filter */}
                    <select style={{ ...S.inp, marginBottom: 0, width: 160, fontSize: 12 }}
                        value={filterTruckId} onChange={e => setFilterTruck(e.target.value)}>
                        <option value="ALL">All trucks</option>
                        {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                    {/* View toggle */}
                    <div style={{ display: 'flex', background: dark ? '#1c2235' : '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 }}>
                        {[['schedule', '📋 Schedule'], ['history', '🕐 History']].map(([id, label]) => (
                            <button key={id} onClick={() => setViewMode(id)}
                                style={{ padding: '6px 14px', border: viewMode === id ? `1px solid ${T.border}` : 'none', borderRadius: 6, fontSize: 12, fontWeight: viewMode === id ? 700 : 400, cursor: 'pointer', background: viewMode === id ? T.surface : 'transparent', color: viewMode === id ? T.text : T.textFaint }}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <button style={S.btn()} onClick={() => setLogModal({ truck: data.trucks[0], task: 'Oil Change', intervalKm: 10000 })}>
                        + Log Service
                    </button>
                </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                    { id: 'overdue', label: 'Overdue tasks', val: overdueCount, c: '#ef4444' },
                    { id: 'due',     label: 'Due soon',      val: dueCount,     c: '#f97316' },
                    { id: 'ok',      label: 'Up to date',    val: okCount,      c: '#10b981' },
                ].map(k => (
                    <div key={k.id}
                        onClick={() => setFilter(filterStatus === k.id ? 'all' : k.id)}
                        style={{ background: filterStatus === k.id ? k.c + '18' : dark ? '#0c0e14' : '#f8fafc', border: `${filterStatus === k.id ? '1.5px' : '1px'} solid ${filterStatus === k.id ? k.c + '44' : T.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}>
                        <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: k.c }}>{k.val}</div>
                    </div>
                ))}
            </div>

            {/* ── SCHEDULE VIEW ── */}
            {viewMode === 'schedule' && (
                <div>
                    {visibleTrucks.map(truck => {
                        const tasks = DEFAULT_SCHEDULE.map(s => ({
                            ...s,
                            ...getTaskStatus(truck, s.task, s.intervalKm),
                        }));
                        const filteredTasks = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);
                        const truckOverdue = tasks.filter(t => t.status === 'overdue').length;
                        const truckDue     = tasks.filter(t => t.status === 'due').length;
                        const isExpanded   = expandedTrucks.has(truck.id);

                        if (filteredTasks.length === 0) return null;

                        return (
                            <div key={truck.id} style={{ border: `1px solid ${truckOverdue > 0 ? '#ef444433' : T.border}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                                {/* Truck header row — click to collapse */}
                                <div
                                    onClick={() => toggleTruck(truck.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: dark ? '#0c0e14' : '#f8fafc', cursor: 'pointer', borderBottom: isExpanded ? `1px solid ${T.border}` : 'none' }}>
                                    <div style={{ fontSize: 18 }}>🚛</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: 15, color: T.text }}>{truck.reg}</div>
                                        <div style={{ fontSize: 11, color: T.textFaint }}>{truck.make} · {truck.type} · Odometer: {Number(truck.odom || 0).toLocaleString('en-KE')} km</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {truckOverdue > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#ef444418', color: '#ef4444' }}>🔴 {truckOverdue} overdue</span>}
                                        {truckDue > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f9731618', color: '#f97316' }}>⚠️ {truckDue} due soon</span>}
                                        {truckOverdue === 0 && truckDue === 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#10b98118', color: '#10b981' }}>✅ All clear</span>}
                                        <span style={{ fontSize: 14, color: T.textFaint, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>›</span>
                                    </div>
                                </div>

                                {/* Task rows */}
                                {isExpanded && (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ ...S.tbl, minWidth: 680 }}>
                                            <thead>
                                                <tr>
                                                    {['Maintenance task', 'Interval', 'Last service', 'km Since', 'Remaining', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTasks.map(row => (
                                                    <tr key={row.task} style={{ background: row.status === 'overdue' ? '#ef444406' : row.status === 'due' ? '#f9731606' : T.surface }}>
                                                        <td style={{ ...S.td, fontWeight: 600, color: T.text }}>{row.task}</td>
                                                        <td style={{ ...S.td, fontSize: 12, color: T.textFaint }}>Every {row.intervalKm.toLocaleString('en-KE')} km</td>
                                                        <td style={{ ...S.td, fontSize: 12, color: T.textFaint }}>
                                                            {row.lastServiceDate
                                                                ? <>{row.lastServiceDate}<br /><span style={{ fontSize: 10 }}>@ {Number(row.lastServiceOdom).toLocaleString('en-KE')} km</span></>
                                                                : <span style={{ color: '#f97316' }}>Never serviced</span>
                                                            }
                                                        </td>
                                                        <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{Number(row.kmSince).toLocaleString('en-KE')} km</td>
                                                        <td style={S.td}>
                                                            {/* Progress bar */}
                                                            <div style={{ marginBottom: 6 }}>
                                                                <div style={{ height: 5, background: dark ? '#1c2235' : '#f1f5f9', borderRadius: 3, overflow: 'hidden', width: 100 }}>
                                                                    <div style={{ height: '100%', width: `${row.pct}%`, background: statusColor(row.status), borderRadius: 3, transition: 'width .4s' }} />
                                                                </div>
                                                            </div>
                                                            <span style={{ fontSize: 12, color: statusColor(row.status), fontWeight: 600 }}>{statusLabel(row)}</span>
                                                        </td>
                                                        <td style={S.td}>
                                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: statusBg(row.status), color: statusColor(row.status) }}>
                                                                {row.status === 'overdue' ? 'Overdue' : row.status === 'due' ? 'Due soon' : 'OK'}
                                                            </span>
                                                        </td>
                                                        <td style={S.td}>
                                                            <button style={S.btn('sm')} onClick={() => {
                                                                setLogModal({ truck, task: row.task, intervalKm: row.intervalKm });
                                                                setLogForm({ date: today(), odom: String(truck.odom || '') });
                                                            }}>
                                                                Log Service
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── HISTORY VIEW ── */}
            {viewMode === 'history' && (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 14 }}>🕐 All Service Records</div>
                    {maintenanceHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: T.textFaint }}>
                            <div style={{ fontSize: 32, marginBottom: 10 }}>🔧</div>
                            <div>No service records yet. Use "Log Service" to record maintenance.</div>
                        </div>
                    ) : (
                        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ ...S.tbl, minWidth: 620 }}>
                                    <thead>
                                        <tr>{['Date', 'Truck', 'Task', 'Odometer', 'Cost', 'Workshop', 'Notes'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {maintenanceHistory.map(e => (
                                            <tr key={e.id}>
                                                <td style={S.td}>{e.date}</td>
                                                <td style={{ ...S.td, fontWeight: 700, color: '#f97316' }}>{truckReg(e.truck)}</td>
                                                <td style={{ ...S.td, fontWeight: 600, color: T.text }}>{e._maintenanceTask || e.desc}</td>
                                                <td style={{ ...S.td, fontSize: 12, color: T.textFaint }}>
                                                    {e.odom ? `${Number(e.odom).toLocaleString('en-KE')} km` : '—'}
                                                </td>
                                                <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>{fmt(e.amount)}</td>
                                                <td style={{ ...S.td, fontSize: 12, color: T.textFaint }}>{e._maintenanceDetails?.workshop || '—'}</td>
                                                <td style={{ ...S.td, fontSize: 12, color: T.textFaint }}>{e._maintenanceDetails?.notes || e.desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: T.border2 }}>
                                            <td colSpan={4} style={{ ...S.td, fontWeight: 800, textAlign: 'right', color: T.text }}>Total maintenance cost</td>
                                            <td style={{ ...S.td, fontWeight: 800, color: '#10b981', fontSize: 14 }}>{fmt(maintenanceHistory.reduce((s, e) => s + +e.amount, 0))}</td>
                                            <td colSpan={2} style={S.td} />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── LOG SERVICE MODAL ── */}
            {logModal && (
                <div style={S.ovl} onClick={() => { setLogModal(null); setLogForm({}); setLoggingStatus(''); }}>
                    <div style={{ ...S.mbox, width: 'min(520px,95vw)' }} onClick={e => e.stopPropagation()}>
                        <div style={S.mtitle}>🔧 Log Service — {logModal.task}</div>

                        {/* Truck selector */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={S.lbl}>Truck</label>
                            <select style={S.inp} value={logModal.truck.id}
                                onChange={e => setLogModal(m => ({ ...m, truck: data.trucks.find(t => t.id === e.target.value) }))}>
                                {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg} — {Number(t.odom || 0).toLocaleString('en-KE')} km</option>)}
                            </select>
                        </div>

                        {/* Task selector */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={S.lbl}>Maintenance task</label>
                            <select style={S.inp} value={logModal.task}
                                onChange={e => {
                                    const found = DEFAULT_SCHEDULE.find(s => s.task === e.target.value);
                                    setLogModal(m => ({ ...m, task: e.target.value, intervalKm: found?.intervalKm || m.intervalKm }));
                                }}>
                                {DEFAULT_SCHEDULE.map(s => <option key={s.task} value={s.task}>{s.task} (every {s.intervalKm.toLocaleString()} km)</option>)}
                                <option value="Custom">Custom task…</option>
                            </select>
                        </div>

                        {logModal.task === 'Custom' && (
                            <div style={{ marginBottom: 14 }}>
                                <label style={S.lbl}>Custom task description</label>
                                <input style={S.inp} placeholder="e.g. Radiator flush" value={logForm.customTask || ''}
                                    onChange={e => setLogForm(f => ({ ...f, customTask: e.target.value }))} />
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <div>
                                <label style={S.lbl}>Date of service <span style={{ color: '#ef4444' }}>*</span></label>
                                <input type="date" style={S.inp} value={logForm.date || today()}
                                    onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} />
                            </div>
                            <div>
                                <label style={S.lbl}>Odometer reading (km) <span style={{ color: '#ef4444' }}>*</span></label>
                                <input type="number" style={S.inp} placeholder={String(logModal.truck.odom || 0)}
                                    value={logForm.odom || ''}
                                    onChange={e => setLogForm(f => ({ ...f, odom: e.target.value }))} />
                            </div>
                            <div>
                                <label style={S.lbl}>Cost (KES)</label>
                                <input type="number" style={S.inp} placeholder="0"
                                    value={logForm.cost || ''}
                                    onChange={e => setLogForm(f => ({ ...f, cost: e.target.value }))} />
                            </div>
                            <div>
                                <label style={S.lbl}>Workshop / Garage</label>
                                <input style={S.inp} placeholder="e.g. Nairobi Auto Centre"
                                    value={logForm.workshop || ''}
                                    onChange={e => setLogForm(f => ({ ...f, workshop: e.target.value }))} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <label style={S.lbl}>Notes (optional)</label>
                            <textarea style={{ ...S.inp, height: 64, resize: 'vertical' }}
                                placeholder="Any additional details…"
                                value={logForm.notes || ''}
                                onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>

                        {/* Receipt photo upload — uses Cloudinary via server */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={S.lbl}>Receipt / Invoice photo (optional)</label>
                            <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 6 }}>Photo of workshop invoice or receipt — stored in Cloudinary</div>
                            {logForm.receiptUrl ? (
                                <div>
                                    <img src={logForm.receiptUrl} alt="receipt" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #10b98144', marginBottom: 4 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✅ Receipt uploaded</span>
                                        <button style={{ ...S.btn('del'), fontSize: 10, padding: '2px 8px' }}
                                            onClick={() => setLogForm(f => ({ ...f, receiptUrl: '', receiptUploading: false }))}>✕ Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <label style={{ display: 'block', background: dark ? T.bg : '#f8fafc', border: `1.5px dashed ${logForm.receiptUploading ? '#38bdf8' : T.border}`, borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: 13, color: logForm.receiptUploading ? '#38bdf8' : T.textDim }}>
                                    {logForm.receiptUploading ? '⏳ Uploading…' : '📷 Click to upload receipt photo'}
                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                                        disabled={logForm.receiptUploading}
                                        onChange={async (e) => {
                                            const file = e.target.files[0]; if (!file) return;
                                            setLogForm(f => ({ ...f, receiptUploading: true }));
                                            try {
                                                const fd = new FormData();
                                                fd.append('file', file);
                                                fd.append('folder', 'maintenance_receipts');
                                                fd.append('filename', `maint_${logModal.truck.id}_${Date.now()}`);
                                                // Use the existing /api/driver/upload endpoint (no auth needed for admin uploads)
                                                const res = await fetch(`${PAYMENT_API}/api/driver/upload`, { method: 'POST', body: fd });
                                                const result = await res.json();
                                                if (result.success) setLogForm(f => ({ ...f, receiptUrl: result.url, receiptUploading: false }));
                                                else setLogForm(f => ({ ...f, receiptUploading: false }));
                                            } catch { setLogForm(f => ({ ...f, receiptUploading: false })); }
                                            e.target.value = '';
                                        }} />
                                </label>
                            )}
                        </div>

                        {loggingStatus && (
                            <div style={{ background: loggingStatus.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${loggingStatus.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, fontWeight: 600, color: loggingStatus.startsWith('✅') ? '#065f46' : '#dc2626' }}>
                                {loggingStatus}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button style={S.btn('green')} onClick={submitLog}>✅ Save Service Record</button>
                            <button style={S.btn('ghost')} onClick={() => { setLogModal(null); setLogForm({}); setLoggingStatus(''); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
```

---

# IMPROVEMENT 2 — Fleet vehicle detail — full tabbed modal

## 2.1 — Replace the vehicle detail modal

Find the modal that opens when the admin clicks "View" on a truck row in the Fleet page. It currently shows Overview / Maintenance / Documents / P&L tabs. Replace the entire vehicle detail modal with an expanded version:

The modal should be `width: 'min(800px, 95vw)'` and `maxHeight: '90vh'` with `overflowY: 'auto'`.

Inside the modal, render tabs:

```jsx
const VehicleDetailModal = ({ truck, onClose }) => {
    const [tab, setTab] = useState('overview');

    const tabs = [
        { id: 'overview',   label: 'Overview' },
        { id: 'fuel',       label: 'Fuel Log' },
        { id: 'journeys',   label: 'Journeys' },
        { id: 'maintenance', label: 'Maintenance' },
        { id: 'documents',  label: 'Documents' },
        { id: 'pnl',        label: 'P&L' },
    ];

    // ── Per-truck data
    const truckJourneys  = data.journeys.filter(j => j.truck === truck.id).sort((a,b) => b.date.localeCompare(a.date));
    const truckFuel      = data.fuel.filter(f => f.truck === truck.id).sort((a,b) => b.date.localeCompare(a.date));
    const truckExpenses  = data.expenses.filter(e => e.truck === truck.id);
    const truckRevenue   = truckJourneys.reduce((s, j) => s + +j.revenue, 0);
    const truckFuelCost  = truckFuel.reduce((s, f) => s + (f.litres * f.pricePerL), 0);
    const truckMaintCost = truckExpenses.filter(e => e.cat === 'Maintenance').reduce((s, e) => s + +e.amount, 0);
    const truckTotalCost = truckExpenses.reduce((s, e) => s + +e.amount, 0);
    const truckProfit    = truckRevenue - truckTotalCost;
    const totalKm        = truckJourneys.reduce((s, j) => s + +j.distance, 0);
    const totalLitres    = truckFuel.reduce((s, f) => s + +f.litres, 0);
    const avgKmPerL      = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : '—';

    const tabStyle = (id) => ({
        padding: '9px 16px', border: 'none',
        borderBottom: tab === id ? '2px solid #E8501A' : '2px solid transparent',
        background: 'none', fontSize: 13, cursor: 'pointer',
        color: tab === id ? '#E8501A' : T.textFaint,
        fontWeight: tab === id ? 700 : 400,
        whiteSpace: 'nowrap', marginBottom: -1,
    });

    return (
        <div style={S.ovl} onClick={onClose}>
            <div style={{ ...S.mbox, width: 'min(820px,95vw)', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
                onClick={e => e.stopPropagation()}>

                {/* Modal header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderBottom: `1px solid ${T.border}`, background: dark ? '#0c0e14' : '#f8fafc' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E8501A18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🚛</div>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{truck.reg}</div>
                        <div style={{ fontSize: 12, color: T.textFaint }}>{truck.make} · {truck.type} · {truck.year} · <span style={S.badge(truck.status)}>{truck.status}</span></div>
                    </div>
                    <button style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: T.textFaint, lineHeight: 1 }} onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, overflowX: 'auto', padding: '0 24px', background: T.surface }}>
                    {tabs.map(t => <button key={t.id} style={tabStyle(t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
                </div>

                {/* Tab content */}
                <div style={{ padding: 24 }}>

                    {/* OVERVIEW */}
                    {tab === 'overview' && (
                        <div>
                            {/* KPI grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                                {[
                                    { l: 'Revenue',        v: fmt(truckRevenue),  c: '#10b981' },
                                    { l: 'Total Costs',    v: fmt(truckTotalCost), c: '#f97316' },
                                    { l: 'Net Profit',     v: fmt(truckProfit),   c: truckProfit >= 0 ? '#10b981' : '#ef4444' },
                                    { l: 'Trips',          v: truckJourneys.length, c: '#38bdf8' },
                                    { l: 'Total Distance', v: `${totalKm.toLocaleString('en-KE')} km`, c: T.text },
                                    { l: 'Fuel Consumed',  v: `${totalLitres.toLocaleString('en-KE')} L`, c: T.text },
                                    { l: 'Avg km/L',       v: avgKmPerL, c: '#a78bfa' },
                                    { l: 'Capacity',       v: `${truck.capacity} T`, c: T.text },
                                ].map(k => (
                                    <div key={k.l} style={{ background: dark ? '#0c0e14' : '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{k.l}</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: k.c }}>{k.v}</div>
                                    </div>
                                ))}
                            </div>
                            {/* Edit fields */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                {[
                                    ['Registration', 'reg', 'KCB 100A'],
                                    ['Make / Model', 'make', 'Isuzu FVR'],
                                    ['Year of manufacture', 'year', '2020', 'number'],
                                    ['Truck type', 'type', '', null, TRUCK_TYPES],
                                    ['Capacity (tonnes)', 'capacity', '7', 'number'],
                                    ['Odometer (km)', 'odom', '0', 'number'],
                                    ['Tyre change interval (km)', 'tyreLimit', '60000', 'number'],
                                    ['Last tyre change (km)', 'tyreOdom', '0', 'number'],
                                    ['KRA PIN', 'kraPin', ''],
                                    ['Insurance policy no.', 'insurancePolicy', ''],
                                    ['Speed governor serial', 'speedGovernor', ''],
                                    ['Assigned driver', 'driver', '', null, [{ v: '', l: 'Unassigned' }, ...data.drivers.map(d => ({ v: d.id, l: d.name }))]],
                                ].map(([label, key, placeholder, type, options]) => (
                                    <div key={key}>
                                        <label style={S.lbl}>{label}</label>
                                        {options ? (
                                            <select style={S.inp} value={truck[key] || ''}
                                                onChange={e => setData(d => ({ ...d, trucks: d.trucks.map(t => t.id === truck.id ? { ...t, [key]: e.target.value } : t) }))}>
                                                {Array.isArray(options[0]) || typeof options[0] === 'string'
                                                    ? options.map(o => <option key={o} value={o}>{o}</option>)
                                                    : options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                                            </select>
                                        ) : (
                                            <input style={S.inp} type={type || 'text'} placeholder={placeholder}
                                                value={truck[key] || ''}
                                                onChange={e => setData(d => ({ ...d, trucks: d.trucks.map(t => t.id === truck.id ? { ...t, [key]: e.target.value } : t) }))} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FUEL LOG */}
                    {tab === 'fuel' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                                {[['Fill-ups', truckFuel.length, '#38bdf8'], ['Total litres', `${totalLitres.toLocaleString('en-KE')} L`, '#f97316'], ['Total cost', fmt(truckFuelCost), '#ef4444']].map(([l, v, c]) => (
                                    <div key={l} style={{ background: dark ? '#0c0e14' : '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px' }}>
                                        <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{l}</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                            {truckFuel.length === 0 ? <div style={{ color: T.textFaint, padding: 20, textAlign: 'center' }}>No fuel entries for {truck.reg}.</div> : (
                                <table style={S.tbl}>
                                    <thead><tr>{['Date', 'Station', 'Litres', 'Price/L', 'Cost', 'Odometer'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {truckFuel.map(f => (
                                            <tr key={f.id}>
                                                <td style={S.td}>{f.date}</td>
                                                <td style={{ ...S.td, fontWeight: 600, color: T.text }}>{f.station}</td>
                                                <td style={S.td}>{f.litres} L</td>
                                                <td style={S.td}>KES {f.pricePerL}</td>
                                                <td style={{ ...S.td, color: '#f97316', fontWeight: 700 }}>{fmt(f.litres * f.pricePerL)}</td>
                                                <td style={{ ...S.td, color: T.textFaint }}>{f.odom ? `${Number(f.odom).toLocaleString('en-KE')} km` : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* JOURNEYS */}
                    {tab === 'journeys' && (
                        <div>
                            {truckJourneys.length === 0 ? <div style={{ color: T.textFaint, padding: 20, textAlign: 'center' }}>No journeys for {truck.reg}.</div> : (
                                <table style={S.tbl}>
                                    <thead><tr>{['Date', 'Route', 'Driver', 'Distance', 'Revenue', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {truckJourneys.map(j => (
                                            <tr key={j.id}>
                                                <td style={S.td}>{j.date}</td>
                                                <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{j.origin} → {j.dest}</td>
                                                <td style={S.td}>{driverName(j.driver)}</td>
                                                <td style={S.td}>{j.distance} km</td>
                                                <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>{fmt(j.revenue)}</td>
                                                <td style={S.td}><span style={S.badge(j.status)}>{j.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* MAINTENANCE */}
                    {tab === 'maintenance' && (
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 14 }}>Maintenance schedule for {truck.reg}</div>
                            <table style={S.tbl}>
                                <thead><tr>{['Task', 'Interval', 'Last service', 'km Since', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {DEFAULT_SCHEDULE.map(s => {
                                        const row = { ...s, ...(() => {
                                            const odom = +truck.odom || 0;
                                            const history = data.expenses.filter(e => e.truck === truck.id && e.cat === 'Maintenance' && e.desc?.toLowerCase().includes(s.task.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
                                            const lastOdom = history.length > 0 ? +(history[0].odom || 0) : 0;
                                            const kmSince = odom - lastOdom;
                                            const remaining = s.intervalKm - kmSince;
                                            const status = remaining <= 0 ? 'overdue' : remaining <= s.intervalKm * 0.1 ? 'due' : 'ok';
                                            return { kmSince, remaining, status, lastServiceDate: history[0]?.date };
                                        })() };
                                        return (
                                            <tr key={row.task} style={{ background: row.status === 'overdue' ? '#ef444406' : row.status === 'due' ? '#f9731606' : T.surface }}>
                                                <td style={{ ...S.td, fontWeight: 600, color: T.text }}>{row.task}</td>
                                                <td style={{ ...S.td, fontSize: 12, color: T.textFaint }}>Every {row.intervalKm.toLocaleString()} km</td>
                                                <td style={{ ...S.td, fontSize: 12, color: T.textFaint }}>{row.lastServiceDate || 'Never'}</td>
                                                <td style={S.td}>{Number(row.kmSince).toLocaleString('en-KE')} km</td>
                                                <td style={S.td}><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: statusBg(row.status), color: statusColor(row.status) }}>{row.status === 'overdue' ? `Overdue ${Math.abs(row.remaining).toLocaleString()} km` : row.status === 'due' ? 'Due soon' : 'OK'}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Maintenance expense history */}
                            <div style={{ fontWeight: 700, fontSize: 14, color: T.text, margin: '20px 0 12px' }}>Service history</div>
                            {truckExpenses.filter(e => e.cat === 'Maintenance').length === 0
                                ? <div style={{ color: T.textFaint, fontSize: 13 }}>No service records yet.</div>
                                : truckExpenses.filter(e => e.cat === 'Maintenance').sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 13 }}>
                                        <span style={{ color: T.textFaint }}>{e.date}</span>
                                        <span style={{ flex: 1, paddingLeft: 16, fontWeight: 600, color: T.text }}>{e._maintenanceTask || e.desc}</span>
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(e.amount)}</span>
                                    </div>
                                ))
                            }
                        </div>
                    )}

                    {/* DOCUMENTS */}
                    {tab === 'documents' && (
                        <div>
                            <div style={{ marginBottom: 14, fontSize: 13, color: T.textDim }}>
                                Documents for {truck.reg} stored in Cloudflare R2.
                                <button style={{ ...S.btn('ghost'), fontSize: 11, marginLeft: 12 }}
                                    onClick={() => { onClose(); setPage('documents'); fetchDocuments('truck', truck.id); }}>
                                    Open in Document Library →
                                </button>
                            </div>
                            <DocumentPanel entityType="truck" entityId={truck.id} entityLabel={truck.reg} docTypes={DOC_TYPES_TRUCK} />
                        </div>
                    )}

                    {/* P&L */}
                    {tab === 'pnl' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                                {[['Revenue', truckRevenue, '#10b981'], ['Total costs', truckTotalCost, '#ef4444'], ['Net profit', truckProfit, truckProfit >= 0 ? '#10b981' : '#ef4444'], ['Fuel cost', truckFuelCost, '#f97316'], ['Maintenance cost', truckMaintCost, '#f59e0b'], ['Profit margin', truckRevenue > 0 ? ((truckProfit / truckRevenue) * 100).toFixed(1) + '%' : '—', truckProfit >= 0 ? '#10b981' : '#ef4444']].map(([l, v, c]) => (
                                    <div key={l} style={{ background: dark ? '#0c0e14' : '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{l}</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{typeof v === 'number' ? fmt(v) : v}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontWeight: 700, color: T.text, marginBottom: 12 }}>Expense breakdown</div>
                            {truckExpenses.length === 0 ? <div style={{ color: T.textFaint, fontSize: 13 }}>No expenses recorded for {truck.reg}.</div> : (
                                <table style={S.tbl}>
                                    <thead><tr>{['Date', 'Category', 'Description', 'Amount'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {truckExpenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e => (
                                            <tr key={e.id}><td style={S.td}>{e.date}</td><td style={S.td}><span style={S.badge(e.cat)}>{e.cat}</span></td><td style={{ ...S.td, fontSize: 12, color: T.textDim }}>{e.desc}</td><td style={{ ...S.td, color: '#f97316', fontWeight: 700 }}>{fmt(e.amount)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
```

In the Fleet component, replace `setInvoicePreview(t)` / the existing truck view modal with:
```jsx
const [selectedTruck, setSelectedTruck] = useState(null);
// ...
{selectedTruck && <VehicleDetailModal truck={selectedTruck} onClose={() => setSelectedTruck(null)} />}
```

The View button:
```jsx
<button style={S.btn('sm')} onClick={() => setSelectedTruck(t)}>View</button>
```

---

# IMPROVEMENT 3 — Driver full-page view with tabs

## 3.1 — Replace the driver view with a full-page component

In the Drivers component, instead of just opening an edit modal, clicking a driver name / View button should navigate to a full-page driver profile.

Add state to the Drivers component:
```jsx
const [selectedDriver, setSelectedDriver] = useState(null);
```

When `selectedDriver` is set, render the `DriverProfile` component instead of the normal table view:
```jsx
if (selectedDriver) return <DriverProfile driver={selectedDriver} onBack={() => setSelectedDriver(null)} />;
```

Add the `DriverProfile` component (place before the `PAGES` map):

```jsx
const DriverProfile = ({ driver: initialDriver, onBack }) => {
    const driver = data.drivers.find(d => d.id === initialDriver.id) || initialDriver;
    const [tab, setTab] = useState('bio');
    const [authStatus, setAuthStatus] = useState(null);
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState('');

    const driverJourneys  = data.journeys.filter(j => j.driver === driver.id).sort((a,b) => b.date.localeCompare(a.date));
    const driverPayslips  = data.payroll.filter(p => p.driver === driver.id).sort((a,b) => b.month.localeCompare(a.month));
    const assignedTruck   = data.trucks.find(t => t.id === driver.truck);

    // Load portal account status
    useEffect(() => {
        if (tab === 'portal' && driver.email) {
            fetch(`${PAYMENT_API}/api/driver/account-status/${driver.id}?adminKey=${ADMIN_KEY}`)
                .then(r => r.json()).then(setAuthStatus).catch(() => {});
        }
    }, [tab, driver.id]);

    // Performance metrics
    const completedTrips  = driverJourneys.filter(j => j.status === 'Completed').length;
    const totalRevenue    = driverJourneys.reduce((s, j) => s + +j.revenue, 0);
    const totalDistance   = driverJourneys.reduce((s, j) => s + +j.distance, 0);
    const incidentCount   = data.expenses.filter(e => e.truck === driver.truck && e.cat === 'Other').length;

    const tabStyle = (id) => ({
        padding: '9px 18px', border: 'none',
        borderBottom: tab === id ? '2px solid #E8501A' : '2px solid transparent',
        background: 'none', fontSize: 13, cursor: 'pointer',
        color: tab === id ? '#E8501A' : T.textFaint,
        fontWeight: tab === id ? 700 : 400, whiteSpace: 'nowrap', marginBottom: -1,
    });

    const resendSetup = async () => {
        setResending(true); setResendMsg('');
        try {
            const res = await fetch(`${PAYMENT_API}/api/driver/resend-setup`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driverId: driver.id, email: driver.email, driverName: driver.name, adminKey: ADMIN_KEY }),
            });
            const result = await res.json();
            setResendMsg(result.success ? '✅ Email sent' : '❌ ' + result.error);
            if (result.success) setAuthStatus(s => ({ ...s, hasPendingReset: true }));
        } catch { setResendMsg('❌ Server not reachable'); }
        setResending(false);
    };

    return (
        <div>
            {/* Back button + header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <button style={{ ...S.btn('ghost'), fontSize: 12 }} onClick={onBack}>← Back to drivers</button>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#1B3A6B18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{driver.name}</div>
                    <div style={{ fontSize: 12, color: T.textFaint }}>{driver.license} · {driver.class} · <span style={S.badge(driver.status)}>{driver.status}</span></div>
                </div>
                <button style={{ marginLeft: 'auto', ...S.btn('sm') }} onClick={() => openModal('driver', driver)}>Edit</button>
            </div>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                {[['Trips completed', completedTrips, '#38bdf8'], ['Total revenue', fmt(totalRevenue), '#10b981'], ['Total distance', `${totalDistance.toLocaleString('en-KE')} km`, T.text], ['Assigned truck', assignedTruck?.reg || 'None', '#f97316']].map(([l, v, c]) => (
                    <div key={l} style={{ background: dark ? '#0c0e14' : '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 0, overflowX: 'auto' }}>
                {[['bio','👤 Bio & Info'],['journeys','🚛 Journey Log'],['payroll','💰 Payroll'],['documents','📄 Documents'],['performance','📊 Performance'],['portal','🔐 Portal Access']].map(([id, label]) => (
                    <button key={id} style={tabStyle(id)} onClick={() => setTab(id)}>{label}</button>
                ))}
            </div>

            <div style={{ paddingTop: 20 }}>

                {/* BIO */}
                {tab === 'bio' && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                        {[['Full name','name'],['Phone','phone'],['M-Pesa number','mpesa'],['Email','email'],['License number','license'],['Monthly salary (KES)','salary'],['Date joined','joined'],['Status','status']].map(([label, key]) => (
                            <div key={key}>
                                <label style={S.lbl}>{label}</label>
                                {key === 'status' ? (
                                    <select style={S.inp} value={driver[key] || 'Active'}
                                        onChange={e => setData(d => ({ ...d, drivers: d.drivers.map(dr => dr.id === driver.id ? { ...dr, [key]: e.target.value } : dr) }))}>
                                        {['Active', 'Inactive', 'Suspended'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                ) : (
                                    <input style={S.inp} type={key === 'salary' ? 'number' : key === 'joined' ? 'date' : key === 'email' ? 'email' : 'text'}
                                        value={driver[key] || ''}
                                        onChange={e => setData(d => ({ ...d, drivers: d.drivers.map(dr => dr.id === driver.id ? { ...dr, [key]: e.target.value } : dr) }))} />
                                )}
                            </div>
                        ))}
                        <div>
                            <label style={S.lbl}>Assigned truck</label>
                            <select style={S.inp} value={driver.truck || ''}
                                onChange={e => setData(d => ({ ...d, drivers: d.drivers.map(dr => dr.id === driver.id ? { ...dr, truck: e.target.value } : dr) }))}>
                                <option value="">Unassigned</option>
                                {data.trucks.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10, gridColumn: '1/-1', marginTop: 4 }}>
                            <button style={S.btn('green')} onClick={() => { /* changes are live via setData above */ alert('Changes saved locally.'); }}>Save changes</button>
                        </div>
                    </div>
                )}

                {/* JOURNEYS */}
                {tab === 'journeys' && (
                    <div>
                        {driverJourneys.length === 0 ? <div style={{ color: T.textFaint, padding: 20, textAlign: 'center' }}>No journeys assigned to {driver.name}.</div> : (
                            <table style={S.tbl}>
                                <thead><tr>{['Date', 'Route', 'Truck', 'Distance', 'Revenue', 'Mileage', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {driverJourneys.map(j => (
                                        <tr key={j.id}>
                                            <td style={S.td}>{j.date}</td>
                                            <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{j.origin} → {j.dest}</td>
                                            <td style={{ ...S.td, color: '#f97316' }}>{truckReg(j.truck)}</td>
                                            <td style={S.td}>{j.distance} km</td>
                                            <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>{fmt(j.revenue)}</td>
                                            <td style={{ ...S.td, color: '#3b82f6', fontWeight: 700 }}>{j.driverMileage ? fmt(j.driverMileage) : '—'}</td>
                                            <td style={S.td}><span style={S.badge(j.status)}>{j.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* PAYROLL */}
                {tab === 'payroll' && (
                    <div>
                        {driverPayslips.length === 0 ? <div style={{ color: T.textFaint, padding: 20, textAlign: 'center' }}>No payroll records for {driver.name}.</div> : (
                            <table style={S.tbl}>
                                <thead><tr>{['Month', 'Base Salary', 'Allowances', 'Deductions', 'Net Pay', 'Status', 'M-Pesa Ref'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {driverPayslips.map(p => {
                                        const net = +p.baseSalary + +p.allowance - +p.deductions;
                                        return (
                                            <tr key={p.id}>
                                                <td style={{ ...S.td, fontWeight: 700, color: T.text }}>{new Date(p.month + '-01').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</td>
                                                <td style={S.td}>{fmt(p.baseSalary)}</td>
                                                <td style={{ ...S.td, color: '#10b981' }}>+{fmt(p.allowance)}</td>
                                                <td style={{ ...S.td, color: '#ef4444' }}>-{fmt(p.deductions)}</td>
                                                <td style={{ ...S.td, fontWeight: 800, color: '#10b981', fontSize: 14 }}>{fmt(net)}</td>
                                                <td style={S.td}><span style={S.badge(p.status)}>{p.status}</span></td>
                                                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#10b981' }}>{p.mpesaRef || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: T.border2 }}>
                                        <td style={{ ...S.td, fontWeight: 800, color: T.text }} colSpan={4}>Total paid</td>
                                        <td style={{ ...S.td, fontWeight: 800, color: '#10b981', fontSize: 14 }}>{fmt(driverPayslips.filter(p => p.status === 'Paid').reduce((s, p) => s + +p.baseSalary + +p.allowance - +p.deductions, 0))}</td>
                                        <td colSpan={2} style={S.td} />
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                )}

                {/* DOCUMENTS */}
                {tab === 'documents' && (
                    <div>
                        <div style={{ marginBottom: 14, fontSize: 13, color: T.textDim }}>
                            Driver documents stored in Cloudflare R2.
                        </div>
                        <DocumentPanel entityType="driver" entityId={driver.id} entityLabel={driver.name} docTypes={DOC_TYPES_DRIVER} />
                    </div>
                )}

                {/* PERFORMANCE */}
                {tab === 'performance' && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                            {[
                                ['Trips completed', completedTrips, '#38bdf8'],
                                ['On-time rate', driverJourneys.length > 0 ? Math.round((completedTrips / driverJourneys.length) * 100) + '%' : '—', '#10b981'],
                                ['Total revenue generated', fmt(totalRevenue), '#10b981'],
                                ['Total distance driven', `${totalDistance.toLocaleString('en-KE')} km`, T.text],
                                ['Avg revenue per trip', completedTrips > 0 ? fmt(Math.round(totalRevenue / completedTrips)) : '—', '#a78bfa'],
                                ['Total mileage earned', fmt(driverJourneys.reduce((s, j) => s + (+j.driverMileage || 0), 0)), '#3b82f6'],
                            ].map(([l, v, c]) => (
                                <div key={l} style={{ background: dark ? '#0c0e14' : '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px' }}>
                                    <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{l}</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PORTAL ACCESS */}
                {tab === 'portal' && (
                    <div style={{ maxWidth: 480 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 14 }}>Driver portal account status</div>
                        {!driver.email ? (
                            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#92400e', marginBottom: 14 }}>
                                ⚠️ No email on this driver record. Add an email in the Bio tab to enable portal access.
                            </div>
                        ) : !authStatus ? (
                            <div style={{ color: T.textFaint, fontSize: 13 }}>⏳ Loading account status…</div>
                        ) : (
                            <>
                                <div style={{ background: dark ? '#0c0e14' : '#f8fafc', border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 13 }}>
                                        <span style={{ color: T.textFaint }}>Login email</span>
                                        <span style={{ fontFamily: 'monospace', color: T.text }}>{driver.email}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 13 }}>
                                        <span style={{ color: T.textFaint }}>Account status</span>
                                        <span style={{ fontWeight: 700, color: !authStatus.exists ? '#f97316' : !authStatus.hasPassword ? '#f59e0b' : '#10b981' }}>
                                            {!authStatus.exists ? '⚠ No account' : !authStatus.hasPassword ? '⏳ Pending setup' : '✅ Active'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
                                        <span style={{ color: T.textFaint }}>Portal URL</span>
                                        <span style={{ color: '#38bdf8', fontSize: 12 }}>driver.segecha.com</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <button style={S.btn()} onClick={resendSetup} disabled={resending}>
                                        {resending ? '⏳ Sending…' : authStatus.hasPassword ? '🔄 Send password reset' : '📧 Resend setup email'}
                                    </button>
                                    {resendMsg && <span style={{ fontSize: 12, color: resendMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{resendMsg}</span>}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
```

---

# IMPROVEMENT 4 — Settings: merge M-Pesa into Finance, add logo + WhatsApp

## 4.1 — Merge M-Pesa into Finance in Settings sidebar

In the `NAV_GROUPS` array inside the Settings component, find the Business group:
```js
{ label: 'Business', items: [
    { id: 'company',  icon: '🏢', label: 'Company' },
    { id: 'mpesa',    icon: '💚', label: 'M-Pesa' },
    { id: 'finance',  icon: '🧾', label: 'Finance' },
]}
```

Replace with:
```js
{ label: 'Business', items: [
    { id: 'company',  icon: '🏢', label: 'Company' },
    { id: 'finance',  icon: '🧾', label: 'Finance' },
]}
```

Remove the `mpesa` entry entirely. The M-Pesa config is now rendered as a section inside the `finance` panel.

## 4.2 — Add M-Pesa section to the finance panel

In the `panels` object, find `finance:` and at the bottom of the finance panel (after the bank transfer section), add:

```jsx
<div style={{ fontWeight: 700, fontSize: 13, color: T.text, margin: '8px 0 14px', paddingTop: 20, borderTop: `1px solid ${T.border2}` }}>💚 M-Pesa configuration</div>
<div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>Configure your Safaricom Paybill for client payments and your B2C shortcode for paying drivers.</div>
<div style={grid2}>
    {field('Paybill number', 'Your Safaricom Business Paybill — shown on all invoices', inp(paybillNumber, setPaybillNumber, { placeholder: 'e.g. 522522' }))}
    {field('M-Pesa account number', 'What clients enter when paying via Paybill', inp(paybillAccount, setPaybillAccount, { placeholder: 'e.g. SEGECHA or Invoice No.' }))}
    {field('Business name on M-Pesa', "Name shown on client's M-Pesa receipt", inp(mpesaBusinessName, setMpesaBusinessName))}
    {field('B2C shortcode / Till number', 'For paying drivers via M-Pesa Business', inp(b2cShortcode, setB2cShortcode, { placeholder: 'e.g. 600000' }))}
    {field('Invoice payment footer note', 'Text at bottom of every invoice',
        <textarea style={{ ...S.inp, height: 60, resize: 'vertical', fontFamily: 'inherit' }}
            value={mpesaConfirmationNote} onChange={e => setMpesaConfirmationNote(e.target.value)} />
    )}
</div>
{paybillNumber && (
    <div style={{ background: dark ? '#10b98108' : '#f0fdf4', border: '1px solid #10b98133', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: T.textDim, marginTop: 6 }}>
        Preview: Pay via <b style={{ color: T.text }}>M-Pesa Paybill: {paybillNumber}</b> · Account: <b style={{ color: T.text }}>{paybillAccount || 'Invoice Number'}</b>
    </div>
)}
```

## 4.3 — Add logo upload + WhatsApp number to Company panel

In the `panels.company` section, add these fields to the company grid:

After the date format field, add a logo section:

```jsx
<div style={{ ...S.fg, gridColumn: '1/-1' }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: T.text, margin: '8px 0 14px', paddingTop: 16, borderTop: `1px solid ${T.border2}` }}>Company logo</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Logo preview */}
        {logoUrl ? (
            <div style={{ position: 'relative' }}>
                <img src={logoUrl} alt="Company logo" style={{ height: 56, maxWidth: 200, objectFit: 'contain', borderRadius: 8, border: `1px solid ${T.border}`, padding: 6, background: T.surface }} />
                <button style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', border: 'none', color: '#fff', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 11, lineHeight: 1 }}
                    onClick={() => { setLogoUrl(''); localStorage.removeItem('segecha_logo'); }}>✕</button>
            </div>
        ) : (
            <div style={{ width: 100, height: 56, border: `1.5px dashed ${T.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.textFaint }}>No logo</div>
        )}
        <div>
            <label style={{ ...S.btn(), display: 'inline-block', cursor: 'pointer', fontSize: 12 }}>
                {logoUrl ? '↺ Change logo' : '📷 Upload logo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                        setLogoUrl(ev.target.result);
                        localStorage.setItem('segecha_logo', ev.target.result);
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                }} />
            </label>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>PNG or JPG · appears on invoices, portals, and email templates</div>
        </div>
    </div>
</div>

<div style={{ ...S.fg, gridColumn: '1/-1' }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: T.text, margin: '8px 0 14px', paddingTop: 16, borderTop: `1px solid ${T.border2}` }}>WhatsApp notification numbers</div>
    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>These numbers receive WhatsApp alerts — driver submissions, payment requests, and journey updates. Must be in international format without the + sign.</div>
    <div style={grid2}>
        {field('Main office WhatsApp', 'All notifications sent here · e.g. 254712345678',
            inp(officeWhatsapp, setOfficeWhatsapp, { placeholder: '254700000000' })
        )}
        {field('Backup / Operations WhatsApp (optional)', 'Copy of all alerts · leave blank if not needed',
            inp(backupWhatsapp, setBackupWhatsapp, { placeholder: '254700000000' })
        )}
    </div>
</div>
```

## 4.4 — Add logo and WhatsApp state variables to Settings

Add to the state declarations at the top of Settings:
```js
const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('segecha_logo') || '');
const [officeWhatsapp, setOfficeWhatsapp] = useState(() => loadSetting('officeWhatsapp', ''));
const [backupWhatsapp, setBackupWhatsapp] = useState(() => loadSetting('backupWhatsapp', ''));
```

Add to `saveSettings`:
```js
officeWhatsapp, backupWhatsapp,
```

Note: `logoUrl` is saved directly to `localStorage('segecha_logo')` on upload — not through the settings object — because it's a base64 string that can be large.

## 4.5 — Use logo in the topbar and invoice view

**Topbar:** Find the topbar logo/brand section. Replace the orange circle icon with:
```jsx
{logoUrl ? (
    <img src={logoUrl} alt={companyName} style={{ height: 28, maxWidth: 120, objectFit: 'contain' }} />
) : (
    <div style={{ /* existing orange circle */ }}>S</div>
)}
```

**InvoiceView:** Find `InvoiceView` component. In the invoice header, after the company name, add:
```jsx
{logoUrl && <img src={logoUrl} alt={companyName} style={{ height: 44, maxWidth: 160, objectFit: 'contain', marginBottom: 8 }} />}
```

## 4.6 — Use WhatsApp numbers from settings throughout

Find all hardcoded `PAYMENT_API` WhatsApp references and the `OFFICE_WHATSAPP` constant. Replace with:
```js
const OFFICE_WHATSAPP = _S.officeWhatsapp || '';
const BACKUP_WHATSAPP = _S.backupWhatsapp || '';
```

---

# IMPROVEMENT 5 — M-Pesa payments on invoices

## 5.1 — Add payment tracking to invoice data model

In SEED.invoices, add to each invoice object:
```js
payments: [], // array of { id, amount, method, mpesaCode, date, note }
```

## 5.2 — Add "Record Payment" button to invoice table

Find the invoice table row actions. After the `📤 Send` button, add:
```jsx
{inv.status !== 'Paid' && (
    <button style={{ ...S.btn('sm'), background: '#10b98118', color: '#10b981', border: '1px solid #10b98133', fontSize: 11 }}
        onClick={() => { setPaymentRecordModal(inv); setPaymentForm({ amount: inv.amount, method: 'M-Pesa', date: today() }); }}>
        💚 Record Payment
    </button>
)}
```

Add state:
```js
const [paymentRecordModal, setPaymentRecordModal] = useState(null);
const [paymentForm, setPaymentForm] = useState({});
```

## 5.3 — Add Record Payment modal

After the `PaymentRequestModal` component, add:

```jsx
const RecordPaymentModal = ({ inv }) => {
    const [form, setForm] = useState({ amount: inv.amount, method: 'M-Pesa', date: today(), mpesaCode: '', note: '' });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const totalPaid = (inv.payments || []).reduce((s, p) => s + +p.amount, 0);
    const outstanding = +inv.amount - totalPaid;

    const savePayment = () => {
        if (!form.amount || +form.amount <= 0) { setMsg('❌ Enter a valid amount'); return; }
        if (form.method === 'M-Pesa' && !form.mpesaCode) { setMsg('❌ Enter the M-Pesa confirmation code'); return; }

        const payment = {
            id: uid(),
            amount: +form.amount,
            method: form.method,
            mpesaCode: form.mpesaCode || '',
            date: form.date,
            note: form.note || '',
        };

        const newPayments = [...(inv.payments || []), payment];
        const newTotalPaid = newPayments.reduce((s, p) => s + +p.amount, 0);
        const newStatus = newTotalPaid >= +inv.amount ? 'Paid' : 'Partial';

        setData(d => ({
            ...d,
            invoices: d.invoices.map(i => i.id === inv.id ? {
                ...i,
                payments: newPayments,
                status: newStatus,
                paidDate: newStatus === 'Paid' ? today() : i.paidDate,
            } : i),
        }));

        setMsg('✅ Payment recorded');
        setTimeout(() => { setPaymentRecordModal(null); setPaymentForm({}); setMsg(''); }, 1200);
    };

    return (
        <div style={S.ovl} onClick={() => { setPaymentRecordModal(null); setPaymentForm({}); }}>
            <div style={{ ...S.mbox, width: 'min(500px,95vw)' }} onClick={e => e.stopPropagation()}>
                <div style={S.mtitle}>💚 Record Payment — {inv.id}</div>

                {/* Invoice summary */}
                <div style={{ background: dark ? '#0c0e14' : '#f8fafc', borderRadius: 8, padding: '12px 16px', marginBottom: 18, border: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: T.textFaint }}>Invoice total</span>
                        <b style={{ color: T.text }}>{fmt(inv.amount)}</b>
                    </div>
                    {totalPaid > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ color: T.textFaint }}>Already paid</span>
                            <b style={{ color: '#10b981' }}>{fmt(totalPaid)}</b>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, borderTop: `1px solid ${T.border}`, paddingTop: 8, marginTop: 4 }}>
                        <span style={{ color: T.text }}>Outstanding</span>
                        <span style={{ color: outstanding <= 0 ? '#10b981' : '#E8501A' }}>{fmt(Math.max(0, outstanding))}</span>
                    </div>
                </div>

                {/* Payment form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                        <label style={S.lbl}>Payment method</label>
                        <select style={S.inp} value={form.method} onChange={e => set('method', e.target.value)}>
                            <option value="M-Pesa">💚 M-Pesa</option>
                            <option value="Bank Transfer">🏦 Bank Transfer</option>
                            <option value="Cash">💵 Cash</option>
                            <option value="Cheque">📄 Cheque</option>
                            <option value="Card">💳 Card</option>
                        </select>
                    </div>
                    <div>
                        <label style={S.lbl}>Amount (KES)</label>
                        <input type="number" style={S.inp} value={form.amount}
                            onChange={e => set('amount', e.target.value)} />
                    </div>
                    <div>
                        <label style={S.lbl}>Date received</label>
                        <input type="date" style={S.inp} value={form.date} onChange={e => set('date', e.target.value)} />
                    </div>
                    {form.method === 'M-Pesa' && (
                        <div>
                            <label style={S.lbl}>M-Pesa confirmation code <span style={{ color: '#ef4444' }}>*</span></label>
                            <input style={{ ...S.inp, fontFamily: 'monospace', textTransform: 'uppercase' }}
                                placeholder="e.g. QHX4K2T9WB"
                                value={form.mpesaCode}
                                onChange={e => set('mpesaCode', e.target.value.toUpperCase())} />
                        </div>
                    )}
                    {form.method === 'Bank Transfer' && (
                        <div>
                            <label style={S.lbl}>Bank reference / UTR</label>
                            <input style={S.inp} placeholder="e.g. TRF123456" value={form.mpesaCode}
                                onChange={e => set('mpesaCode', e.target.value)} />
                        </div>
                    )}
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label style={S.lbl}>Note (optional)</label>
                    <input style={S.inp} placeholder="e.g. Partial payment — balance in 7 days"
                        value={form.note} onChange={e => set('note', e.target.value)} />
                </div>

                {msg && (
                    <div style={{ background: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, fontWeight: 600, color: msg.startsWith('✅') ? '#065f46' : '#dc2626' }}>
                        {msg}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                    <button style={S.btn('green')} onClick={savePayment} disabled={saving}>
                        {saving ? '⏳ Saving…' : '✅ Save Payment'}
                    </button>
                    <button style={S.btn('ghost')} onClick={() => { setPaymentRecordModal(null); setPaymentForm({}); }}>Cancel</button>
                </div>

                {/* Payment history */}
                {(inv.payments || []).length > 0 && (
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Payment history</div>
                        {inv.payments.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border2}`, fontSize: 13 }}>
                                <div>
                                    <span style={{ fontWeight: 600, color: T.text }}>{p.method}</span>
                                    {p.mpesaCode && <span style={{ fontFamily: 'monospace', color: '#10b981', marginLeft: 8, fontSize: 11 }}>{p.mpesaCode}</span>}
                                    <div style={{ fontSize: 11, color: T.textFaint, marginTop: 1 }}>{p.date}{p.note ? ` · ${p.note}` : ''}</div>
                                </div>
                                <div style={{ fontWeight: 800, color: '#10b981' }}>{fmt(p.amount)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
```

## 5.4 — Render the RecordPaymentModal

After `{verifyModal && <VerificationModal journey={verifyModal} />}` add:
```jsx
{paymentRecordModal && <RecordPaymentModal inv={paymentRecordModal} />}
```

## 5.5 — Daraja callback: auto-mark invoice paid when STK Push completes

In `server/index.js`, find the existing M-Pesa callback route:
```js
app.post('/api/mpesa/callback', (req, res) => {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (callback.ResultCode === 0) {
        const items = callback.CallbackMetadata?.Item || [];
        const get = name => items.find(i => i.Name === name)?.Value;
        // Log confirmed payment — in future this will update invoice status in database
        console.log('✅ M-Pesa payment confirmed:', {
```

Replace the entire callback route with:

```js
app.post('/api/mpesa/callback', async (req, res) => {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (callback.ResultCode === 0) {
        const items = callback.CallbackMetadata?.Item || [];
        const get = name => items.find(i => i.Name === name)?.Value;

        const invoiceId = callback.AccountReference;
        const amount    = get('Amount');
        const mpesaCode = get('MpesaReceiptNumber');
        const phone     = get('PhoneNumber');
        const timestamp = get('TransactionDate');

        console.log('✅ M-Pesa payment confirmed:', { invoiceId, amount, mpesaCode, phone });

        // Auto-record payment on the invoice in tracker-data.json
        try {
            const { readTrackerData, writeTrackerData } = require('./driver-data');
            const data = readTrackerData();
            const invoice = (data.invoices || []).find(inv =>
                inv.id === invoiceId || inv.id?.toLowerCase() === invoiceId?.toLowerCase()
            );

            if (invoice) {
                const payment = {
                    id: Date.now().toString(36).toUpperCase(),
                    amount: +amount,
                    method: 'M-Pesa',
                    mpesaCode: mpesaCode || '',
                    date: new Date().toISOString().split('T')[0],
                    note: `Auto-recorded via M-Pesa STK Push · ${phone}`,
                    autoVerified: true,
                };

                if (!invoice.payments) invoice.payments = [];
                invoice.payments.push(payment);

                const totalPaid = invoice.payments.reduce((s, p) => s + +p.amount, 0);
                if (totalPaid >= +invoice.amount) {
                    invoice.status = 'Paid';
                    invoice.paidDate = new Date().toISOString().split('T')[0];
                } else {
                    invoice.status = 'Partial';
                }

                writeTrackerData(data);
                console.log(`📋 Invoice ${invoiceId} updated: ${invoice.status} · total paid KES ${totalPaid}`);

                // Send payment receipt to client if email is on invoice
                if (invoice.email) {
                    try {
                        const { sendPaymentReceiptEmail } = require('./email');
                        const settings = JSON.parse(process.env.CACHED_SETTINGS || '{}');
                        await sendPaymentReceiptEmail({
                            to: invoice.email,
                            clientName: invoice.client,
                            invoice,
                            payment,
                            companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
                        });
                        console.log(`📧 Payment receipt sent to ${invoice.email}`);
                    } catch (emailErr) {
                        console.warn('Receipt email failed:', emailErr.message);
                    }
                }
            }
        } catch (err) {
            console.warn('Could not auto-update invoice:', err.message);
        }
    } else {
        console.log('❌ M-Pesa payment failed:', callback.ResultCode, callback.ResultDesc);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

## 5.6 — Add payment receipt email to `server/email.js`

Find `module.exports = { sendInvoiceEmail, sendDriverWelcomeEmail, sendPasswordResetEmail };` at the bottom of `server/email.js`. Before it, add:

```js
// ── Payment receipt email (sent after a payment is recorded — M-Pesa or manual)
async function sendPaymentReceiptEmail({ to, clientName, invoice, payment, companyName }) {
    const totalPaid = (invoice.payments || []).reduce((s, p) => s + +p.amount, 0);
    const outstanding = Math.max(0, +invoice.amount - totalPaid);
    const isFullyPaid = outstanding === 0;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,${isFullyPaid ? '#059669,#10b981' : '#1B3A6B,#0d2347'});padding:32px 40px;text-align:center}
.hdr h1{color:#fff;font-size:22px;font-weight:800;margin:0}
.hdr p{color:${isFullyPaid ? '#a7f3d0' : '#8ab0d8'};font-size:14px;margin:8px 0 0}
.body{padding:32px 40px}
.box{background:#f8fafc;border-radius:10px;padding:18px 22px;margin-bottom:20px}
.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e9ecef;font-size:14px}
.row:last-child{border-bottom:none;font-weight:800;font-size:16px;padding-top:12px}
.lbl{color:#6b7280}.val{color:#111827;font-weight:600}
.green{color:#059669}.amber{color:#d97706}.red{color:#dc2626}
.code-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;text-align:center;margin-bottom:20px}
.code{font-family:monospace;font-size:20px;font-weight:800;color:#059669;letter-spacing:3px}
.ftr{background:#1B3A6B;padding:18px 40px;text-align:center}
.ftr p{color:#8ab0d8;font-size:12px;margin:3px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>${isFullyPaid ? '✅ Payment Received' : '💚 Partial Payment Received'}</h1>
    <p>${companyName} · Nairobi, Kenya</p>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#374151;margin-bottom:20px;line-height:1.6">
      Dear <b>${clientName}</b>,<br><br>
      Thank you — we have received your payment${isFullyPaid ? '. Your invoice is now fully settled.' : '. A balance remains outstanding.'}
    </p>

    ${payment.mpesaCode ? `
    <div class="code-box">
      <div style="font-size:12px;color:#6b7280;margin-bottom:6px">M-Pesa confirmation code</div>
      <div class="code">${payment.mpesaCode}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:6px">Keep this for your records</div>
    </div>` : ''}

    <div class="box">
      <div class="row"><span class="lbl">Invoice</span><span class="val">${invoice.id}</span></div>
      <div class="row"><span class="lbl">Client</span><span class="val">${invoice.client}</span></div>
      <div class="row"><span class="lbl">Invoice total</span><span class="val">KES ${Number(invoice.amount).toLocaleString('en-KE')}</span></div>
      <div class="row"><span class="lbl">This payment</span><span class="val green">KES ${Number(payment.amount).toLocaleString('en-KE')}</span></div>
      <div class="row"><span class="lbl">Payment method</span><span class="val">${payment.method}</span></div>
      <div class="row"><span class="lbl">Payment date</span><span class="val">${payment.date}</span></div>
      <div class="row">
        <span class="lbl">Balance outstanding</span>
        <span class="val ${isFullyPaid ? 'green' : 'amber'}">${isFullyPaid ? 'KES 0 — Fully paid ✅' : `KES ${outstanding.toLocaleString('en-KE')}`}</span>
      </div>
    </div>

    ${!isFullyPaid ? `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;margin-bottom:20px">
      ⚠️ Outstanding balance: <b>KES ${outstanding.toLocaleString('en-KE')}</b>.
      Please settle by <b>${invoice.due || 'the due date'}</b>.
    </div>` : ''}
  </div>
  <div class="ftr">
    <p><b>${companyName}</b> · Nairobi, Kenya</p>
    <p>This is an automated payment receipt. Reply for any queries.</p>
  </div>
</div>
</body>
</html>`;

    await sgMail.send({
        to,
        from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME },
        subject: isFullyPaid
            ? `Payment received — ${invoice.id} · KES ${Number(payment.amount).toLocaleString('en-KE')} — ${companyName}`
            : `Partial payment received — ${invoice.id} · KES ${outstanding.toLocaleString('en-KE')} outstanding`,
        html,
        text: `Hi ${clientName},\n\nPayment received: KES ${Number(payment.amount).toLocaleString('en-KE')}\nInvoice: ${invoice.id}\nM-Pesa code: ${payment.mpesaCode || 'N/A'}\nOutstanding: KES ${outstanding.toLocaleString('en-KE')}\n\n${companyName}`,
    });
}
```

Update the module.exports line:
```js
module.exports = { sendInvoiceEmail, sendDriverWelcomeEmail, sendPasswordResetEmail, sendPaymentReceiptEmail };
```

## 5.7 — Add "Send Receipt" button to the Record Payment modal

Inside `RecordPaymentModal`, in the `savePayment` function, after the `setData(...)` call and before `setMsg('✅ Payment recorded')`, add:

```js
// Send payment receipt to client via email (if email is on invoice)
if (inv.email && form.method) {
    fetch(`${PAYMENT_API}/api/invoices/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            invoiceId: inv.id,
            payment: { ...payment, id: payment.id },
            adminKey: ADMIN_KEY,
        }),
    }).catch(err => console.warn('Receipt email failed:', err.message));
}

// Also prepare WhatsApp receipt message
const s = getSettings();
const waMsg = [
    `✅ *Payment Receipt — ${inv.id}*`,
    ``,
    `Dear ${inv.client},`,
    `We have received your payment.`,
    ``,
    `Amount paid: *KES ${Number(form.amount).toLocaleString('en-KE')}*`,
    `Method: ${form.method}`,
    form.mpesaCode ? `M-Pesa code: *${form.mpesaCode}*` : '',
    `Date: ${form.date}`,
    ``,
    outstanding > 0 ? `Outstanding balance: KES ${Math.max(0, +inv.amount - totalPaid - +form.amount).toLocaleString('en-KE')}` : `Invoice fully settled ✅`,
    ``,
    `Thank you — ${s.companyName || 'Segecha Group Ltd'}`,
].filter(Boolean).join('\n');

const clientPhone = (inv.phone || '').replace(/\D/g, '').replace(/^0/, '254');
if (clientPhone) {
    setPaymentReceiptWa({ url: `https://wa.me/${clientPhone}?text=${encodeURIComponent(waMsg)}`, name: inv.client });
}
```

Add state for the WhatsApp receipt prompt:
```js
const [paymentReceiptWa, setPaymentReceiptWa] = useState(null);
```

Inside the modal JSX, after the success message, add:
```jsx
{paymentReceiptWa && (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600, marginBottom: 8 }}>
            ✅ Payment saved — send receipt to {paymentReceiptWa.name}?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
            <a href={paymentReceiptWa.url} target="_blank" rel="noreferrer"
                style={{ ...S.btn('green'), textDecoration: 'none', fontSize: 12, padding: '7px 14px' }}>
                💬 Send via WhatsApp
            </a>
            <button style={{ ...S.btn('ghost'), fontSize: 12 }} onClick={() => setPaymentReceiptWa(null)}>Skip</button>
        </div>
    </div>
)}
```

## 5.8 — Add receipt email route to `server/index.js`

Find `const PORT = process.env.PORT || 3001;` and before it add:

```js
// Send payment receipt email
app.post('/api/invoices/send-receipt', async (req, res) => {
    const { invoiceId, payment, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { readTrackerData } = require('./driver-data');
        const { sendPaymentReceiptEmail } = require('./email');
        const data = readTrackerData();
        const invoice = (data.invoices || []).find(inv => inv.id === invoiceId);
        if (!invoice || !invoice.email) return res.status(404).json({ error: 'Invoice not found or no email' });
        await sendPaymentReceiptEmail({
            to: invoice.email,
            clientName: invoice.client,
            invoice,
            payment,
            companyName: process.env.COMPANY_NAME || 'Segecha Group Ltd',
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

Find the invoice status badge rendering. Update the status logic to handle `'Partial'`:
```js
// In SC color map:
"Partial": "#f59e0b",
```

In the invoice table, show outstanding amount for partial invoices:
```jsx
{inv.status === 'Partial' && (inv.payments || []).length > 0 && (
    <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
        {fmt(+inv.amount - (inv.payments || []).reduce((s,p)=>s++p.amount,0))} outstanding
    </div>
)}
```

---

# IMPROVEMENT 6 — Checklist

- [ ] Maintenance Hub — trucks are grouped with collapsible sections (click truck header to expand/collapse)
- [ ] Maintenance Hub — odometer shows correct numbers (not concatenated)
- [ ] Maintenance Hub — progress bar fills correctly per task per truck
- [ ] Maintenance Hub — Log Service modal opens with truck and task pre-selected
- [ ] Maintenance Hub — logging a service creates an expense entry and updates truck odom
- [ ] Maintenance History tab shows all service records with total cost
- [ ] Fleet View modal — 6 tabs: Overview, Fuel Log, Journeys, Maintenance, Documents, P&L
- [ ] Fleet View Overview — all 8 KPI cards show correct numbers
- [ ] Fleet View Overview — all fields are editable inline (changes saved to data state)
- [ ] Fleet View Maintenance — shows schedule + history for that truck only
- [ ] Fleet View Documents — renders DocumentPanel for that truck
- [ ] Driver page — clicking a driver opens DriverProfile full-page view
- [ ] Driver profile — 6 tabs: Bio, Journey Log, Payroll, Documents, Performance, Portal Access
- [ ] Driver profile Bio — all fields editable, save works
- [ ] Driver profile Journey Log — shows only that driver's trips with mileage column
- [ ] Driver profile Payroll — shows all payslips with totals footer
- [ ] Driver profile Portal Access — shows account status, resend button works
- [ ] Settings — M-Pesa tab removed from sidebar, M-Pesa config now inside Finance panel
- [ ] Settings Company — logo upload works, preview shows, delete clears it
- [ ] Settings Company — two WhatsApp number fields (main + backup)
- [ ] Logo appears in topbar, invoice view, and is saved to localStorage
- [ ] Log Service modal has receipt photo upload field (Cloudinary)
- [ ] Uploading a receipt photo shows a preview thumbnail in the modal
- [ ] Receipt URL is stored on the maintenance expense record
- [ ] Invoice table has "💚 Record Payment" button on unpaid/partial invoices
- [ ] Record Payment modal supports M-Pesa code, bank reference, cash, cheque, card
- [ ] M-Pesa code field is uppercase monospace with placeholder
- [ ] Partial payments update invoice status to "Partial" (not fully Paid)
- [ ] Payment history shown inside the Record Payment modal
- [ ] After saving payment, WhatsApp receipt prompt appears with pre-written message
- [ ] WhatsApp receipt message includes M-Pesa code, amount, outstanding balance
- [ ] "Partial" status badge is amber coloured
- [ ] Outstanding amount shown under partial invoices in the table
- [ ] `server/email.js` has `sendPaymentReceiptEmail` function with full branded HTML
- [ ] Receipt email shows M-Pesa confirmation code in large monospace green text
- [ ] Receipt email shows outstanding balance in amber if not fully paid
- [ ] Receipt email subject line differs for full vs partial payment
- [ ] `POST /api/invoices/send-receipt` route added to `server/index.js`
- [ ] Daraja callback (`POST /api/mpesa/callback`) auto-records payment on invoice in tracker-data.json
- [ ] Daraja callback auto-sets invoice status to Paid or Partial based on total received
- [ ] Daraja callback sends receipt email automatically if invoice has an email address
