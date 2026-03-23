-e ---
# SEGECHA — CURSOR SESSION 6 OF 8
# Previous: PROMPT_05_DOCUMENTS.md
# Next: PROMPT_07_FUEL_TURNBOY.md
# Scope: server/ + src/App.jsx + driver-portal/
# Rule: Complete every section and run the checklist before closing this session.
---

# Segecha — Journey Completion Verification Workflow
# Cursor AI Prompt

## What this changes

Currently drivers can self-complete a journey. This prompt replaces that with a
**two-step verified completion workflow**:

```
Loading → In Transit → Awaiting Verification → Completed
                              ↓ (if rejected)
                           In Transit (driver resubmits)
```

**Step 1 — Driver submits:** On arrival, driver enters end odometer reading,
uploads odometer photo, and uploads delivery proof. Journey moves to
**"Awaiting Verification"**. Driver cannot mark it Completed themselves.

**Step 2 — Admin verifies:** In the main tracker, the journey row shows a
**⏳ Verify** badge. Admin clicks it, sees the odometer reading, odometer photo,
and delivery proof. Admin either approves (→ Completed) or rejects with a reason
(→ back to In Transit, driver sees rejection reason on the portal).

**Notifications:**
- On driver submission: Dashboard alert + WhatsApp to office
- On admin rejection: Driver sees rejection reason on portal next time they open the journey

---

## PART A — Backend changes (`server/`)

### A.1 — Update `server/driver-data.js`

#### A.1a — Add "Awaiting Verification" to valid journey statuses

Find `updateJourneyStatus` in `server/driver-data.js`. Replace the entire function:

```js
function updateJourneyStatus(driverId, journeyId, newStatus, extras = {}) {
    const data = readTrackerData();
    const journey = data.journeys.find(j => j.id === journeyId && j.driver === driverId);
    if (!journey) return { success: false, error: 'Journey not found or not assigned to you' };

    // Valid driver-initiated transitions only
    const validDriverTransitions = {
        'Loading': ['In Transit'],
        'In Transit': ['Awaiting Verification'],
        // Drivers cannot set Completed — only admin can do that
    };

    if (!validDriverTransitions[journey.status]?.includes(newStatus)) {
        return {
            success: false,
            error: journey.status === 'Awaiting Verification'
                ? 'This trip is waiting for office verification. You cannot make changes until it is reviewed.'
                : `Cannot change status from ${journey.status} to ${newStatus}`,
        };
    }

    // For In Transit: require start odometer + photo
    if (newStatus === 'In Transit') {
        if (!extras.startOdom) return { success: false, error: 'Start odometer reading is required' };
        if (!extras.startOdomPhotoUrl) return { success: false, error: 'Start odometer photo is required' };
        journey.startOdom = +extras.startOdom;
        journey.startOdomPhotoUrl = extras.startOdomPhotoUrl;
        journey.startedAt = new Date().toISOString();
    }

    // For Awaiting Verification: require end odometer + photo + delivery proof
    if (newStatus === 'Awaiting Verification') {
        if (!extras.endOdom) return { success: false, error: 'End odometer reading is required before submitting for verification' };
        if (!extras.endOdomPhotoUrl) return { success: false, error: 'End odometer photo is required before submitting for verification' };
        if (!extras.deliveryProofUrl) return { success: false, error: 'Delivery proof photo is required before submitting for verification' };

        journey.endOdom = +extras.endOdom;
        journey.endOdomPhotoUrl = extras.endOdomPhotoUrl;
        journey.deliveryProofUrl = extras.deliveryProofUrl;
        journey.submittedForVerificationAt = new Date().toISOString();
        journey._pendingVerification = true;
        journey._rejectionReason = null; // clear any previous rejection
    }

    journey.status = newStatus;
    writeTrackerData(data);
    return { success: true, journey };
}
```

#### A.1b — Add admin verification function

After `updateJourneyStatus`, add:

