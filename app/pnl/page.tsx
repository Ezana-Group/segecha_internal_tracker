'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, fmtN } from '@/lib/ErpContext'
import { CATS } from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'

export default function PNL() {
    const { S, dark } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            const [
                { data: journeys }, { data: fuel }, { data: expenses },
                { data: invoices }, { data: payroll }, { data: trucks }
            ] = await Promise.all([
                supabase.from('journeys').select('*'),
                supabase.from('fuel').select('*'),
                supabase.from('expenses').select('*'),
                supabase.from('invoices').select('*'),
                supabase.from('payroll').select('*'),
                supabase.from('trucks').select('*')
            ])
            setData({
                journeys: journeys || [],
                fuel: fuel || [],
                expenses: expenses || [],
                invoices: invoices || [],
                payroll: payroll || [],
                trucks: trucks || []
            })
            setLoading(false)
        }
        loadData()
    }, [])

    const truckStats = (id: string) => {
        if (!data) return { rev: 0, fuelCost: 0, exp: 0, profit: 0, kmPerL: 0 }
        const r = data.journeys.filter((j: any) => j.status === "Completed" && j.truck === id).reduce((s: any, j: any) => s + +(j.revenue || 0), 0)
        const fc = data.fuel.filter((f: any) => f.truck === id).reduce((s: any, f: any) => s + ((f.litres || 0) * (f.pricePerL || 0)), 0)
        const fl = data.fuel.filter((f: any) => f.truck === id).reduce((s: any, f: any) => s + +(f.litres || 0), 0)
        const fkm = data.fuel.filter((f: any) => f.truck === id).reduce((s: any, f: any) => s + +(f.odoEnd ? f.odoEnd - f.odoStart : 0), 0)
        const e = data.expenses.filter((e: any) => e.truck === id).reduce((s: any, ex: any) => s + +(ex.amount || 0), 0) + fc
        return { rev: r, fuelCost: fc, exp: e, profit: r - e, kmPerL: fl > 0 ? fkm / fl : 0 }
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading P&L Report...</div></AppLayout>

    const totalRevenue = data.journeys.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +(j.revenue || 0), 0)
    const totalFuelCost = data.fuel.reduce((s: any, f: any) => s + ((f.litres || 0) * (f.pricePerL || 0)), 0)
    const totalOtherExp = data.expenses.reduce((s: any, e: any) => s + +(e.amount || 0), 0)
    const totalExpenses = totalFuelCost + totalOtherExp
    const netProfit = totalRevenue - totalExpenses
    const invoicesPaid = data.invoices.filter((i: any) => i.status === "Paid").reduce((s: any, i: any) => s + +(i.amount || 0), 0)

    const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : "0"
    const catBreakdown = CATS.filter(c => c !== "Fuel").map(c => ({ cat: c, total: data.expenses.filter((e: any) => e.cat === c).reduce((s: any, e: any) => s + +(e.amount || 0), 0) })).filter(x => x.total > 0)
    const totalSalaries = data.payroll.filter((p: any) => p.status === "Paid").reduce((s: any, p: any) => s + +(p.baseSalary || 0) + +(p.allowance || 0) - +(p.deductions || 0), 0)

    const handlePrint = () => {
        const printContent = document.getElementById("pnl-print-area")
        if (!printContent) return
        const w = window.open("", "_blank")
        if (!w) return
        w.document.write(`<html><head><title>Segecha Group P&L Report</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111;}table{width:100%;border-collapse:collapse;}th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;}th{background:#f3f4f6;font-weight:700;}h1{color:#e85d04;}h2{color:#374151;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;}.total-row{background:#e85d04;color:#fff;font-weight:800;}.sub-header{background:#f9fafb;color:#374151;}</style></head><body>${printContent.innerHTML}</body></html>`)
        w.document.close()
        w.print()
    }

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div style={S.ph}>▣ P&L Report</div>
                <button style={S.btn("orange")} onClick={handlePrint}>🖨️ Print / Export PDF</button>
            </div>
            <div style={S.grid(3, 2, 1)}>
                {[
                    { l: "Gross Revenue", v: fmt(totalRevenue), c: "#10b981", s: `${data.journeys.filter((j: any) => j.status === "Completed").length} completed trips` },
                    { l: "Total Costs", v: fmt(totalExpenses), c: "#f59e0b", s: "Fuel + all operations" },
                    { l: "Net Profit / Loss", v: fmt(netProfit), c: netProfit >= 0 ? "#3b82f6" : "#ef4444", s: `${margin}% profit margin` },
                ].map((k, i) => <div key={i} style={{ ...S.card(k.c), padding: 24 }}><div style={S.kpi}>{k.l}</div><div style={{ ...S.val(k.c), fontSize: 30 }}>{k.v}</div><div style={{ ...S.sub, fontSize: 12, marginTop: 6 }}>{k.s}</div></div>)}
            </div>
            <div style={S.grid(2, 1, 1)}>
                <div style={S.card()}>
                    <div style={{ fontWeight: 700, color: S.mtitle.color, marginBottom: 16, fontSize: 14 }}>Per-Truck P&L</div>
                    <div style={{ overflowX: "auto" as any }}>
                        <table style={S.tbl}>
                            <thead><tr>{["Truck", "Revenue", "Fuel", "Other", "Net", "Margin", "km/L"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                            <tbody>
                                {data.trucks.map((t: any) => {
                                    const st = truckStats(t.id)
                                    const m = st.rev > 0 ? (st.profit / st.rev * 100).toFixed(1) : "0.0"
                                    return (
                                        <tr key={t.id}>
                                            <td style={{ ...S.td, fontWeight: 800, color: "#f97316" }}>{t.reg}</td>
                                            <td style={{ ...S.td, color: "#10b981", fontWeight: 700 }}>{fmt(st.rev)}</td>
                                            <td style={{ ...S.td, color: "#f97316" }}>{fmt(st.fuelCost)}</td>
                                            <td style={{ ...S.td, color: "#f59e0b" }}>{fmt(st.exp - st.fuelCost)}</td>
                                            <td style={{ ...S.td, color: st.profit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: 800 }}>{fmt(st.profit)}</td>
                                            <td style={{ ...S.td, color: +m >= 0 ? "#10b981" : "#ef4444" }}>{m}%</td>
                                            <td style={{ ...S.td, color: "#a78bfa" }}>{fmtN(st.kmPerL, 2)}</td>
                                        </tr>
                                    )
                                })}
                                <tr style={{ background: S.border }}>
                                    <td style={{ ...S.td, fontWeight: 800, color: S.mtitle.color }}>TOTAL</td>
                                    <td style={{ ...S.td, color: "#10b981", fontWeight: 800 }}>{fmt(totalRevenue)}</td>
                                    <td style={{ ...S.td, color: "#f97316", fontWeight: 800 }}>{fmt(totalFuelCost)}</td>
                                    <td style={{ ...S.td, color: "#f59e0b", fontWeight: 800 }}>{fmt(totalOtherExp)}</td>
                                    <td style={{ ...S.td, color: netProfit >= 0 ? "#3b82f6" : "#ef4444", fontWeight: 800 }}>{fmt(netProfit)}</td>
                                    <td style={{ ...S.td, fontWeight: 800, color: +margin >= 0 ? "#10b981" : "#ef4444" }}>{margin}%</td>
                                    <td style={S.td}>—</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={S.card()}>
                    <div style={{ fontWeight: 700, color: S.mtitle.color, marginBottom: 16, fontSize: 14 }}>Cost Breakdown</div>
                    {[{ cat: "Fuel", total: totalFuelCost }, ...catBreakdown, { cat: "Payroll Paid", total: totalSalaries }].map((e, i) => {
                        const colors = ["#f97316", "#f59e0b", "#a78bfa", "#10b981", "#3b82f6", "#f87171", "#34d399", "#fb923c"]
                        const c = colors[i % colors.length]
                        const pct = totalExpenses > 0 ? (e.total / totalExpenses * 100).toFixed(1) : "0.0"
                        return (
                            <div key={e.cat} style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                                    <span style={{ color: S.td.color }}>{e.cat}</span>
                                    <span style={{ color: c, fontWeight: 700 }}>{fmt(e.total)} <span style={{ color: S.kpi.color, fontWeight: 400 }}>({pct}%)</span></span>
                                </div>
                                <div style={S.bar()}><div style={S.barFill(+pct, c)} /></div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Printable P&L */}
            <div id="pnl-print-area" style={{ ...S.card("#10b981"), padding: 28, background: dark ? undefined : "#f0fdf4", border: dark ? undefined : "1px solid #bbf7d0" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#10b981", marginBottom: 4 }}>📋 Segecha Group — Profit & Loss Statement</div>
                <div style={{ fontSize: 12, color: S.kpi.color, marginBottom: 20 }}>Generated: {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
                    <div>
                        <div style={{ color: S.kpi.color, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Income</div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                            <span style={{ color: S.td.color }}>Freight Revenue</span>
                            <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(totalRevenue)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                            <span style={{ color: S.td.color }}>Invoices Collected (M-Pesa)</span>
                            <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(invoicesPaid)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 800, fontSize: 14 }}>
                            <span style={{ color: S.mtitle.color }}>Total Income</span><span style={{ color: "#10b981" }}>{fmt(totalRevenue)}</span>
                        </div>
                    </div>
                    <div>
                        <div style={{ color: S.kpi.color, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Expenditure</div>
                        {[{ l: "Fuel", v: totalFuelCost }, ...catBreakdown, { l: "Payroll (Paid)", v: totalSalaries }].map((e: any) => (
                            <div key={e.cat || e.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${S.border2}`, fontSize: 13 }}>
                                <span style={{ color: S.td.color }}>{e.cat || e.l}</span>
                                <span style={{ color: "#f59e0b", fontWeight: 600 }}>{fmt(e.total || e.v)}</span>
                            </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 800, fontSize: 14 }}>
                            <span style={{ color: S.mtitle.color }}>Total Expenses</span><span style={{ color: "#f59e0b" }}>{fmt(totalExpenses)}</span>
                        </div>
                    </div>
                </div>
                <div style={{ borderTop: "2px solid #10b981", marginTop: 20, paddingTop: 20, display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 800 }}>
                    <span style={{ color: S.mtitle.color }}>NET {netProfit >= 0 ? "PROFIT" : "LOSS"}</span>
                    <span style={{ color: netProfit >= 0 ? "#10b981" : "#ef4444" }}>{fmt(Math.abs(netProfit))}</span>
                </div>
            </div>
        </AppLayout>
    )
}
