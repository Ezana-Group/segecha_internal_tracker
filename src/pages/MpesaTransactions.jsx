import React, { useState, useEffect, useMemo } from 'react';
import { 
    Activity, 
    Search, 
    ArrowUpRight, 
    ArrowDownLeft, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    Filter,
    FileText,
    Copy,
    ExternalLink,
    RefreshCw,
    Link,
    Trash2,
    DollarSign,
    Plus,
    X,
    FilterX,
    CreditCard,
    ArrowRightLeft,
    Wallet
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { PageHeader } from '../components/PageHeader';
import { TableRowActions } from '../components/TableRowActions';
import { adminAuth } from '../utils/adminAuth';
import { PAYMENT_API, ADMIN_KEY } from '../utils/env';
import { fmt, fmtDate, uid, today } from '../utils/formatters';
import { CATS, TRUCK_TYPES } from '../constants/nav';

export function MpesaTransactions({ data, setData, isMobile, showToast }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sourceTab, setSourceTab] = useState('all'); // 'all', 'mpesa', 'bank', 'manual'
    const [assigningTo, setAssigningTo] = useState(null); 
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualLoading, setManualLoading] = useState(false);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/mpesa-transactions`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error('Fetch failed');
            const result = await res.json();
            setTransactions(result.transactions || []);
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
            showToast?.('Failed to load transactions', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const matchesSearch = 
                (tx.mpesa_receipt?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (tx.receipt_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (tx.phone?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (tx.checkout_request_id?.toLowerCase() || '').includes(searchQuery.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
            const matchesSource = sourceTab === 'all' || tx.source === sourceTab;

            return matchesSearch && matchesStatus && matchesSource;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [transactions, searchQuery, statusFilter, sourceTab]);

    const handleAssign = async (tx, entityType, entityId, additionalData = {}) => {
        try {
            const token = adminAuth.getToken();
            const endpoint = entityType === 'invoice' 
                ? `${PAYMENT_API}/api/admin/mpesa-transactions/link`
                : `${PAYMENT_API}/api/admin/mpesa-transactions/assign-expense`;
            
            const body = entityType === 'invoice'
                ? { transactionId: tx.id, invoiceId: entityId }
                : { 
                    transactionId: tx.id, 
                    truckId: additionalData.truckId || '', 
                    category: additionalData.category || 'Other',
                    description: additionalData.description || `M-Pesa ${tx.type}: ${tx.mpesa_receipt || tx.receipt_number}`
                  };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Assignment failed');
            }
            
            showToast?.(`Linked successfully`, 'success');
            setAssigningTo(null);
            fetchTransactions(); 
        } catch (err) {
            showToast?.(err.message || 'Failed to link transaction', 'error');
        }
    };

    const handleManualEntry = async (formData) => {
        setManualLoading(true);
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/transactions/manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Manual entry failed');
            
            showToast?.('Transaction recorded', 'success');
            setShowManualModal(false);
            fetchTransactions();
        } catch (err) {
            showToast?.(err.message, 'error');
        } finally {
            setManualLoading(false);
        }
    };

    const statusBadge = (tx) => {
        const s = tx.status;
        switch(s) {
            case 'Completed': return <Badge status="Success" text="Completed" icon={CheckCircle2} />;
            case 'Pending': return <Badge status="Warning" text="Pending" icon={Clock} />;
            case 'Failed': return <Badge status="Error" text="Failed" icon={XCircle} />;
            default: return <Badge status="Default" text={s} />;
        }
    };

    const sourceBadge = (source) => {
        switch(source) {
            case 'mpesa': return <Badge status="Default" text="M-Pesa" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }} />;
            case 'bank': return <Badge status="Default" text="Bank" icon={CreditCard} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} />;
            case 'manual': return <Badge status="Default" text="Manual" icon={Plus} style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' }} />;
            default: return <Badge status="Default" text={source} />;
        }
    };

    return (
        <div className="page-shell">
            <PageHeader 
                icon={Activity} 
                title="Financial Transactions" 
                description="Monitor M-Pesa, Bank, and Manual transactions across all systems."
                actions={
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" icon={RefreshCw} onClick={fetchTransactions} disabled={loading}>
                            {loading ? 'Syncing...' : 'Refresh'}
                        </Button>
                        <Button variant="primary" icon={Plus} onClick={() => setShowManualModal(true)}>
                            Manual Entry
                        </Button>
                    </div>
                }
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
                {['all', 'mpesa', 'bank', 'manual'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setSourceTab(tab)}
                        style={{ 
                            padding: '12px 20px', 
                            background: 'none', 
                            border: 'none', 
                            borderBottom: sourceTab === tab ? '2px solid var(--brand-primary)' : '2px solid transparent',
                            color: sourceTab === tab ? 'var(--text-main)' : 'var(--text-dim)',
                            fontWeight: sourceTab === tab ? 800 : 500,
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}
                    >
                        {tab === 'all' ? 'All Transactions' : tab === 'mpesa' ? 'M-Pesa' : tab}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>TOTAL VOLUME</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>KES {fmt(transactions.reduce((sum, tx) => sum + (tx.status === 'Completed' ? Number(tx.amount) : 0), 0))}</div>
                    <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>{transactions.filter(t => t.status === 'Completed').length} successful</div>
                </Card>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>UNLINKED REVENUE</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{transactions.filter(t => t.status === 'Completed' && !t.invoice_id && !t.expense_id && (t.type === 'stk_push' || t.amount > 0)).length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Awaiting assignment</div>
                </Card>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>FAILED / ERROR</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>{transactions.filter(t => t.status === 'Failed').length}</div>
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Payment failures</div>
                </Card>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>PENDING PUSHES</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{transactions.filter(t => t.status === 'Pending').length}</div>
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Real-time callbacks</div>
                </Card>
            </div>

            <Card style={{ padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-dim)' }} />
                        <input 
                            className="input-premium" 
                            style={{ paddingLeft: 40, width: '100%' }} 
                            placeholder="Search Receipt, Ref, Phone or Request ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select className="input-premium" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="Completed">Completed</option>
                        <option value="Pending">Pending</option>
                        <option value="Failed">Failed</option>
                    </select>
                    {(searchQuery || statusFilter !== 'all') && (
                        <Button variant="ghost" icon={FilterX} onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>Clear Filters</Button>
                    )}
                </div>
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Date & Source</th>
                                <th>Reference / Entity</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th>Status</th>
                                <th>Linked To</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40 }}>Loading transactions...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>No transactions found</td></tr>
                            ) : filteredTransactions.map(tx => (
                                <tr key={tx.id}>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{fmtDate(tx.created_at)}</div>
                                        <div>{sourceBadge(tx.source)}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{tx.receipt_number || tx.mpesa_receipt || tx.id.slice(0, 10)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tx.phone || 'System Entry'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{tx.type}</div>
                                        {tx.checkout_request_id && <div style={{ fontSize: 9, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{tx.checkout_request_id}</div>}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                        <span style={{ color: (tx.type === 'stk_push' || tx.amount > 0) ? '#10b981' : '#ef4444' }}>
                                            {(tx.type === 'stk_push' || tx.amount > 0) ? '+' : '-'} KES {fmt(Math.abs(tx.amount))}
                                        </span>
                                    </td>
                                    <td>{statusBadge(tx)}</td>
                                    <td>
                                        {tx.invoice_id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-primary)', fontWeight: 700 }}>
                                                <FileText size={14} /> {tx.invoice_id}
                                            </div>
                                        ) : tx.expense_id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontWeight: 700 }}>
                                                <DollarSign size={14} /> {tx.expense_id}
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Unlinked</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <TableRowActions 
                                            items={[
                                                { id: 'link-inv', label: 'Link to Invoice', icon: Link, onClick: () => setAssigningTo({ tx, type: 'invoice' }) },
                                                { id: 'link-exp', label: 'Link to Expense', icon: Plus, onClick: () => setAssigningTo({ tx, type: 'expense' }) },
                                                { id: 'copy', label: 'Copy Ref', icon: Copy, onClick: () => { navigator.clipboard.writeText(tx.receipt_number || tx.id); showToast?.('Copied', 'info'); } },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Manual Entry Modal */}
            {showManualModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 500, padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ fontWeight: 900, fontSize: 18 }}>Record Manual Transaction</div>
                            <Button variant="ghost" icon={X} onClick={() => setShowManualModal(false)} />
                        </div>

                        <form onSubmit={e => {
                            e.preventDefault();
                            const fd = new FormData(e.target);
                            handleManualEntry({
                                type: fd.get('type'), // 'atm_withdrawal', 'transfer', etc
                                source: fd.get('source'), // 'bank', 'manual', 'mpesa'
                                amount: fd.get('type') === 'transfer' ? Math.abs(Number(fd.get('amount'))) : -Math.abs(Number(fd.get('amount'))),
                                receipt_number: fd.get('ref'),
                                truckId: fd.get('truckId'),
                                category: fd.get('category'),
                                description: fd.get('desc'),
                                invoiceId: fd.get('invoiceId')
                            });
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>SOURCE</label>
                                    <select name="source" className="input-premium" style={{ width: '100%' }} required>
                                        <option value="bank">Bank Account</option>
                                        <option value="mpesa">M-Pesa Business</option>
                                        <option value="manual">Cash / Petty</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>TYPE</label>
                                    <select name="type" className="input-premium" style={{ width: '100%' }} required>
                                        <option value="atm_withdrawal">ATM Withdrawal</option>
                                        <option value="transfer">Bank to M-Pesa</option>
                                        <option value="expense">Direct Expense</option>
                                        <option value="reconciliation">Reconciliation</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>AMOUNT (KES)</label>
                                    <input name="amount" type="number" className="input-premium" style={{ width: '100%' }} required placeholder="8000" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>REFERENCE #</label>
                                    <input name="ref" className="input-premium" style={{ width: '100%' }} placeholder="Ref or Card #" />
                                </div>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>LINK TO TRUCK (OPTIONAL)</label>
                                <select name="truckId" className="input-premium" style={{ width: '100%' }}>
                                    <option value="">No truck assignment</option>
                                    {(data.trucks || []).map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>CATEGORY</label>
                                    <select name="category" className="input-premium" style={{ width: '100%' }}>
                                        <option value="ATM withdrawal">ATM withdrawal</option>
                                        <option value="Bank to M-Pesa">Bank to M-Pesa</option>
                                        {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>INVOICE LINK (IF ANY)</label>
                                    <select name="invoiceId" className="input-premium" style={{ width: '100%' }}>
                                        <option value="">No invoice link</option>
                                        {(data.invoices || []).map(inv => <option key={inv.id} value={inv.id}>{inv.id}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>DESCRIPTION</label>
                                <textarea name="desc" className="input-premium" style={{ width: '100%', height: 60, padding: 12 }} placeholder="Additional notes..."></textarea>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <Button type="button" variant="ghost" style={{ flex: 1 }} onClick={() => setShowManualModal(false)}>Cancel</Button>
                                <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={manualLoading}>
                                    {manualLoading ? 'Recording...' : 'Record Transaction'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Linking Modal */}
            {assigningTo && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 450, padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ fontWeight: 900, fontSize: 18 }}>Link Transaction</div>
                            <Button variant="ghost" icon={X} onClick={() => setAssigningTo(null)} />
                        </div>
                        <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-surface)', borderRadius: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)' }}>TRANSACTION INFO</div>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>KES {fmt(Math.abs(assigningTo.tx.amount))} • {assigningTo.tx.mpesa_receipt || assigningTo.tx.receipt_number || 'No Ref'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{sourceBadge(assigningTo.tx.source)} • {assigningTo.tx.type}</div>
                        </div>

                        {assigningTo.type === 'invoice' ? (
                            <>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>SELECT INVOICE</label>
                                <select className="input-premium" style={{ width: '100%', marginBottom: 24 }} onChange={e => handleAssign(assigningTo.tx, 'invoice', e.target.value)}>
                                    <option value="">Select invoice...</option>
                                    {(data.invoices || []).map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.id} - {item.client} (KES {fmt(item.amount)})
                                        </option>
                                    ))}
                                </select>
                            </>
                        ) : (
                            <form onSubmit={e => {
                                e.preventDefault();
                                const fd = new FormData(e.target);
                                handleAssign(assigningTo.tx, 'expense', null, {
                                    truckId: fd.get('truckId'),
                                    category: fd.get('category'),
                                    description: fd.get('description')
                                });
                            }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>TRUCK</label>
                                <select name="truckId" className="input-premium" style={{ width: '100%', marginBottom: 16 }} required>
                                    <option value="">Select truck...</option>
                                    {(data.trucks || []).map(t => <option key={t.id} value={t.id}>{t.reg}</option>)}
                                </select>

                                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>CATEGORY</label>
                                <select name="category" className="input-premium" style={{ width: '100%', marginBottom: 16 }} required>
                                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>

                                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>DESCRIPTION</label>
                                <input name="description" className="input-premium" style={{ width: '100%', marginBottom: 24 }} defaultValue={`Linked ${assigningTo.tx.source}: ${assigningTo.tx.mpesa_receipt || assigningTo.tx.receipt_number}`} />

                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Button type="button" style={{ flex: 1 }} variant="ghost" onClick={() => setAssigningTo(null)}>Cancel</Button>
                                    <Button type="submit" style={{ flex: 1 }} variant="primary">Create Expense</Button>
                                </div>
                            </form>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}
