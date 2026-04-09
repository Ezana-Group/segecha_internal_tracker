import { useState, useEffect } from "react";
import {
    FileText,
    Upload,
    Trash2,
    Download,
    Eye,
    Search,
    Filter,
    Clock,
    AlertCircle,
    CheckCircle2,
    ShieldCheck,
    Truck,
    User,
    FileCheck,
    X,
    ExternalLink,
    ChevronRight,
    SearchIcon,
    Calendar,
    Cloud,
    Files,
    FileImage,
    FileArchive,
} from "lucide-react";
import { PAYMENT_API } from "../utils/env";
import { fetchWithAuth } from "../utils/api";
import { fmtDate } from "../utils/formatters";
import { DOC_TYPES_TRUCK, DOC_TYPES_DRIVER, uploadDocument, deleteDocumentById } from "../components/DocumentPanel";
import { getDocumentTypes, subscribeSettings } from "../utils/settingsStore.js";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { TableRowActions } from "../components/TableRowActions";

export function Documents({ data, setData, dark, isMobile }) {
    // ── State (from existing version)
    const [documents, setDocuments] = useState([]);
    const [docsLoading, setDocsLoading] = useState(true);

    // ── New UI State
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
        entityType: '', entityId: '', docType: '', docTypeOther: '', label: '', expiryDate: ''
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadDragOver, setUploadDragOver] = useState(false);
    const [, bumpSettingsVersion] = useState(0);

    useEffect(() => subscribeSettings(() => bumpSettingsVersion((n) => n + 1)), []);

    // ── Helper: fetchDocuments
    const fetchDocuments = async (entityType, entityId) => {
        setDocsLoading(true);
        try {
            const params = new URLSearchParams();
            if (entityType) params.set('entityType', entityType);
            if (entityId) params.set('entityId', entityId);
            const res = await fetchWithAuth(`${PAYMENT_API}/api/documents?${params}`);
            const apiData = await res.json();
            setDocuments(apiData.documents || []);
        } catch { setDocuments([]); }
        setDocsLoading(false);
    };

    // ── Load on mount
    useEffect(() => {
        fetchDocuments(null, null);
        fetchWithAuth(`${PAYMENT_API}/api/documents/expiring?days=60`)
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

    const statusBadge = (doc) => {
        const s = docStatus(doc);
        const d = daysUntil(doc.expiryDate);
        if (s === 'expired') return <Badge status="Overdue" text={`Expired ${Math.abs(d)}d ago`} />;
        if (s === 'expiring') return <Badge status="Warning" text={`Expires in ${d}d`} />;
        if (s === 'valid') return <Badge status="Success" text={`Valid: ${fmtDate(doc.expiryDate)}`} />;
        return <Badge status="Default" text="No expiry" />;
    };

    const docCategory = (docType) => {
        if (['insurance_lorry', 'insurance_trailer'].includes(docType)) return 'insurance';
        if (['comesa', 'ntsa_inspection', 'overweight_permit', 'customs', 'logbook'].includes(docType)) return 'legal';
        if (['psv_licence', 'medical_certificate', 'id_card'].includes(docType)) return 'drivers';
        return 'vehicles';
    };

    const categoryLabel = (cat) => ({
        insurance: { label: 'Insurance', icon: ShieldCheck, color: '#3b82f6' },
        legal: { label: 'Compliance', icon: FileCheck, color: '#10b981' },
        drivers: { label: 'Personnel', icon: User, color: '#a78bfa' },
        vehicles: { label: 'Operations', icon: Truck, color: '#f59e0b' },
    }[cat] || { label: 'Other', icon: FileText, color: 'var(--text-dim)' });

    // File-type icon helper
    const fileTypeIcon = (filename) => {
        if (!filename) return FileText;
        const ext = filename.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
        return FileText;
    };

    // Enrich documents
    const enriched = documents.map(doc => ({
        ...doc,
        status: docStatus(doc),
        category: docCategory(doc.docType),
        entityName: doc.entityType === 'truck'
            ? (data.trucks.find(t => t.id === doc.entityId)?.reg || doc.entityId)
            : (data.drivers.find(d => d.id === doc.entityId)?.name || doc.entityId),
    }));

    // Filter + sort
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
                    doc.filename?.toLowerCase().includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            let av, bv;
            if (sortCol === 'name') { av = a.label; bv = b.label; }
            else if (sortCol === 'entity') { av = a.entityName; bv = b.entityName; }
            else { av = a.expiryDate || '9999'; bv = b.expiryDate || '9999'; }
            if (av === bv) return 0;
            return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });

    const handleUpload = async () => {
        const customDocType = uploadForm.docType === 'other' ? uploadForm.docTypeOther.trim() : '';
        const effectiveDocType = customDocType || uploadForm.docType;
        if (!selectedFile || !uploadForm.docType || !uploadForm.entityId) {
            setUploadMsg('❌ Requirements missing');
            return;
        }
        if (!effectiveDocType) {
            setUploadMsg('❌ Specify the document type');
            return;
        }
        setUploading(true); setUploadMsg('');
        const result = await uploadDocument(
            selectedFile,
            uploadForm.entityType,
            uploadForm.entityId,
            effectiveDocType,
            uploadForm.label || selectedFile.name,
            uploadForm.expiryDate
        );
        if (result.success) {
            setUploadMsg('OK: Uploaded successfully.');
            setDocuments(d => [...d, result.document]);
            setUploadForm({ entityType: '', entityId: '', docType: '', docTypeOther: '', label: '', expiryDate: '' });
            setSelectedFile(null);
            setShowUpload(false);
        } else {
            setUploadMsg('❌ ' + (result.error || 'Upload failed'));
        }
        setUploading(false);
    };

    const handleDelete = async (docId) => {
        await deleteDocumentById(docId, setDocuments);
    };

    const expiredCount = enriched.filter(d => d.status === 'expired').length;
    const expiringCount = enriched.filter(d => d.status === 'expiring').length;

    const docTabConfig = [
        { id: 'all',       label: 'All Documents' },
        { id: 'vehicles',  label: 'Vehicles' },
        { id: 'drivers',   label: 'Personnel' },
        { id: 'insurance', label: 'Insurance' },
        { id: 'legal',     label: 'Legal' },
    ];

    const statusFilterConfig = [
        { id: 'all',      label: 'All',      color: 'var(--text-muted)' },
        { id: 'expired',  label: 'Expired',  color: '#ef4444' },
        { id: 'expiring', label: 'Expiring', color: '#f97316' },
        { id: 'valid',    label: 'Valid',    color: '#10b981' },
    ];

    return (
        <div className="page-shell">
            <PageHeader
                icon={Files}
                title="Documents"
                description="Compliance files, expiry tracking, and secure cloud storage."
                actions={
                    <Button
                        variant={showUpload ? "secondary" : "primary"}
                        icon={showUpload ? X : Upload}
                        onClick={() => setShowUpload(!showUpload)}
                    >
                        {showUpload ? "Cancel" : "Upload Document"}
                    </Button>
                }
            />

            {/* ── KPI Summary Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                {/* Total */}
                <Card
                    accent="#38bdf8"
                    style={{ padding: 20, cursor: "pointer", borderColor: statusFilter === 'all' ? "#38bdf8" : undefined }}
                    onClick={() => setStatusFilter('all')}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(56,189,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                            <FileText size={18} strokeWidth={2} />
                        </div>
                        <span style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{enriched.length}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Total Documents</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Stored in Cloudflare R2</div>
                </Card>

                {/* Expired */}
                <Card
                    accent="#ef4444"
                    style={{ padding: 20, cursor: "pointer", borderColor: statusFilter === 'expired' ? "#ef4444" : undefined }}
                    onClick={() => setStatusFilter('expired')}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                            <AlertCircle size={18} strokeWidth={2} />
                        </div>
                        <span style={{ fontSize: 28, fontWeight: 900, color: expiredCount > 0 ? "#ef4444" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{expiredCount}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Expired</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Requires immediate attention</div>
                </Card>

                {/* Expiring soon */}
                <Card
                    accent="#f97316"
                    style={{ padding: 20, cursor: "pointer", borderColor: statusFilter === 'expiring' ? "#f97316" : undefined }}
                    onClick={() => setStatusFilter('expiring')}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(249,115,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316" }}>
                            <Clock size={18} strokeWidth={2} />
                        </div>
                        <span style={{ fontSize: 28, fontWeight: 900, color: expiringCount > 0 ? "#f97316" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{expiringCount}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Expiring within 30 days</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Preventive renewal recommended</div>
                </Card>
            </div>

            {/* ── Upload Form Panel ── */}
            {showUpload && (
                <Card style={{ padding: 24, marginBottom: 24, border: "2px dashed var(--brand-primary)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                        <Cloud size={16} color="var(--brand-primary)" />
                        Upload New Document
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                        {/* Entity type */}
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                Entity Type
                            </label>
                            <select
                                style={{ width: "100%", height: 40, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}
                                value={uploadForm.entityType}
                                onChange={e => setUploadForm({ ...uploadForm, entityType: e.target.value, entityId: '', docType: '' })}
                            >
                                <option value="">Select Category...</option>
                                <option value="truck">Vehicle / Fleet</option>
                                <option value="driver">Personnel / Driver</option>
                            </select>
                        </div>
                        {/* Specific asset */}
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                Specific Asset
                            </label>
                            <select
                                style={{ width: "100%", height: 40, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}
                                value={uploadForm.entityId}
                                onChange={e => setUploadForm({ ...uploadForm, entityId: e.target.value })}
                                disabled={!uploadForm.entityType}
                            >
                                <option value="">Choose Asset...</option>
                                {(uploadForm.entityType === 'truck' ? data.trucks.map(t => ({ v: t.id, l: t.reg })) : data.drivers.map(d => ({ v: d.id, l: d.name }))).map(o => (
                                    <option key={o.v} value={o.v}>{o.l}</option>
                                ))}
                            </select>
                        </div>
                        {/* Document type */}
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                Document Type
                            </label>
                            <select
                                style={{ width: "100%", height: 40, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}
                                value={uploadForm.docType}
                                onChange={e => setUploadForm({ ...uploadForm, docType: e.target.value, docTypeOther: e.target.value === 'other' ? uploadForm.docTypeOther : '' })}
                                disabled={!uploadForm.entityId}
                            >
                                <option value="">Select Type...</option>
                                {(uploadForm.entityType === 'truck'
                                    ? getDocumentTypes('truck')
                                    : uploadForm.entityType === 'driver'
                                        ? getDocumentTypes('driver')
                                        : DOC_TYPES_DRIVER
                                ).map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        {uploadForm.docType === 'other' && (
                            <div>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                    Specify Document Type
                                </label>
                                <input
                                    style={{ width: "100%", height: 40, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", color: "var(--text-primary)", fontWeight: 600, fontSize: 13, boxSizing: "border-box" }}
                                    placeholder="e.g. Local Authority Permit"
                                    value={uploadForm.docTypeOther}
                                    onChange={e => setUploadForm({ ...uploadForm, docTypeOther: e.target.value })}
                                />
                            </div>
                        )}
                        {/* Label */}
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                Document Label
                            </label>
                            <input
                                style={{ width: "100%", height: 40, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", color: "var(--text-primary)", fontWeight: 600, fontSize: 13, boxSizing: "border-box" }}
                                placeholder="e.g. Comprehensive Policy 2024"
                                value={uploadForm.label}
                                onChange={e => setUploadForm({ ...uploadForm, label: e.target.value })}
                            />
                        </div>
                        {/* Expiry date */}
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                Expiry Date
                            </label>
                            <input
                                type="date"
                                style={{ width: "100%", height: 40, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px", color: "var(--text-primary)", fontWeight: 600, fontSize: 13, boxSizing: "border-box" }}
                                value={uploadForm.expiryDate}
                                onChange={e => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                            />
                        </div>
                        {/* File picker */}
                        <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                File
                            </label>
                            <div
                                style={{ position: "relative" }}
                                onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
                                onDragLeave={() => setUploadDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setUploadDragOver(false);
                                    const file = e.dataTransfer?.files?.[0];
                                    if (file) setSelectedFile(file);
                                }}
                            >
                                <input
                                    type="file"
                                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                                    onChange={e => setSelectedFile(e.target.files[0])}
                                />
                                <div style={{ height: 40, background: uploadDragOver ? "var(--brand-muted)" : "var(--bg-surface)", border: uploadDragOver ? "1px solid var(--brand-primary)" : "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", padding: "0 12px", gap: 8, color: selectedFile ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>
                                    <Cloud size={15} color="var(--brand-primary)" />
                                    {selectedFile ? selectedFile.name : "Choose or drop file..."}
                                </div>
                            </div>
                        </div>
                    </div>

                    {uploadMsg && (
                        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: "var(--radius-md)", background: uploadMsg.includes('OK:') ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", color: uploadMsg.includes('OK:') ? "#4ade80" : "#f87171", fontWeight: 600, fontSize: 13 }}>
                            {uploadMsg}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                        <Button variant="primary" icon={Cloud} onClick={handleUpload} disabled={uploading}>
                            {uploading ? "Uploading..." : "Upload Document"}
                        </Button>
                        <Button variant="ghost" onClick={() => setShowUpload(false)}>Cancel</Button>
                    </div>
                </Card>
            )}

            {/* ── Filter bar ── */}
            <Card style={{ padding: "0 20px", marginBottom: 20, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, minHeight: 60 }}>
                    {/* Document type tabs */}
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        {docTabConfig.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setDocTab(t.id)}
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    border: "none",
                                    cursor: "pointer",
                                    background: docTab === t.id ? "var(--brand-muted)" : "transparent",
                                    color: docTab === t.id ? "var(--brand-primary)" : "var(--text-muted)",
                                    transition: "all 0.15s",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Separator */}
                    <div style={{ width: 1, height: 22, background: "var(--border-subtle)", flexShrink: 0 }} />

                    {/* Status filters */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {statusFilterConfig.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setStatusFilter(s.id)}
                                style={{
                                    padding: "4px 11px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    borderRadius: 20,
                                    border: `1px solid ${statusFilter === s.id ? s.color : "transparent"}`,
                                    background: statusFilter === s.id ? `${s.color}18` : "transparent",
                                    color: statusFilter === s.id ? s.color : "var(--text-muted)",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
                        <SearchIcon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                        <input
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            placeholder="Search documents..."
                            style={{ width: "100%", height: 36, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0 12px 0 34px", fontSize: 12, color: "var(--text-primary)", fontWeight: 600, boxSizing: "border-box" }}
                        />
                    </div>
                </div>
            </Card>

            {/* ── Document list ── */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
                {docsLoading ? (
                    <div style={{ padding: 80, textAlign: "center" }}>
                        <div className="spinner" style={{ margin: "0 auto 16px" }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>Loading documents...</div>
                    </div>
                ) : visible.length === 0 ? (
                    <div style={{ padding: "80px 24px", textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "var(--radius-lg)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--text-muted)" }}>
                            <Files size={26} strokeWidth={1.5} />
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
                            {searchQ || docTab !== 'all' || statusFilter !== 'all' ? "No documents match your filters" : "No documents uploaded yet"}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                            {searchQ || docTab !== 'all' || statusFilter !== 'all'
                                ? "Try adjusting your search or filters."
                                : "Upload compliance files using the button above."}
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th
                                        className="sticky-col"
                                        onClick={() => { setSortCol('name'); setSortAsc(s => sortCol === 'name' ? !s : true); }}
                                        style={{ cursor: "pointer", userSelect: "none" }}
                                    >
                                        Document {sortCol === 'name' && (sortAsc ? "↑" : "↓")}
                                    </th>
                                    <th>Category</th>
                                    <th
                                        onClick={() => { setSortCol('entity'); setSortAsc(s => sortCol === 'entity' ? !s : true); }}
                                        style={{ cursor: "pointer", userSelect: "none" }}
                                    >
                                        Linked Asset {sortCol === 'entity' && (sortAsc ? "↑" : "↓")}
                                    </th>
                                    <th
                                        onClick={() => { setSortCol('expiry'); setSortAsc(s => sortCol === 'expiry' ? !s : true); }}
                                        style={{ cursor: "pointer", userSelect: "none" }}
                                    >
                                        Expiry {sortCol === 'expiry' && (sortAsc ? "↑" : "↓")}
                                    </th>
                                    <th className="status-col">Status</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(doc => {
                                    const cat = categoryLabel(doc.category);
                                    const FileIcon = fileTypeIcon(doc.filename);
                                    return (
                                        <tr key={doc.id}>
                                            {/* Document name + filename */}
                                            <td className="sticky-col" title={`${doc.label} (${doc.filename})`}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    <div style={{ width: 38, height: 38, borderRadius: "var(--radius-md)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)", flexShrink: 0 }}>
                                                        <FileIcon size={18} strokeWidth={1.5} />
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{doc.label}</div>
                                                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{doc.filename}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td title={cat.label}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--radius-md)", background: `${cat.color}12`, border: `1px solid ${cat.color}20` }}>
                                                    <cat.icon size={13} color={cat.color} strokeWidth={2} />
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: cat.color }}>{cat.label}</span>
                                                </div>
                                            </td>

                                            {/* Linked asset */}
                                            <td title={`${doc.entityType}: ${doc.entityName}`}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                                    {doc.entityType === 'truck' ? <Truck size={12} strokeWidth={2} /> : <User size={12} strokeWidth={2} />}
                                                    {doc.entityName}
                                                </div>
                                            </td>

                                            {/* Expiry */}
                                            <td title={doc.expiryDate ? `Expires ${fmtDate(doc.expiryDate)}` : "Lifetime document"}>
                                                {doc.expiryDate ? (
                                                    <div>
                                                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 5 }}>
                                                            <Calendar size={13} strokeWidth={2} color="var(--text-muted)" />
                                                            {fmtDate(doc.expiryDate)}
                                                        </div>
                                                        <div style={{ width: 80, height: 3, background: "var(--border-subtle)", borderRadius: 2, marginTop: 5, overflow: "hidden" }}>
                                                            <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, ((365 - (daysUntil(doc.expiryDate) || 0)) / 365) * 100))}%`, background: doc.status === 'expired' ? "#ef4444" : doc.status === 'expiring' ? "#f97316" : "#10b981", borderRadius: 2 }} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Lifetime</span>
                                                )}
                                            </td>

                                            {/* Status badge */}
                                            <td className="status-col">{statusBadge(doc)}</td>

                                            {/* Actions */}
                                            <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                                <TableRowActions
                                                    ariaLabel={`Actions for ${doc.label || doc.filename}`}
                                                    items={[
                                                        {
                                                            id: "view",
                                                            label: "Open / view",
                                                            icon: Eye,
                                                            onClick: () => window.open(doc.url, "_blank", "noopener,noreferrer"),
                                                        },
                                                        {
                                                            id: "download",
                                                            label: "Download",
                                                            icon: Download,
                                                            onClick: () => window.open(doc.url),
                                                        },
                                                        {
                                                            id: "delete",
                                                            label: "Delete",
                                                            icon: Trash2,
                                                            danger: true,
                                                            onClick: () => handleDelete(doc.id),
                                                        },
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