```js
function verifyJourneyCompletion(journeyId, approved, rejectionReason = '') {
    const data = readTrackerData();
    const journey = data.journeys.find(j => j.id === journeyId);
    if (!journey) return { success: false, error: 'Journey not found' };
    if (journey.status !== 'Awaiting Verification') {
        return { success: false, error: `Journey is ${journey.status}, not awaiting verification` };
    }

    if (approved) {
        journey.status = 'Completed';
        journey.endDate = new Date().toISOString().split('T')[0];
        journey._pendingVerification = false;
        journey._verifiedAt = new Date().toISOString();
        journey._rejectionReason = null;

        // Update truck odometer with verified end reading
        if (journey.endOdom) {
            const truck = data.trucks.find(t => t.id === journey.truck);
            if (truck && journey.endOdom > truck.odom) {
                truck.odom = journey.endOdom;
            }
        }
    } else {
        // Rejected — send back to In Transit, driver must resubmit
        journey.status = 'In Transit';
        journey._pendingVerification = false;
        journey._rejectionReason = rejectionReason || 'Verification rejected by office';
        journey._rejectedAt = new Date().toISOString();
        // Clear the submitted verification data so driver resubmits fresh
        journey.endOdom = null;
        journey.endOdomPhotoUrl = null;
        journey.deliveryProofUrl = null;
        journey.submittedForVerificationAt = null;
    }

    writeTrackerData(data);
    return { success: true, journey, approved };
}
```

#### A.1c — Export the new function

Find the `module.exports` at the bottom of `server/driver-data.js`:
```js
module.exports = { readTrackerData, writeTrackerData, getDriverData, updateJourneyStatus, addPendingSubmission };
```
Replace with:
```js
module.exports = { readTrackerData, writeTrackerData, getDriverData, updateJourneyStatus, verifyJourneyCompletion, addPendingSubmission };
```

---

### A.2 — Add verification routes to `server/index.js`

Find the existing journey status route:
```js
app.post('/api/driver/journey/:id/status', authMiddleware, (req, res) => {
```

After its closing `});`, add these two new admin-only routes:

```js
// Admin: verify or reject a journey completion
app.post('/api/admin/journey/:id/verify', async (req, res) => {
    const { adminKey, approved, rejectionReason } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const { verifyJourneyCompletion } = require('./driver-data');
        const result = verifyJourneyCompletion(req.params.id, approved === true, rejectionReason);
        if (!result.success) return res.status(400).json({ error: result.error });

        // If rejected, notify via WhatsApp link (logged — admin sends manually)
        if (!approved && rejectionReason) {
            console.log(`❌ Journey ${req.params.id} verification rejected. Reason: ${rejectionReason}`);
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: get all journeys awaiting verification
app.get('/api/admin/journeys/pending-verification', (req, res) => {
    const { adminKey } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    const { readTrackerData } = require('./driver-data');
    const data = readTrackerData();
    const pending = (data.journeys || []).filter(j => j.status === 'Awaiting Verification');
    res.json({ journeys: pending, count: pending.length });
});
```

---

## PART B — Main Tracker changes (`App.jsx`)

### B.1 — Add "Awaiting Verification" to the status colour map

Find the `SC` constant:
```js
const SC = {
    "Completed": "#10b981", "In Transit": "#3b82f6", "Loading": "#f59e0b",
    ...
};
```

Add the new status:
```js
"Awaiting Verification": "#8b5cf6",
```

### B.2 — Add verify/reject helpers

Find `getSettings` in `App.jsx`. After it, add:

```js
const verifyJourney = async (journeyId, approved, rejectionReason = '') => {
    const res = await fetch(`${PAYMENT_API}/api/admin/journey/${journeyId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: ADMIN_KEY, approved, rejectionReason }),
    });
    return res.json();
};

