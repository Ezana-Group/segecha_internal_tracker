-e ---
# SEGECHA — CURSOR SESSION 5 OF 8
# Previous: PROMPT_04_DRIVER_UPLOADS.md
# Next: PROMPT_06_VERIFICATION.md
# Scope: server/ + src/App.jsx + driver-portal/
# Rule: Complete every section and run the checklist before closing this session.
---

# Segecha Document Management — Full Cursor AI Prompt
# Cloudflare R2 for permanent business documents

This prompt adds a permanent document store to the Segecha system using **Cloudflare R2**.
Operational photos (fuel receipts, odometer, delivery proof) stay on **Cloudinary** as built in the driver portal addendum.
Permanent business documents (insurance, permits, licences, logbooks) go to **Cloudflare R2**.

## Two-tier storage strategy

| Document type | Storage | Why |
|---|---|---|
| Fuel receipts, odometer photos, delivery proof, incident photos, maintenance receipts | **Cloudinary** | Already implemented. Auto-optimised images, short-term operational. |
| Insurance certs, COMESA, NTSA inspection, PSV licences, permits, customs docs, logbooks | **Cloudflare R2** | Permanent, tamper-evident, unlimited storage, no egress fees, S3-compatible. |

## Who uploads what

- **Office admin** (from main tracker): all company documents — insurance, COMESA, NTSA, permits, customs, logbooks
- **Drivers** (from driver portal): their own personal documents — PSV licence, medical certificate

## Where documents are visible

- **Fleet page** — per-truck document tab (insurance, COMESA, NTSA, permits, logbook)
- **Drivers page** — per-driver document tab (PSV licence, medical)
- **Dedicated Documents page** in main tracker — full document library across all trucks and drivers
- **Driver portal** — drivers can view their own documents (PSV licence, medical)

---

## PART A — Cloudflare R2 Setup

### A.1 — Create a Cloudflare R2 bucket

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**
2. Click **Create bucket** → name it `segecha-documents`
3. Set **Location** to automatic (or choose Africa if available)
4. Go to **R2 → Overview → Manage R2 API tokens**
5. Click **Create API Token** with:
   - Permissions: **Object Read & Write**
   - Specify bucket: `segecha-documents`
6. Note your: **Access Key ID**, **Secret Access Key**, **Account ID**
7. Your bucket endpoint will be: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### A.2 — Make documents publicly readable (for viewing in browser)

1. In R2 → your bucket → **Settings** → **Public Access**
2. Enable **R2.dev subdomain** — Cloudflare gives you a public URL like `https://pub-XXXX.r2.dev`
3. Note this public URL — documents uploaded here can be opened directly in browser

### A.3 — Add R2 credentials to `server/.env`

```env
# Cloudflare R2 — permanent document storage
CF_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=segecha-documents
R2_PUBLIC_URL=https://pub-XXXX.r2.dev
```

---

## PART B — Backend changes

### B.1 — Install the AWS S3 SDK (R2 is S3-compatible)

```bash
cd server
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### B.2 — Create `server/r2.js`

```js
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.R2_BUCKET_NAME || 'segecha-documents';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Upload a buffer to R2
async function uploadToR2(buffer, key, contentType) {
    await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        // Metadata stored alongside the file
        Metadata: {
            uploadedAt: new Date().toISOString(),
        },
    }));
    // Return the public URL
    return `${PUBLIC_URL}/${key}`;
}

