'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, SortableTh, sortCompare, ClearFiltersButton } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import { notify, NOTIFY_MESSAGES } from '@/lib/notify'
import toast from 'react-hot-toast'

export default function Payroll() {
    const { S } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})

    const loadData = async () => {
        setLoading(true)
        const [{ data: payroll }, { data: drivers }] = await Promise.all([
            supabase.from('payroll').select('*').order('month', { ascending: false }),
            supabase.from('drivers').select('*')
        ])
        setData({ payroll: payroll || [], drivers: drivers || [] })
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }
    const closeModal = () => { setModal(null); setForm({}) }

    const savePayroll = async () => {
        if (!form.driver || !form.month || !form.baseSalary) return toast.error("Driver, Month, and Base Salary are required")
        const payload = { ...form }
        if (!payload.id) {
            payload.id = "PAY-" + Date.now().toString().slice(-6)
            const { error } = await supabase.from('payroll').insert(payload)
            if (error) return toast.error(error.message)
            toast.success("Payroll record added")
        } else {
            const { error } = await supabase.from('payroll').update(payload).eq('id', payload.id)
            if (error) return toast.error(error.message)
            toast.success("Payroll record updated")
        }
        closeModal()
        loadData()
    }

    const delPayroll = async (id: string) => {
        if (!confirm("Are you sure you want to remove this payroll record?")) return
        const { error } = await supabase.from('payroll').delete().eq('id', id)
        if (error) return toast.error(error.message)
        toast.success("Payroll record removed")
        loadData()
    }

    const markPayrollPaid = async (id: string) => {
        if (!confirm("Confirm payment sent via M-Pesa?")) return
        const payslip = data?.payroll?.find((p: any) => p.id === id)
        const driver = payslip ? data?.drivers?.find((d: any) => d.id === payslip.driver) : null
        const { error } = await supabase.from('payroll').update({ status: "Paid", paidDate: today() }).eq('id', id)
        if (error) return toast.error(error.message)
        if (driver?.mpesa) {
          const netPay = Number(payslip?.baseSalary || 0) + Number(payslip?.allowance || 0) - Number(payslip?.deductions || 0)
          notify(
            driver.mpesa,
            NOTIFY_MESSAGES.payroll_paid(driver.name || 'Driver', netPay.toLocaleString('en-KE'), payslip?.month || '', payslip?.mpesaRef || '—'),
            'payroll_processed',
            id,
            driver.name
          )
        }
        toast.success("Payroll marked as Paid")
        loadData()
    }

    const monthLabel = (m: string) => new Date(m + "-01").toLocaleDateString("en-KE", { month: "long", year: "numeric" })

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Payroll...</div></AppLayout>

    const months = [...new Set(data.payroll.map((p: any) => p.month))].sort().reverse()
    // Can't use hooks conditionally so we use a fallback if months is empty
    const firstMonth = months.length > 0 ? months[0] : new Date().toISOString().slice(0, 7)

    // We cannot declare useState after a conditional return, but we bypassed it here by putting it above. Wait, we violated hooks rule!
    return <PayrollContent S={S} data={data} months={months} firstMonth={firstMonth as string} monthLabel={monthLabel} openModal={openModal} closeModal={closeModal} savePayroll={savePayroll} delPayroll={delPayroll} markPayrollPaid={markPayrollPaid} form={form} setForm={setForm} modal={modal} />
}

