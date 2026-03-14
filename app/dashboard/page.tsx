'use client'

import React from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, fmtN } from '@/lib/ErpContext'
import { SC, TYRE_WARN_KM } from '@/lib/seed-data'
import { DOC_LABELS, daysAgo } from '@/lib/documents'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
    const { S } = useErpContext()
    const [data, setData] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    const currentMonth = React.useMemo(() => new Date().toISOString().slice(0, 7), [])
    const monthFirstLast = React.useMemo(() => {
        const [y, m] = currentMonth.split('-').map(Number)
        const first = `${currentMonth}-01`
        const last = new Date(y, m, 0)
        const lastStr = last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0')
        return { first, last: lastStr }
    }, [currentMonth])

    React.useEffect(() => {
        async function load() {
            setLoading(true)
            const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            const { first, last } = monthFirstLast
            const tables = [
                () => supabase.from('trucks').select('*'),
                () => supabase.from('journeys').select('*'),
                () => supabase.from('fuel').select('*'),
                () => supabase.from('expenses').select('*'),
                () => supabase.from('invoices').select('*'),
                () => supabase.from('payroll').select('*'),
                () => supabase.from('drivers').select('*'),
                () => supabase.from('maintenance').select('*'),
                () => supabase.from('documents').select('*').lte('expiry_date', thirtyDaysFromNow).order('expiry_date'),
                () => supabase.from('budgets').select('*').eq('month', currentMonth)
            ]
            const results = await Promise.allSettled(tables.map(fn => fn()))
            const pick = (i: number) => {
                const r = results[i]
                if (r.status === 'fulfilled' && r.value.data != null) return r.value.data
                return []
            }
            const journeysThisMonth = (pick(1) as any[]).filter((j: any) => j.date >= first && j.date <= last)
            const fuelThisMonth = (pick(2) as any[]).filter((f: any) => f.date >= first && f.date <= last)
            const expensesThisMonth = (pick(3) as any[]).filter((e: any) => e.date >= first && e.date <= last)
            const payrollThisMonth = (pick(5) as any[]).filter((p: any) => (p.month || '').slice(0, 7) === currentMonth)
            setData({
                trucks: pick(0), journeys: pick(1),
                fuel: pick(2), expenses: pick(3),
                invoices: pick(4), payroll: pick(5),
                drivers: pick(6), maintenance: pick(7),
                urgentDocuments: pick(8),
                budgets: pick(9),
                journeysThisMonth,
                fuelThisMonth,
                expensesThisMonth,
                payrollThisMonth
            })
            setLoading(false)
        }
        load()
    }, [currentMonth, monthFirstLast])

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
    const urgentDocs = data.urgentDocuments || []
    const expiredDocs = urgentDocs.filter((d: any) => d.status === 'Expired')
    const expiringSoonDocs = urgentDocs.filter((d: any) => d.status === 'Expiring Soon')
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

    const companyBudgets = (data.budgets || []).filter((b: any) => b.truck_id == null)
    const budgetActuals = {
        revenue: (data.journeysThisMonth || []).filter((j: any) => j.status === 'Completed').reduce((s: number, j: any) => s + Number(j.revenue || 0), 0),
        Fuel: (data.fuelThisMonth || []).reduce((s: number, f: any) => s + Number(f.litres || 0) * Number(f.pricePerL || 0), 0),
        Maintenance: (data.expensesThisMonth || []).filter((e: any) => (e.cat || '') === 'Maintenance').reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
        Salary: (data.payrollThisMonth || []).reduce((s: number, p: any) => s + Number(p.baseSalary || 0) + Number(p.allowance || 0) - Number(p.deductions || 0), 0),
        Tyre: (data.expensesThisMonth || []).filter((e: any) => (e.cat || '') === 'Tyre').reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
        Other: ['Other', 'Toll', 'Permit', 'Allowance', 'Insurance'].reduce((sum, cat) => sum + (data.expensesThisMonth || []).filter((e: any) => (e.cat || '') === cat).reduce((s: number, e: any) => s + Number(e.amount || 0), 0), 0)
    }
    const budgetAlerts: { label: string; budget: number; actual: number; pct: number; positive: boolean; severity: 'amber' | 'red' }[] = []
    const BUDGET_CATS = [
        { key: 'revenue', label: 'Revenue Target', positive: true },
        { key: 'Fuel', label: 'Fuel', positive: false },
        { key: 'Maintenance', label: 'Maintenance', positive: false },
        { key: 'Salary', label: 'Driver Salaries', positive: false },
        { key: 'Tyre', label: 'Tyres', positive: false },
        { key: 'Other', label: 'Other', positive: false }
    ]
    BUDGET_CATS.forEach(({ key, label, positive }) => {
        const budget = Number(companyBudgets.find((b: any) => (b.category || '') === key)?.amount ?? 0)
        if (budget <= 0) return
        const actual = (budgetActuals as any)[key] ?? 0
        const pct = (actual / budget) * 100
        if (positive && pct < 90) budgetAlerts.push({ label, budget, actual, pct, positive, severity: pct < 70 ? 'red' : 'amber' })
        if (!positive && pct > 90) budgetAlerts.push({ label, budget, actual, pct, positive, severity: pct >= 100 ? 'red' : 'amber' })
    })

    return (
        <AppLayout>
            <div style={S.ph}>◈ Operations Dashboard <span style={S.pill()}>March 2025</span></div>

            {(tyreAlerts.length > 0 || overdueInv.length > 0 || maintenanceAlerts.length > 0 || expiredDocs.length > 0 || expiringSoonDocs.length > 0 || budgetAlerts.length > 0) && (
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
                    {expiredDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                            <span className="text-red-500 text-lg">🔴</span>
                            <div className="flex-1 min-w-0">
                                <span className="font-semibold text-red-700 dark:text-red-400 text-sm">
                                    EXPIRED: {DOC_LABELS[doc.doc_type] || doc.doc_type}
                                </span>
                                <span className="text-red-500 text-sm ml-2">
                                    {doc.entity_name || doc.entity_id || '—'} · Expired {daysAgo(doc.expiry_date)} days ago
                                </span>
                            </div>
                            <Link href="/documents" className="text-xs text-red-500 font-semibold hover:underline whitespace-nowrap">Renew →</Link>
                        </div>
                    ))}
                    {expiringSoonDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                            <span className="text-amber-500 text-lg">🟡</span>
                            <div className="flex-1 min-w-0">
                                <span className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                                    EXPIRING SOON: {DOC_LABELS[doc.doc_type] || doc.doc_type}
                                </span>
                                <span className="text-amber-600 dark:text-amber-400 text-sm ml-2">
                                    {doc.entity_name || doc.entity_id || '—'} · {doc.expiry_date}
                                </span>
                            </div>
                            <Link href="/documents" className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline whitespace-nowrap">Renew →</Link>
                        </div>
                    ))}
                    {budgetAlerts.map((a, i) => (
                        <div key={i} style={S.alertBox(a.severity === 'red' ? '#ef4444' : '#f59e0b')}>
                            <span style={{ fontSize: 18 }}>{a.severity === 'red' ? '🔴' : '🟡'}</span>
                            <div>
                                <div style={{ fontWeight: 700, color: S.mtitle.color, fontSize: 13 }}>
                                    Budget Alert — {a.label}
                                </div>
                                <div style={{ fontSize: 12, color: S.sub.color }}>
                                    {a.positive
                                        ? `Revenue at ${a.pct.toFixed(0)}% of target (${fmt(a.actual)} / ${fmt(a.budget)})`
                                        : `Spend at ${a.pct.toFixed(0)}% of budget (${fmt(a.actual)} / ${fmt(a.budget)})`
                                    }
                                    {' · '}
                                    <Link href="/budget" style={{ color: '#f97316', fontWeight: 600 }}>Open Budget →</Link>
                                </div>
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
