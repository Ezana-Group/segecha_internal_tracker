import { useState } from "react";
import { PAYMENT_API } from "../utils/env";

export const DOC_TYPES_TRUCK = [
    { value: 'insurance_lorry', label: 'Lorry Insurance Certificate' },
    { value: 'insurance_trailer', label: 'Trailer Insurance Certificate' },
    { value: 'comesa', label: 'COMESA Certificate' },
    { value: 'ntsa_inspection', label: 'NTSA Inspection Certificate' },
    { value: 'logbook', label: 'Vehicle Logbook / Title' },
    { value: 'overweight_permit', label: 'Overweight / Special Permit' },
    { value: 'customs', label: 'Customs / Border Document' },
    { value: 'other', label: 'Other Document' },
];

export const DOC_TYPES_DRIVER = [
    { value: 'psv_licence', label: 'PSV Driving Licence' },
    { value: 'medical_certificate', label: 'Medical Certificate' },
    { value: 'id_card', label: 'National ID / Passport' },
    { value: 'certificate_of_good_conduct', label: 'Certificate of Good Conduct' },
    { value: 'other', label: 'Other Document' },
];

export const DOC_TYPES_JOURNEY = [
    { value: 'delivery_note', label: 'Delivery Note / POD' },
    { value: 'loading_manifest', label: 'Loading Manifest' },
    { value: 'fuel_receipt', label: 'External Fuel Receipt' },
    { value: 'weighbridge_ticket', label: 'Weighbridge Ticket' },
    { value: 'customs_clearance', label: 'Customs Clearance' },
    { value: 'toll_receipt', label: 'Toll/Gate Receipt' },
    { value: 'other', label: 'Other Trip Document' },
];

export const uploadDocument = async (file, entityType, entityId, docType, label, expiryDate) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('adminKey', import.meta.env.VITE_ADMIN_KEY);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('docType', docType);
    formData.append('label', label);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    formData.append('uploadedBy', 'admin');
    const res = await fetch(`${PAYMENT_API}/api/documents/upload`, { method: 'POST', body: formData });
    return res.json();
};

export const deleteDocumentById = async (docId, setDocuments) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
        const res = await fetch(`${PAYMENT_API}/api/documents/${docId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminKey: import.meta.env.VITE_ADMIN_KEY }),
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
    const [uploadForm, setUploadForm] = useState({ docType: '', label: '', expiryDate: '' });
    const [uploadMsg, setUploadMsg] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const entityDocs = (documents || []).filter(d => d.entityType === entityType && d.entityId === entityId);

    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.docType) { setUploadMsg('❌ Select a document type and choose a file'); return; }
        setUploading(true); setUploadMsg('');
        const result = await uploadDocument(selectedFile, entityType, entityId, uploadForm.docType, uploadForm.label || selectedFile.name, uploadForm.expiryDate);
        if (result.success) {
            setDocuments(d => [...d, result.document]);
            setUploadMsg('OK: Document uploaded.');
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
                            onChange={e => setUploadForm(f => ({ ...f, docType: e.target.value }))}
                        >
                            <option value="">Select type…</option>
                            {(docTypes || []).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
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
                        <input 
                            type="file" 
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                            style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}
                            onChange={e => setSelectedFile(e.target.files[0])} 
                        />
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

            {/* Document Gallery */}
            {capViewList && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {entityDocs.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', background: "var(--bg-card)", borderRadius: 20, border: "1px dashed var(--border-subtle)" }}>
                        <FileText size={48} color="var(--text-dim)" style={{ opacity: 0.2, marginBottom: 16 }} />
                        <div style={{ color: "var(--text-dim)", fontWeight: 500 }}>No documents have been digitized for this profile.</div>
                    </div>
                ) : (
                    entityDocs.map(doc => (
                        <div key={doc.id} style={{ background: "var(--bg-card)", borderRadius: 16, padding: "16px 24px", border: "1px solid var(--border-subtle)", display: 'flex', alignItems: 'center', gap: 20, transition: "transform 0.2s ease" }} className="hover-scale">
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-surface)", display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--brand-primary)" }}>
                                {doc.mimeType?.includes('pdf') ? <FileText size={20} /> : <Image size={20} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{doc.label}</div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                    {(docTypes || []).find(t => t.value === doc.docType)?.label || doc.docType} · <span style={{ color: "var(--text-dim)" }}>{doc.filename}</span>
                                </div>
                                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                    <Badge status={doc.isExpired ? 'Overdue' : (doc.daysUntilExpiry <= 30 ? 'Pending' : 'Paid')} text={expiryLabel(doc)} />
                                </div>
                            </div>
                            {(capOpen || capDelete) && (
                            <TableRowActions
                                ariaLabel={`Document ${doc.label || doc.filename}`}
                                items={[
                                    ...(capOpen
                                        ? [
                                              {
                                                  id: "view",
                                                  label: "View",
                                                  icon: Eye,
                                                  onClick: () => window.open(doc.url, "_blank", "noopener,noreferrer"),
                                              },
                                          ]
                                        : []),
                                    ...(capDelete
                                        ? [
                                              {
                                                  id: "delete",
                                                  label: "Delete",
                                                  icon: Trash2,
                                                  danger: true,
                                                  onClick: () => deleteDocumentById(doc.id, setDocuments),
                                              },
                                          ]
                                        : []),
                                ]}
                            />
                            )}
                        </div>
                    ))
                )}
            </div>
            )}
        </div>
    );
}
