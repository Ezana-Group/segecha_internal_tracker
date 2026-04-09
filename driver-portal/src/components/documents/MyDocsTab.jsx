import React, { useState, useEffect, useCallback } from 'react';
import { COLORS, S } from '../../constants/theme';

import { API_URL } from '../../utils/api';


export const MyDocsTab = ({ token, portalPerm }) => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadForm, setUploadForm] = useState({ docType: '', label: '', expiryDate: '' });
    const [msg, setMsg] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const DOC_TYPES = [
        { v: 'psv_licence', l: 'PSV Driving Licence' },
        { v: 'medical_certificate', l: 'Medical Certificate' },
        { v: 'id_card', l: 'ID / Passport' },
    ];

    const fetchMyDocs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/documents/mine`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const d = await res.json();
            setDocs(d.documents || []);
        } catch {
            setDocs([]);
        }
        setLoading(false);
    }, [token]);

    useEffect(() => {
        fetchMyDocs();
    }, [fetchMyDocs]);

    const handleUpload = async (file) => {
        if (!uploadForm.docType) {
            setMsg('❌ Select document type first');
            return;
        }
        setUploading(true);
        setMsg('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('docType', uploadForm.docType);
            formData.append('label', uploadForm.label || file.name);
            if (uploadForm.expiryDate) formData.append('expiryDate', uploadForm.expiryDate);

            const res = await fetch(`${API_URL}/api/documents/driver-upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const result = await res.json();
            if (result.success) {
                setMsg('✅ Document uploaded successfully');
                setUploadForm({ docType: '', label: '', expiryDate: '' });
                fetchMyDocs();
            } else {
                setMsg('❌ ' + (result.error || 'Upload failed'));
            }
        } catch (err) {
            setMsg('❌ Connection error');
        }
        setUploading(false);
    };

    const expiryLabel = (doc) => {
        if (!doc.expiryDate) return { text: 'No expiry set', color: COLORS.textFaint };
        if (doc.isExpired) return { text: `EXPIRED (${Math.abs(doc.daysUntilExpiry)}d ago)`, color: COLORS.red };
        if (doc.daysUntilExpiry <= 30) return { text: `Expires in ${doc.daysUntilExpiry}d`, color: COLORS.yellow };
        return { text: `Valid until ${doc.expiryDate}`, color: COLORS.green };
    };

    return (
        <div style={S.content}>
            <div style={S.sectionTitle}>My Documents</div>
            {portalPerm.docsUploadSection !== false && (
                <div style={S.card()}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📤 Upload Personal Document</div>
                    {msg && <div style={msg.startsWith('✅') ? S.success() : S.errBox()}>{msg}</div>}

                    <label style={S.lbl}>Document Type</label>
                    <select style={S.inp} value={uploadForm.docType} onChange={(e) => setUploadForm((f) => ({ ...f, docType: e.target.value }))}>
                        <option value="">Select type…</option>
                        {DOC_TYPES.map((t) => (
                            <option key={t.v} value={t.v}>
                                {t.l}
                            </option>
                        ))}
                    </select>

                    <label style={S.lbl}>Expiry Date (if applicable)</label>
                    <input style={S.inp} type="date" value={uploadForm.expiryDate} onChange={(e) => setUploadForm((f) => ({ ...f, expiryDate: e.target.value }))} />

                    <div style={{ marginTop: 12, marginBottom: 12 }}>
                        <label
                            style={{
                                ...S.inp,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1.5px dashed ${dragOver ? COLORS.primary : COLORS.border}`,
                                background: dragOver ? COLORS.bg : S.inp.background,
                                cursor: uploading ? 'wait' : 'pointer',
                                minHeight: 42,
                            }}
                            onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(false);
                                const file = e.dataTransfer?.files?.[0];
                                if (file && !uploading) handleUpload(file);
                            }}
                        >
                            {uploading ? 'Uploading…' : 'Drag & drop file or click to choose'}
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                                onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
                                disabled={uploading}
                            />
                        </label>
                    </div>

                    <div style={{ fontSize: 11, color: COLORS.textFaint }}>Upload your PSV licence, medical certificate, or ID card for office records.</div>
                </div>
            )}

            {portalPerm.docsList !== false && (
                <>
                    <div style={S.sectionTitle}>Uploaded Files</div>
                    {loading && <div style={{ textAlign: 'center', padding: 20, color: COLORS.textFaint }}>Loading documents…</div>}
                    {!loading && docs.length === 0 && <div style={{ ...S.card(), textAlign: 'center', color: COLORS.textFaint, padding: 24 }}>No documents uploaded yet</div>}
                    {docs.map((doc) => {
                        const status = expiryLabel(doc);
                        const isVehicleDoc = doc.entityType === 'truck';
                        return (
                            <div key={doc.id} style={S.card()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: COLORS.text }}>{doc.label}</div>
                                        {isVehicleDoc && <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.accent, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>Assigned vehicle (office)</div>}
                                        <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 2 }}>
                                            {doc.filename} · {String(doc.docType || '').replace(/_/g, ' ')}
                                        </div>
                                        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: status.color, background: status.color + '15', display: 'inline-block', padding: '2px 8px', borderRadius: 4 }}>{status.text}</div>
                                    </div>
                                    {portalPerm.docsViewFile !== false && (
                                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ ...S.btn('sm'), textDecoration: 'none', background: COLORS.bg, color: COLORS.primary }}>
                                            👁 View
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};