function PayrollContent({ S, data, months, firstMonth, monthLabel, openModal, closeModal, savePayroll, delPayroll, markPayrollPaid, form, setForm, modal }: any) {
    const [selMonth, setSelMonth] = useState(firstMonth)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState("ALL")
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
    const monthPayroll = data.payroll.filter((p: any) => p.month === selMonth)
    const byStatus = filterStatus === "ALL" ? monthPayroll : monthPayroll.filter((p: any) => (p.status || "") === filterStatus)
    const q = searchQuery.trim().toLowerCase()
    const filteredPayroll = !q ? byStatus : byStatus.filter((p: any) => {
        const drv = data.drivers.find((d: any) => d.id === p.driver)
        const name = (drv?.name || p.driver || "").toLowerCase()
        const status = (p.status || "").toLowerCase()
        const mpesaRef = (p.mpesaRef || "").toLowerCase()
        const month = (p.month || "").toLowerCase()
        return name.includes(q) || status.includes(q) || mpesaRef.includes(q) || month.includes(q)
    })
    const hasActiveFilters = searchQuery.trim() !== "" || filterStatus !== "ALL"
    const clearFilters = () => { setSearchQuery(""); setFilterStatus("ALL") }
    const getSortVal = (p: any, key: string) => {
        const drv = data.drivers.find((d: any) => d.id === p.driver)
        switch (key) {
            case 'id': return (p.id || '').toString()
            case 'name': return (drv?.name || p.driver || '').toString()
            case 'baseSalary': return Number(p.baseSalary) || 0
            case 'allowance': return Number(p.allowance) || 0
            case 'deductions': return Number(p.deductions) || 0
            case 'net': return +p.baseSalary + +p.allowance - +p.deductions
            case 'status': return (p.status || '').toString()
            default: return ''
        }
    }
    const handleSort = (key: string) => setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
    const sortedPayroll = [...filteredPayroll].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))
    const totalNet = monthPayroll.reduce((s: any, p: any) => s + +p.baseSalary + +p.allowance - +p.deductions, 0)

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div style={S.ph}>◑ Driver Payroll</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search driver, status, month..." />
                    <select style={{ ...S.inp, width: 180 }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
                        {months.map((m: any) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                    </select>
                    <select style={{ ...S.inp, width: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="ALL">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                    </select>
                    <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
                    <button style={S.btn()} onClick={() => openModal("payroll", { month: selMonth, status: "Pending", baseSalary: 0, allowance: 0, deductions: 0 })}>+ Add Pay Record</button>
                </div>
            </div>
            <div style={S.grid(4, 3, 1)}>
                {[
                    { l: "Total Payroll", v: fmt(totalNet), c: "#f59e0b" },
                    { l: "Paid", v: fmt(monthPayroll.filter((p: any) => p.status === "Paid").reduce((s: any, p: any) => s + +p.baseSalary + +p.allowance - +p.deductions, 0)), c: "#10b981" },
                    { l: "Pending", v: fmt(monthPayroll.filter((p: any) => p.status === "Pending").reduce((s: any, p: any) => s + +p.baseSalary + +p.allowance - +p.deductions, 0)), c: "#ef4444" },
                    { l: "Drivers", v: monthPayroll.length, c: "#38bdf8" },
                ].map((k, i) => <div key={i} style={S.card(k.c)}><div style={S.kpi}>{k.l}</div><div style={S.val(k.c)}>{k.v}</div></div>)}
            </div>
            <div style={{ ...S.card(), overflowX: "auto" as any }}>
                <table style={{ ...S.tbl, minWidth: 800 }}>
                    <thead>
                        <tr>
                            <SortableTh label="Record ID" sortKey="id" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Driver" sortKey="name" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>M-Pesa No.</th>
                            <SortableTh label="Base Salary (KES)" sortKey="baseSalary" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Allowance (KES)" sortKey="allowance" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Deductions (KES)" sortKey="deductions" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <SortableTh label="Net Pay (KES)" sortKey="net" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}>M-Pesa Ref</th>
                            <SortableTh label="Status" sortKey="status" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                            <th style={S.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPayroll.map((p: any) => {
                            const drv = data.drivers.find((d: any) => d.id === p.driver)
                            const net = +p.baseSalary + +p.allowance - +p.deductions
                            return (
                                <tr key={p.id}>
                                    <td style={{ ...S.td, fontFamily: "monospace", color: S.mtitle.color }}>{p.id}</td>
                                    <td style={{ ...S.td, fontWeight: 700, color: S.mtitle.color }}>{drv?.name || p.driver}</td>
                                    <td style={{ ...S.td, fontFamily: "monospace", color: "#10b981", fontSize: 11 }}>💚 {drv?.mpesa || "—"}</td>
                                    <td style={S.td}>{fmt(p.baseSalary)}</td>
                                    <td style={{ ...S.td, color: "#10b981" }}>+{fmt(p.allowance)}</td>
                                    <td style={{ ...S.td, color: "#ef4444" }}>-{fmt(p.deductions)}</td>
                                    <td style={{ ...S.td, color: "#f59e0b", fontWeight: 800 }}>{fmt(net)}</td>
                                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: p.mpesaRef ? "#10b981" : S.kpi.color }}>{p.mpesaRef || "—"}</td>
                                    <td style={S.td}><span style={S.badge(p.status)}>{p.status}</span></td>
                                    <td style={S.td}>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            {p.status === "Pending" && <button style={S.btn("green")} onClick={() => markPayrollPaid(p.id)}>✓ Pay via M-Pesa</button>}
                                            <button style={S.btn("sm")} onClick={() => openModal("payroll", p)}>Edit</button>
                                            <button style={S.btn("del")} onClick={() => delPayroll(p.id)}>✕</button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {monthPayroll.some((p: any) => p.status === "Pending") && (
                    <div style={{ marginTop: 16, padding: 14, background: "#f9731612", border: "1px solid #f9731633", borderRadius: 8, fontSize: 13, color: "#f97316" }}>
                        💡 <b>M-Pesa Integration:</b> To send salaries via M-Pesa, use Safaricom Business Pay Bill or M-Pesa Business API. Each driver's M-Pesa number is shown above. Mark payments as paid after confirmation.
                    </div>
                )}
            </div>
            {modal === "payroll" && (
                <ErpModal title={form.id ? "Edit Pay Record" : "Add Pay Record"} onClose={closeModal} onSave={savePayroll}>
                    <div style={S.fgg(2)}>
                        <F label="Driver" k="driver" options={[{ v: "", l: "-- Select Driver --" }, ...data.drivers.map((d: any) => ({ v: d.id, l: d.name }))]} form={form} setForm={setForm} />
                        <F label="Month (YYYY-MM)" k="month" placeholder="2025-03" form={form} setForm={setForm} />
                        <F label="Base Salary (KES)" k="baseSalary" type="number" form={form} setForm={setForm} /><F label="Allowances (KES)" k="allowance" type="number" form={form} setForm={setForm} />
                        <F label="Deductions (KES)" k="deductions" type="number" form={form} setForm={setForm} /><F label="Status" k="status" options={["Pending", "Paid"]} form={form} setForm={setForm} />
                        <F label="M-Pesa Reference" k="mpesaRef" placeholder="e.g. PAY1234567" form={form} setForm={setForm} /><F label="Date Paid" k="paidDate" type="date" form={form} setForm={setForm} />
                    </div>
                </ErpModal>
            )}
        </AppLayout>
    )
}
