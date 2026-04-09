import React, { useState } from "react";
import { FileUp, AlertTriangle, CheckCircle, XCircle, Upload } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Badge } from "../components/Badge";
import { useNavigate } from "react-router-dom";

export const ImportUploadButton = ({ label = 'Import from Excel', runExcelImport, setImportSession, onNavigate }) => {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const handleFileObject = async (file) => {
        if (!file) return;
        setLoading(true); setErr('');
        try {
            const session = await runExcelImport(file);
            setImportSession(session);
            if (onNavigate) onNavigate();
        } catch (error) {
            setErr(error.message);
        }
        setLoading(false);
    };

    const handleFile = async (e) => {
        const file = e.target.files[0];
        await handleFileObject(file);
        e.target.value = '';
    };

    return (
        <div>
            <label style={{
                display: 'inline-flex', cursor: 'pointer', alignItems: 'center', gap: 8,
                background: dragOver ? '#ea580c' : 'var(--brand-primary)', color: 'white', padding: '10px 18px',
                borderRadius: 8, fontWeight: 600, fontSize: 13,
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)', transition: 'all 0.2s ease'
            }}
                onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={async (e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (loading) return;
                    await handleFileObject(e.dataTransfer?.files?.[0]);
                }}
            >
                {loading ? 'Parsing…' : label}
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} disabled={loading} />
            </label>
            {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontWeight: 600 }}>{err}</div>}
        </div>
    );
};

