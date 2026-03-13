'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today, uid } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, SortableTh, sortCompare, DateRangeFilter, ClearFiltersButton } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

function InvoiceView({ inv, onClose, data, settings, onStkPush, stkPushing }: any) {
    const { S, dark } = useErpContext()
    const journey = data.journeys.find((j: any) => j.id === inv.journey)
    const paybill = settings?.paybill_display || settings?.till_display || '—'
    const accountPrefix = (settings?.account_prefix || 'INV').trim()
    const accountNumber = (accountPrefix && !String(inv.id).startsWith(accountPrefix)) ? `${accountPrefix}-${inv.id}` : inv.id
    const truck = journey ? data.trucks.find((t: any) => t.id === journey.truck) : null
    const driver = journey ? data.drivers.find((d: any) => d.id === journey.driver) : null
    const vat = Math.round(inv.amount * 0.16)
    const subtotal = inv.amount - vat

    return (
        <div style={S.ovl} onClick={onClose}>
            <div style={{ maxWidth: 720, width: "95vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ background: S.surface.split(' ')[0], color: S.text, padding: 40, borderRadius: 12, fontFamily: "Arial, sans-serif", minWidth: 0, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
                        <div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: "#e85d04" }}>INVOICE</div>
                            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{inv.id}</div>
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
                            <div style={{ fontWeight: 700, fontSize: 15, color: S.text }}>{inv.client}</div>
                            <div style={{ fontSize: 13, color: "#555" }}>📞 {inv.phone}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, color: "#666" }}>Date Issued: <b>{inv.issued}</b></div>
                            <div style={{ fontSize: 12, color: "#666" }}>Due Date: <b>{inv.due}</b></div>
                            <div style={{ marginTop: 8 }}>
                                <span style={{ background: inv.status === "Paid" ? "#d1fae5" : inv.status === "Overdue" ? "#fee2e2" : "#fef3c7", color: inv.status === "Paid" ? "#065f46" : inv.status === "Overdue" ? "#991b1b" : "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{inv.status}</span>
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
                                    <td style={{ padding: "12px 14px", fontSize: 13 }}>Freight Services — {journey.cargo}</td>
                                    <td style={{ padding: "12px 14px", fontSize: 13 }}>{journey.origin} → {journey.dest}</td>
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
                                    <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800 }}>KES {Number(inv.amount).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                    {inv.status === "Paid" && inv.mpesaRef && (
                        <div style={{ background: dark ? "#10b98120" : "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, color: "#065f46", fontSize: 13 }}>✅ Payment Received via M-Pesa</div>
                            <div style={{ fontSize: 12, color: "#047857" }}>Reference: {inv.mpesaRef} · Date: {inv.paidDate}</div>
                        </div>
                    )}
                    <div style={{ marginBottom: 16, padding: 14, background: dark ? "#ffffff08" : "#f8fafc", borderRadius: 8, border: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 11, color: S.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Pay via M-Pesa</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>Paybill: <span style={{ fontFamily: "monospace" }}>{paybill}</span></div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: S.text, marginTop: 4 }}>Account: <span style={{ fontFamily: "monospace" }}>{accountNumber}</span></div>
                        <div style={{ fontSize: 13, color: S.textDim, marginTop: 4 }}>Amount: KES {Number(inv.amount).toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: 11, color: S.textDim, textAlign: "center", borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
                        Payment via M-Pesa Paybill · Bank Transfer · Cheque · Thank you for your business!
                    </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                    {inv.status !== "Paid" && inv.phone && (
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

    const loadData = async () => {
        setLoading(true)
        const [{ data: invoices }, { data: trucks }, { data: journeys }, { data: drivers }, { data: settingsRows }] = await Promise.all([
            supabase.from('invoices').select('*').order('issued', { ascending: false }),
            supabase.from('trucks').select('*'),
            supabase.from('journeys').select('*'),
            supabase.from('drivers').select('*'),
            supabase.from('settings').select('key, value')
        ])
        const settingsMap: Record<string, string> = {}
        ;(settingsRows || []).forEach((r: any) => { settingsMap[r.key] = r.value ?? '' })
        setSettings(settingsMap)
        setData({ invoices: invoices || [], trucks: trucks || [], journeys: journeys || [], drivers: drivers || [] })
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
        // Clean empty strings to null for foreign keys
        if (!payload.journey) payload.journey = null
        if (!payload.id) {
            payload.id = "INV-" + Date.now().toString().slice(-6)
            const { error } = await supabase.from('invoices').insert(payload)
            if (error) return toast.error(error.message)
            toast.success("Invoice added")
        } else {
            const { error } = await supabase.from('invoices').update(payload).eq('id', payload.id)
            if (error) return toast.error(error.message)
            toast.success("Invoice updated")
        }
        closeModal()
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

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Invoices...</div></AppLayout>

    const invoicesPaid = data.invoices.filter((i: any) => i.status === "Paid").reduce((s: any, i: any) => s + +i.amount, 0)
    const q = searchQuery.trim().toLowerCase()
    const getRoute = (inv: any) => {
        const j = data.journeys.find((j: any) => j.id === inv.journey)
        return j ? `${j.origin}→${j.dest}` : ""
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
                            <SortableTh label="Invoice" sortKey="id" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Client" sortKey="client" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Route" sortKey="route" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Issued" sortKey="issued" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Due" sortKey="due" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Amount" sortKey="amount" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
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
                                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "#10b981" }}>{inv.mpesaRef || "—"}</td>
                                <td style={S.td}><span style={S.badge(inv.status)}>{inv.status}</span></td>
                                <td style={S.td}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button style={S.btn("sm")} onClick={() => setInvoicePreview(inv)}>View</button>
                                        {inv.status !== "Paid" && <button style={S.btn("green")} onClick={() => markInvoicePaid(inv.id)} >✓ Paid</button>}
                                        <button style={S.btn("sm")} onClick={() => openModal("invoice", inv)}>Edit</button>
                                        <button style={S.btn("del")} onClick={() => delInvoice(inv.id)}>✕</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {invoicePreview && <InvoiceView inv={invoicePreview} onClose={() => setInvoicePreview(null)} data={data} settings={settings} onStkPush={handleStkPush} stkPushing={stkPushing} />}
            {modal === "invoice" && (
                <ErpModal title={form.id ? "Edit Invoice" : "New Invoice"} onClose={closeModal} onSave={saveInvoice}>
                    <div style={S.fgg(2)}>
                        <F label="Client Name" k="client" full form={form} setForm={setForm} /><F label="Client Phone" k="phone" form={form} setForm={setForm} />
                        <F label="Linked Journey" k="journey" options={[{ v: "", l: "-- None --" }, ...data.journeys.map((j: any) => ({ v: j.id, l: `${j.origin}→${j.dest} (${j.date})` }))]} form={form} setForm={setForm} />
                        <F label="Amount (KES)" k="amount" type="number" form={form} setForm={setForm} /><F label="Date Issued" k="issued" type="date" form={form} setForm={setForm} />
                        <F label="Due Date" k="due" type="date" form={form} setForm={setForm} /><F label="Status" k="status" options={["Pending", "Paid", "Overdue"]} form={form} setForm={setForm} />
                        <F label="M-Pesa Ref" k="mpesaRef" placeholder="e.g. QJK1234567" form={form} setForm={setForm} /><F label="Date Paid" k="paidDate" type="date" form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
