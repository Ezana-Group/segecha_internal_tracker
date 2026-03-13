'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { TableSearch, SortableTh, sortCompare, ClearFiltersButton } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function TransactionsPage() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
    const [matchModal, setMatchModal] = useState<any>(null)
    const [matchType, setMatchType] = useState<'invoice' | 'payroll'>('invoice')

    const loadData = async () => {
        setLoading(true)
        const [
            { data: txns },
            { data: invoices },
            { data: payroll },
            { data: drivers }
        ] = await Promise.all([
            supabase.from('mpesa_transactions').select('*').order('createdAt', { ascending: false }),
            supabase.from('invoices').select('id, client, amount, status'),
            supabase.from('payroll').select('*'),
            supabase.from('drivers').select('id, name')
        ])
        setData({
            transactions: txns || [],
            invoices: invoices || [],
            payroll: payroll || [],
            drivers: drivers || []
        })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading M-Pesa transactions...</div></AppLayout>

    const q = searchQuery.trim().toLowerCase()
    const filtered = data.transactions.filter((t: any) => {
        if (!q) return true
        const phone = (t.phone || '').toLowerCase()
        const receipt = (t.receiptNumber || '').toLowerCase()
        const ref = (t.accountReference || '').toLowerCase()
        return phone.includes(q) || receipt.includes(q) || ref.includes(q)
    })
    const hasActiveFilters = searchQuery.trim() !== ''
    const clearFilters = () => setSearchQuery('')

    const getSortVal = (t: any, key: string) => {
        switch (key) {
            case 'createdAt': return t.createdAt || ''
            case 'amount': return Number(t.amount) || 0
            case 'phone': return (t.phone || '').toString()
            case 'receiptNumber': return (t.receiptNumber || '').toString()
            case 'status': return (t.status || '').toString()
            default: return ''
        }
    }
    const handleSort = (key: string) => setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))
    const sorted = [...filtered].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))

    const matchToInvoice = async (txId: string, invoiceId: string) => {
        const txn = data.transactions.find((t: any) => t.id === txId)
        const { error: err1 } = await supabase.from('mpesa_transactions').update({ invoiceId }).eq('id', txId)
        if (err1) return toast.error(err1.message)
        const { error: err2 } = await supabase.from('invoices').update({ status: 'Paid', mpesaRef: txn?.receiptNumber || null, paidDate: today() }).eq('id', invoiceId)
        if (err2) return toast.error(err2.message)
        toast.success('Transaction matched to invoice')
        setMatchModal(null)
        loadData()
    }

    const matchToPayroll = async (txId: string, payrollId: string) => {
        const txn = data.transactions.find((t: any) => t.id === txId)
        const { error: err1 } = await supabase.from('mpesa_transactions').update({ payrollId }).eq('id', txId)
        if (err1) return toast.error(err1.message)
        const { error: err2 } = await supabase.from('payroll').update({ status: 'Paid', mpesaRef: txn?.receiptNumber, paidDate: today() }).eq('id', payrollId)
        if (err2) return toast.error(err2.message)
        toast.success('Transaction matched to payroll')
        setMatchModal(null)
        loadData()
    }

    const requestRefund = async (txId: string) => {
        if (!confirm('Request refund (reversal) for this transaction? This will call the M-Pesa Reversal API.')) return
        try {
            const res = await fetch('/api/mpesa/reversal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: txId }) })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Reversal failed')
            toast.success('Reversal requested')
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Refund failed')
        }
    }

    const driverName = (driverId: string) => data.drivers.find((d: any) => d.id === driverId)?.name || '—'

    return (
        <AppLayout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={S.ph}>💳 M-Pesa Transactions</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search phone, receipt, reference..." />
                    <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
                </div>
            </div>
            <p style={{ fontSize: 13, color: S.kpi?.color, marginBottom: 16 }}>
                Payments received via STK Push (and B2C results) appear here. Match to an invoice or payroll to confirm payment; use Refund to reverse.
            </p>
            <div style={{ ...S.card(), overflowX: 'auto' as any }}>
                <table style={{ ...S.tbl, minWidth: 800 }}>
                    <thead>
                        <tr>
                            <SortableTh label="Date" sortKey="createdAt" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Receipt" sortKey="receiptNumber" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Phone" sortKey="phone" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Amount" sortKey="amount" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>Status</th>
                            <th style={S.th}>Matched to</th>
                            <th style={S.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: S.textDim }}>No M-Pesa transactions yet. They appear when customers pay via STK Push (callback from Safaricom).</td></tr>
                        ) : (
                            sorted.map((t: any) => (
                                <tr key={t.id}>
                                    <td style={S.td}>{t.createdAt ? new Date(t.createdAt).toLocaleString('en-KE') : '—'}</td>
                                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#10b981' }}>{t.receiptNumber || '—'}</td>
                                    <td style={S.td}>{t.phone || '—'}</td>
                                    <td style={{ ...S.td, fontWeight: 700, color: '#10b981' }}>{fmt(t.amount)}</td>
                                    <td style={S.td}><span style={S.badge(t.status)}>{t.status}</span></td>
                                    <td style={S.td}>
                                        {t.invoiceId ? <span style={{ color: '#38bdf8' }}>Invoice {t.invoiceId}</span> : t.payrollId ? <span style={{ color: '#f59e0b' }}>Payroll</span> : '—'}
                                    </td>
                                    <td style={S.td}>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {!t.invoiceId && !t.payrollId && t.status === 'completed' && (
                                                <>
                                                    <button style={S.btn('sm')} onClick={() => { setMatchModal({ txId: t.id, type: 'invoice' }); setMatchType('invoice') }}>Match invoice</button>
                                                    <button style={S.btn('sm')} onClick={() => { setMatchModal({ txId: t.id, type: 'payroll' }); setMatchType('payroll') }}>Match payroll</button>
                                                </>
                                            )}
                                            {t.status === 'completed' && (
                                                <button style={S.btn('del')} onClick={() => requestRefund(t.id)} title="Request M-Pesa reversal">Refund</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {matchModal && matchType === 'invoice' && (
                <div style={S.ovl} onClick={() => setMatchModal(null)}>
                    <div style={{ ...S.mbox, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div style={S.mtitle}>Match to invoice</div>
                        <p style={{ fontSize: 13, color: S.textDim, marginBottom: 12 }}>Select the invoice this payment is for. Invoice will be marked Paid.</p>
                        <select id="match-inv-select" style={{ ...S.inp, marginBottom: 16 }}>
                            <option value="">— Select invoice —</option>
                            {data.invoices.filter((i: any) => i.status !== 'Paid').map((i: any) => (
                                <option key={i.id} value={i.id}>{i.id} — {i.client} — {fmt(i.amount)}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button style={S.btn()} onClick={() => { const sel = (document.getElementById('match-inv-select') as HTMLSelectElement)?.value; if (sel) matchToInvoice(matchModal.txId, sel); }}>Match</button>
                            <button style={S.btn('ghost')} onClick={() => setMatchModal(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {matchModal && matchType === 'payroll' && (
                <div style={S.ovl} onClick={() => setMatchModal(null)}>
                    <div style={{ ...S.mbox, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div style={S.mtitle}>Match to payroll</div>
                        <p style={{ fontSize: 13, color: S.textDim, marginBottom: 12 }}>Select the payroll record this payment is for.</p>
                        <select id="match-pay-select" style={{ ...S.inp, marginBottom: 16 }}>
                            <option value="">— Select payroll —</option>
                            {data.payroll.filter((p: any) => p.status !== 'Paid').map((p: any) => (
                                <option key={p.id} value={p.id}>{driverName(p.driver)} — {p.month} — {fmt(+(p.baseSalary || 0) + +(p.allowance || 0) - +(p.deductions || 0))}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button style={S.btn()} onClick={() => { const sel = (document.getElementById('match-pay-select') as HTMLSelectElement)?.value; if (sel) matchToPayroll(matchModal.txId, sel); }}>Match</button>
                            <button style={S.btn('ghost')} onClick={() => setMatchModal(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    )
}
