'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today, uid } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, SortableTh, sortCompare, DateRangeFilter, ClearFiltersButton } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

function InvoiceView({ inv, onClose, data, settings, onStkPush, stkPushing, totalPaid, paymentsList }: any) {
    const { S, dark } = useErpContext()
    if (!inv || !data) return null
    const journeyRef = inv.journey ?? inv.journey_id
    const journeys = data.journeys ?? []
    const journey = journeyRef ? journeys.find((j: any) => j.id === journeyRef) : null
    const paybill = settings?.paybill_display || settings?.till_display || '—'
    const accountPrefix = (settings?.account_prefix || 'INV').trim()
    const accountNumber = (accountPrefix && !String(inv.id || '').startsWith(accountPrefix)) ? `${accountPrefix}-${inv.id}` : (inv.id ?? '')
    const trucks = data.trucks ?? []
    const drivers = data.drivers ?? []
    const truck = journey ? trucks.find((t: any) => t.id === (journey.truck ?? journey.truck_id)) : null
    const driver = journey ? drivers.find((d: any) => d.id === (journey.driver ?? journey.driver_id)) : null
    const amount = Number(inv.amount ?? 0)
    const vat = Math.round(amount * 0.16)
    const subtotal = amount - vat
    const paid = totalPaid ?? (inv.status === 'Paid' ? amount : 0)
    const isFullyPaid = paid >= amount
    const mpesaRef = inv.mpesaRef ?? inv.mpesa_ref
    const paidDate = inv.paidDate ?? inv.paid_date
    const surfaceBg = (S?.surface && typeof S.surface === 'string') ? S.surface.split(' ')[0] : (dark ? '#10141f' : '#ffffff')

    return (
        <div style={S.ovl} onClick={onClose}>
            <div style={{ maxWidth: 720, width: "95vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ background: surfaceBg, color: S.text, padding: 40, borderRadius: 12, fontFamily: "Arial, sans-serif", minWidth: 0, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
                        <div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: "#e85d04" }}>INVOICE</div>
                            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{inv.id ?? '—'}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800, fontSize: 18, color: S.text }}>Segecha Group Ltd</div>
                            <div style={{ fontSize: 12, color: "#666" }}>Nairobi, Kenya</div>
                            <div style={{ fontSize: 12, color: "#666" }}>Tel: +254 700 000 000</div>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28, background: dark ? "#ffffff0a" : "#f9f9f9", padding: 20, borderRadius: 8 }}>
                        <div>
                            <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Billed To</div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: S.text }}>{inv.client ?? '—'}</div>
                            <div style={{ fontSize: 13, color: "#555" }}>📞 {inv.phone ?? '—'}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, color: "#666" }}>Date Issued: <b>{inv.issued ?? '—'}</b></div>
                            <div style={{ fontSize: 12, color: "#666" }}>Due Date: <b>{inv.due ?? '—'}</b></div>
                            <div style={{ marginTop: 8 }}>
                                <span style={{ background: isFullyPaid ? "#d1fae5" : inv.status === "Overdue" ? "#fee2e2" : "#fef3c7", color: isFullyPaid ? "#065f46" : inv.status === "Overdue" ? "#991b1b" : "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{isFullyPaid ? 'Paid' : (inv.status ?? 'Pending')}</span>
                                {paymentsList?.length > 0 && !isFullyPaid && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Paid so far: KES {(paid || 0).toLocaleString()} of {amount.toLocaleString()}</div>}
                            </div>
                        </div>
                    </div>
                    {journey && (
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                            <thead>
                                <tr style={{ background: "#f97316", color: "#fff" }}>
                                    {["Description", "Route", "Truck", "Driver", "Amount"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700 }}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                                    <td style={{ padding: "12px 14px", fontSize: 13 }}>Freight Services — {journey.cargo ?? journey.cargo_type ?? '—'}</td>
                                    <td style={{ padding: "12px 14px", fontSize: 13 }}>{journey.origin ?? '—'} → {journey.dest ?? journey.destination ?? '—'}</td>
                                    <td style={{ padding: "12px 14px", fontSize: 13 }}>{truck?.reg || "—"}</td>
                                    <td style={{ padding: "12px 14px", fontSize: 13 }}>{driver?.name || "—"}</td>
                                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700 }}>KES {subtotal.toLocaleString()}</td>
                                </tr>
                                <tr style={{ background: dark ? "#ffffff08" : "#f9fafb" }}>
                                    <td colSpan={4} style={{ padding: "10px 14px", fontSize: 13, textAlign: "right", color: "#666" }}>VAT (16%)</td>
                                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>KES {vat.toLocaleString()}</td>
                                </tr>
                                <tr style={{ background: "#f97316", color: "#fff" }}>
                                    <td colSpan={4} style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800, textAlign: "right" }}>TOTAL DUE</td>
                                    <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800 }}>KES {amount.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                    {(isFullyPaid || (paymentsList?.length > 0)) && (
                        <div style={{ background: dark ? "#10b98120" : "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, color: "#065f46", fontSize: 13 }}>{isFullyPaid ? '✅ Payment complete' : '📋 Payments received'}</div>
                            {paymentsList?.length > 0 ? (
                                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: "#047857" }}>
                                    {paymentsList.map((p: any) => <li key={p.id}>KES {(p.amount || 0).toLocaleString()} · {p.paidDate} {p.type ? `(${p.type})` : ''} {p.mpesaRef ? `· ${p.mpesaRef}` : ''}</li>)}
                                </ul>
                            ) : mpesaRef && <div style={{ fontSize: 12, color: "#047857" }}>Reference: {mpesaRef} · Date: {paidDate ?? '—'}</div>}
                        </div>
                    )}
                    <div style={{ marginBottom: 16, padding: 14, background: dark ? "#ffffff08" : "#f8fafc", borderRadius: 8, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 11, color: S.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Pay via M-Pesa</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>Paybill: <span style={{ fontFamily: "monospace" }}>{paybill}</span></div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: S.text, marginTop: 4 }}>Account: <span style={{ fontFamily: "monospace" }}>{accountNumber}</span></div>
                        <div style={{ fontSize: 13, color: S.textDim, marginTop: 4 }}>Amount: KES {amount.toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: 11, color: S.textDim, textAlign: "center", borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
                        Payment via M-Pesa Paybill · Bank Transfer · Cheque · Thank you for your business!
                    </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                    {!isFullyPaid && (inv.phone ?? inv.phone_number) && (
                        <button style={S.btn("green")} onClick={() => onStkPush(inv)} disabled={stkPushing}>
                            {stkPushing ? 'Sending...' : '📱 Request payment (STK Push)'}
                        </button>
                    )}
                    <button style={S.btn()} onClick={() => window.print()}>🖨️ Print / Save PDF</button>
                    <button style={S.btn("ghost")} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}

export default function Invoices() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState("ALL")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'issued', dir: 'desc' })
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})
    const [invoicePreview, setInvoicePreview] = useState<any>(null)
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [stkPushing, setStkPushing] = useState(false)
    const [sendStkAfterSave, setSendStkAfterSave] = useState(false)
    const [paymentForm, setPaymentForm] = useState({ amount: '', paidDate: today(), mpesaRef: '', type: 'deposit' })

    const loadData = async () => {
        setLoading(true)
        const [{ data: invoices }, { data: trucks }, { data: journeys }, { data: drivers }, { data: settingsRows }] = await Promise.all([
            supabase.from('invoices').select('*').order('issued', { ascending: false }),
            supabase.from('trucks').select('*'),
            supabase.from('journeys').select('*'),
            supabase.from('drivers').select('*'),
            supabase.from('settings').select('key, value')
        ])
        let payments: any[] = []
        const { data: p, error: payErr } = await supabase.from('invoice_payments').select('*')
        if (!payErr) payments = p || []
        const settingsMap: Record<string, string> = {}
        ;(settingsRows || []).forEach((r: any) => { settingsMap[r.key] = r.value ?? '' })
        setData({ invoices: invoices || [], trucks: trucks || [], journeys: journeys || [], drivers: drivers || [], invoicePayments: payments })
        setLoading(false)
    }

    const handleStkPush = async (inv: any) => {
        setStkPushing(true)
        try {
            const res = await fetch('/api/mpesa/stk-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: inv.id }) })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Request failed')
            toast.success('Payment request sent to customer phone. They will receive an M-Pesa prompt.')
        } catch (e: any) {
            toast.error(e.message || 'STK Push failed')
        } finally {
            setStkPushing(false)
        }
    }

    useEffect(() => { loadData() }, [])

    const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }
    const closeModal = () => { setModal(null); setForm({}) }

    const saveInvoice = async () => {
        if (!form.client || !form.amount) return toast.error("Client Name and Amount are required")
        const payload = { ...form }
        if (!payload.journey) payload.journey = null
        let savedInv: any = null
        if (!payload.id) {
            payload.id = "INV-" + Date.now().toString().slice(-6)
            const { data, error } = await supabase.from('invoices').insert(payload).select().single()
            if (error) return toast.error(error.message)
            savedInv = data
            toast.success("Invoice added")
        } else {
            const { data, error } = await supabase.from('invoices').update(payload).eq('id', payload.id).select().single()
            if (error) return toast.error(error.message)
            savedInv = data
            toast.success("Invoice updated")
        }
        closeModal()
        setSendStkAfterSave(false)
        if (sendStkAfterSave && (form.phone || form.phone_number) && savedInv) {
            setStkPushing(true)
            try {
                const res = await fetch('/api/mpesa/stk-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: savedInv.id }) })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Request failed')
                toast.success('Payment request sent to customer phone.')
            } catch (e: any) {
                toast.error(e.message || 'STK Push failed')
            } finally {
                setStkPushing(false)
            }
        }
        loadData()
    }

    const delInvoice = async (id: string) => {
        if (!confirm("Are you sure you want to remove this invoice?")) return
        const { error } = await supabase.from('invoices').delete().eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Invoice removed")
        loadData()
    }

    const markInvoicePaid = async (id: string) => {
        if (!confirm("Mark this invoice as Paid?")) return
        const { error } = await supabase.from('invoices').update({ status: "Paid", paidDate: today() }).eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Invoice marked as Paid via Cash/Bank")
        loadData()
    }

    const paymentsForInvoice = (invoiceId: string) => (data?.invoicePayments || []).filter((p: any) => p.invoice_id === invoiceId)
    const totalPaidForInvoice = (inv: any) => {
        const payments = paymentsForInvoice(inv.id)
        if (payments.length === 0) return null
        return payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    }
    const invoiceStatusResolved = (inv: any) => {
        const totalPaid = totalPaidForInvoice(inv)
        if (totalPaid != null && totalPaid >= Number(inv.amount || 0)) return 'Paid'
        return inv.status || 'Pending'
    }

    const recordManualMpesaTransaction = async (opts: { receiptNumber: string; amount: number; invoiceId: string; phone?: string; transactionDate?: string }) => {
        const id = 'MANUAL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        await supabase.from('mpesa_transactions').insert({
            id,
            receiptNumber: opts.receiptNumber,
            phone: opts.phone || null,
            amount: opts.amount,
            transactionDate: opts.transactionDate || today(),
            accountReference: opts.invoiceId,
            invoiceId: opts.invoiceId,
            status: 'completed'
        })
    }

    const verifyAndMarkPaid = async (inv: any) => {
        if (!inv.mpesaRef && !inv.mpesa_ref) return toast.error('Enter M-Pesa reference first')
        const paidDateVal = today()
        const { error } = await supabase.from('invoices').update({
            status: 'Paid',
            paidDate: paidDateVal,
            mpesaRef: inv.mpesaRef || inv.mpesa_ref
        }).eq('id', inv.id)
        if (error) return toast.error(error.message)
        await recordManualMpesaTransaction({
            receiptNumber: inv.mpesaRef || inv.mpesa_ref,
            amount: Number(inv.amount || 0),
            invoiceId: inv.id,
            phone: inv.phone || inv.phone_number || undefined,
            transactionDate: paidDateVal
        })
        toast.success('Invoice marked as Paid with M-Pesa ref. Transaction recorded on M-Pesa page.')
        closeModal()
        loadData()
    }

    const addPayment = async (invoiceId: string) => {
        const amt = Number(paymentForm.amount)
        if (!amt || amt <= 0) return toast.error('Enter payment amount')
        const id = 'PAY-' + Date.now().toString().slice(-6)
        const paidDateVal = paymentForm.paidDate || today()
        const mpesaRefVal = paymentForm.mpesaRef?.trim() || null
        const { error } = await supabase.from('invoice_payments').insert({
            id, invoice_id: invoiceId, amount: amt, paidDate: paidDateVal,
            mpesaRef: mpesaRefVal, type: paymentForm.type || 'payment'
        })
        if (error) return toast.error(error.message)
        if (mpesaRefVal) {
            await recordManualMpesaTransaction({
                receiptNumber: mpesaRefVal,
                amount: amt,
                invoiceId,
                transactionDate: paidDateVal
            })
        }
        const inv = data?.invoices?.find((i: any) => i.id === invoiceId)
        const payments = [...(paymentsForInvoice(invoiceId) || []), { amount: amt, paidDate: paidDateVal, mpesaRef: mpesaRefVal }]
        const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
        if (inv && totalPaid >= Number(inv.amount || 0)) {
            await supabase.from('invoices').update({
                status: 'Paid',
                paidDate: paidDateVal,
                mpesaRef: mpesaRefVal || undefined
            }).eq('id', invoiceId)
        }
        setPaymentForm({ amount: '', paidDate: today(), mpesaRef: '', type: 'deposit' })
        toast.success('Payment recorded' + (mpesaRefVal ? ' (on M-Pesa page). ' : ' ') + (inv && totalPaid >= Number(inv.amount) ? 'Invoice marked Paid.' : ''))
        loadData()
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Invoices...</div></AppLayout>

    const invoicesPaid = data.invoices.filter((i: any) => i.status === "Paid").reduce((s: any, i: any) => s + +i.amount, 0)
    const q = searchQuery.trim().toLowerCase()
    const getRoute = (inv: any) => {
        const jId = inv.journey ?? inv.journey_id
        const j = jId ? data.journeys.find((j: any) => j.id === jId) : null
        return j ? `${j.origin ?? ''}→${j.dest ?? ''}` : ""
    }
    const filtered = data.invoices.filter((inv: any) => {
        if (filterStatus !== "ALL" && (inv.status || "") !== filterStatus) return false
        if (dateFrom && (inv.issued || "") < dateFrom) return false
        if (dateTo && (inv.issued || "") > dateTo) return false
        if (!q) return true
        const id = (inv.id || "").toLowerCase()
        const client = (inv.client || "").toLowerCase()
        const status = (inv.status || "").toLowerCase()
        const route = getRoute(inv).toLowerCase()
        return id.includes(q) || client.includes(q) || status.includes(q) || route.includes(q)
    })
    const hasActiveFilters = searchQuery.trim() !== "" || filterStatus !== "ALL" || dateFrom !== "" || dateTo !== ""
    const clearFilters = () => { setSearchQuery(""); setFilterStatus("ALL"); setDateFrom(""); setDateTo("") }
    const getSortVal = (inv: any, key: string) => {
        switch (key) {
            case 'id': return (inv.id || '').toString()
            case 'client': return (inv.client || '').toString()
            case 'route': return getRoute(inv)
            case 'issued': return inv.issued || ''
            case 'due': return inv.due || ''
            case 'amount': return Number(inv.amount) || 0
            case 'status': return (inv.status || '').toString()
            default: return ''
        }
    }
    const handleSort = (key: string) => setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))
    const sorted = [...filtered].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>◆ M-Pesa Invoices</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search invoice, client, status..." />
                    <select style={{ ...S.inp, width: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="ALL">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                    <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
                    <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
                    <button style={S.btn()} onClick={() => openModal("invoice", { issued: today(), due: today(), status: "Pending" })}>+ New Invoice</button>
                </div>
            </div>
            <div style={S.grid(4, 3, 1)}>
                {[
                    { l: "Total Invoiced", v: fmt(data.invoices.reduce((s: any, i: any) => s + +i.amount, 0)), c: "#38bdf8" },
                    { l: "Paid", v: fmt(invoicesPaid), c: "#10b981" },
                    { l: "Pending", v: fmt(data.invoices.filter((i: any) => i.status === "Pending").reduce((s: any, i: any) => s + +i.amount, 0)), c: "#f59e0b" },
                    { l: "Overdue", v: fmt(data.invoices.filter((i: any) => i.status === "Overdue").reduce((s: any, i: any) => s + +i.amount, 0)), c: "#ef4444" },
                ].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
            </div>
            <div style={{ ...S.card(), overflowX: "auto" as any }}>
                <table style={{ ...S.tbl, minWidth: 800 }}>
                    <thead>
                        <tr>
                            <SortableTh label="Invoice ID" sortKey="id" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Client" sortKey="client" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Route" sortKey="route" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Issued Date" sortKey="issued" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Due Date" sortKey="due" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Amount (KES)" sortKey="amount" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>M-Pesa Ref</th>
                            <SortableTh label="Status" sortKey="status" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((inv: any) => (
                            <tr key={inv.id}>
                                <td style={{ ...S.td, fontFamily: "monospace", color: "#38bdf8" }}>{inv.id}</td>
                                <td style={{ ...S.td, fontWeight: 700, color: S.mtitle.color }}>{inv.client}</td>
                                <td style={S.td}>{getRoute(inv) || "—"}</td>
                                <td style={S.td}>{inv.issued}</td>
                                <td style={S.td}>{inv.due}</td>
                                <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(inv.amount)}</td>
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "#10b981" }}>{(inv.mpesaRef ?? inv.mpesa_ref) || "—"}</td>
                                <td style={S.td}>
                                    <span style={S.badge(invoiceStatusResolved(inv))}>{invoiceStatusResolved(inv)}</span>
                                    {totalPaidForInvoice(inv) != null && totalPaidForInvoice(inv)! < Number(inv.amount) && (
                                        <span style={{ fontSize: 11, color: S.textDim, marginLeft: 6 }}>({(totalPaidForInvoice(inv) || 0).toLocaleString()} of {(inv.amount || 0).toLocaleString()})</span>
                                    )}
                                </td>
                                <td style={S.td}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button style={S.btn("sm")} onClick={() => setInvoicePreview(inv)}>View</button>
                                        {invoiceStatusResolved(inv) !== "Paid" && <button style={S.btn("green")} onClick={() => markInvoicePaid(inv.id)} >✓ Paid</button>}
                                        <button style={S.btn("sm")} onClick={() => openModal("invoice", inv)}>Edit</button>
                                        <button style={S.btn("del")} onClick={() => delInvoice(inv.id)}>✕</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {invoicePreview && <InvoiceView inv={invoicePreview} onClose={() => setInvoicePreview(null)} data={data} settings={settings} onStkPush={handleStkPush} stkPushing={stkPushing} totalPaid={totalPaidForInvoice(invoicePreview)} paymentsList={paymentsForInvoice(invoicePreview.id)} />}
            {modal === "invoice" && (
                <ErpModal title={form.id ? "Edit Invoice" : "New Invoice"} onClose={closeModal} onSave={saveInvoice}>
                    <div style={S.fgg(2)}>
                        <F label="Client Name" k="client" full form={form} setForm={setForm} />
                        <F label="Client phone (customer number, for M-Pesa STK Push)" k="phone" placeholder="e.g. 254712345678" full form={form} setForm={setForm} />
                        <F label="Linked Journey" k="journey" options={[{ v: "", l: "-- None --" }, ...data.journeys.map((j: any) => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} form={form} setForm={setForm} />
                        <F label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} /><F label="Date Issued" k="issued" type="date" form={form} setForm={setForm} />
                        <F label="Due Date" k="due" type="date" form={form} setForm={setForm} /><F label="Status" k="status" options={["Pending", "Paid", "Overdue"]} form={form} setForm={setForm} />
                        <F label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. QJK1234567 (or enter after customer pays)" form={form} setForm={setForm} /><F label="Date Paid" k="paidDate" type="date" form={form} setForm={setForm} />
                    </div>
                    {(form.phone || form.phone_number) && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                <input type="checkbox" checked={sendStkAfterSave} onChange={e => setSendStkAfterSave(e.target.checked)} />
                                <span>Send payment request (STK Push) to customer after save</span>
                            </label>
                        </div>
                    )}
                    {form.id && invoiceStatusResolved(form) !== 'Paid' && (form.mpesaRef || form.mpesa_ref) && (
                        <div style={{ marginTop: 12 }}>
                            <button type="button" style={S.btn('green')} onClick={() => verifyAndMarkPaid(form)}>✓ Verify & mark paid (M-Pesa ref)</button>
                        </div>
                    )}
                    {form.id && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${S.border}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: S.kpi.color, marginBottom: 8 }}>RECORD PAYMENT (deposit / partial / final)</div>
                            <p style={{ fontSize: 12, color: S.textDim, marginBottom: 10 }}>Invoice is marked Paid once total payments ≥ invoice amount.</p>
                            <div style={S.fgg(2)}>
                                <F label="Amount (KES)" k="amount" type="number" form={paymentForm} setForm={setPaymentForm} />
                                <F label="Date" k="paidDate" type="date" form={paymentForm} setForm={setPaymentForm} />
                                <F label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. QJK1234567" form={paymentForm} setForm={setPaymentForm} />
                                <div style={S.fg}>
                                    <label style={S.lbl}>Type</label>
                                    <select style={S.inp} value={paymentForm.type} onChange={e => setPaymentForm((f: any) => ({ ...f, type: e.target.value }))}>
                                        <option value="deposit">Deposit</option>
                                        <option value="partial">Partial</option>
                                        <option value="final">Final</option>
                                    </select>
                                </div>
                                <div style={{ ...S.fg, display: 'flex', alignItems: 'flex-end' }}>
                                    <button type="button" style={S.btn('green')} onClick={() => addPayment(form.id)}>Add payment</button>
                                </div>
                            </div>
                            {paymentsForInvoice(form.id).length > 0 && (
                                <div style={{ marginTop: 12, fontSize: 12 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Payments</div>
                                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                                        {paymentsForInvoice(form.id).map((p: any) => (
                                            <li key={p.id}>KES {(p.amount || 0).toLocaleString()} · {p.paidDate} {p.type ? `(${p.type})` : ''} {p.mpesaRef ? `· ${p.mpesaRef}` : ''}</li>
                                        ))}
                                    </ul>
                                    <div style={{ marginTop: 6, fontWeight: 700 }}>Total paid: KES {(totalPaidForInvoice(form) ?? 0).toLocaleString()} {invoiceStatusResolved(form) === 'Paid' ? '✓ Paid' : `of ${Number(form.amount || 0).toLocaleString()}`}</div>
                                </div>
                            )}
                        </div>
                    )}
                </ErpModal>
            )}
        </AppLayout>
    )
}