const fetchPendingVerifications = async () => {
    try {
        const res = await fetch(`${PAYMENT_API}/api/admin/journeys/pending-verification?adminKey=${ADMIN_KEY}`);
        return res.json();
    } catch { return { journeys: [], count: 0 }; }
};
```

### B.3 — Add verification state

Find the state declarations block. After `const [paymentModal, setPaymentModal] = useState(null);` add:

```js
const [verifyModal, setVerifyModal] = useState(null); // holds journey awaiting verification
const [pendingVerifications, setPendingVerifications] = useState([]);
const [rejectReason, setRejectReason] = useState('');
const [verifyLoading, setVerifyLoading] = useState(false);
const [verifyMsg, setVerifyMsg] = useState('');
```

### B.4 — Fetch pending verifications on load

Find the `useEffect` that saves data to localStorage:
```js
useEffect(() => {
    try { localStorage.setItem('segecha_v2', JSON.stringify(data)); }
    ...
}, [data]);
```

After it, add:

```js
// Fetch pending verifications from server on load and after data changes
useEffect(() => {
    fetchPendingVerifications().then(result => {
        setPendingVerifications(result.journeys || []);
    });
}, [data]);
```

### B.5 — Add the VerificationModal component

Find the `PaymentRequestModal` component. After its closing `};`, add:

```jsx
// ── Journey Verification Modal ─────────────────────────────────────────────
const VerificationModal = ({ journey }) => {
    const driver = data.drivers.find(d => d.id === journey.driver);
    const truck = data.trucks.find(t => t.id === journey.truck);
    const distanceCovered = journey.endOdom && journey.startOdom
        ? journey.endOdom - journey.startOdom
        : null;

    const handleApprove = async () => {
        setVerifyLoading(true);
        setVerifyMsg('');
        const result = await verifyJourney(journey.id, true);
        if (result.success) {
            setVerifyMsg('✅ Journey marked as Completed');
            // Sync back to local tracker data
            setData(d => ({
                ...d,
                journeys: d.journeys.map(j => j.id === journey.id
                    ? { ...j, status: 'Completed', endDate: new Date().toISOString().split('T')[0] }
                    : j
                ),
                trucks: d.trucks.map(t => t.id === journey.truck && journey.endOdom
                    ? { ...t, odom: Math.max(t.odom, journey.endOdom) }
                    : t
                ),
            }));
            setTimeout(() => { setVerifyModal(null); setVerifyMsg(''); }, 1500);
        } else {
            setVerifyMsg('❌ ' + result.error);
        }
        setVerifyLoading(false);
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            setVerifyMsg('❌ Enter a rejection reason so the driver knows what to fix');
            return;
        }
        setVerifyLoading(true);
        setVerifyMsg('');
        const result = await verifyJourney(journey.id, false, rejectReason);
        if (result.success) {
            setVerifyMsg('↩️ Journey sent back to In Transit — driver will see the rejection reason');
            setData(d => ({
                ...d,
                journeys: d.journeys.map(j => j.id === journey.id
                    ? { ...j, status: 'In Transit', _rejectionReason: rejectReason }
                    : j
                ),
            }));
            // Notify driver via WhatsApp
            if (driver?.phone) {
                const waMsg = `❌ Trip verification rejected by Segecha office.

Trip: *${journey.origin} → ${journey.dest}*
Reason: ${rejectReason}

Please re-submit your end odometer reading and photos.`;
                window.open(`https://wa.me/${driver.phone.replace(/\D/g, '').replace(/^0/, '254')}?text=${encodeURIComponent(waMsg)}`, '_blank');
            }
            setTimeout(() => { setVerifyModal(null); setRejectReason(''); setVerifyMsg(''); }, 2000);
        } else {
            setVerifyMsg('❌ ' + result.error);
        }
        setVerifyLoading(false);
    };

    return (
        <div style={S.ovl} onClick={() => { setVerifyModal(null); setVerifyMsg(''); setRejectReason(''); }}>
            <div style={{ ...S.mbox, width: 'min(620px,95vw)', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}>

                <div style={S.mtitle}>🔍 Verify Journey Completion</div>

                {/* Journey summary */}
                <div style={{ background: dark ? '#0c0e14' : '#f8fafc', borderRadius: 10, padding: '14px 18px', marginBottom: 20, border: `1px solid ${T.border}` }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: T.text, marginBottom: 6 }}>
                        {journey.origin} → {journey.dest}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                        <div><span style={{ color: T.textFaint }}>Truck: </span><b style={{ color: '#f97316' }}>{truck?.reg || journey.truck}</b></div>
                        <div><span style={{ color: T.textFaint }}>Driver: </span><b style={{ color: T.text }}>{driver?.name || journey.driver}</b></div>
                        <div><span style={{ color: T.textFaint }}>Cargo: </span><span>{journey.cargo} {journey.weight ? `· ${journey.weight}T` : ''}</span></div>
                        <div><span style={{ color: T.textFaint }}>Revenue: </span><b style={{ color: '#10b981' }}>{fmt(journey.revenue)}</b></div>
                        <div><span style={{ color: T.textFaint }}>Departed: </span><span>{journey.date}</span></div>
                        <div><span style={{ color: T.textFaint }}>Submitted: </span><span>{journey.submittedForVerificationAt?.split('T')[0] || '—'}</span></div>
                    </div>
                </div>

                {/* Odometer readings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                        { label: 'Start Odometer', value: journey.startOdom ? `${Number(journey.startOdom).toLocaleString()} km` : '—', c: '#38bdf8' },
                        { label: 'End Odometer', value: journey.endOdom ? `${Number(journey.endOdom).toLocaleString()} km` : '—', c: '#10b981' },
                        { label: 'Distance Covered', value: distanceCovered ? `${distanceCovered.toLocaleString()} km` : '—', c: distanceCovered && journey.distance && Math.abs(distanceCovered - journey.distance) > 50 ? '#ef4444' : '#a78bfa' },
                    ].map(k => (
                        <div key={k.label} style={S.card(k.c)}>
                            <div style={S.kpi}>{k.label}</div>
                            <div style={{ ...S.val(k.c), fontSize: 18 }}>{k.value}</div>
                        </div>
                    ))}
                </div>

                {/* Distance discrepancy warning */}
                {distanceCovered && journey.distance && Math.abs(distanceCovered - journey.distance) > 50 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                        ⚠️ Distance discrepancy: Odometer shows {distanceCovered.toLocaleString()} km but journey was logged as {Number(journey.distance).toLocaleString()} km. Difference: {Math.abs(distanceCovered - journey.distance).toLocaleString()} km.
                    </div>
                )}

                {/* Photo evidence */}
                <div style={{ fontWeight: 700, color: T.text, marginBottom: 12, fontSize: 14 }}>📸 Photo Evidence</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                        { label: '📷 Start Odometer', url: journey.startOdomPhotoUrl },
                        { label: '📷 End Odometer', url: journey.endOdomPhotoUrl },
                        { label: '📄 Delivery Proof', url: journey.deliveryProofUrl },
                    ].map(photo => (
                        <div key={photo.label} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.textFaint, padding: '8px 10px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                                {photo.label}
                            </div>
                            {photo.url ? (
                                <a href={photo.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                                    <img src={photo.url} alt={photo.label}
                                        style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                    />
                                    <div style={{ display: 'none', height: 140, alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: T.textFaint, fontSize: 12 }}>
                                        Could not load — <a href={photo.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>open link</a>
                                    </div>
                                </a>
                            ) : (
                                <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
                                    ❌ Not uploaded
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Action area */}
                {verifyMsg && (
                    <div style={{ background: verifyMsg.startsWith('✅') || verifyMsg.startsWith('↩️') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${verifyMsg.startsWith('✅') || verifyMsg.startsWith('↩️') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600, color: verifyMsg.startsWith('✅') || verifyMsg.startsWith('↩️') ? '#065f46' : '#dc2626' }}>
                        {verifyMsg}
                    </div>
                )}

                {/* Approve */}
                <button
                    style={{ ...S.btn('green'), width: '100%', marginBottom: 12, padding: 14, fontSize: 15 }}
                    onClick={handleApprove}
                    disabled={verifyLoading || !journey.endOdomPhotoUrl || !journey.deliveryProofUrl}>
                    {verifyLoading ? '⏳ Processing…' : '✅ Approve — Mark Journey Completed'}
                </button>

                {(!journey.endOdomPhotoUrl || !journey.deliveryProofUrl) && (
                    <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12, textAlign: 'center' }}>
                        Cannot approve — driver has not uploaded all required photos
                    </div>
                )}

                {/* Reject with reason */}
                <div style={{ background: dark ? '#0c0e14' : '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 10, fontSize: 13 }}>
                        ↩️ Reject — Send Back to Driver
                    </div>
                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 10, lineHeight: 1.6 }}>
                        Explain what the driver needs to fix. The reason will be shown on the driver portal and sent via WhatsApp.
                    </div>
                    <textarea
                        style={{ ...S.inp, height: 80, resize: 'vertical', border: '1.5px solid #fecaca' }}
                        placeholder="e.g. Odometer photo is blurry — please retake. End reading should be higher than start reading."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                    />
                    <button
                        style={{ ...S.btn('del'), width: '100%', padding: 12 }}
                        onClick={handleReject}
                        disabled={verifyLoading}>
                        {verifyLoading ? '⏳ Processing…' : '↩️ Reject & Notify Driver'}
                    </button>
                </div>

                <button style={{ ...S.btn('ghost'), marginTop: 12 }}
                    onClick={() => { setVerifyModal(null); setVerifyMsg(''); setRejectReason(''); }}>
                    Close
                </button>
            </div>
        </div>
    );
};
```

### B.6 — Render the VerificationModal

Find where `{paymentModal && <PaymentRequestModal inv={paymentModal} />}` is rendered. Directly after it, add:

```jsx
{verifyModal && <VerificationModal journey={verifyModal} />}
```

### B.7 — Add verification alerts to the Dashboard

Find the `Dashboard` component. After the `staleJourneys` / `maintenanceOverdue` derivations, add:

```js
const awaitingVerification = data.journeys.filter(j => j.status === 'Awaiting Verification');
```

Update the alert condition to include it:
```jsx
{(tyreAlerts.length > 0 || overdueInv.length > 0 || staleJourneys.length > 0 || maintenanceOverdue.length > 0 || fleetActiveWarning || awaitingVerification.length > 0) && (
```

Inside the alert block, add (after the other alerts):

```jsx
{awaitingVerification.map(j => (
    <div key={j.id} style={S.alertBox('#8b5cf6')}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>
                Awaiting Verification — {j.origin} → {j.dest}
            </div>
            <div style={{ fontSize: 12, color: T.textDim }}>
                {truckReg(j.truck)} · {driverName(j.driver)} · Submitted {j.submittedForVerificationAt?.split('T')[0] || j.date}
            </div>
        </div>
        <button style={{ ...S.btn('sm'), background: '#8b5cf6', color: '#fff', fontSize: 11, marginLeft: 10, whiteSpace: 'nowrap' }}
            onClick={() => setVerifyModal(j)}>
            🔍 Verify
        </button>
    </div>
))}
```

### B.8 — Add "⏳ Verify" button to the Journeys table

Find the Journeys table row actions in the `Journeys` component. The row has Edit and ✕ buttons. Before them, add:

```jsx
{j.status === 'Awaiting Verification' && (
    <button
        style={{ ...S.btn('sm'), background: '#8b5cf6', color: '#fff', fontSize: 11 }}
        onClick={() => setVerifyModal(j)}>
        🔍 Verify
    </button>
)}
```

### B.9 — Add badge count to the Journeys nav item

Find the sidebar NAV rendering:
```jsx
{NAV.map(n => (
    <button key={n.id} style={S.navBtn(page === n.id)} onClick={...}>
        <span>{n.icon}</span>
        <span>{n.label}</span>
        {n.id === "tyres" && tyreAlertCount > 0 && ...}
    </button>
))}
```

After the tyres badge, add:
```jsx
{n.id === "journeys" && data.journeys.filter(j => j.status === 'Awaiting Verification').length > 0 && (
    <span style={{ marginLeft: "auto", background: "#8b5cf6", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>
        {data.journeys.filter(j => j.status === 'Awaiting Verification').length}
    </span>
)}
```

### B.10 — Add "Awaiting Verification" to STATUSES_JOURNEY

Find:
```js
const STATUSES_JOURNEY = ["Loading", "In Transit", "Completed", "Cancelled"];
```

Replace with:
```js
const STATUSES_JOURNEY = ["Loading", "In Transit", "Awaiting Verification", "Completed", "Cancelled"];
```

---

## PART C — Driver Portal changes (`driver-portal/src/App.jsx`)

### C.1 — Replace the journey completion flow in `JourneysTab`

Find the `updateStatus` function inside `JourneysTab`. Replace it:

```js
const updateStatus = async (j, newStatus) => {
    const form = odomForms[j.id] || {};

    // Validate before submitting
    if (newStatus === 'In Transit') {
        if (!form.startOdom) { setMsgs(m => ({ ...m, [j.id]: '❌ Enter your starting odometer reading' })); return; }
        if (!form.startOdomPhotoUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload a photo of the odometer before departing' })); return; }
    }

    if (newStatus === 'Awaiting Verification') {
        if (!form.endOdom) { setMsgs(m => ({ ...m, [j.id]: '❌ Enter your final odometer reading' })); return; }
        if (!form.endOdomPhotoUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload a photo of the odometer on arrival' })); return; }
        if (!form.deliveryProofUrl) { setMsgs(m => ({ ...m, [j.id]: '❌ Upload delivery proof (signed waybill or receipt photo)' })); return; }
    }

    setUpdating(u => ({ ...u, [j.id]: true }));
    const result = await apiPost(`/api/driver/journey/${j.id}/status`, { status: newStatus, ...form });

    if (result.success) {
        if (newStatus === 'Awaiting Verification') {
            setMsgs(m => ({ ...m, [j.id]: '⏳ Submitted for office verification. You will be notified once it is approved.' }));
            // Notify office via WhatsApp
            notifyOffice(`🔍 Journey ready for verification

Driver: *${driver.name}*
Trip: ${j.origin} → ${j.dest}
Truck: ${truck?.reg}
End Odometer: ${form.endOdom} km

Please verify in the Segecha Tracker.`);
        } else {
            setMsgs(m => ({ ...m, [j.id]: `✅ Status updated to ${newStatus}` }));
            notifyOffice(`📍 Journey update from *${driver.name}*
Trip: ${j.origin} → ${j.dest}
Status: *${newStatus}*
Truck: ${truck?.reg}
Odometer: ${form.startOdom} km`);
        }
        await fetchDriverData(token);
    } else {
        setMsgs(m => ({ ...m, [j.id]: '❌ ' + result.error }));
    }
    setUpdating(u => ({ ...u, [j.id]: false }));
};
```

### C.2 — Replace the "In Transit" action block in `JourneyCard`

Find the section inside `JourneyCard` that shows the action when `j.status === 'In Transit'`. Replace it entirely:

```jsx
{/* Awaiting Verification — show holding state */}
{j.status === 'Awaiting Verification' && (
    <div style={{ marginTop: 14, background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 700, color: '#6b21a8', marginBottom: 8, fontSize: 14 }}>⏳ Awaiting Office Verification</div>
        <div style={{ fontSize: 13, color: '#4c1d95', lineHeight: 1.6, marginBottom: 12 }}>
            You have submitted your end odometer and delivery proof.
            The office is reviewing your submission. You will be notified once it is approved or if any changes are needed.
        </div>
        <div style={{ fontSize: 12, color: '#7c3aed' }}>
            Submitted: {j.submittedForVerificationAt?.split('T')[0] || 'just now'}
        </div>
    </div>
)}

{/* In Transit — show completion form */}
{allowUpdate && j.status === 'In Transit' && (
    <div style={{ marginTop: 14, padding: 14, background: COLORS.bg, borderRadius: 10 }}>
        <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13 }}>
            🏁 Submit trip completion for office verification
        </div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 14, lineHeight: 1.6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px' }}>
            ⚠️ The office must verify your odometer and delivery proof before this trip is marked Completed.
            Make sure your photos are clear and readable.
        </div>
        <label style={S.lbl}>End Odometer Reading (km)</label>
        <input style={S.inp} type="number" placeholder={`Must be greater than start: ${j.startOdom ? Number(j.startOdom).toLocaleString() : '?'} km`}
            value={form.endOdom || ''}
            onChange={e => setOdom(j.id, 'endOdom', e.target.value)} />
        {form.endOdom && j.startOdom && +form.endOdom <= +j.startOdom && (
            <div style={{ fontSize: 12, color: COLORS.red, marginBottom: 10 }}>
                ❌ End odometer must be greater than start odometer ({Number(j.startOdom).toLocaleString()} km)
            </div>
        )}
        <PhotoField
            label="📷 End Odometer Photo"
            hint="Take a clear, readable photo of the dashboard odometer on arrival"
            token={token} folder="odometer" filename={`${j.id}_end`}
            onUploaded={url => setOdom(j.id, 'endOdomPhotoUrl', url)}
        />
        <PhotoField
            label="📄 Delivery Proof"
            hint="Photo of signed waybill, delivery note, or stamped receipt from the client"
            token={token} folder="delivery_proof" filename={`${j.id}_proof`}
            onUploaded={url => setOdom(j.id, 'deliveryProofUrl', url)}
        />
        {msgs[j.id] && (
            <div style={{ color: msgs[j.id].startsWith('✅') || msgs[j.id].startsWith('⏳') ? '#6b21a8' : COLORS.red, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                {msgs[j.id]}
            </div>
        )}
        <button
            style={{ ...S.btn(), width: '100%', background: 'linear-gradient(135deg,#6b21a8,#9333ea)', color: '#fff' }}
            disabled={updating[j.id] || (form.endOdom && j.startOdom && +form.endOdom <= +j.startOdom)}
            onClick={() => updateStatus(j, 'Awaiting Verification')}>
            {updating[j.id] ? '⏳ Submitting…' : '📤 Submit for Office Verification'}
        </button>
    </div>
)}
```

### C.3 — Show rejection reason if a previous submission was rejected

Find inside `JourneyCard`, the block that shows journey details when `isExpanded`. After the notes row and before the action blocks, add:

```jsx
{/* Rejection notice — shown after admin rejects */}
{j._rejectionReason && j.status === 'In Transit' && (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginTop: 10, marginBottom: 4 }}>
        <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 4, fontSize: 13 }}>
            ❌ Previous submission was rejected
        </div>
        <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
            {j._rejectionReason}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            Please correct the issue and resubmit below.
        </div>
    </div>
)}
```

### C.4 — Add "Awaiting Verification" to driver status badge colours

Find the `SC` object in driver portal `App.jsx`:
```js
const SC = {
    'Loading': '#f59e0b', 'In Transit': '#3b82f6', 'Completed': '#10b981',
    ...
};
```

Add:
```js
'Awaiting Verification': '#8b5cf6',
```

---

## Summary — Complete verification flow

### What happens step by step

| Step | Who | Action | Result |
|---|---|---|---|
| 1 | Driver | Marks trip "In Transit" with start odometer + photo | Journey → In Transit. Office notified via WhatsApp. |
| 2 | Driver | On arrival: enters end odometer, uploads odometer photo + delivery proof, taps Submit | Journey → **Awaiting Verification**. Office notified via WhatsApp. |
| 3 | Admin | Sees purple alert on Dashboard + badge on Journeys nav | Opens Verify modal |
| 4 | Admin | Reviews end odometer reading, odometer photo, delivery proof, checks distance discrepancy | — |
| 5a | Admin approves | Clicks ✅ Approve | Journey → **Completed**. Truck odometer updated. |
| 5b | Admin rejects | Enters rejection reason, clicks ↩️ Reject | Journey → **In Transit**. Rejection reason stored. WhatsApp sent to driver. |
| 6 | Driver (if rejected) | Opens portal, sees red rejection notice on the journey | Corrects issue, resubmits |

### What admin sees in the tracker

- 🟣 Purple **⏳ Verify** badge on every journey row with status "Awaiting Verification"
- 🟣 Purple badge count on the Journeys nav item
- 🔍 Alert card on Dashboard with Verify button
- Full verification modal with: odometer readings, distance discrepancy check, three photo thumbnails (start odom, end odom, delivery proof), approve button, reject-with-reason section

### What driver sees in the portal

- Purple "Awaiting Office Verification" holding state — no buttons, just status
- Red rejection notice with exact reason if admin rejected
- Resubmission form appears immediately after rejection
- "Submit for Office Verification" button (not "Mark Completed") — driver never self-completes

### Safety checks built in

- Approve button is **disabled** if odometer photo or delivery proof is missing
- Distance discrepancy warning shown if odometer reading differs from logged distance by more than 50 km
- End odometer must be greater than start odometer (validated in driver portal)
- Driver cannot change status of a journey in "Awaiting Verification" state
