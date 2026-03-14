'use client'

import React from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, fmtN } from '@/lib/ErpContext'
import { SC, TYRE_WARN_KM } from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
    const { S } = useErpContext()
    const [data, setData] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        async function load() {
            setLoading(true)
            const tables = [
                () => supabase.from('trucks').select('*'),
                () => supabase.from('journeys').select('*'),
                () => supabase.from('fuel').select('*'),
                () => supabase.from('expenses').select('*'),
                () => supabase.from('invoices').select('*'),
                () => supabase.from('payroll').select('*'),
                () => supabase.from('drivers').select('*'),
                () => supabase.from('maintenance').select('*')
            ]
            const results = await Promise.allSettled(tables.map(fn => fn()))
            const pick = (i: number) => {
                const r = results[i]
                if (r.status === 'fulfilled' && r.value.data != null) return r.value.data
                return []
            }
            setData({
                trucks: pick(0), journeys: pick(1),
                fuel: pick(2), expenses: pick(3),
                invoices: pick(4), payroll: pick(5),
                drivers: pick(6), maintenance: pick(7)
            })
            setLoading(false)
        }
        load()
    }, [])

    const truckStats = (tid: string) => {
        const jrns = data?.journeys.filter((j: any) => j.truck === tid) || []
        const rev = jrns.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.revenue, 0)
        const fuelEntries = data?.fuel.filter((f: any) => f.truck === tid) || []
        const fuelCost = fuelEntries.reduce((s: any, f: any) => s + (f.litres * f.pricePerL), 0)
        const totalLitres = fuelEntries.reduce((s: any, f: any) => s + f.litres, 0)
        const totalKm = jrns.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.distance, 0)
        const kmPerL = totalLitres > 0 ? totalKm / totalLitres : 0
        const otherExp = data?.expenses.filter((e: any) => e.truck === tid).reduce((s: any, e: any) => s + +e.amount, 0) || 0
        const exp = fuelCost + otherExp
        return { rev, exp, profit: rev - exp, trips: jrns.length, totalKm, totalLitres, fuelCost, kmPerL }
    }

    const tyreStatus = (truck: any) => {
        const kmSinceChange = truck.odom - truck.tyreOdom
        const remaining = truck.tyreLimit - kmSinceChange
        const pct = (kmSinceChange / truck.tyreLimit) * 100
        const status = remaining <= 0 ? "Overdue" : remaining <= TYRE_WARN_KM ? "Due Soon" : "OK"
        return { kmSinceChange, remaining, pct, status }
    }

    if (loading || !data) return <AppLayout><div style={S.ph}>Loading Dashboard...</div></AppLayout>

    const totalRevenue = data.journeys.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.revenue, 0)
    const totalFuelCost = data.fuel.reduce((s: any, f: any) => s + (f.litres * f.pricePerL), 0)
    const totalOtherExp = data.expenses.reduce((s: any, e: any) => s + +e.amount, 0)
    const totalExpenses = totalFuelCost + totalOtherExp
    const netProfit = totalRevenue - totalExpenses
    const invoicesPaid = data.invoices.filter((i: any) => i.status === "Paid").reduce((s: any, i: any) => s + +i.amount, 0)
    const invoicesPending = data.invoices.filter((i: any) => i.status !== "Paid").reduce((s: any, i: any) => s + +i.amount, 0)
    const payrollPending = data.payroll.filter((p: any) => p.status === "Pending").reduce((s: any, p: any) => s + +p.baseSalary + +p.allowance - +p.deductions, 0)

    const tyreAlerts = data.trucks.filter((t: any) => { const ts = tyreStatus(t); return ts.status !== "OK"; })
    const overdueInv = data.invoices.filter((i: any) => i.status === "Overdue")
    const todayStr = new Date().toISOString().split('T')[0]
    const addMonths = (d: string, months: number) => { const x = new Date(d); x.setMonth(x.getMonth() + months); return x.toISOString().split('T')[0] }
    const maintenanceAlerts = (data.maintenance || []).filter((m: any) => {
        const t = data.trucks.find((x: any) => x.id === m.truck)
        const odom = t && typeof t.odom === 'number' ? t.odom : null
        let nextDueKm: number | null = null
        let nextDueDate: string | null = null
        if (m.intervalKm != null && m.lastDoneOdom != null) nextDueKm = Number(m.lastDoneOdom) + Number(m.intervalKm)
        if (m.intervalMonths != null && m.lastDoneDate) nextDueDate = addMonths(m.lastDoneDate, m.intervalMonths)
        if (nextDueKm != null && odom != null && odom >= nextDueKm) return true
        if (nextDueDate && todayStr >= nextDueDate) return true
        if (nextDueKm != null && odom != null && (nextDueKm - odom) <= 2000) return true
        if (nextDueDate) { const daysLeft = Math.floor((new Date(nextDueDate).getTime() - new Date(todayStr).getTime()) / (24 * 60 * 60 * 1000)); if (daysLeft <= 30) return true }
        return false
    })
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : 0
    const totalLitres = data.fuel.reduce((s: any, f: any) => s + f.litres, 0)
    const totalKm = data.journeys.filter((j: any) => j.status === "Completed").reduce((s: any, j: any) => s + +j.distance, 0)
    const overallKmPerL = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : 0

    return (
        <AppLayout>
            <div style={S.ph}>◈ Operations Dashboard <span style={S.pill()}>March 2025</span></div>

            {(tyreAlerts.length > 0 || overdueInv.length > 0 || maintenanceAlerts.length > 0) && (
                <div style={{ marginBottom: 20 }}>
                    {tyreAlerts.map((t: any) => {
                        const ts = tyreStatus(t)
                        return (
                            <div key={t.id} style={S.alertBox(ts.status === "Overdue" ? "#ef4444" : "#f97316")}>
                                <span style={{ fontSize: 18 }}>🔴</span>
                                <div>
                                    <div style={{ fontWeight: 700, color: S.mtitle.color, fontSize: 13 }}>Tyre Alert — {t.reg}</div>
                                    <div style={{ fontSize: 12, color: S.sub.color }}>
                                        {ts.status === "Overdue" ? `Tyres overdue by ${Math.abs(ts.remaining).toLocaleString()} km` : `Tyres due in ${ts.remaining.toLocaleString()} km`}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {maintenanceAlerts.map((m: any) => {
                        const t = data.trucks.find((x: any) => x.id === m.truck)
                        return (
                            <div key={m.id} style={S.alertBox('#f59e0b')}>
                                <span style={{ fontSize: 18 }}>🔧</span>
                                <div>
                                    <div style={{ fontWeight: 700, color: S.mtitle.color, fontSize: 13 }}>Maintenance — {t?.reg ?? m.truck}: {m.type}</div>
                                    <div style={{ fontSize: 12, color: S.sub.color }}>Due or due soon. <a href="/maintenance" style={{ color: '#f97316', fontWeight: 600 }}>Open Maintenance →</a></div>
                                </div>
                            </div>
                        )
                    })}
                    {overdueInv.map((i: any) => (
                        <div key={i.id} style={S.alertBox("#ef4444")}>
                            <span style={{ fontSize: 18 }}>💰</span>
                            <div>
                                <div style={{ fontWeight: 700, color: S.mtitle.color, fontSize: 13 }}>Overdue Invoice — {i.id}</div>
                                <div style={{ fontSize: 12, color: S.sub.color }}>{i.client} · {fmt(i.amount)} · Due {i.due}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={S.grid(4, 3, 1)}>
                {[
                    { l: "Net Profit", v: fmt(netProfit), c: netProfit >= 0 ? "#3b82f6" : "#ef4444", s: `${margin}% margin` },
                    { l: "Revenue Collected", v: fmt(invoicesPaid), c: "#10b981", s: `${fmt(invoicesPending)} outstanding` },
                    { l: "Payroll Due", v: fmt(payrollPending), c: "#f59e0b", s: "Unpaid this month" },
                    { l: "Fleet Efficiency", v: `${overallKmPerL} km/L`, c: "#a78bfa", s: `${totalLitres.toLocaleString()}L used` },
                ].map((k, i) => (
                    <div key={i} style={S.card(k.c)}>
                        <div style={S.kpi}>{k.l}</div>
                        <div style={S.val(k.c)}>{k.v}</div>
                        <div style={S.sub}>{k.s}</div>
                    </div>
                ))}
            </div>

            <div style={S.grid(2, 1, 1)}>
                <div style={S.card()}>
                    <div style={{ fontWeight: 700, marginBottom: 16, color: S.mtitle.color, fontSize: 14 }}>🚛 Per-Truck Summary</div>
                    {data.trucks.map((t: any) => {
                        const st = truckStats(t.id)
                        const ts = tyreStatus(t)
                        const margin = st.rev > 0 ? (st.profit / st.rev * 100).toFixed(1) : 0
                        return (
                            <div key={t.id} style={{ padding: "12px 0", borderBottom: `1px solid ${S.td.borderBottom.split(' ')[2]}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <span style={{ fontWeight: 700, color: S.mtitle.color }}>{t.reg}</span>
                                        {ts.status !== "OK" && <span style={S.pill(SC[ts.status as keyof typeof SC])}>🔴 Tyres</span>}
                                    </div>
                                    <span style={S.badge(t.status)}>{t.status}</span>
                                </div>
                                <div style={{ display: "flex", gap: 16, fontSize: 11, color: S.kpi.color, marginBottom: 8 }}>
                                    <span>Rev: <b style={{ color: "#10b981" }}>{fmt(st.rev)}</b></span>
                                    <span>Exp: <b style={{ color: "#f59e0b" }}>{fmt(st.exp)}</b></span>
                                    <span>Net: <b style={{ color: st.profit >= 0 ? "#3b82f6" : "#ef4444" }}>{fmt(st.profit)}</b></span>
                                    <span>{fmtN(st.kmPerL, 2)} km/L</span>
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <div style={S.bar()}><div style={S.barFill(Math.max(0, +margin), +margin >= 0 ? "#10b981" : "#ef4444")} /></div>
                                    <span style={{ fontSize: 10, color: S.kpi.color, whiteSpace: "nowrap" }}>{margin}% margin</span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div style={S.card()}>
                    <div style={{ fontWeight: 700, marginBottom: 16, color: S.mtitle.color, fontSize: 14 }}>📋 Invoice & Payroll Status</div>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: S.kpi.color, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Invoices</div>
                        {["Paid", "Pending", "Overdue"].map((s: string) => {
                            const total = data.invoices.filter((i: any) => i.status === s).reduce((sum: any, i: any) => sum + +i.amount, 0)
                            const count = data.invoices.filter((i: any) => i.status === s).length
                            return (
                                <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${S.td.borderBottom.split(' ')[2]}`, fontSize: 12 }}>
                                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={S.badge(s)}>{s}</span><span style={{ color: S.kpi.color }}>({count})</span></span>
                                    <span style={{ fontWeight: 700, color: SC[s as keyof typeof SC] }}>{fmt(total)}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: S.kpi.color, marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Payroll — March 2025</div>
                        {data.drivers.map((d: any) => {
                            const paySlip = data.payroll.find((p: any) => p.driver === d.id && p.month === "2025-03")
                            const net = paySlip ? +paySlip.baseSalary + +paySlip.allowance - +paySlip.deductions : 0
                            return (
                                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${S.td.borderBottom.split(' ')[2]}`, fontSize: 12 }}>
                                    <span style={{ color: S.wrap.color }}>{d.name}</span>
                                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <span style={{ fontWeight: 700, color: "#f59e0b" }}>{fmt(net)}</span>
                                        {paySlip && <span style={S.badge(paySlip.status)}>{paySlip.status}</span>}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