// Delete a document from R2
async function deleteFromR2(key) {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Generate a signed URL for private access (if you turn off public access later)
async function getSignedDownloadUrl(key, expiresInSeconds = 3600) {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

// Build a structured key for a document
// e.g. trucks/T001/insurance/cert_2025.pdf
function buildKey(entityType, entityId, docType, filename) {
    const ext = path.extname(filename) || '.pdf';
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ts = Date.now();
    return `${entityType}/${entityId}/${docType}/${ts}_${safe}`;
}

module.exports = { uploadToR2, deleteFromR2, getSignedDownloadUrl, buildKey };
```

### B.3 — Create `server/documents.js`

This manages the document registry — a JSON file that indexes all uploaded documents so the tracker can list them without querying R2 directly every time.

```js
const fs = require('fs');
const path = require('path');

const DOCS_PATH = path.join(__dirname, 'documents.json');

function readDocs() {
    try { return JSON.parse(fs.readFileSync(DOCS_PATH, 'utf8')); }
    catch { return { documents: [] }; }
}

function writeDocs(data) {
    fs.writeFileSync(DOCS_PATH, JSON.stringify(data, null, 2));
}

function addDocument({ id, entityType, entityId, docType, label, filename, url, r2Key, uploadedBy, expiryDate, fileSize, mimeType }) {
    const db = readDocs();
    const uid = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    db.documents.push({
        id: id || uid(),
        entityType,       // 'truck' | 'driver'
        entityId,         // e.g. 'T001' | 'D001'
        docType,          // 'insurance' | 'comesa' | 'ntsa' | 'psv_licence' | etc.
        label,            // Human-readable name e.g. "Lorry Insurance 2025"
        filename,
        url,              // Public R2 URL
        r2Key,            // R2 object key (for deletion)
        uploadedBy,       // 'admin' | driverId
        uploadedAt: new Date().toISOString(),
        expiryDate: expiryDate || null,   // YYYY-MM-DD — for expiry alerts
        fileSize: fileSize || 0,
        mimeType: mimeType || 'application/pdf',
        isExpired: expiryDate ? new Date(expiryDate) < new Date() : false,
        daysUntilExpiry: expiryDate ? Math.ceil((new Date(expiryDate) - new Date()) / 86400000) : null,
    });
    writeDocs(db);
    return db.documents[db.documents.length - 1];
}

function getDocuments(entityType, entityId) {
    const db = readDocs();
    return db.documents.filter(d =>
        (!entityType || d.entityType === entityType) &&
        (!entityId || d.entityId === entityId)
    ).map(d => ({
        ...d,
        // Refresh expiry status on read
        isExpired: d.expiryDate ? new Date(d.expiryDate) < new Date() : false,
        daysUntilExpiry: d.expiryDate ? Math.ceil((new Date(d.expiryDate) - new Date()) / 86400000) : null,
    }));
}

function getAllExpiringDocuments(withinDays = 30) {
    const db = readDocs();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);
    return db.documents.filter(d => {
        if (!d.expiryDate) return false;
        const exp = new Date(d.expiryDate);
        return exp <= threshold;
    }).map(d => ({
        ...d,
        isExpired: new Date(d.expiryDate) < new Date(),
        daysUntilExpiry: Math.ceil((new Date(d.expiryDate) - new Date()) / 86400000),
    })).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

function deleteDocument(docId) {
    const db = readDocs();
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) return null;
    db.documents = db.documents.filter(d => d.id !== docId);
    writeDocs(db);
    return doc; // return so caller can delete from R2
}

module.exports = { addDocument, getDocuments, getAllExpiringDocuments, deleteDocument };
```

### B.4 — Add document routes to `server/index.js`

Find `const PORT = process.env.PORT || 3001;` and before it add:

```js
// ── Document management routes ────────────────────────────────────────────
const multerDoc = require('multer');
const { uploadToR2, deleteFromR2, buildKey } = require('./r2');
const { addDocument, getDocuments, getAllExpiringDocuments, deleteDocument } = require('./documents');

const uploadDoc = multerDoc({
    storage: multerDoc.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max per document
    fileFilter: (req, file, cb) => {
        // Allow PDF, images, and common document formats
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only PDF, JPG, PNG, and Word documents are allowed'));
    },
});

// Upload a document (admin only)
app.post('/api/documents/upload', uploadDoc.single('file'), async (req, res) => {
    const { adminKey, entityType, entityId, docType, label, expiryDate, uploadedBy } = req.body;
    if (adminKey !== process.env.ADMIN_KEY && uploadedBy !== req.body.driverId) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    if (!entityType || !entityId || !docType) {
        return res.status(400).json({ error: 'entityType, entityId, and docType are required' });
    }
    try {
        const key = buildKey(entityType, entityId, docType, req.file.originalname);
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        const doc = addDocument({
            entityType, entityId, docType, label: label || req.file.originalname,
            filename: req.file.originalname, url, r2Key: key,
            uploadedBy: uploadedBy || 'admin',
            expiryDate: expiryDate || null,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
        });
        res.json({ success: true, document: doc });
    } catch (err) {
        console.error('R2 upload error:', err.message);
        res.status(500).json({ error: 'Document upload failed: ' + err.message });
    }
});

// Driver uploads their own document (PSV licence, medical)
app.post('/api/documents/driver-upload', authMiddleware, uploadDoc.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const { docType, label, expiryDate } = req.body;
    const allowedDriverDocs = ['psv_licence', 'medical_certificate', 'id_card'];
    if (!allowedDriverDocs.includes(docType)) {
        return res.status(400).json({ error: `Drivers can only upload: ${allowedDriverDocs.join(', ')}` });
    }
    try {
        const key = buildKey('driver', req.driver.driverId, docType, req.file.originalname);
        const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
        const doc = addDocument({
            entityType: 'driver', entityId: req.driver.driverId,
            docType, label: label || req.file.originalname,
            filename: req.file.originalname, url, r2Key: key,
            uploadedBy: req.driver.driverId,
            expiryDate: expiryDate || null,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
        });
        res.json({ success: true, document: doc });
    } catch (err) {
        res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
});

// Get documents for an entity
app.get('/api/documents', (req, res) => {
    const { entityType, entityId, adminKey } = req.query;
    // Admin gets all, drivers only get their own
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    const docs = getDocuments(entityType || null, entityId || null);
    res.json({ documents: docs });
});

// Get driver's own documents (authenticated driver)
app.get('/api/documents/mine', authMiddleware, (req, res) => {
    const docs = getDocuments('driver', req.driver.driverId);
    res.json({ documents: docs });
});

// Get all expiring documents (for dashboard alerts)
app.get('/api/documents/expiring', (req, res) => {
    const { adminKey, days } = req.query;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    res.json({ documents: getAllExpiringDocuments(+days || 30) });
});

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });
    try {
        const doc = deleteDocument(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        await deleteFromR2(doc.r2Key);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

---

## PART C — Main Tracker changes (App.jsx)

### C.1 — Add document constants

Find `const ADMIN_KEY = ...` at the top of `App.jsx`. After it add:

```js
const DOC_TYPES_TRUCK = [
    { value: 'insurance_lorry', label: 'Lorry Insurance Certificate' },
    { value: 'insurance_trailer', label: 'Trailer Insurance Certificate' },
    { value: 'comesa', label: 'COMESA Certificate' },
    { value: 'ntsa_inspection', label: 'NTSA Inspection Certificate' },
    { value: 'logbook', label: 'Vehicle Logbook / Title' },
    { value: 'overweight_permit', label: 'Overweight / Special Permit' },
    { value: 'customs', label: 'Customs / Border Document' },
    { value: 'other', label: 'Other Document' },
];

const DOC_TYPES_DRIVER = [
    { value: 'psv_licence', label: 'PSV Driving Licence' },
    { value: 'medical_certificate', label: 'Medical Certificate' },
    { value: 'id_card', label: 'National ID / Passport' },
    { value: 'other', label: 'Other Document' },
];
```

### C.2 — Add documents state

Find the `useState` block. After `const [showImportPanel, setShowImportPanel] = useState(false);` add:

```js
const [documents, setDocuments] = useState([]);
const [docsLoading, setDocsLoading] = useState(false);
const [docsPage, setDocsPage] = useState(null); // null | 'truck:{id}' | 'driver:{id}' | 'all'
```

### C.3 — Add document fetch helper

Find the `getSettings` helper function. After it add:

```js
const fetchDocuments = async (entityType, entityId) => {
    setDocsLoading(true);
    try {
        const params = new URLSearchParams({ adminKey: ADMIN_KEY });
        if (entityType) params.set('entityType', entityType);
        if (entityId) params.set('entityId', entityId);
        const res = await fetch(`${PAYMENT_API}/api/documents?${params}`);
        const data = await res.json();
        setDocuments(data.documents || []);
    } catch { setDocuments([]); }
    setDocsLoading(false);
};

const uploadDocument = async (file, entityType, entityId, docType, label, expiryDate) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('adminKey', ADMIN_KEY);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('docType', docType);
    formData.append('label', label);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    formData.append('uploadedBy', 'admin');
    const res = await fetch(`${PAYMENT_API}/api/documents/upload`, { method: 'POST', body: formData });
    return res.json();
};

const deleteDocumentById = async (docId) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    const res = await fetch(`${PAYMENT_API}/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: ADMIN_KEY }),
    });
    const result = await res.json();
    if (result.success) setDocuments(d => d.filter(doc => doc.id !== docId));
};
```

### C.4 — Add the DocumentPanel component

Find the `Modal` component. After it, add:

```jsx
// ── Document panel — reusable for trucks and drivers ───────────────────────
const DocumentPanel = ({ entityType, entityId, entityLabel, docTypes }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ docType: '', label: '', expiryDate: '' });
    const [uploadMsg, setUploadMsg] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const entityDocs = documents.filter(d => d.entityType === entityType && d.entityId === entityId);

    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.docType) { setUploadMsg('❌ Select a document type and choose a file'); return; }
        setUploading(true); setUploadMsg('');
        const result = await uploadDocument(selectedFile, entityType, entityId, uploadForm.docType, uploadForm.label || selectedFile.name, uploadForm.expiryDate);
        if (result.success) {
            setDocuments(d => [...d, result.document]);
            setUploadMsg('✅ Document uploaded successfully');
            setSelectedFile(null);
            setUploadForm({ docType: '', label: '', expiryDate: '' });
        } else {
            setUploadMsg('❌ ' + (result.error || 'Upload failed'));
        }
        setUploading(false);
    };

    const expiryColor = (doc) => {
        if (doc.isExpired) return '#ef4444';
        if (doc.daysUntilExpiry !== null && doc.daysUntilExpiry <= 30) return '#f97316';
        if (doc.daysUntilExpiry !== null && doc.daysUntilExpiry <= 60) return '#f59e0b';
        return '#10b981';
    };

    const expiryLabel = (doc) => {
        if (!doc.expiryDate) return 'No expiry set';
        if (doc.isExpired) return `Expired ${Math.abs(doc.daysUntilExpiry)}d ago`;
        if (doc.daysUntilExpiry <= 30) return `⚠️ Expires in ${doc.daysUntilExpiry}d`;
        return `Valid until ${doc.expiryDate}`;
    };

    return (
        <div>
            {/* Upload form */}
            <div style={{ background: dark ? T.bg : '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16, border: `1px solid ${T.border}` }}>
                <div style={{ fontWeight: 700, color: T.text, marginBottom: 12, fontSize: 13 }}>📎 Upload Document for {entityLabel}</div>
                <div style={S.fgg(2)}>
                    <div style={S.fg}>
                        <label style={S.lbl}>Document Type</label>
                        <select style={S.inp} value={uploadForm.docType} onChange={e => setUploadForm(f => ({ ...f, docType: e.target.value }))}>
                            <option value="">Select type…</option>
                            {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div style={S.fg}>
                        <label style={S.lbl}>Label (optional)</label>
                        <input style={S.inp} placeholder="e.g. Insurance 2025–2026" value={uploadForm.label}
                            onChange={e => setUploadForm(f => ({ ...f, label: e.target.value }))} />
                    </div>
                    <div style={S.fg}>
                        <label style={S.lbl}>Expiry Date (optional)</label>
                        <input style={S.inp} type="date" value={uploadForm.expiryDate}
                            onChange={e => setUploadForm(f => ({ ...f, expiryDate: e.target.value }))} />
                    </div>
                    <div style={S.fg}>
                        <label style={S.lbl}>Choose File (PDF, JPG, PNG)</label>
                        <input style={{ ...S.inp, padding: '7px 12px' }} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                            onChange={e => setSelectedFile(e.target.files[0])} />
                    </div>
                </div>
                {uploadMsg && <div style={{ fontSize: 12, color: uploadMsg.startsWith('✅') ? '#10b981' : '#ef4444', marginBottom: 10 }}>{uploadMsg}</div>}
                <button style={S.btn()} onClick={handleUpload} disabled={uploading}>
                    {uploading ? '⏳ Uploading…' : '📤 Upload to Cloudflare R2'}
                </button>
            </div>

            {/* Document list */}
            {docsLoading && <div style={{ color: T.textFaint, fontSize: 13, padding: 12 }}>⏳ Loading documents…</div>}
            {!docsLoading && entityDocs.length === 0 && (
                <div style={{ color: T.textFaint, fontSize: 13, padding: 12, textAlign: 'center' }}>No documents uploaded yet for {entityLabel}.</div>
            )}
            {entityDocs.map(doc => (
                <div key={doc.id} style={{ background: T.surface, borderRadius: 10, padding: '12px 16px', marginBottom: 10, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 28 }}>{doc.mimeType?.includes('pdf') ? '📄' : '🖼️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: T.text, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.label}</div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
                            {docTypes.find(t => t.value === doc.docType)?.label || doc.docType} · {doc.filename}
                        </div>
                        <div style={{ fontSize: 11, color: expiryColor(doc), marginTop: 2, fontWeight: 600 }}>
                            {expiryLabel(doc)}
                        </div>
                        <div style={{ fontSize: 10, color: T.textFaint }}>Uploaded: {doc.uploadedAt?.split('T')[0]} by {doc.uploadedBy}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        <a href={doc.url} target="_blank" rel="noreferrer"
                            style={{ ...S.btn('sm'), textDecoration: 'none', textAlign: 'center', fontSize: 11 }}>
                            👁 View
                        </a>
                        <a href={doc.url} download={doc.filename}
                            style={{ ...S.btn('ghost'), textDecoration: 'none', textAlign: 'center', fontSize: 11, padding: '5px 12px' }}>
                            ⬇ Save
                        </a>
                        <button style={{ ...S.btn('del'), fontSize: 11 }} onClick={() => deleteDocumentById(doc.id)}>✕</button>
                    </div>
                </div>
            ))}
        </div>
    );
};
```

### C.5 — Add a Documents page

Find the `PnL` page component. After its closing `};`, add:

```jsx
// ══════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════
const Documents = () => {
    const [filterEntity, setFilterEntity] = useState('all');
    const [expiringDocs, setExpiringDocs] = useState([]);

    useEffect(() => {
        fetchDocuments(null, null);
        // Fetch expiring documents
        fetch(`${PAYMENT_API}/api/documents/expiring?adminKey=${ADMIN_KEY}&days=60`)
            .then(r => r.json())
            .then(d => setExpiringDocs(d.documents || []))
            .catch(() => {});
    }, []);

    const expiredCount = expiringDocs.filter(d => d.isExpired).length;
    const expiringSoonCount = expiringDocs.filter(d => !d.isExpired && d.daysUntilExpiry <= 30).length;

    const expiryColor = doc => {
        if (doc.isExpired) return '#ef4444';
        if (doc.daysUntilExpiry <= 30) return '#f97316';
        return '#f59e0b';
    };

    return (
        <div>
            <div style={S.ph}>📁 Document Library</div>

            {/* Expiry alerts */}
            {expiringDocs.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    {expiredCount > 0 && (
                        <div style={S.alertBox('#ef4444')}>
                            <span style={{ fontSize: 18 }}>🔴</span>
                            <div>
                                <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>
                                    {expiredCount} document{expiredCount !== 1 ? 's' : ''} EXPIRED
                                </div>
                                <div style={{ fontSize: 12, color: T.textDim }}>
                                    {expiringDocs.filter(d => d.isExpired).map(d => d.label).join(', ')}
                                </div>
                            </div>
                        </div>
                    )}
                    {expiringSoonCount > 0 && (
                        <div style={S.alertBox('#f97316')}>
                            <span style={{ fontSize: 18 }}>⚠️</span>
                            <div>
                                <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>
                                    {expiringSoonCount} document{expiringSoonCount !== 1 ? 's' : ''} expiring within 30 days
                                </div>
                                <div style={{ fontSize: 12, color: T.textDim }}>
                                    {expiringDocs.filter(d => !d.isExpired && d.daysUntilExpiry <= 30).map(d => `${d.label} (${d.daysUntilExpiry}d)`).join(', ')}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* KPI row */}
            <div style={S.grid(4, 2, 1)}>
                {[
                    { l: 'Total Documents', v: documents.length, c: '#38bdf8' },
                    { l: 'Expired', v: expiredCount, c: '#ef4444' },
                    { l: 'Expiring Soon', v: expiringSoonCount, c: '#f97316' },
                    { l: 'Valid', v: documents.filter(d => !d.isExpired && (d.daysUntilExpiry === null || d.daysUntilExpiry > 30)).length, c: '#10b981' },
                ].map((k, i) => (
                    <div key={i} style={S.card(k.c)}>
                        <div style={S.kpi}>{k.l}</div>
                        <div style={S.val(k.c)}>{k.v}</div>
                    </div>
                ))}
            </div>

            {/* Filter row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <button style={{ ...S.btn(filterEntity === 'all' ? undefined : 'ghost'), fontSize: 12, padding: '7px 14px' }} onClick={() => setFilterEntity('all')}>All</button>
                {data.trucks.map(t => (
                    <button key={t.id} style={{ ...S.btn(filterEntity === t.id ? undefined : 'ghost'), fontSize: 12, padding: '7px 14px' }} onClick={() => setFilterEntity(t.id)}>{t.reg}</button>
                ))}
                {data.drivers.map(d => (
                    <button key={d.id} style={{ ...S.btn(filterEntity === d.id ? undefined : 'ghost'), fontSize: 12, padding: '7px 14px' }} onClick={() => setFilterEntity(d.id)}>{d.name.split(' ')[0]}</button>
                ))}
            </div>

            {/* Truck document sections */}
            {data.trucks.filter(t => filterEntity === 'all' || filterEntity === t.id).map(t => (
                <div key={t.id} style={{ ...S.card(), marginBottom: 24 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: T.text, marginBottom: 4 }}>🚛 {t.reg}</div>
                    <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 16 }}>{t.make} · {t.type} · {t.status}</div>
                    <DocumentPanel
                        entityType="truck"
                        entityId={t.id}
                        entityLabel={t.reg}
                        docTypes={DOC_TYPES_TRUCK}
                    />
                </div>
            ))}

            {/* Driver document sections */}
            {data.drivers.filter(d => filterEntity === 'all' || filterEntity === d.id).map(d => (
                <div key={d.id} style={{ ...S.card(), marginBottom: 24 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: T.text, marginBottom: 4 }}>👤 {d.name}</div>
                    <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 16 }}>{d.license} · {d.class} · {d.status}</div>
                    <DocumentPanel
                        entityType="driver"
                        entityId={d.id}
                        entityLabel={d.name}
                        docTypes={DOC_TYPES_DRIVER}
                    />
                </div>
            ))}
        </div>
    );
};
```

### C.6 — Add Documents to NAV and PAGES

Find the NAV array. Add before the settings entry:
```js
{ id: "documents", icon: "📁", label: "Documents" },
```

Find the PAGES map and add:
```js
documents: Documents,
```

### C.7 — Add document tabs to Fleet cards

Find the Fleet page truck card actions (the Edit and Remove buttons). Before them, add a Documents button:

```jsx
<button style={S.btn("sm")} onClick={() => {
    fetchDocuments('truck', t.id);
    setPage('documents');
}}>📁 Docs</button>
```

### C.8 — Add document tab to Drivers table

Find the Drivers table row actions (Edit and ✕ buttons). Before them, add:

```jsx
<button style={S.btn("sm")} onClick={() => {
    fetchDocuments('driver', d.id);
    setPage('documents');
}}>📁 Docs</button>
```

### C.9 — Add expiring document alerts to Dashboard

Find the `overdueInv` declaration inside `Dashboard`. After the other alert derivations add:

```js
const [expiringDocs, setExpiringDocs] = useState([]);
useEffect(() => {
    fetch(`${PAYMENT_API}/api/documents/expiring?adminKey=${ADMIN_KEY}&days=30`)
        .then(r => r.json())
        .then(d => setExpiringDocs(d.documents || []))
        .catch(() => {});
}, []);
```

Then find the alert rendering block and add inside it after the other alerts:

```jsx
{expiringDocs.map(doc => (
    <div key={doc.id} style={S.alertBox(doc.isExpired ? '#ef4444' : '#f97316')}>
        <span style={{ fontSize: 18 }}>{doc.isExpired ? '🔴' : '⚠️'}</span>
        <div>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 13 }}>
                {doc.isExpired ? 'Document EXPIRED' : `Document expiring in ${doc.daysUntilExpiry} days`} — {doc.label}
            </div>
            <div style={{ fontSize: 12, color: T.textDim }}>
                {doc.entityType === 'truck' ? `Truck: ${truckReg(doc.entityId)}` : `Driver: ${driverName(doc.entityId)}`}
                {doc.expiryDate && ` · Due: ${doc.expiryDate}`}
            </div>
        </div>
    </div>
))}
```

---

## PART D — Driver portal — view own documents + upload personal docs

### D.1 — Add a Documents section to the driver portal

In `driver-portal/src/App.jsx`, find the `PayslipsTab` component. After it, add:

```jsx
const MyDocsTab = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ docType: 'psv_licence', expiryDate: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [msg, setMsg] = useState('');

    const DRIVER_DOC_TYPES = [
        { value: 'psv_licence', label: 'PSV Driving Licence' },
        { value: 'medical_certificate', label: 'Medical Certificate' },
        { value: 'id_card', label: 'National ID / Passport' },
    ];

    useEffect(() => {
        setLoading(true);
        fetch(`${API}/api/documents/mine`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => { setDocs(d.documents || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.docType) { setMsg('❌ Select a document type and choose a file'); return; }
        setUploading(true); setMsg('');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('docType', uploadForm.docType);
        formData.append('label', DRIVER_DOC_TYPES.find(t => t.value === uploadForm.docType)?.label || uploadForm.docType);
        if (uploadForm.expiryDate) formData.append('expiryDate', uploadForm.expiryDate);
        try {
            const res = await fetch(`${API}/api/documents/driver-upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const result = await res.json();
            if (result.success) {
                setDocs(d => [...d, result.document]);
                setMsg('✅ Document uploaded successfully');
                setSelectedFile(null);
            } else {
                setMsg('❌ ' + (result.error || 'Upload failed'));
            }
        } catch { setMsg('❌ Could not connect to server'); }
        setUploading(false);
    };

    const expiryLabel = doc => {
        if (!doc.expiryDate) return '';
        if (doc.isExpired) return `⚠️ Expired ${Math.abs(doc.daysUntilExpiry)}d ago`;
        if (doc.daysUntilExpiry <= 30) return `⚠️ Expires in ${doc.daysUntilExpiry}d`;
        return `✅ Valid until ${doc.expiryDate}`;
    };

    return (
        <div style={S.content}>
            <div style={S.sectionTitle}>My Documents</div>

            {/* Upload section */}
            <div style={S.card()}>
                <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13 }}>📤 Upload My Document</div>
                <label style={S.lbl}>Document Type</label>
                <select style={S.inp} value={uploadForm.docType}
                    onChange={e => setUploadForm(f => ({ ...f, docType: e.target.value }))}>
                    {DRIVER_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label style={S.lbl}>Expiry Date</label>
                <input style={S.inp} type="date" value={uploadForm.expiryDate}
                    onChange={e => setUploadForm(f => ({ ...f, expiryDate: e.target.value }))} />
                <label style={S.inp} style={{ display: 'block', background: COLORS.bg, border: `1.5px dashed ${COLORS.border}`, borderRadius: 10, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
                    {selectedFile ? `✅ ${selectedFile.name}` : '📷 Tap to photograph or upload document'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" capture="environment"
                        style={{ display: 'none' }} onChange={e => setSelectedFile(e.target.files[0])} />
                </label>
                {msg && <div style={{ fontSize: 12, color: msg.startsWith('✅') ? COLORS.green : COLORS.red, marginBottom: 10 }}>{msg}</div>}
                <button style={{ ...S.btn(), width: '100%', borderRadius: 10 }} onClick={handleUpload} disabled={uploading}>
                    {uploading ? '⏳ Uploading…' : 'Upload Document'}
                </button>
            </div>

            {/* Document list */}
            {loading && <div style={{ color: COLORS.textFaint, padding: 20, textAlign: 'center' }}>⏳ Loading…</div>}
            {!loading && docs.length === 0 && (
                <div style={{ ...S.card(), textAlign: 'center', padding: 24, color: COLORS.textFaint }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                    <div>No documents uploaded yet</div>
                </div>
            )}
            {docs.map(doc => (
                <div key={doc.id} style={{ ...S.card(doc.isExpired ? COLORS.red : doc.daysUntilExpiry <= 30 ? COLORS.yellow : null), marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{doc.label}</div>
                        <a href={doc.url} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: COLORS.blue, fontWeight: 600, textDecoration: 'none' }}>
                            View →
                        </a>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textFaint }}>{doc.filename}</div>
                    {doc.expiryDate && (
                        <div style={{ fontSize: 12, color: doc.isExpired ? COLORS.red : doc.daysUntilExpiry <= 30 ? COLORS.yellow : COLORS.green, fontWeight: 600, marginTop: 4 }}>
                            {expiryLabel(doc)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
```

### D.2 — Add the My Docs tab to the driver portal tab bar

Find the `TABS` array in driver portal `App.jsx`. Add a docs tab:

```js
{ id: 'docs', icon: '📄', label: 'My Docs' },
```

Find `TAB_COMPONENTS`. Add:
```js
docs: MyDocsTab,
```

---

## PART E — Deployment

### E.1 — Add R2 credentials to Render environment variables

In the Render dashboard for your server, add:

```
CF_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=segecha-documents
R2_PUBLIC_URL=https://pub-XXXX.r2.dev
```

Redeploy the server.

### E.2 — Create `server/documents.json`

Create this empty file in the `server/` folder so it exists before first use:

```json
{ "documents": [] }
```

Commit and push.

---

## Summary — complete storage architecture

| What | Storage | Location | Who accesses |
|---|---|---|---|
| Fuel receipts | Cloudinary | `segecha/fuel_receipts/` | Drivers upload, admin views |
| Odometer photos | Cloudinary | `segecha/odometer/` | Drivers upload, admin views |
| Delivery proof | Cloudinary | `segecha/delivery_proof/` | Drivers upload, admin views |
| Incident photos | Cloudinary | `segecha/incidents/` | Drivers upload, admin views |
| Maintenance receipts | Cloudinary | `segecha/maintenance_receipts/` | Drivers upload, admin views |
| Insurance certificates | Cloudflare R2 | `trucks/{id}/insurance/` | Admin uploads, drivers view own |
| COMESA certificates | Cloudflare R2 | `trucks/{id}/comesa/` | Admin uploads |
| NTSA inspection certs | Cloudflare R2 | `trucks/{id}/ntsa_inspection/` | Admin uploads |
| Vehicle logbooks | Cloudflare R2 | `trucks/{id}/logbook/` | Admin uploads |
| Overweight permits | Cloudflare R2 | `trucks/{id}/overweight_permit/` | Admin uploads |
| Customs documents | Cloudflare R2 | `trucks/{id}/customs/` | Admin uploads |
| PSV driving licences | Cloudflare R2 | `driver/{id}/psv_licence/` | Drivers upload their own |
| Medical certificates | Cloudflare R2 | `driver/{id}/medical_certificate/` | Drivers upload their own |
| National ID / Passport | Cloudflare R2 | `driver/{id}/id_card/` | Drivers upload their own |

## Final checklist

- [ ] Cloudflare R2 bucket `segecha-documents` created with public access enabled
- [ ] R2 credentials added to `server/.env` and Render
- [ ] `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` ran in `server/`
- [ ] `server/r2.js` created
- [ ] `server/documents.js` created
- [ ] `server/documents.json` created (empty `{"documents":[]}`)
- [ ] Document routes added to `server/index.js`
- [ ] `Documents` page added to `App.jsx` — visible in NAV
- [ ] `DocumentPanel` component renders in Fleet and Drivers pages via 📁 Docs button
- [ ] Dashboard alerts show expired and soon-to-expire documents
- [ ] Driver portal — `MyDocsTab` lets drivers upload PSV licence, medical cert, ID
- [ ] Driver portal — uploaded docs visible with expiry warning colours
- [ ] Test: upload a PDF from Fleet page → verify it appears in the Documents page
- [ ] Test: upload a JPG from driver portal → verify it appears in the driver's My Docs tab
- [ ] Test: set an expiry date in the past → verify red alert appears on Dashboard
