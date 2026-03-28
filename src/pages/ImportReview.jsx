import React, { useState } from "react";
import { FileUp, Database, Truck, Users, Briefcase, Fuel, Receipt, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/Badge";

export const ImportReview = ({ importResult, setImportResult, executeImport, commitImportResult, data, dark, S, T }) => {
    const [view, setView] = useState('new'); // 'new' or 'history'
    const [selectedEntityType, setSelectedEntityType] = useState(null);
    const [showValidRows, setShowValidRows] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadErr, setUploadErr] = useState('');
    const [dragging, setDragging] = useState(false);
    const navigate = useNavigate();

    const entities = [
        { id: 'journeys', label: 'Trips / Journeys', icon: Truck, desc: 'Import master trip logs (Trucking_2025.xlsx)' },
        { id: 'fleet',    label: 'Vehicles / Fleet', icon: Database, desc: 'Sync truck registrations, models, and years' },
        { id: 'drivers',  label: 'Drivers',         icon: Users,    desc: 'Update driver contact info and assignments' },
        { id: 'staff',    label: 'Staff Members',   icon: Briefcase, desc: 'Bulk add or sync office staff data' },
        { id: 'fuel',     label: 'Fuel Logs',       icon: Fuel,     desc: 'Import fuel consumption and price data' },
        { id: 'expenses', label: 'Expenses',        icon: Receipt,  desc: 'Import general or vehicle-specific expenses' },
    ];

    const handleFile = async (eOrFile) => {
        const file = eOrFile.target ? eOrFile.target.files[0] : eOrFile;
        if (!file || !selectedEntityType) return;
        setUploadLoading(true); setUploadErr('');
        try {
            await executeImport(file, selectedEntityType);
        } catch (error) {
            setUploadErr(error.message);
        }
        setUploadLoading(false);
        if (eOrFile.target) eOrFile.target.value = '';
    };

    const handleCommit = async () => {
        if (!window.confirm("Commit these changes? Existing records will be updated based on ID match.")) return;
        await commitImportResult();
    };

    const sTh = { padding: '12px 14px', borderBottom: `2px solid var(--border-subtle)`, color: 'var(--text-dim)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' };
    const sTd = { padding: '12px 14px', borderBottom: `1px solid var(--border-subtle)`, color: 'var(--text-secondary)', fontSize: 13 };

    if (!importResult) {
        return (
            <div className="page-shell" style={{ maxWidth: 900, padding: "40px 20px" }}>
                <PageHeader
                    icon={FileUp}
                    title="Universal Data Sync"
                    description="Upload Excel/CSV to update or add records. The system will automatically reconcile IDs."
                    marginBottom={40}
                />

                {!selectedEntityType ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                        {entities.map(e => (
                            <Card key={e.id} className="hover-scale" onClick={() => setSelectedEntityType(e.id)} style={{ cursor: 'pointer', padding: 24, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                <div style={{ background: 'var(--brand-primary)15', color: 'var(--brand-primary)', padding: 12, borderRadius: 12 }}>
                                    <e.icon size={24} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{e.label}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>{e.desc}</div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                        <Button variant="ghost" onClick={() => setSelectedEntityType(null)} style={{ marginBottom: 24 }}>← Back to Selection</Button>
                        <div style={{ textAlign: "center", marginBottom: 32 }}>
                            <h2 style={{ fontSize: 24, fontWeight: 800 }}>Import {entities.find(e => e.id === selectedEntityType).label}</h2>
                            <p style={{ color: "var(--text-dim)" }}>Drop your file below to start the validation process.</p>
                        </div>
                        <label 
                            style={{ 
                                display: "block", border: dragging ? "2px dashed var(--brand-primary)" : "2px dashed var(--border-medium)", 
                                borderRadius: 20, background: dragging ? "var(--brand-primary)05" : "var(--bg-card)", 
                                padding: "80px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s ease"
                            }} 
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                        >
                            <div style={{ color: 'var(--text-dim)', marginBottom: 16 }}><FileUp size={48} /></div>
                            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Click to Browse or Drag File</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Excel (.xlsx) or CSV supported</div>
                            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} />
                        </label>
                        {uploadErr && <div style={{ color: '#ef4444', textAlign: 'center', marginTop: 16, fontWeight: 600 }}>{uploadErr}</div>}
                    </div>
                )}
            </div>
        );
    }

    const { entityType, valid, errors, imported, fileName } = importResult;
    const allRows = [...errors, ...(showValidRows ? valid : [])];
    const entity = entities.find(e => e.id === entityType);

    return (
        <div style={{ paddingBottom: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <Button variant="ghost" onClick={() => setImportResult(null)} style={{ marginBottom: 12 }}>← Start Over</Button>
                    <h1 style={{ fontSize: 28, fontWeight: 800 }}>Review {entity.label}</h1>
                    <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{fileName} · {valid.length} valid · {errors.length} errors</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <Button variant="primary" onClick={handleCommit} disabled={imported.length === 0} style={{ padding: '12px 32px' }}>
                        Commit {imported.length} Records
                    </Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
                <Card style={{ padding: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>New Records</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}>{imported.filter(r => !r._isSync).length}</div>
                </Card>
                <Card style={{ padding: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Updates / Syncs</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6' }}>{imported.filter(r => r._isSync).length}</div>
                </Card>
                <Card style={{ padding: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Validation Errors</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#ef4444' }}>{errors.length}</div>
                </Card>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={showValidRows} onChange={e => setShowValidRows(e.target.checked)} />
                    Show valid rows
                </label>
            </div>

            <Card style={{ overflow: 'hidden' }}>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-main)' }}>
                                <th style={sTh}>Status</th>
                                <th style={sTh}>Details</th>
                                <th style={sTh}>Sync Mode</th>
                                <th style={sTh}>Errors</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allRows.map((row, i) => (
                                <tr key={i} style={{ background: row.errors.length > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                                    <td style={sTd}>
                                        {row.errors.length > 0 ? (
                                            <Badge status="Partial" label="Invalid" icon={AlertCircle} />
                                        ) : (
                                            <Badge status="Completed" label="Valid" icon={CheckCircle2} />
                                        )}
                                    </td>
                                    <td style={sTd}>
                                        <div style={{ fontWeight: 700 }}>{row.uId || row.reg || row.name || row.id}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{row.date || row.email || row.phone}</div>
                                    </td>
                                    <td style={sTd}>
                                        {row._isSync ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6', fontWeight: 700 }}>
                                                <Database size={14} /> Update Existing
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 700 }}>
                                                <Database size={14} /> New Record
                                            </div>
                                        )}
                                    </td>
                                    <td style={sTd}>
                                        {row.errors.map((e, ei) => (
                                            <div key={ei} style={{ color: '#ef4444', fontSize: 11, marginBottom: 2 }}>
                                                <b>{e.field}:</b> {e.msg}
                                            </div>
                                        ))}
                                    </td>
                                </tr>
                            ))}
                            {allRows.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
                                        No rows to display. {errors.length > 0 ? 'Toggle filters to see invalid rows.' : 'All rows are valid.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export const ImportUploadButton = ({ label = 'Import from Excel', runExcelImport, setImportSession, onNavigate }) => {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const handleFile = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true); setErr('');
        try {
            const session = await runExcelImport(file);
            setImportSession(session);
            if (onNavigate) onNavigate();
        } catch (error) {
            setErr(error.message);
        }
        setLoading(false);
        e.target.value = '';
    };

    return (
        <div>
            <label style={{ 
                display: 'inline-flex', cursor: 'pointer', alignItems: 'center', gap: 8,
                background: 'var(--brand-primary)', color: 'white', padding: '10px 18px',
                borderRadius: 8, fontWeight: 600, fontSize: 13,
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)', transition: 'all 0.2s ease'
             }}>
                {loading ? 'Parsing…' : label}
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} disabled={loading} />
            </label>
            {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6, fontWeight: 600 }}>{err}</div>}
        </div>
    );
};
