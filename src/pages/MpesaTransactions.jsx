import React, { useState, useEffect } from 'react';
import { 
    Activity, 
    ArrowUpRight, 
    ArrowDownLeft, 
    Link as LinkIcon, 
    ExternalLink, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Search, 
    Filter,
    MoreVertical,
    Wallet,
    Truck,
    Receipt
} from 'lucide-react';

export function MpesaTransactions({ state, S, T }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignType, setAssignType] = useState('income'); // 'income' or 'expense'

    // Form states for assignment
    const [invoiceId, setInvoiceId] = useState('');
    const [truckId, setTruckId] = useState('');
    const [category, setCategory] = useState('Fuel');
    const [description, setDescription] = useState('');

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/mpesa-transactions', {
                headers: { 'x-admin-key': state.token || localStorage.getItem('segecha_admin_key') }
            });
            const data = await res.json();
            setTransactions(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        const endpoint = assignType === 'income' 
            ? '/api/admin/mpesa-transactions/link' 
            : '/api/admin/mpesa-transactions/assign-expense';
        
        const body = assignType === 'income' 
            ? { transactionId: selectedTx.id, invoiceId }
            : { transactionId: selectedTx.id, truckId, category, description };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-admin-key': state.token || localStorage.getItem('segecha_admin_key') 
                },
                body: JSON.stringify(body)
            });
            const result = await res.json();
            if (result.success) {
                state.showToast(`Transaction assigned as ${assignType}`, 'success');
                setShowAssignModal(false);
                fetchTransactions();
            } else {
                state.showToast(result.error || 'Assignment failed', 'error');
            }
        } catch (e) {
            state.showToast('Network error', 'error');
        }
    };

    const filtered = transactions.filter(tx => {
        const matchesFilter = filter === 'All' || tx.status === filter || tx.type === filter;
        const matchesSearch = 
            (tx.phone && tx.phone.includes(searchTerm)) || 
            (tx.receipt_number && tx.receipt_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (tx.checkout_request_id && tx.checkout_request_id.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'Failed': return <XCircle className="w-4 h-4 text-rose-500" />;
            default: return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-blue-500" />
                        M-Pesa Transaction Logs
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Monitor all incoming collections and outgoing disbursements</p>
                </div>
                <button 
                    onClick={fetchTransactions}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-slate-700"
                >
                    <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Total Collections (STK)</span>
                        <ArrowDownLeft className="text-emerald-500 w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {transactions.filter(t => t.type === 'STK_PUSH' && t.status === 'Success').length}
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Total Disbursements (B2C/B2B)</span>
                        <ArrowUpRight className="text-blue-500 w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {transactions.filter(t => ['B2C', 'B2B'].includes(t.type) && t.status === 'Success').length}
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Pending Requests</span>
                        <Clock className="text-amber-500 w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {transactions.filter(t => t.status === 'Pending').length}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="text"
                        placeholder="Search by phone, receipt, or request ID..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {['All', 'Success', 'Pending', 'Failed', 'STK_PUSH', 'B2C'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                filter === f 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                            }`}
                        >
                            {f.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/80">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Phone / Shortcode</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Receipt / ID</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filtered.length > 0 ? filtered.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${tx.type === 'STK_PUSH' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                {tx.type === 'STK_PUSH' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                            </div>
                                            <span className="text-white font-medium text-sm">{tx.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 text-sm">{tx.phone || '---'}</td>
                                    <td className="px-6 py-4">
                                        <span className="text-white font-semibold">
                                            {S.currency} {parseFloat(tx.amount).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-slate-300 text-sm font-mono">{tx.receipt_number || '---'}</span>
                                            <span className="text-slate-500 text-[10px] truncate max-w-[120px]">
                                                {tx.checkout_request_id || tx.merchant_request_id}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(tx.status)}
                                            <span className={`text-xs font-medium ${
                                                tx.status === 'Success' ? 'text-emerald-500' : 
                                                tx.status === 'Failed' ? 'text-rose-500' : 'text-amber-500'
                                            }`}>
                                                {tx.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {tx.status === 'Success' && (
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {tx.type === 'STK_PUSH' ? (
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedTx(tx);
                                                            setAssignType('income');
                                                            setShowAssignModal(true);
                                                        }}
                                                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-all"
                                                        title="Assign to Invoice"
                                                    >
                                                        <Receipt className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedTx(tx);
                                                            setAssignType('expense');
                                                            setShowAssignModal(true);
                                                        }}
                                                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-all"
                                                        title="Assign to Expense"
                                                    >
                                                        <Truck className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        No transactions found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
                        <div className="p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {assignType === 'income' ? <Receipt className="text-emerald-500" /> : <Truck className="text-blue-500" />}
                                {assignType === 'income' ? 'Assign to Income' : 'Assign to Expense'}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">
                                Link {S.currency} {selectedTx?.amount} ({selectedTx?.phone}) to the system.
                            </p>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {assignType === 'income' ? (
                                <div>
                                    <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Invoice ID</label>
                                    <select 
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                                        value={invoiceId}
                                        onChange={e => setInvoiceId(e.target.value)}
                                    >
                                        <option value="">Select Invoice...</option>
                                        {(state.invoices || []).filter(i => i.status !== 'Paid').map(inv => (
                                            <option key={inv.id} value={inv.id}>{inv.id} - {inv.customer_id} ({S.currency} {inv.amount})</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Vehicle / Truck</label>
                                        <select 
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
                                            value={truckId}
                                            onChange={e => setTruckId(e.target.value)}
                                        >
                                            <option value="">Select Vehicle...</option>
                                            {(state.trucks || []).map(t => (
                                                <option key={t.id} value={t.id}>{t.registration_number}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Category</label>
                                            <select 
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                            >
                                                <option value="Fuel">Fuel</option>
                                                <option value="Maintenance">Maintenance</option>
                                                <option value="Tolls">Tolls</option>
                                                <option value="Salary">Salary</option>
                                                <option value="Insurance">Insurance</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">Description</label>
                                            <input 
                                                type="text"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50"
                                                placeholder="Remarks..."
                                                value={description}
                                                onChange={e => setDescription(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-6 bg-slate-950/50 flex gap-3">
                            <button 
                                onClick={() => setShowAssignModal(false)}
                                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAssign}
                                className={`flex-1 px-4 py-2.5 rounded-xl transition-all font-bold ${
                                    assignType === 'income' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                            >
                                Confirm Assignment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
