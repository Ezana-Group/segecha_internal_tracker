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
    Cloud
} from "lucide-react";
import { adminAuth } from '../utils/adminAuth';
import { PAYMENT_API, ADMIN_KEY } from "../utils/env";
import { fmtDate } from "../utils/formatters";
import { DOC_TYPES_TRUCK, DOC_TYPES_DRIVER, uploadDocument, deleteDocumentById } from "../components/DocumentPanel";
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
        entityType: '', entityId: '', docType: '', label: '', expiryDate: ''
    });
    const [selectedFile, setSelectedFile] = useState(null);

    // ── Helper: fetchDocuments
    const fetchDocuments = async (entityType, entityId) => {
        setDocsLoading(true);
        try {
            const token = adminAuth.getToken();
            const params = new URLSearchParams({ adminKey: ADMIN_KEY });
            if (entityType) params.set('entityType', entityType);
            if (entityId) params.set('entityId', entityId);
            const res = await fetch(`${PAYMENT_API}/api/documents?${params}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const apiData = await res.json();
            setDocuments(apiData.documents || []);
        } catch { setDocuments([]); }
        setDocsLoading(false);
    };

    // ── Load on mount
    useEffect(() => {
        fetchDocuments(null, null);
        const token = adminAuth.getToken();
        fetch(`${PAYMENT_API}/api/documents/expiring?adminKey=${ADMIN_KEY}&days=60`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
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
        if (!selectedFile || !uploadForm.docType || !uploadForm.entityId) {
            setUploadMsg('❌ Requirements missing');
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
            setUploadMsg('OK: Uploaded successfully.');
            setDocuments(d => [...d, result.document]);
            setUploadForm({ entityType: '', entityId: '', docType: '', label: '', expiryDate: '' });
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

    return (
        <div className="page-shell">
            <PageHeader
                icon={ShieldCheck}
                title="Documents"
                description="Compliance files, expiry tracking, and secure storage."
                actions={
                    <Button
                        variant={showUpload ? "secondary" : "premium"}
                        icon={showUpload ? X : Upload}
                        onClick={() => setShowUpload(!showUpload)}
                    >
                        {showUpload ? "Cancel upload" : "Upload document"}
                    </Button>
                }
            />

            {/* KPI Section */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 32 }}>
                <Card 
                    style={{ padding: 24, cursor: "pointer", border: statusFilter === 'all' ? "2px solid var(--brand-primary)" : "1px solid var(--border-subtle)" }}
                    onClick={() => setStatusFilter('all')}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(56, 189, 248, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                            <FileText size={20} />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900 }}>{enriched.length}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Total Assets</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Managed in Cloudflare R2</div>
                </Card>

                <Card 
                    style={{ padding: 24, cursor: "pointer", border: statusFilter === 'expired' ? "2px solid #ef4444" : "1px solid var(--border-subtle)" }}
                    onClick={() => setStatusFilter('expired')}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                            <AlertCircle size={20} />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#ef4444" }}>{expiredCount}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Expired Items</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Requires immediate attention</div>
                </Card>

                <Card 
                    style={{ padding: 24, cursor: "pointer", border: statusFilter === 'expiring' ? "2px solid #f97316" : "1px solid var(--border-subtle)" }}
                    onClick={() => setStatusFilter('expiring')}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(249, 115, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316" }}>
                            <Clock size={20} />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#f97316" }}>{expiringCount}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Expiring ≤ 30d</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Preventive renewal recommended</div>
                </Card>
            </div>

            {/* Upload Area */}
            {showUpload && (
                <Card style={{ padding: 32, marginBottom: 32, background: "var(--bg-card)", border: "2px dashed var(--brand-primary)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 24, marginBottom: 24 }}>
                        <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Target Entity Type</label>
                            <select 
                                className="input-premium" 
                                style={{ width: "100%", height: 42, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontWeight: 600 }}
                                value={uploadForm.entityType}
                                onChange={e => setUploadForm({ ...uploadForm, entityType: e.target.value, entityId: '', docType: '' })}
                            >
                                <option value="">Select Category...</option>
                                <option value="truck">Vehicle / Fleet</option>
                                <option value="driver">Personnel / Driver</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Specific Asset</label>
                            <select 
                                className="input-premium" 
                                style={{ width: "100%", height: 42, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontWeight: 600 }}
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
                        <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Document Schema</label>
                            <select 
                                className="input-premium" 
                                style={{ width: "100%", height: 42, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontWeight: 600 }}
                                value={uploadForm.docType}
                                onChange={e => setUploadForm({ ...uploadForm, docType: e.target.value })}
                                disabled={!uploadForm.entityId}
                            >
                                <option value="">Select Type...</option>
                                {(uploadForm.entityType === 'truck' ? DOC_TYPES_TRUCK : DOC_TYPES_DRIVER).map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Document Label</label>
                            <input 
                                className="input-premium" 
                                style={{ width: "100%", height: 42, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontWeight: 600 }}
                                placeholder="e.g. Comprehensive Policy 2024"
                                value={uploadForm.label}
                                onChange={e => setUploadForm({ ...uploadForm, label: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Regulatory Expiry</label>
                            <input 
                                type="date"
                                className="input-premium" 
                                style={{ width: "100%", height: 42, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontWeight: 600 }}
                                value={uploadForm.expiryDate}
                                onChange={e => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Binary Asset</label>
                            <div style={{ position: "relative" }}>
                                <input 
                                    type="file" 
                                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                                    onChange={e => setSelectedFile(e.target.files[0])}
                                />
                                <div style={{ width: "100%", height: 42, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, display: "flex", alignItems: "center", padding: "0 12px", color: selectedFile ? "var(--text-primary)" : "var(--text-dim)", fontWeight: 600, fontSize: 13, gap: 8 }}>
                                    <Cloud size={16} color="var(--brand-primary)" />
                                    {selectedFile ? selectedFile.name : "Select File..."}
                                </div>
                            </div>
                        </div>
                    </div>

                    {uploadMsg && (
                        <div style={{ marginBottom: 20, padding: 12, borderRadius: 'var(--radius-md)', background: uploadMsg.includes('OK:') ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)', color: uploadMsg.includes('OK:') ? '#4ade80' : '#f87171', fontWeight: 600, fontSize: 13 }}>
                            {uploadMsg}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 12 }}>
                        <Button variant="premium" icon={Cloud} onClick={handleUpload} disabled={uploading}>
                            {uploading ? "Verifying..." : "Propagate to Registry"}
                        </Button>
                        <Button variant="ghost" onClick={() => setShowUpload(false)}>Cancel</Button>
                    </div>
                </Card>
            )}

            {/* Filter Hub */}
            <Card style={{ padding: "0 24px", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, gap: 20, overflowX: "auto" }}>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {[
                            { id: 'all', label: 'All Library' },
                            { id: 'vehicles', label: 'Vehicles' },
                            { id: 'drivers', label: 'Personnel' },
                            { id: 'insurance', label: 'Insurance' },
                            { id: 'legal', label: 'Legal' }
                        ].map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setDocTab(t.id)}
                                style={{ 
                                    padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                                    background: docTab === t.id ? "var(--brand-primary)15" : "transparent",
                                    color: docTab === t.id ? "var(--brand-primary)" : "var(--text-dim)",
                                    transition: "all 0.2s"
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ height: 24, width: 1, background: "var(--border-subtle)" }} />

                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {[
                            { id: 'all', label: 'Status: All', color: 'var(--text-dim)' },
                            { id: 'expired', label: 'Expired', color: '#ef4444' },
                            { id: 'expiring', label: 'Expiring', color: '#f97316' },
                            { id: 'valid', label: 'Healthy', color: '#10b981' }
                        ].map(s => (
                            <button 
                                key={s.id}
                                onClick={() => setStatusFilter(s.id)}
                                style={{ 
                                    padding: "4px 12px", fontSize: 11, fontWeight: 700, borderRadius: 12, border: `1px solid ${statusFilter === s.id ? s.color : 'transparent'}`, background: statusFilter === s.id ? `${s.color}15` : 'transparent', color: statusFilter === s.id ? s.color : 'var(--text-dim)', cursor: "pointer"
                                }}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
                        <SearchIcon size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
                        <input 
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            placeholder="Search indexed assets..."
                            style={{ width: "100%", height: 42, background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "0 12px 0 40px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}
                        />
                    </div>
                </div>
            </Card>

            {/* Asset Ledger */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
                {docsLoading ? (
                    <div style={{ padding: 80, textAlign: "center", color: "var(--text-dim)" }}>
                        <div className="spinner" style={{ marginBottom: 16 }} />
                        <div style={{ fontWeight: 700 }}>Synchronizing Vault...</div>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th className="sticky-col" onClick={() => setSortCol('name')} style={{ cursor: "pointer" }} title="Document Name">Document Name {sortCol === 'name' && (sortAsc ? "↑" : "↓")}</th>
                                    <th title="Schema">Schema</th>
                                    <th onClick={() => setSortCol('entity')} style={{ cursor: "pointer" }} title="Linked Asset">Linked Asset {sortCol === 'entity' && (sortAsc ? "↑" : "↓")}</th>
                                    <th onClick={() => setSortCol('expiry')} style={{ cursor: "pointer" }} title="Expiry Map">Expiry Map {sortCol === 'expiry' && (sortAsc ? "↑" : "↓")}</th>
                                    <th className="status-col" title="Status">Status</th>
                                    <th style={{ textAlign: "right" }} title="Actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: 100, textAlign: "center" }}>
                                            <div style={{ color: "var(--text-dim)", fontWeight: 600 }}>No documents found matching the current perspective.</div>
                                        </td>
                                    </tr>
                                ) : visible.map(doc => {
                                    const cat = categoryLabel(doc.category);
                                    return (
                                        <tr key={doc.id}>
                                            <td className="sticky-col" title={`${doc.label} (${doc.filename})`}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)" }}>
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{doc.label}</div>
                                                        <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{doc.filename}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td title={cat.label}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 6, background: `${cat.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color }}>
                                                        <cat.icon size={14} />
                                                    </div>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{cat.label}</div>
                                                </div>
                                            </td>
                                            <td title={`${doc.entityType}: ${doc.entityName}`}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "var(--surface-subtle)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                                                    {doc.entityType === 'truck' ? <Truck size={12} /> : <User size={12} />}
                                                    {doc.entityName}
                                                </div>
                                            </td>
                                            <td title={doc.expiryDate ? `Expires on ${fmtDate(doc.expiryDate)}` : "Lifetime document"}>
                                                {doc.expiryDate ? (
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                                                            <Calendar size={14} />
                                                            {fmtDate(doc.expiryDate)}
                                                        </div>
                                                        <div style={{ width: 100, height: 4, background: "var(--surface-subtle)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                                                            <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, ((365 - (daysUntil(doc.expiryDate) || 0)) / 365) * 100))}%`, background: doc.status === 'expired' ? "#ef4444" : doc.status === 'expiring' ? "#f97316" : "#10b981" }} />
                                                        </div>
                                                    </div>
                                                ) : <span style={{ color: "var(--text-dim)", fontSize: 12 }}>Lifetime</span>}
                                            </td>
                                            <td className="status-col" title={docStatus(doc)}>{statusBadge(doc)}</td>
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

function ArrowUpIcon({ size, color }) { return <ChevronRight size={size} style={{ transform: 'rotate(-90deg)' }} color={color || "currentColor"} />; }
