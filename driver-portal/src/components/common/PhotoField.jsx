import React, { useState } from 'react';
import { COLORS, S } from '../../constants/theme';
import { uploadFile } from '../../utils/api';

export function PhotoField({ label, hint, token, folder, filename, onUploaded }) {
    const [status, setStatus] = useState('idle'); // idle | uploading | done | error
    const [preview, setPreview] = useState('');
    const [errMsg, setErrMsg] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const handleFileUpload = async (file) => {
        if (!file) return;
        setStatus('uploading');
        setErrMsg('');
        try {
            const url = await uploadFile(file, folder, filename + '_' + Date.now(), token);
            setPreview(URL.createObjectURL(file));
            setStatus('done');
            onUploaded(url);
        } catch (err) {
            setStatus('error');
            setErrMsg(err.message);
        }
    };
    const handleFile = async (e) => {
        const file = e.target.files[0];
        await handleFileUpload(file);
    };

    const lbl = { fontSize: 11, color: COLORS.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, display: 'block' };

    return (
        <div style={{ marginBottom: 14 }}>
            <label style={lbl}>{label}</label>
            {hint && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 6 }}>{hint}</div>}
            {preview && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                    <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: `1px solid ${COLORS.border}` }} />
                    <button 
                        onClick={() => { setStatus('idle'); setPreview(''); onUploaded(''); }}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                    >
                        Remove
                    </button>
                </div>
            )}
            {status === 'done' ? (
                <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, marginBottom: 8 }}>✅ Photo uploaded</div>
            ) : (
                <label
                    style={{ display: 'block', background: dragOver ? '#eff6ff' : COLORS.bg, border: `1.5px dashed ${status === 'error' ? COLORS.red : dragOver ? COLORS.primary : COLORS.border}`, borderRadius: 10, padding: '12px', textAlign: 'center', cursor: 'pointer', fontSize: 13, color: status === 'uploading' ? COLORS.textFaint : COLORS.textDim }}
                    onDragOver={(e) => { e.preventDefault(); if (status !== 'uploading') setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={async (e) => {
                        e.preventDefault();
                        setDragOver(false);
                        if (status === 'uploading') return;
                        await handleFileUpload(e.dataTransfer?.files?.[0]);
                    }}
                >
                    {status === 'uploading' ? '⏳ Uploading…' : (dragOver ? '📥 Drop image to upload' : '📷 Tap or drag photo to upload')}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} disabled={status === 'uploading'} />
                </label>
            )}
            {errMsg && <div style={{ fontSize: 11, color: COLORS.red, marginTop: 4 }}>{errMsg}</div>}
        </div>
    );
}
