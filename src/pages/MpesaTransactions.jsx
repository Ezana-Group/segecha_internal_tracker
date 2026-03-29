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
    FilterX
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { PageHeader } from '../components/PageHeader';
import { TableRowActions } from '../components/TableRowActions';
import { adminAuth } from '../utils/adminAuth';
import { PAYMENT_API, ADMIN_KEY } from '../utils/env';
import { fmt, fmtDate, uid } from '../utils/formatters';
import { CATS, TRUCK_TYPES } from '../constants/nav';


export function MpesaTransactions({ data, setData, isMobile, showToast }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [assigningTo, setAssigningTo] = useState(null); // { tx: object, type: 'invoice' | 'expense' }

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const token = adminAuth.getToken();
            const res = await fetch(`${PAYMENT_API}/api/admin/mpesa-transactions?adminKey=${ADMIN_KEY}`, {
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
                (tx.phone?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                (tx.checkout_request_id?.toLowerCase() || '').includes(searchQuery.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
            const matchesType = typeFilter === 'all' || tx.type === typeFilter;

            return matchesSearch && matchesStatus && matchesType;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [transactions, searchQuery, statusFilter, typeFilter]);

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
                    description: additionalData.description || `M-Pesa ${tx.type}: ${tx.mpesa_receipt}`
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
            
            showToast?.(`Linked to ${entityType} ${entityId || ''}`, 'success');
            setAssigningTo(null);
            fetchTransactions(); // Refresh
        } catch (err) {
            showToast?.(err.message || 'Failed to link transaction', 'error');
        }
    };


    const statusBadge = (status) => {
        switch(status) {
            case 'Completed': return <Badge status="Success" text="Completed" icon={CheckCircle2} />;
            case 'Pending': return <Badge status="Warning" text="Pending" icon={Clock} />;
            case 'Failed': return <Badge status="Error" text="Failed" icon={XCircle} />;
            case 'Cancelled': return <Badge status="Default" text="Cancelled" />;
            default: return <Badge status="Default" text={status} />;
        }
    };

    const typeBadge = (type) => {
        switch(type) {
            case 'stk_push': return <Badge status="Default" text="STK Push" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} />;
            case 'b2c': return <Badge status="Default" text="B2C Payout" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }} />;
            case 'b2b': return <Badge status="Default" text="B2B Transfer" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }} />;
            default: return <Badge status="Default" text={type} />;
        }
    };

    return (
        <div className="page-shell">
            <PageHeader 
                icon={Activity} 
                title="M-Pesa Transaction Tracker" 
                description="Monitor real-time payments, STK pushes, and link unassigned transactions."
                actions={
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchTransactions} disabled={loading}>
                        {loading ? 'Syncing...' : 'Refresh'}
                    </Button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>TOTAL VOLUME</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>KES {fmt(transactions.reduce((sum, tx) => sum + (tx.status === 'Completed' ? Number(tx.amount) : 0), 0))}</div>
                    <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>{transactions.filter(t => t.status === 'Completed').length} successful</div>
                </Card>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>PENDING PUSHES</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{transactions.filter(t => t.status === 'Pending').length}</div>
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Awaiting callback</div>
                </Card>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>FAILED TRANSACTIONS</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>{transactions.filter(t => t.status === 'Failed').length}</div>
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Insufficient funds / Cancelled</div>
                </Card>
                <Card style={{ padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', marginBottom: 4 }}>UNLINKED PAYMENTS</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{transactions.filter(t => t.status === 'Completed' && !t.invoice_id && !t.expense_id).length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Manual linking needed</div>
                </Card>
            </div>

            <Card style={{ padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-dim)' }} />
                        <input 
                            className="input-premium" 
                            style={{ paddingLeft: 40, width: '100%' }} 
                            placeholder="Search Receipt, Phone or Request ID..."
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
                    <select className="input-premium" style={{ width: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                        <option value="all">All Types</option>
                        <option value="stk_push">STK Push</option>
                        <option value="b2c">B2C Payout</option>
                        <option value="b2b">B2B Transfer</option>
                    </select>
                    {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                        <Button variant="ghost" icon={FilterX} onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTypeFilter('all'); }}>Clear</Button>
                    )}
                </div>
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>M-Pesa Receipt</th>
                                <th>Customer / Type</th>
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
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tx.id.slice(0, 8)}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{tx.mpesa_receipt || '---'}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tx.phone || 'N/A'}</div>
                                    </td>
                                    <td>
                                        <div style={{ marginBottom: 4 }}>{typeBadge(tx.type)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.checkout_request_id}</div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                        <span style={{ color: tx.type === 'stk_push' ? '#10b981' : '#ef4444' }}>
                                            {tx.type === 'stk_push' ? '+' : '-'} KES {fmt(tx.amount)}
                                        </span>
                                    </td>
                                    <td>{statusBadge(tx.status)}</td>
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
                                                { id: 'copy', label: 'Copy Receipt ID', icon: Copy, onClick: () => { navigator.clipboard.writeText(tx.mpesa_receipt); showToast?.('Copied', 'info'); } },
                                                { id: 'view', label: 'View Request Details', icon: ExternalLink, onClick: () => alert(JSON.stringify(tx, null, 2)) },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {assigningTo && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 450, padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ fontWeight: 900, fontSize: 18 }}>Link Transaction</div>
                            <Button variant="ghost" icon={X} onClick={() => setAssigningTo(null)} />
                        </div>
                        <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-surface)', borderRadius: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)' }}>TRANSACTION INFO</div>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>KES {fmt(assigningTo.tx.amount)} • {assigningTo.tx.mpesa_receipt || 'No Receipt'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{assigningTo.tx.phone}</div>
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
                                <input name="description" className="input-premium" style={{ width: '100%', marginBottom: 24 }} defaultValue={`M-Pesa ${assigningTo.tx.type}: ${assigningTo.tx.mpesa_receipt}`} />

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