const HistoryView = ({ history, T, S, navigate }) => {
    const sTh = { padding: '12px 14px', borderBottom: `2px solid ${T?.border || 'var(--border-subtle)'}`, color: T?.textDim || 'var(--text-dim)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' };
    const sTd = { padding: '12px 14px', borderBottom: `1px solid ${T?.border || 'var(--border-subtle)'}`, color: T?.text || 'var(--text-secondary)', fontSize: 13 };

    return (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-main)' }}>
                            <th style={sTh}>Date & Time</th>
                            <th style={sTh}>File Name</th>
                            <th style={sTh}>Trips</th>
                            <th style={sTh}>Expenses</th>
                            <th style={sTh}>Maintenance</th>
                            <th style={sTh}>Total Rows</th>
                            <th style={{ ...sTh, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                                    No import history found.
                                </td>
                            </tr>
                        ) : (
                            history.map((h, i) => (
                                <tr key={i} className="hover-scale">
                                    <td style={sTd}>
                                        <div style={{ fontWeight: 700 }}>{new Date(h.timestamp).toLocaleDateString('en-KE')}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(h.timestamp).toLocaleTimeString('en-KE')}</div>
                                    </td>
                                    <td style={sTd}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.fileName}</div>
                                    </td>
                                    <td style={sTd}><Badge status="Completed" label={h.trips} /></td>
                                    <td style={sTd}><Badge status="Partial" label={h.expenses} /></td>
                                    <td style={sTd}><Badge status="Pending" label={h.maintenance} /></td>
                                    <td style={sTd}>
                                        <div style={{ fontWeight: 800 }}>{h.totalRows}</div>
                                    </td>
                                    <td style={{ ...sTd, textAlign: 'right' }}>
                                        <Button variant="ghost" size="sm" onClick={() => navigate('/journeys')}>View Journeys</Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export const ImportReview = ({ importSession, setImportSession, importHistory, runExcelImport, commitImport, data, dark, S, T }) => {
    const session = importSession;
    const [view, setView] = useState('new'); // 'new' or 'history'
    const [activeSheet, setActiveSheet] = useState('trips');
    const [showValidRows, setShowValidRows] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState('');
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadErr, setUploadErr] = useState('');
    const [uploadDragOver, setUploadDragOver] = useState(false);
    const navigate = useNavigate();

    const sTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 };
    const sTh = { padding: '12px 14px', borderBottom: `2px solid ${T?.border || 'var(--border-subtle)'}`, color: T?.textDim || 'var(--text-dim)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-subtle)', position: 'sticky', top: 0, zIndex: 1 };
    const sTd = { padding: '12px 14px', borderBottom: `1px solid ${T?.border || 'var(--border-subtle)'}`, color: T?.text || 'var(--text-secondary)' };

    const handleUploadFile = async (file) => {
        if (!file) return;
        setUploadLoading(true); setUploadErr('');
        try {
            const parsedSession = await runExcelImport(file);
            setImportSession(parsedSession);
        } catch (error) {
            setUploadErr(error.message);
        }
        setUploadLoading(false);
    };

    const handleUploadDrop = async (e) => {
        const file = e.target.files[0];
        await handleUploadFile(file);
        e.target.value = '';
    };

    // ── NO SESSION: Upload screen ──────────────────────────────────────────────
    if (!session) {
        return (
            <div className="page-shell">
                <PageHeader
                    icon={FileUp}
                    title="Import Data"
                    description="Upload Trucking_2025.xlsx (or CSV). Review validated rows before committing to your local workspace."
                    marginBottom={28}
                />

                {/* View toggle: New | History */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
                    {[
                        { id: 'new', label: 'New Import' },
                        { id: 'history', label: 'Import History' },
                    ].map((v) => (
                        <button
                            key={v.id}
                            onClick={() => setView(v.id)}
                            style={{
                                background: view === v.id ? 'var(--brand-primary)' : 'var(--bg-card)',
                                color: view === v.id ? '#fff' : 'var(--text-dim)',
                                padding: '8px 20px',
                                borderRadius: 20,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: view === v.id ? 'none' : '1px solid var(--border-subtle)',
                                boxShadow: view === v.id ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                {view === 'history' ? (
                    <HistoryView history={importHistory} T={T} S={S} navigate={navigate} />
                ) : (
                    <>
                        {/* Step indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36, overflowX: 'auto' }} className="hide-scrollbar">
                            {[
                                { num: 1, label: 'Upload', active: true },
                                { num: 2, label: 'Preview & Validate', active: false },
                                { num: 3, label: 'Fix Issues', active: false },
                                { num: 4, label: 'Import', active: false },
                                { num: 5, label: 'Results', active: false },
                            ].map((step, i) => (
                                <React.Fragment key={step.num}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: 13,
                                            background: step.active ? 'var(--brand-primary)' : 'var(--bg-card)',
                                            border: step.active ? 'none' : '1.5px solid var(--border-subtle)',
                                            color: step.active ? '#fff' : 'var(--text-dim)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12, fontWeight: 800,
                                        }}>
                                            {step.num}
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: step.active ? 800 : 600, color: step.active ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {step.label}
                                        </div>
                                    </div>
                                    {i < 4 && <div style={{ color: 'var(--border-subtle)', fontSize: 14, userSelect: 'none' }}>→</div>}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Upload drop zone */}
                        <Card style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '32px 24px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--brand-primary)15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--brand-primary)' }}>
                                    <Upload size={28} />
                                </div>
                                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Upload Excel or CSV</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
                                    Supports <strong>Trucking_2025.xlsx</strong> format, or any CSV with matching columns. Max 10 MB.
                                </p>

                                <label style={{
                                    display: 'block',
                                    border: uploadDragOver ? '2px dashed var(--brand-primary)' : '2px dashed var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    background: uploadDragOver ? 'var(--brand-muted)' : 'var(--surface-subtle)',
                                    padding: '40px 20px',
                                    cursor: uploadLoading ? 'wait' : 'pointer',
                                    transition: 'border-color 0.2s ease',
                                    marginBottom: 16,
                                }}
                                    onDragOver={(e) => { e.preventDefault(); if (!uploadLoading) setUploadDragOver(true); }}
                                    onDragLeave={() => setUploadDragOver(false)}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        setUploadDragOver(false);
                                        if (uploadLoading) return;
                                        await handleUploadFile(e.dataTransfer?.files?.[0]);
                                    }}
                                >
                                    {uploadLoading ? (
                                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Processing file…</div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 4, marginBottom: 14 }}>
                                                <div style={{ width: 10, height: 20, background: '#10b981', borderRadius: 3 }} />
                                                <div style={{ width: 10, height: 30, background: '#ef4444', borderRadius: 3 }} />
                                                <div style={{ width: 10, height: 14, background: '#3b82f6', borderRadius: 3 }} />
                                            </div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                Drop your file here
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                                or <span style={{ color: '#3b82f6', fontWeight: 600 }}>click to browse</span>
                                            </div>
                                            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleUploadDrop} disabled={uploadLoading} />
                                        </>
                                    )}
                                </label>
                                {uploadErr && (
                                    <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>{uploadErr}</div>
                                )}
                            </div>

                            {/* Expected format hint */}
                            <div style={{ padding: '20px 24px', background: 'rgba(59,130,246,0.04)', borderTop: '1px solid rgba(59,130,246,0.12)' }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Expected format — Trucking_2025.xlsx
                                </div>
                                <p style={{ fontSize: 12, color: '#1e40af', marginBottom: 14, lineHeight: 1.5 }}>
                                    Sheet named <code style={{ background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', color: '#2563eb' }}>Trips_2025</code> with headers on row 2. Required columns marked with *.
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {['Vehicle*', 'Date*', 'Origin*', 'Destination*', 'Gross Income*', 'Standard Distance', 'Fuel(L)', 'Fuel Price (Per Litre)', 'Fuel Cost', 'Driver Millage', 'Turn-Boy', 'Road Users fee', 'Other Expenses', 'Total Expense', 'Net Income', 'Money Deposited at Bank', 'Date Deposited', 'Deposit Received', 'Notes'].map(col => (
                                        <span key={col} style={{
                                            background: col.includes('*') ? 'rgba(59,130,246,0.1)' : 'transparent',
                                            color: col.includes('*') ? '#2563eb' : 'var(--text-dim)',
                                            fontSize: 11, fontWeight: col.includes('*') ? 700 : 500,
                                            padding: '3px 9px', borderRadius: 20,
                                        }}>
                                            {col}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </>
                )}
            </div>
        );
    }

    // ── SESSION EXISTS: Review screen ──────────────────────────────────────────
    const sheets = {
        trips:       { label: 'Trips',           data: session.sheets.trips },
        expenses:    { label: 'Fixed Expenses',   data: session.sheets.expenses },
        maintenance: { label: 'Maintenance',      data: session.sheets.maintenance },
    };

    const currentSheet = sheets[activeSheet].data;
    const errorRows    = currentSheet.errors;
    const validRows    = currentSheet.valid;
    const allRows      = [...errorRows, ...(showValidRows ? validRows : [])];

    const totalAccepted = Object.values(session.sheets).reduce((sum, sh) =>
        sum + [...sh.valid, ...sh.errors].filter(r => r.accepted).length, 0);
    const totalErrors   = Object.values(session.sheets).reduce((sum, sh) => sum + sh.errors.length, 0);
    const totalValid    = Object.values(session.sheets).reduce((sum, sh) => sum + sh.valid.length, 0);

    const rowMatchesId = (sheetKey, r, rowId) =>
        sheetKey === 'trips' ? r.journeyId === rowId : r.expenseId === rowId;

    const updateRow = (sheetKey, rowId, field, value) => {
        setImportSession((prev) => {
            const sheet = prev.sheets[sheetKey];
            const patchList = (listName) => {
                const list = sheet[listName];
                const idx = list.findIndex((r) => rowMatchesId(sheetKey, r, rowId));
                if (idx < 0) return list;
                let next = { ...list[idx], [field]: value, edited: true };
                const stillHasErrors = next.errors.filter((e) => {
                    if (e.field === 'Vehicle' && next.truck) return false;
                    if (e.field === 'Date' && next.date) return false;
                    if (e.field === 'Origin' && next.origin) return false;
                    if (e.field === 'Destination' && next.dest) return false;
                    if (e.field === 'Standard Distance' && next.distance > 0) return false;
                    if (e.field === 'Gross Income' && next.revenue > 0) return false;
                    if (e.field === 'Cost' && next.amount > 0) return false;
                    if (e.field === 'Date Undertaken' && next.date) return false;
                    if (e.field === 'Vehicle Reg' && next.truck) return false;
                    return true;
                });
                next = { ...next, errors: stillHasErrors };
                if (stillHasErrors.length === 0 && !next.accepted) next = { ...next, accepted: true };
                const out = [...list];
                out[idx] = next;
                return out;
            };
            return {
                ...prev,
                sheets: {
                    ...prev.sheets,
                    [sheetKey]: {
                        valid: patchList('valid'),
                        errors: patchList('errors'),
                    },
                },
            };
        });
    };

    const toggleAccept = (sheetKey, rowId, value) => {
        setImportSession((prev) => {
            const sheet = prev.sheets[sheetKey];
            const patchList = (listName) => {
                const list = sheet[listName];
                const idx = list.findIndex((r) => rowMatchesId(sheetKey, r, rowId));
                if (idx < 0) return list;
                const out = [...list];
                out[idx] = { ...list[idx], accepted: value };
                return out;
            };
            return {
                ...prev,
                sheets: {
                    ...prev.sheets,
                    [sheetKey]: {
                        valid: patchList('valid'),
                        errors: patchList('errors'),
                    },
                },
            };
        });
    };

    const acceptAll = (sheetKey) => {
        setImportSession((prev) => {
            const sheet = prev.sheets[sheetKey];
            return {
                ...prev,
                sheets: {
                    ...prev.sheets,
                    [sheetKey]: {
                        valid: sheet.valid.map((r) => ({ ...r, accepted: true })),
                        errors: sheet.errors.map((r) => ({ ...r, accepted: true })),
                    },
                },
            };
        });
    };

    const discardAll = (sheetKey) => {
        setImportSession((prev) => {
            const sheet = prev.sheets[sheetKey];
            return {
                ...prev,
                sheets: {
                    ...prev.sheets,
                    [sheetKey]: {
                        valid: sheet.valid.map((r) => ({ ...r, accepted: false })),
                        errors: sheet.errors.map((r) => ({ ...r, accepted: false })),
                    },
                },
            };
        });
    };

    const handleCommit = () => {
        if (!window.confirm(`Import ${totalAccepted} rows into the tracker? This cannot be undone.`)) return;
        setImporting(true);
        try {
            commitImport(session);
            setImportMsg(`OK: Imported ${totalAccepted} rows.`);
        } catch (err) {
            setImportMsg('❌ Import failed: ' + err.message);
        }
        setImporting(false);
    };

    const inputStyle = { width: '100%', height: 32, background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '0 8px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit' };
    const errorBorderStyle = '1px solid #ef4444';

    const TripRow = ({ row }) => {
        const hasError = row.errors.length > 0;
        return (
            <tr style={{ background: !row.accepted ? 'var(--bg-main)' : hasError ? 'rgba(239, 68, 68, 0.05)' : 'transparent', opacity: row.accepted ? 1 : 0.5 }}>
                <td style={{ ...sTd, fontSize: 11, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace", width: 50 }}>
                    {row._rowNum}
                    {row.edited && <span style={{ color: '#f59e0b', marginLeft: 4, fontSize: 10 }}>✎</span>}
                </td>
                <td style={{ ...sTd, width: 200 }}>
                    {row.errors.map((e, i) => <div key={i} style={{ fontSize: 10, color: '#ef4444', marginBottom: 2 }}><b>{e.field}:</b> {e.msg}</div>)}
                    {row.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: '#f59e0b', marginBottom: 2 }}><b>{w.field}:</b> {w.msg}</div>)}
                    {row.errors.length === 0 && row.warnings.length === 0 && <span style={{ fontSize: 10, color: '#22c55e' }}>Valid</span>}
                </td>
                <td style={sTd}>
                    <select style={{ ...inputStyle, border: row.errors.some(e=>e.field==='Vehicle') ? errorBorderStyle : inputStyle.border }}
                        value={row.truck || ''} onChange={e => updateRow(activeSheet, row.journeyId, 'truck', e.target.value)}>
                        <option value="">{row._rawVehicle || 'Select truck…'}</option>
                        {data?.trucks?.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                </td>
                <td style={sTd}>
                    <input type="date" style={{ ...inputStyle, border: row.errors.some(e=>e.field==='Date') ? errorBorderStyle : inputStyle.border }}
                        value={row.date || ''} onChange={e => updateRow(activeSheet, row.journeyId, 'date', e.target.value)} />
                </td>
                <td style={sTd}>
                    <input style={{ ...inputStyle, border: row.errors.some(e=>e.field==='Origin') ? errorBorderStyle : inputStyle.border }}
                        value={row.origin || ''} onChange={e => updateRow(activeSheet, row.journeyId, 'origin', e.target.value)} />
                </td>
                <td style={sTd}>
                    <input style={{ ...inputStyle, border: row.errors.some(e=>e.field==='Destination') ? errorBorderStyle : inputStyle.border }}
                        value={row.dest || ''} onChange={e => updateRow(activeSheet, row.journeyId, 'dest', e.target.value)} />
                </td>
                <td style={sTd}>
                    <input type="number" style={{ ...inputStyle, width: 80, border: row.errors.some(e=>e.field==='Standard Distance') ? errorBorderStyle : inputStyle.border }}
                        value={row.distance || ''} onChange={e => updateRow(activeSheet, row.journeyId, 'distance', +e.target.value)} />
                </td>
                <td style={sTd}>
                    <input type="number" style={{ ...inputStyle, width: 100, border: row.errors.some(e=>e.field==='Gross Income') ? errorBorderStyle : inputStyle.border }}
                        value={row.revenue || ''} onChange={e => updateRow(activeSheet, row.journeyId, 'revenue', +e.target.value)} />
                </td>
                <td style={{ ...sTd, fontSize: 11, color: 'var(--text-dim)' }}>
                    {row.hasFuel ? `${row.fuelLitres}L @ ${row.fuelPrice}` : '—'}
                </td>
                <td style={sTd}>
                    <select style={inputStyle} value={row.status} onChange={e => updateRow(activeSheet, row.journeyId, 'status', e.target.value)}>
                        {['Completed', 'In Transit', 'Loading', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                    </select>
                </td>
                <td style={{ ...sTd, textAlign: 'center' }}>
                    <Button variant={row.accepted ? 'success' : 'ghost'} size="sm" onClick={() => toggleAccept(activeSheet, row.journeyId, !row.accepted)}>
                        {row.accepted ? 'Accept' : 'Skipped'}
                    </Button>
                </td>
            </tr>
        );
    };

    const ExpenseRow = ({ row }) => {
        const hasError = row.errors.length > 0;
        return (
            <tr style={{ background: !row.accepted ? 'var(--bg-main)' : hasError ? 'rgba(239, 68, 68, 0.05)' : 'transparent', opacity: row.accepted ? 1 : 0.5 }}>
                <td style={{ ...sTd, fontSize: 11, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace", width: 50 }}>
                    {row._rowNum}
                    {row._monthName && <span style={{ color: '#3b82f6', marginLeft: 4 }}>{row._monthName}</span>}
                    {row.edited && <span style={{ color: '#f59e0b', marginLeft: 4, fontSize: 10 }}>✎</span>}
                </td>
                <td style={{ ...sTd, width: 200 }}>
                    {row.errors.map((e, i) => <div key={i} style={{ fontSize: 10, color: '#ef4444', marginBottom: 2 }}><b>{e.field}:</b> {e.msg}</div>)}
                    {row.errors.length === 0 && <span style={{ fontSize: 10, color: '#22c55e' }}>Valid</span>}
                </td>
                <td style={sTd}>
                    <select style={inputStyle} value={row.truck || ''} onChange={e => updateRow(activeSheet, row.expenseId, 'truck', e.target.value)}>
                        <option value="">{row._rawVehicle || 'Company-wide'}</option>
                        {data?.trucks?.map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                    </select>
                </td>
                <td style={sTd}>
                    <input type="date" style={{ ...inputStyle, border: row.errors.some(e=>e.field==='Date Undertaken'||e.field==='Date') ? errorBorderStyle : inputStyle.border }}
                        value={row.date || ''} onChange={e => updateRow(activeSheet, row.expenseId, 'date', e.target.value)} />
                </td>
                <td style={sTd}>
                    <input style={inputStyle} value={row.desc || ''} onChange={e => updateRow(activeSheet, row.expenseId, 'desc', e.target.value)} />
                </td>
                <td style={sTd}>
                    <span style={{ fontSize: 10, padding: '4px 8px', background: 'var(--brand-primary)15', color: 'var(--brand-primary)', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' }}>{row.cat}</span>
                </td>
                <td style={sTd}>
                    <input type="number" style={{ ...inputStyle, width: 100, fontFamily: "'DM Mono', monospace", border: row.errors.some(e=>e.field==='Cost') ? errorBorderStyle : inputStyle.border }}
                        value={row.amount || ''} onChange={e => updateRow(activeSheet, row.expenseId, 'amount', +e.target.value)} />
                </td>
                <td style={{ ...sTd, textAlign: 'center' }}>
                    <Button variant={row.accepted ? 'success' : 'ghost'} size="sm" onClick={() => toggleAccept(activeSheet, row.expenseId, !row.accepted)}>
                        {row.accepted ? 'Accept' : 'Skipped'}
                    </Button>
                </td>
            </tr>
        );
    };

    return (
        <div className="page-shell" style={{ paddingBottom: 100 }}>
            {/* Header */}
            <PageHeader
                icon={FileUp}
                title="Import Review"
                description={`${session.fileName} · parsed ${new Date(session.parsedAt).toLocaleTimeString('en-KE')}`}
                marginBottom={20}
                actions={
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <ImportUploadButton label="Re-import file" runExcelImport={runExcelImport} setImportSession={setImportSession} />
                        <Button variant="ghost" onClick={() => setImportSession(null)}>Clear session</Button>
                        <Button
                            variant="primary"
                            onClick={handleCommit}
                            disabled={importing || session.committed || totalAccepted === 0}
                        >
                            {session.committed ? `Imported ${totalAccepted} rows` : importing ? 'Importing…' : `Commit Import (${totalAccepted} rows)`}
                        </Button>
                    </div>
                }
            />

            {/* Import status message */}
            {importMsg && (
                <div style={{
                    background: importMsg.startsWith('OK:') ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                    border: `1px solid ${importMsg.startsWith('OK:') ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    marginBottom: 24,
                    fontSize: 13,
                    fontWeight: 600,
                    color: importMsg.startsWith('OK:') ? '#4ade80' : '#f87171',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    {importMsg}
                    {session.committed && (
                        <Button variant="ghost" size="sm" onClick={() => { navigate('/journeys'); setImportSession(null); }}>
                            View imported journeys →
                        </Button>
                    )}
                </div>
            )}

            {/* Summary chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total rows',       val: totalValid + totalErrors, color: '#3b82f6' },
                    { label: 'Ready to import',  val: totalValid,               color: '#10b981' },
                    { label: 'Rows with errors', val: totalErrors,              color: '#ef4444' },
                    { label: 'Will be imported', val: totalAccepted,            color: 'var(--brand-primary)' },
                ].map(k => (
                    <Card key={k.label} style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
                    </Card>
                ))}
            </div>

            {/* Sheet selector tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border-subtle)', marginBottom: 16, gap: 2 }}>
                {Object.entries(sheets).map(([key, sh]) => {
                    const errCount = sh.data.errors.length;
                    const valCount = sh.data.valid.length;
                    const accCount = [...sh.data.valid, ...sh.data.errors].filter(r => r.accepted).length;
                    const isActive = activeSheet === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveSheet(key)}
                            style={{
                                padding: '10px 18px',
                                border: 'none',
                                borderBottom: isActive ? '3px solid var(--brand-primary)' : '3px solid transparent',
                                background: 'none',
                                fontSize: 13,
                                cursor: 'pointer',
                                color: isActive ? 'var(--brand-primary)' : 'var(--text-dim)',
                                fontWeight: isActive ? 800 : 600,
                                marginBottom: -2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'color 0.15s, border-color 0.15s',
                            }}
                        >
                            {sh.label}
                            {errCount > 0 && (
                                <span style={{ fontSize: 10, padding: '2px 7px', background: '#ef4444', color: '#fff', borderRadius: 12, fontWeight: 800 }}>
                                    {errCount} err
                                </span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{accCount}/{valCount + errCount}</span>
                        </button>
                    );
                })}
            </div>

            {/* Row controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', marginBottom: 16, flexWrap: 'wrap' }}>
                <Button size="sm" variant="ghost" onClick={() => acceptAll(activeSheet)}>Accept all in this sheet</Button>
                <Button size="sm" variant="ghost" onClick={() => discardAll(activeSheet)}>Discard all</Button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 8, fontWeight: 600 }}>
                    <input type="checkbox" checked={showValidRows} onChange={e => setShowValidRows(e.target.checked)} />
                    Show valid rows ({validRows.length})
                </label>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
                    {errorRows.length} error row{errorRows.length !== 1 ? 's' : ''} shown
                    {showValidRows ? ` · ${validRows.length} valid rows shown` : ' · valid rows hidden'}
                </span>
            </div>

            {/* Preview table */}
            <Card style={{ overflow: 'hidden', padding: 0 }}>
                {allRows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
                        <CheckCircle size={40} style={{ margin: '0 auto 12px', color: '#22c55e', display: 'block' }} />
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>
                            {errorRows.length === 0 ? 'No errors in this sheet — all rows are valid.' : 'No rows match current filters.'}
                        </div>
                        {!showValidRows && validRows.length > 0 && (
                            <div style={{ fontSize: 13, marginTop: 8 }}>
                                {validRows.length} valid rows hidden — check "Show valid rows" to see them.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table style={{ ...sTable, minWidth: activeSheet === 'trips' ? 1100 : 800 }}>
                            <thead>
                                {activeSheet === 'trips' ? (
                                    <tr>
                                        {['Row', 'Validation', 'Truck', 'Date', 'Origin', 'Destination', 'Dist (km)', 'Rev (KES)', 'Fuel', 'Status', ''].map(h => (
                                            <th key={h} style={sTh}>{h}</th>
                                        ))}
                                    </tr>
                                ) : (
                                    <tr>
                                        {['Row', 'Validation', 'Truck', 'Date', 'Description', 'Category', 'Amount (KES)', ''].map(h => (
                                            <th key={h} style={sTh}>{h}</th>
                                        ))}
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {errorRows.map(row => activeSheet === 'trips'
                                    ? <TripRow key={row.journeyId} row={row} />
                                    : <ExpenseRow key={row.expenseId} row={row} />
                                )}
                                {showValidRows && errorRows.length > 0 && validRows.length > 0 && (
                                    <tr>
                                        <td colSpan={12} style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.08)', fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                                            {validRows.length} valid row{validRows.length !== 1 ? 's' : ''} — no errors
                                        </td>
                                    </tr>
                                )}
                                {showValidRows && validRows.map(row => activeSheet === 'trips'
                                    ? <TripRow key={row.journeyId} row={row} />
                                    : <ExpenseRow key={row.expenseId} row={row} />
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Sticky commit bar */}
            {!session.committed && totalAccepted > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: 'max(12px, env(safe-area-inset-bottom))',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(540px, calc(100vw - 16px))',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                    padding: '16px 20px',
                    zIndex: 100,
                    boxSizing: 'border-box',
                }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{totalAccepted} rows selected for import</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                            {[...session.sheets.trips.valid, ...session.sheets.trips.errors].filter(r=>r.accepted).length} journeys
                            {' · '}
                            {[...session.sheets.expenses.valid, ...session.sheets.expenses.errors].filter(r=>r.accepted).length} expenses
                            {' · '}
                            {[...session.sheets.maintenance.valid, ...session.sheets.maintenance.errors].filter(r=>r.accepted).length} maintenance
                        </div>
                    </div>
                    <Button variant="primary" style={{ marginLeft: 'auto', padding: '12px 24px', fontSize: 14 }} onClick={handleCommit} disabled={importing}>
                        {importing ? 'Importing…' : 'Confirm import →'}
                    </Button>
                </div>
            )}
        </div>
    );
};
