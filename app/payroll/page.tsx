'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { ErpModal, F } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
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
        const { error } = await supabase.from('payroll').update({ status: "Paid", paidDate: today() }).eq('id', id)
        if (error) return toast.error(error.message)
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
    const monthPayroll = data.payroll.filter((p: any) => p.month === selMonth)
    const totalNet = monthPayroll.reduce((s: any, p: any) => s + +p.baseSalary + +p.allowance - +p.deductions, 0)

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={S.ph}>◑ Driver Payroll</div>
                <div style={{ display: "flex", gap: 10 }}>
                    <select style={{ ...S.inp, width: 180 }} value={selMonth} onChange={e => setSelMonth(e.target.value)}>
                        {months.map((m: any) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                    </select>
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
                    <thead><tr>{["Driver", "M-Pesa No.", "Base Salary", "Allowances", "Deductions", "Net Pay", "M-Pesa Ref", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {monthPayroll.map((p: any) => {
                            const drv = data.drivers.find((d: any) => d.id === p.driver)
                            const net = +p.baseSalary + +p.allowance - +p.deductions
                            return (
                                <tr key={p.id}>
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
