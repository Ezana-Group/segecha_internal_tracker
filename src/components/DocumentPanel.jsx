import { useEffect, useMemo, useState } from "react";
import { PAYMENT_API } from "../utils/env";
import { fetchWithAuth } from "../utils/api";
import {
    DEFAULT_DOC_TYPES_DRIVER,
    DEFAULT_DOC_TYPES_JOURNEY,
    DEFAULT_DOC_TYPES_TRUCK,
    getDocumentTypes,
    subscribeSettings,
} from "../utils/settingsStore.js";

export const DOC_TYPES_TRUCK = DEFAULT_DOC_TYPES_TRUCK;
export const DOC_TYPES_DRIVER = DEFAULT_DOC_TYPES_DRIVER;
export const DOC_TYPES_JOURNEY = DEFAULT_DOC_TYPES_JOURNEY;

export const uploadDocument = async (file, entityType, entityId, docType, label, expiryDate) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('docType', docType);
    formData.append('label', label);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    formData.append('uploadedBy', 'admin');
    const res = await fetchWithAuth(`${PAYMENT_API}/api/documents/upload`, { method: 'POST', body: formData });
    return res.json();
};

export const deleteDocumentById = async (docId, setDocuments) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
        const res = await fetchWithAuth(`${PAYMENT_API}/api/documents/${docId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        const result = await res.json();
        if (result.success) setDocuments(d => d.filter(doc => doc.id !== docId));
        else alert('Failed to delete document: ' + result.error);
    } catch {
        alert('Could not connect to document server.');
    }
};

import { FileText, Image, Trash2, Eye, UploadCloud, AlertCircle, CheckCircle2 } from "lucide-react";
import { fmtDate } from "../utils/formatters";
import { Button } from "./Button";
import { TableRowActions } from "./TableRowActions";
import { Badge } from "./Badge";

export function DocumentPanel({
    entityType,
    entityId,
    entityLabel,
    docTypes,
    documents,
    setDocuments,
    dark,
    capabilities = { upload: true, open: true, delete: true, viewList: true },
}) {
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ docType: '', docTypeOther: '', label: '', expiryDate: '' });
    const [uploadMsg, setUploadMsg] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [, bumpSettingsVersion] = useState(0);

    useEffect(() => subscribeSettings(() => bumpSettingsVersion((n) => n + 1)), []);

    const resolvedDocTypes = useMemo(() => {
        const fromSettings = getDocumentTypes(entityType);
        if (!Array.isArray(docTypes) || docTypes.length === 0) return fromSettings;
        const seen = new Set();
        return [...docTypes, ...fromSettings].filter((d) => {
            const k = String(d?.value || '').toLowerCase();
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [docTypes, entityType]);

    const entityDocs = (documents || []).filter(d => (d.entityType === entityType && d.entityId === entityId) || (entityType === 'staff' && d.driverId === entityId));

    const handleUpload = async () => {
        const customDocType = uploadForm.docType === 'other' ? uploadForm.docTypeOther.trim() : '';
        const effectiveDocType = customDocType || uploadForm.docType;
        if (!selectedFile || !effectiveDocType) { setUploadMsg('❌ Select a document type and choose a file'); return; }
        setUploading(true); setUploadMsg('');
        const result = await uploadDocument(selectedFile, entityType, entityId, effectiveDocType, uploadForm.label || selectedFile.name, uploadForm.expiryDate);
        if (result.success) {
            setDocuments(d => [...d, result.document]);
            setUploadMsg('OK: Document uploaded.');
            setSelectedFile(null);
            setUploadForm({ docType: '', docTypeOther: '', label: '', expiryDate: '' });
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
        if (doc.daysUntilExpiry <= 30) return `Expires in ${doc.daysUntilExpiry}d (${fmtDate(doc.expiryDate)})`;
        return `Valid until ${fmtDate(doc.expiryDate)}`;
    };

    const capUpload = capabilities.upload !== false;
    const capOpen = capabilities.open !== false;
    const capDelete = capabilities.delete !== false;
    const capViewList = capabilities.viewList !== false;

    return (
        <div>
            {/* Upload Area */}
            {capUpload && (
            <div style={{ background: "var(--bg-surface)", borderRadius: 20, padding: 32, marginBottom: 32, border: "1px solid var(--glass-border)", boxShadow: "var(--glass-shadow)" }}>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                    <UploadCloud size={20} color="var(--brand-primary)" />
                    Upload Document for {entityLabel}
                </h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, marginBottom: 24 }}>
                    <div className="form-group">
                        <label className="form-label" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Document Classification</label>
                        <select 
                            className="input-premium"
                            style={{ width: "100%", height: 42, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}
                            value={uploadForm.docType} 
                            onChange={e => setUploadForm(f => ({ ...f, docType: e.target.value, docTypeOther: e.target.value === 'other' ? f.docTypeOther : '' }))}
                        >
                            <option value="">Select type…</option>
                            {resolvedDocTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    {uploadForm.docType === 'other' && (
                        <div className="form-group">
                            <label className="form-label" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Specify Document Type</label>
                            <input
                                className="input-premium"
                                style={{ width: "100%", height: 42, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}
                                placeholder="e.g. Emissions Certificate"
                                value={uploadForm.docTypeOther}
                                onChange={e => setUploadForm(f => ({ ...f, docTypeOther: e.target.value }))}
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Custom Label (Optional)</label>
                        <input 
                            className="input-premium"
                            style={{ width: "100%", height: 42, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}
                            placeholder="e.g. Q1 2025 Permit" 
                            value={uploadForm.label}
                            onChange={e => setUploadForm(f => ({ ...f, label: e.target.value }))} 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Official Expiry Date</label>
                        <input 
                            className="input-premium"
                            style={{ width: "100%", height: 42, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "0 12px", color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}
                            type="date" 
                            value={uploadForm.expiryDate}
                            onChange={e => setUploadForm(f => ({ ...f, expiryDate: e.target.value }))} 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Select File</label>
                        <label
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(false);
                                const file = e.dataTransfer?.files?.[0];
                                if (file) setSelectedFile(file);
                            }}
                            style={{
                                display: "block",
                                border: `1.5px dashed ${dragOver ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                                borderRadius: 10,
                                padding: "10px 12px",
                                background: dragOver ? "var(--brand-muted)" : "var(--surface-subtle)",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>
                                {selectedFile ? `Selected: ${selectedFile.name}` : "Drag & drop file here, or click to browse"}
                            </div>
                            <input 
                                type="file" 
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, width: "100%" }}
                                onChange={e => setSelectedFile(e.target.files[0])} 
                            />
                        </label>
                    </div>
                </div>

                {uploadMsg && (
                    <div style={{ 
                        padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 20,
                        background: uploadMsg.startsWith('OK:') ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
                        color: uploadMsg.startsWith('OK:') ? "#4ade80" : "#f87171",
                        display: "flex", alignItems: "center", gap: 10
                    }}>
                        {uploadMsg.startsWith("OK:") ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {uploadMsg}
                    </div>
                )}
                
                <Button variant="primary" style={{ height: 44, padding: "0 32px" }} onClick={handleUpload} disabled={uploading}>
                    {uploading ? 'Uploading…' : 'Upload document'}
                </Button>
            </div>
            )}

            {/* Document Table */}
            {capViewList && (
            <div style={{ background: "var(--bg-card)", borderRadius: 24, padding: 0, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 16 }}>Digitized Documents</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{entityDocs.length} record(s)</div>
                </div>
                
                <div className="table-container" style={{ margin: 0 }}>
                    <table className="table-modern" style={{ border: "none" }}>
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 24 }}>Document Label</th>
                                <th>Classification</th>
                                <th>Expiry Status</th>
                                <th style={{ textAlign: "right", paddingRight: 24 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entityDocs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: "center", padding: "80px 0", color: "var(--text-dim)" }}>
                                        <div style={{ marginBottom: 16 }}><FileText size={48} opacity={0.2} /></div>
                                        <div style={{ fontWeight: 600 }}>No documents found for this profile.</div>
                                    </td>
                                </tr>
                            ) : (
                                entityDocs.map(doc => (
                                    <tr key={doc.id} className="hover-row">
                                        <td style={{ paddingLeft: 24 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)" }}>
                                                    {doc.mimeType?.includes('pdf') ? <FileText size={18} /> : <Image size={18} />}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14 }}>{doc.label}</div>
                                                    <div style={{ fontSize: 11, color: "var(--text-dim)", textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 200 }}>{doc.filename}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700 }}>
                                                {resolvedDocTypes.find(t => t.value === doc.docType)?.label || doc.docType}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge status={doc.isExpired ? 'Overdue' : (doc.daysUntilExpiry <= 30 ? 'Pending' : 'Paid')} text={expiryLabel(doc)} />
                                        </td>
                                        <td style={{ textAlign: "right", paddingRight: 24 }}>
                                            <TableRowActions
                                                ariaLabel={`Actions for ${doc.label || doc.filename}`}
                                                items={[
                                                    ...(capOpen ? [{
                                                        id: "view",
                                                        label: "Open / Download",
                                                        icon: Eye,
                                                        onClick: () => window.open(doc.url, "_blank", "noopener,noreferrer"),
                                                    }] : []),
                                                    ...(capDelete ? [{
                                                        id: "delete",
                                                        label: "Remove Permanently",
                                                        icon: Trash2,
                                                        danger: true,
                                                        onClick: () => deleteDocumentById(doc.id, setDocuments),
                                                    }] : []),
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
        </div>
    );
}
