# Segecha Tracker — Document Library Table Redesign
# Cursor AI Prompt — File: src/App.jsx only

Replace the existing `Documents` component with the version below.
All existing `fetchDocuments`, `uploadDocument`, `deleteDocumentById` helpers
and the `documents` state variable must be preserved — this component uses them.
Do not touch any other component.

---

## Find and replace the Documents component

Locate:
```jsx
// ══════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════
const Documents = () => {
```

Delete everything from that line to the closing `};` and replace entirely with:

---

```jsx
// ══════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════
const Documents = () => {
    // ── State
    const [docTab, setDocTab]           = useState('all');      // 'all'|'vehicles'|'drivers'|'insurance'|'legal'
    const [statusFilter, setStatusFilter] = useState('all');    // 'all'|'expired'|'expiring'|'valid'|'none'
    const [searchQ, setSearchQ]         = useState('');
    const [sortCol, setSortCol]         = useState('expiry');   // 'name'|'entity'|'expiry'|'type'
    const [sortAsc, setSortAsc]         = useState(true);
    const [showUpload, setShowUpload]   = useState(false);
    const [expiringDocs, setExpiringDocs] = useState([]);
    const [uploading, setUploading]     = useState(false);
    const [uploadMsg, setUploadMsg]     = useState('');
    const [uploadForm, setUploadForm]   = useState({
        entityType: '', entityId: '', docType: '', label: '', expiryDate: ''
    });
    const [selectedFile, setSelectedFile] = useState(null);

    // ── Load on mount
    useEffect(() => {
        fetchDocuments(null, null);
        fetch(`${PAYMENT_API}/api/documents/expiring?adminKey=${ADMIN_KEY}&days=60`)
            .then(r => r.json())
            .then(d => setExpiringDocs(d.documents || []))
            .catch(() => {});
    }, []);

    // ── Helpers
    const daysUntil = (dateStr) => {
        if (!dateStr) return null;
        return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    };

    const docStatus = (doc) => {
        if (!doc.expiryDate) return 'none';
        const d = daysUntil(doc.expiryDate);
        if (d < 0) return 'expired';
        if (d <= 30) return 'expiring';
        return 'valid';
    };

    const statusColor = (s) => ({
        expired: '#ef4444', expiring: '#f97316', valid: '#10b981', none: T.textFaint
    }[s] || T.textFaint);

    const statusBg = (s) => ({
        expired: '#ef444418', expiring: '#f9731618', valid: '#10b98118', none: dark ? '#1c2235' : '#f1f5f9'
    }[s] || '#f1f5f9');

    const statusLabel = (doc) => {
        const s = docStatus(doc);
        const d = daysUntil(doc.expiryDate);
        if (s === 'expired') return `Expired ${Math.abs(d)}d ago`;
        if (s === 'expiring') return `Expires in ${d}d`;
        if (s === 'valid') return `Valid until ${doc.expiryDate}`;
        return 'No expiry';
    };

    // Assign a category based on docType value
    const docCategory = (docType) => {
        if (['insurance_lorry', 'insurance_trailer'].includes(docType)) return 'insurance';
        if (['comesa', 'ntsa_inspection', 'overweight_permit', 'customs', 'logbook'].includes(docType)) return 'legal';
        if (['psv_licence', 'medical_certificate', 'id_card'].includes(docType)) return 'drivers';
        return 'vehicles';
    };

    const categoryLabel = (cat) => ({
        insurance: '🛡️ Insurance',
        legal: '📋 Legal / Permit',
        drivers: '👤 Driver doc',
        vehicles: '🚛 Vehicle doc',
    }[cat] || '—');

    // Enrich documents with derived fields
    const enriched = documents.map(doc => ({
        ...doc,
        status: docStatus(doc),
        category: docCategory(doc.docType),
        entityName: doc.entityType === 'truck'
            ? (data.trucks.find(t => t.id === doc.entityId)?.reg || doc.entityId)
            : (data.drivers.find(d => d.id === doc.entityId)?.name || doc.entityId),
    }));

    // ── Filter + sort
    const visible = enriched
        .filter(doc => {
            if (docTab === 'vehicles' && doc.entityType !== 'truck') return false;
            if (docTab === 'drivers' && doc.entityType !== 'driver') return false;
            if (docTab === 'insurance' && doc.category !== 'insurance') return false;
            if (docTab === 'legal' && doc.category !== 'legal') return false;
            if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
            if (searchQ) {
                const q = searchQ.toLowerCase();
                return doc.label?.toLowerCase().includes(q) ||
                    doc.entityName?.toLowerCase().includes(q) ||
                    doc.filename?.toLowerCase().includes(q) ||
                    (DOC_TYPES_TRUCK.concat(DOC_TYPES_DRIVER).find(t => t.value === doc.docType)?.label || '').toLowerCase().includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            let av, bv;
            if (sortCol === 'name') { av = a.label; bv = b.label; }
            else if (sortCol === 'entity') { av = a.entityName; bv = b.entityName; }
            else if (sortCol === 'type') { av = a.docType; bv = b.docType; }
            else { av = a.expiryDate || '9999'; bv = b.expiryDate || '9999'; }
            if (av === bv) return 0;
            return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });

    // ── Sort toggle
    const handleSort = (col) => {
        if (sortCol === col) setSortAsc(a => !a);
        else { setSortCol(col); setSortAsc(true); }
    };

    const sortIcon = (col) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ' ↕';

    // ── Tab counts
    const count = (tab) => {
        if (tab === 'all') return enriched.length;
        if (tab === 'vehicles') return enriched.filter(d => d.entityType === 'truck').length;
        if (tab === 'drivers') return enriched.filter(d => d.entityType === 'driver').length;
        if (tab === 'insurance') return enriched.filter(d => d.category === 'insurance').length;
        if (tab === 'legal') return enriched.filter(d => d.category === 'legal').length;
        return 0;
    };

    // ── Upload handler
    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.docType || !uploadForm.entityId) {
            setUploadMsg('❌ Select entity, document type, and choose a file');
            return;
        }
        setUploading(true); setUploadMsg('');
        const result = await uploadDocument(
            selectedFile,
            uploadForm.entityType,
            uploadForm.entityId,
            uploadForm.docType,
            uploadForm.label || selectedFile.name,
            uploadForm.expiryDate
        );
        if (result.success) {
            setUploadMsg('✅ Uploaded successfully');
            setSelectedFile(null);
            setUploadForm({ entityType: '', entityId: '', docType: '', label: '', expiryDate: '' });
            setShowUpload(false);
            // Refresh expiry alerts
            fetch(`${PAYMENT_API}/api/documents/expiring?adminKey=${ADMIN_KEY}&days=60`)
                .then(r => r.json()).then(d => setExpiringDocs(d.documents || [])).catch(() => {});
        } else {
            setUploadMsg('❌ ' + (result.error || 'Upload failed'));
        }
        setUploading(false);
    };

    // Entity options based on selected type
    const entityOptions = uploadForm.entityType === 'truck'
        ? data.trucks.map(t => ({ v: t.id, l: t.reg }))
        : uploadForm.entityType === 'driver'
        ? data.drivers.map(d => ({ v: d.id, l: d.name }))
        : [];

    const docTypeOptions = uploadForm.entityType === 'truck'
        ? DOC_TYPES_TRUCK
        : uploadForm.entityType === 'driver'
        ? DOC_TYPES_DRIVER
        : [...DOC_TYPES_TRUCK, ...DOC_TYPES_DRIVER];

    // KPI counts
    const expiredCount   = enriched.filter(d => d.status === 'expired').length;
    const expiringCount  = enriched.filter(d => d.status === 'expiring').length;
    const validCount     = enriched.filter(d => d.status === 'valid').length;

    // ── Inline styles
    const th = (col) => ({
        fontSize: 11, color: sortCol === col ? '#E8501A' : T.textFaint,
        textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 14px',
        textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap',
        background: dark ? '#0c0e14' : '#f8fafc',
        borderBottom: `1px solid ${T.border}`,
        cursor: 'pointer', userSelect: 'none',
    });

    const td = { padding: '12px 14px', borderBottom: `1px solid ${T.border2}`, verticalAlign: 'middle', color: T.text };

    const tabStyle = (id) => ({
        padding: '10px 18px',
        border: 'none',
        borderBottom: docTab === id ? '2px solid #E8501A' : '2px solid transparent',
        background: 'none',
        fontSize: 13,
        cursor: 'pointer',
        color: docTab === id ? '#E8501A' : T.textFaint,
        fontWeight: docTab === id ? 700 : 400,
        whiteSpace: 'nowrap',
        marginBottom: -1,
        transition: 'all .15s',
    });

    const filterPillStyle = (id) => ({
        padding: '5px 12px',
        border: `0.5px solid ${statusFilter === id ? '#E8501A' : T.border}`,
        borderRadius: 20,
        fontSize: 12,
        cursor: 'pointer',
        background: statusFilter === id ? '#E8501A18' : T.surface,
        color: statusFilter === id ? '#E8501A' : T.textFaint,
        fontWeight: statusFilter === id ? 700 : 400,
        transition: 'all .15s',
    });

    const kpiStyle = (c, active) => ({
        background: dark ? '#0c0e14' : '#f8fafc',
        border: `${active ? '1.5px' : '1px'} solid ${active ? '#E8501A' : T.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
    });

    // ── Render
    return (
        <div>
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={S.ph}>📁 Document library</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input style={{ ...S.inp, marginBottom: 0, width: 220, fontSize: 12 }}
                        placeholder="Search name, entity, type…"
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)} />
                    <button style={S.btn()} onClick={() => { setShowUpload(s => !s); setUploadMsg(''); }}>
                        {showUpload ? '✕ Cancel' : '+ Upload document'}
                    </button>
                </div>
            </div>

            {/* KPI row — clicking filters the table */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                    { id: 'all', label: 'Total documents', val: enriched.length, c: '#38bdf8' },
                    { id: 'expired', label: 'Expired', val: expiredCount, c: '#ef4444' },
                    { id: 'expiring', label: 'Expiring ≤ 30d', val: expiringCount, c: '#f97316' },
                    { id: 'valid', label: 'Valid', val: validCount, c: '#10b981' },
                ].map(k => (
                    <div key={k.id} style={kpiStyle(k.c, statusFilter === k.id)}
                        onClick={() => setStatusFilter(k.id)}>
                        <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: k.c }}>{k.val}</div>
                    </div>
                ))}
            </div>

            {/* Expiry alerts */}
            {expiredCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#ef444412', border: '1px solid #ef444433', borderRadius: 8, marginBottom: 10, fontSize: 13, color: '#ef4444' }}>
                    <span>🔴</span>
                    <div style={{ flex: 1 }}>
                        <b>{expiredCount} document{expiredCount !== 1 ? 's' : ''} EXPIRED</b>
                        {' — '}
                        {enriched.filter(d => d.status === 'expired').slice(0, 3).map(d => `${d.entityName}: ${d.label}`).join(', ')}
                        {expiredCount > 3 ? ` +${expiredCount - 3} more` : ''}
                    </div>
                    <button style={{ ...S.btn('ghost'), fontSize: 11, padding: '4px 10px', color: '#ef4444', borderColor: '#ef444444', whiteSpace: 'nowrap' }}
                        onClick={() => { setStatusFilter('expired'); setDocTab('all'); }}>
                        Show expired →
                    </button>
                </div>
            )}
            {expiringCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f9731612', border: '1px solid #f9731633', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#f97316' }}>
                    <span>⚠️</span>
                    <div style={{ flex: 1 }}>
                        <b>{expiringCount} document{expiringCount !== 1 ? 's' : ''} expiring within 30 days</b>
                        {' — '}
                        {enriched.filter(d => d.status === 'expiring').slice(0, 3).map(d => `${d.entityName}: ${d.label} (${daysUntil(d.expiryDate)}d)`).join(', ')}
                    </div>
                    <button style={{ ...S.btn('ghost'), fontSize: 11, padding: '4px 10px', color: '#f97316', borderColor: '#f9731644', whiteSpace: 'nowrap' }}
                        onClick={() => { setStatusFilter('expiring'); setDocTab('all'); }}>
                        Show expiring →
                    </button>
                </div>
            )}

            {/* Upload form — collapsible */}
            {showUpload && (
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 16 }}>Upload new document</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <label style={S.lbl}>Entity type <span style={{ color: '#ef4444' }}>*</span></label>
                            <select style={S.inp} value={uploadForm.entityType}
                                onChange={e => setUploadForm(f => ({ ...f, entityType: e.target.value, entityId: '', docType: '' }))}>
                                <option value="">Select…</option>
                                <option value="truck">Truck</option>
                                <option value="driver">Driver</option>
                            </select>
                        </div>
                        <div>
                            <label style={S.lbl}>Entity <span style={{ color: '#ef4444' }}>*</span></label>
                            <select style={S.inp} value={uploadForm.entityId}
                                onChange={e => setUploadForm(f => ({ ...f, entityId: e.target.value }))}
                                disabled={!uploadForm.entityType}>
                                <option value="">Select entity…</option>
                                {entityOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={S.lbl}>Document type <span style={{ color: '#ef4444' }}>*</span></label>
                            <select style={S.inp} value={uploadForm.docType}
                                onChange={e => setUploadForm(f => ({ ...f, docType: e.target.value }))}
                                disabled={!uploadForm.entityType}>
                                <option value="">Select…</option>
                                {docTypeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={S.lbl}>Label (optional)</label>
                            <input style={S.inp} placeholder="e.g. Insurance 2025–2026" value={uploadForm.label}
                                onChange={e => setUploadForm(f => ({ ...f, label: e.target.value }))} />
                        </div>
                        <div>
                            <label style={S.lbl}>Expiry date (optional)</label>
                            <input type="date" style={S.inp} value={uploadForm.expiryDate}
                                onChange={e => setUploadForm(f => ({ ...f, expiryDate: e.target.value }))} />
                        </div>
                        <div>
                            <label style={S.lbl}>File (PDF, JPG, PNG — max 25MB) <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                style={{ ...S.inp, padding: '7px 12px' }}
                                onChange={e => setSelectedFile(e.target.files[0])} />
                        </div>
                    </div>
                    {selectedFile && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 12px', marginBottom: 12, fontSize: 12, color: '#065f46' }}>
                            📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB) ready to upload
                        </div>
                    )}
                    {uploadMsg && (
                        <div style={{ background: uploadMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${uploadMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '7px 12px', marginBottom: 12, fontSize: 12, color: uploadMsg.startsWith('✅') ? '#065f46' : '#dc2626', fontWeight: 600 }}>
                            {uploadMsg}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button style={S.btn('green')} onClick={handleUpload} disabled={uploading}>
                            {uploading ? '⏳ Uploading…' : '☁️ Upload to Cloudflare R2'}
                        </button>
                        <button style={S.btn('ghost')} onClick={() => { setShowUpload(false); setUploadMsg(''); }}>Cancel</button>
                        <span style={{ fontSize: 11, color: T.textFaint }}>Stored permanently · accessible via secure link</span>
                    </div>
                </div>
            )}

            {/* Category tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 0, overflowX: 'auto' }}>
                {[
                    ['all', 'All documents'],
                    ['vehicles', '🚛 Vehicles'],
                    ['drivers', '👤 Drivers'],
                    ['insurance', '🛡️ Insurance'],
                    ['legal', '📋 Legal & Permits'],
                ].map(([id, label]) => (
                    <button key={id} style={tabStyle(id)} onClick={() => setDocTab(id)}>
                        {label}
                        <span style={{ display: 'inline-block', background: docTab === id ? '#E8501A18' : dark ? '#1c2235' : '#f1f5f9', color: docTab === id ? '#E8501A' : T.textFaint, borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6, fontWeight: 700 }}>
                            {count(id)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Status filter pills + row count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: T.textFaint }}>Status:</span>
                {[
                    ['all', 'All'],
                    ['expired', '🔴 Expired'],
                    ['expiring', '⚠️ Expiring'],
                    ['valid', '✅ Valid'],
                    ['none', '📭 No expiry'],
                ].map(([id, label]) => (
                    <button key={id} style={filterPillStyle(id)} onClick={() => setStatusFilter(id)}>{label}</button>
                ))}
                {(searchQ || statusFilter !== 'all') && (
                    <button onClick={() => { setSearchQ(''); setStatusFilter('all'); }}
                        style={{ ...filterPillStyle('_'), fontSize: 11, borderRadius: 20 }}>
                        ✕ Clear
                    </button>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textFaint }}>
                    {visible.length} document{visible.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...S.tbl, minWidth: 780 }}>
                        <thead>
                            <tr>
                                <th style={th('name')} onClick={() => handleSort('name')}>Document{sortIcon('name')}</th>
                                <th style={th('type')} onClick={() => handleSort('type')}>Type{sortIcon('type')}</th>
                                <th style={th('entity')} onClick={() => handleSort('entity')}>Entity{sortIcon('entity')}</th>
                                <th style={{ ...th('cat'), cursor: 'default' }}>Category</th>
                                <th style={th('expiry')} onClick={() => handleSort('expiry')}>Expiry{sortIcon('expiry')}</th>
                                <th style={{ ...th('status'), cursor: 'default' }}>Status</th>
                                <th style={{ ...th('_'), cursor: 'default', width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: T.textFaint }}>
                                        <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>No documents match your filters</div>
                                        <div style={{ fontSize: 12 }}>Try clearing filters or uploading a new document.</div>
                                    </td>
                                </tr>
                            ) : visible.map(doc => {
                                const s = doc.status;
                                const days = daysUntil(doc.expiryDate);
                                const pct = doc.expiryDate
                                    ? Math.min(100, Math.max(0, ((365 - (days || 0)) / 365) * 100))
                                    : null;
                                const fillC = s === 'expired' ? '#ef4444' : s === 'expiring' ? '#f97316' : '#10b981';
                                const rowBg = s === 'expired' ? '#ef444406' : s === 'expiring' ? '#f9731606' : T.surface;

                                const typeLabel = DOC_TYPES_TRUCK.concat(DOC_TYPES_DRIVER).find(t => t.value === doc.docType)?.label || doc.docType;
                                const uploadedBy = doc.uploadedAt ? doc.uploadedAt.split('T')[0] : '';

                                return (
                                    <tr key={doc.id} style={{ background: rowBg }}>
                                        {/* Document name */}
                                        <td style={td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 30, height: 30, borderRadius: 6, background: doc.mimeType?.includes('pdf') ? '#ef444418' : '#3b82f618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                                                    {doc.mimeType?.includes('pdf') ? '📄' : '🖼️'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>{doc.label}</div>
                                                    <div style={{ fontSize: 10, color: T.textFaint }}>{doc.filename}{uploadedBy ? ` · uploaded ${uploadedBy}` : ''}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Type */}
                                        <td style={{ ...td, fontSize: 12, color: T.textDim }}>{typeLabel}</td>
                                        {/* Entity */}
                                        <td style={td}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: dark ? '#1c2235' : '#f1f5f9', fontSize: 12, color: T.textDim }}>
                                                {doc.entityType === 'truck' ? '🚛' : '👤'} {doc.entityName}
                                            </div>
                                        </td>
                                        {/* Category */}
                                        <td style={{ ...td, fontSize: 12, color: T.textFaint }}>{categoryLabel(doc.category)}</td>
                                        {/* Expiry with progress bar */}
                                        <td style={td}>
                                            {doc.expiryDate ? (
                                                <>
                                                    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 5 }}>{doc.expiryDate}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ flex: 1, height: 4, background: dark ? '#1c2235' : '#f1f5f9', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: fillC, borderRadius: 2, transition: 'width .4s' }} />
                                                        </div>
                                                        <span style={{ fontSize: 10, color: fillC, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                            {s === 'expired' ? `-${Math.abs(days)}d` : `${days}d`}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: 12, color: T.textFaint }}>—</span>
                                            )}
                                        </td>
                                        {/* Status badge */}
                                        <td style={td}>
                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: statusBg(s), color: statusColor(s) }}>
                                                {statusLabel(doc)}
                                            </span>
                                        </td>
                                        {/* Actions */}
                                        <td style={td}>
                                            <div style={{ display: 'flex', gap: 5 }}>
                                                <a href={doc.url} target="_blank" rel="noreferrer"
                                                    style={{ ...S.btn('sm'), textDecoration: 'none', fontSize: 11, padding: '5px 10px' }}>
                                                    👁 View
                                                </a>
                                                <a href={doc.url} download={doc.filename}
                                                    style={{ ...S.btn('ghost'), textDecoration: 'none', fontSize: 11, padding: '5px 8px' }}>
                                                    ⬇
                                                </a>
                                                <button style={{ ...S.btn('del'), fontSize: 11, padding: '5px 8px' }}
                                                    onClick={() => deleteDocumentById(doc.id)}>
                                                    ✕
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
```

---

## Checklist after implementing

- [ ] Document Library page renders with KPI cards row at top
- [ ] Five tabs render: All / Vehicles / Drivers / Insurance / Legal & Permits — each with doc count badge
- [ ] Clicking a tab filters the table to that category
- [ ] Status filter pills work: All / Expired / Expiring / Valid / No Expiry
- [ ] Clicking a KPI card applies the matching status filter
- [ ] Search bar filters table instantly by name, entity, or type
- [ ] Table columns sort on click — clicking same column toggles asc/desc, arrow indicator updates
- [ ] Expiry column shows the date + a mini progress bar + days remaining/overdue
- [ ] Rows with expired docs have a subtle red tint background
- [ ] Rows with expiring docs have a subtle orange tint background
- [ ] Red expired alert banner shows above tabs when any docs are expired
- [ ] Orange expiring alert banner shows when any docs expire within 30 days
- [ ] "+ Upload document" button toggles the upload form open/closed
- [ ] Upload form — selecting Entity Type populates Entity and Document Type dropdowns correctly
- [ ] Upload form — trucks show truck doc types, drivers show driver doc types
- [ ] Successful upload adds the row to the table immediately
- [ ] View button opens the document URL in a new tab
- [ ] Download button (⬇) triggers file download
- [ ] Delete button (✕) calls `deleteDocumentById` with confirm dialog
- [ ] "Clear" pill appears when any filter is active, resets all filters on click
- [ ] Empty state shows when no documents match the current filters
- [ ] With 100 trucks in data, page loads cleanly — no layout explosion
