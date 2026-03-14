'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, fmtN } from '@/lib/ErpContext'
import { CATS } from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'
import { SortableTh, sortCompare } from '@/components/ErpShared'

type PnlTab = 'pnl' | 'routes' | 'tax'

export default function PNL() {
    const { S, dark } = useErpContext()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [pnlTab, setPnlTab] = useState<PnlTab>('pnl')
    const [routeSort, setRouteSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'profitMargin', dir: 'desc' })
    const [taxYearStart, setTaxYearStart] = useState<'jan' | 'jul'>('jan')

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

    const completed = (data.journeys || []).filter((j: any) => j.status === 'Completed')
    const routeMap = new Map<string, { journeyIds: string[]; origin: string; dest: string }>()
    completed.forEach((j: any) => {
        const key = `${(j.origin || '').trim()} → ${(j.dest || '').trim()}`
        if (!routeMap.has(key)) routeMap.set(key, { journeyIds: [], origin: j.origin || '', dest: j.dest || '' })
        routeMap.get(key)!.journeyIds.push(j.id)
    })
    const routes = Array.from(routeMap.entries()).map(([key, { journeyIds, origin, dest }]) => {
        const jrns = completed.filter((j: any) => journeyIds.includes(j.id))
        const totalRevenueR = jrns.reduce((s: number, j: any) => s + Number(j.revenue || 0), 0)
        const totalDistanceR = jrns.reduce((s: number, j: any) => s + Number(j.distance || 0), 0)
        const tripCount = jrns.length
        const fuelCostR = (data.fuel || []).filter((f: any) => f.journey && journeyIds.includes(f.journey)).reduce((s: number, f: any) => s + Number(f.litres || 0) * Number(f.pricePerL || 0), 0)
        const variableCostsR = (data.expenses || []).filter((e: any) => e.journey && journeyIds.includes(e.journey)).reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
        const totalCostsR = fuelCostR + variableCostsR
        const grossProfitR = totalRevenueR - totalCostsR
        const profitMarginR = totalRevenueR > 0 ? (grossProfitR / totalRevenueR) * 100 : 0
        return {
            key, origin, dest, tripCount, totalRevenue: totalRevenueR, totalDistance: totalDistanceR,
            avgRevenue: tripCount > 0 ? totalRevenueR / tripCount : 0,
            fuelCost: fuelCostR, variableCosts: variableCostsR, totalCosts: totalCostsR,
            grossProfit: grossProfitR, profitMargin: profitMarginR,
            revenuePerKm: totalDistanceR > 0 ? totalRevenueR / totalDistanceR : 0,
            costPerKm: totalDistanceR > 0 ? totalCostsR / totalDistanceR : 0,
            avgCost: tripCount > 0 ? totalCostsR / tripCount : 0,
        }
    })
    const sortedRoutes = [...routes].sort((a, b) => {
        const av = (a as any)[routeSort.key] ?? 0
        const bv = (b as any)[routeSort.key] ?? 0
        return sortCompare(av, bv, routeSort.dir)
    })

    const taxYearMonths = taxYearStart === 'jan' ? ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] : ['07', '08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06']
    const currentYear = new Date().getFullYear()
    const taxYearLabel = taxYearStart === 'jan' ? `${currentYear}` : `${currentYear - 1}-${currentYear}`
    const paidInvoices = (data.invoices || []).filter((i: any) => i.status === 'Paid')
    const monthRevenue: Record<string, number> = {}
    const monthFuelCost: Record<string, number> = {}
    paidInvoices.forEach((i: any) => {
        const issued = i.issued || i.paidDate
        if (!issued) return
        const m = String(issued).slice(0, 7)
        monthRevenue[m] = (monthRevenue[m] || 0) + Number(i.amount || 0)
    })
    ;(data.fuel || []).forEach((f: any) => {
        const m = String(f.date || '').slice(0, 7)
        if (!m) return
        monthFuelCost[m] = (monthFuelCost[m] || 0) + Number(f.litres || 0) * Number(f.pricePerL || 0)
    })
    const vatRows = taxYearMonths.map((mm, idx) => {
        const y = taxYearStart === 'jul' && idx < 6 ? currentYear - 1 : currentYear
        const monthKey = `${y}-${mm}`
        const gross = monthRevenue[monthKey] ?? 0
        const outputVAT = (gross * 0.16) / 1.16
        const inputVAT = (monthFuelCost[monthKey] ?? 0) * 0.16 / 1.16
        return { monthKey, label: new Date(y, parseInt(mm, 10) - 1, 1).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' }), gross, outputVAT, net: gross - outputVAT, inputVAT, vatPayable: outputVAT - inputVAT }
    })
    const totalGross = vatRows.reduce((s, r) => s + r.gross, 0)
    const totalOutputVAT = vatRows.reduce((s, r) => s + r.outputVAT, 0)
    const totalNet = vatRows.reduce((s, r) => s + r.net, 0)
    const totalInputVAT = vatRows.reduce((s, r) => s + r.inputVAT, 0)
    const totalVATPayable = vatRows.reduce((s, r) => s + r.vatPayable, 0)

    function calculatePAYE(taxable: number): number {
        if (taxable <= 24000) return 0
        let paye = 0
        if (taxable > 24000) paye += Math.min(taxable - 24000, 32333 - 24000) * 0.10
        if (taxable > 32333) paye += Math.min(taxable - 32333, 40667 - 32333) * 0.25
        if (taxable > 40667) paye += (taxable - 40667) * 0.30
        return paye
    }
    const drivers = data.drivers || []
    const payroll = data.payroll || []
    const payeRows: { driverName: string; month: string; gross: number; nhif: number; nssf: number; paye: number; netPay: number }[] = []
    payroll.forEach((p: any) => {
        const d = drivers.find((x: any) => x.id === p.driver)
        const gross = Number(p.baseSalary || 0) + Number(p.allowance || 0) - Number(p.deductions || 0)
        const nhif = Math.min(gross * 0.0275, 1700)
        const nssf = Math.min(gross * 0.06, 2160)
        const taxable = Math.max(0, gross - nhif - nssf)
        const paye = calculatePAYE(taxable)
        const netPay = gross - nhif - nssf - paye
        payeRows.push({ driverName: d?.name || '—', month: p.month || '', gross, nhif, nssf, paye, netPay })
    })

    const handlePrint = () => {
        const printContent = document.getElementById("pnl-print-area")
        if (!printContent) return
        const w = window.open("", "_blank")
        if (!w) return
        w.document.write(`<html><head><title>Segecha Group P&L Report</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111;}table{width:100%;border-collapse:collapse;}th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;}th{background:#f3f4f6;font-weight:700;}h1{color:#e85d04;}h2{color:#374151;font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;}.total-row{background:#e85d04;color:#fff;font-weight:800;}.sub-header{background:#f9fafb;color:#374151;}</style></head><body>${printContent.innerHTML}</body></html>`)
        w.document.close()
        w.print()
    }

    const exportVatCsv = () => {
        const header = 'Month,Gross Revenue (Inc. VAT),VAT (16%),Net Revenue (Ex. VAT),Input VAT (Fuel),VAT Payable\n'
        const body = vatRows.map(r => `${r.label},${r.gross.toFixed(2)},${r.outputVAT.toFixed(2)},${r.net.toFixed(2)},${r.inputVAT.toFixed(2)},${r.vatPayable.toFixed(2)}`).join('\n') + `\nANNUAL TOTAL,${totalGross.toFixed(2)},${totalOutputVAT.toFixed(2)},${totalNet.toFixed(2)},${totalInputVAT.toFixed(2)},${totalVATPayable.toFixed(2)}`
        const blob = new Blob([header + body], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vat-summary-${taxYearLabel}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }
    const exportPayeCsv = () => {
        const header = 'Driver,Month,Gross Pay,NHIF,NSSF,PAYE,Net Pay\n'
        const body = payeRows.map(r => `${r.driverName},${r.month},${r.gross.toFixed(2)},${r.nhif.toFixed(2)},${r.nssf.toFixed(2)},${r.paye.toFixed(2)},${r.netPay.toFixed(2)}`).join('\n')
        const blob = new Blob([header + body], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `paye-summary-${new Date().getFullYear()}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }
    const handlePrintTax = () => {
        const el = document.getElementById('tax-print-area')
        if (!el) return
        const w = window.open('', '_blank')
        if (!w) return
        w.document.write(`<html><head><title>Segecha Group Tax Report</title><style>body{font-family:Arial,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;} th,td{padding:8px 12px;border:1px solid #ddd;} th{background:#f3f4f6;} .total-row{background:#e85d04;color:#fff;font-weight:700;}</style></head><body>${el.innerHTML}</body></html>`)
        w.document.close()
        w.print()
    }

    return (
        <AppLayout>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
                <div style={S.ph}>▣ P&L Report</div>
                <div className="flex items-center gap-2 flex-wrap">
                    {(['pnl', 'routes', 'tax'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setPnlTab(t)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${pnlTab === t ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                            {t === 'pnl' ? 'P&L' : t === 'routes' ? 'Routes' : 'Tax Reports'}
                        </button>
                    ))}
                    {pnlTab === 'pnl' && <button style={S.btn('orange')} onClick={handlePrint}>🖨️ Print</button>}
                    {pnlTab === 'tax' && (
                        <>
                            <button type="button" onClick={exportVatCsv} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">Export VAT CSV</button>
                            <button type="button" onClick={exportPayeCsv} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">Export PAYE CSV</button>
                            <button type="button" onClick={handlePrintTax} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600">Print Tax Report</button>
                        </>
                    )}
                </div>
            </div>

            {pnlTab === 'routes' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                        {sortedRoutes.sort((a, b) => b.profitMargin - a.profitMargin).map((route) => (
                            <div key={route.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white text-base">{route.origin} → {route.dest}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{route.tripCount} trips · {route.totalDistance.toLocaleString()} km total</div>
                                    </div>
                                    <span className={`text-sm font-extrabold px-3 py-1 rounded-full ${route.profitMargin >= 30 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : route.profitMargin >= 15 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                                        {route.profitMargin.toFixed(1)}% margin
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    {[
                                        { l: 'Avg Revenue/Trip', v: fmt(route.avgRevenue), c: 'text-emerald-600' },
                                        { l: 'Avg Cost/Trip', v: fmt(route.avgCost), c: 'text-red-500' },
                                        { l: 'Revenue/km', v: `KES ${route.revenuePerKm.toFixed(0)}`, c: 'text-blue-600' },
                                        { l: 'Cost/km', v: `KES ${route.costPerKm.toFixed(0)}`, c: 'text-slate-600 dark:text-slate-400' },
                                    ].map((s) => (
                                        <div key={s.l} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{s.l}</div>
                                            <div className={`font-bold text-sm ${s.c}`}>{s.v}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(route.profitMargin, 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ ...S.card(), overflowX: 'auto' as any }}>
                        <table style={S.tbl}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Route</th>
                                    <SortableTh label="Trips" sortKey="tripCount" currentSortKey={routeSort.key} currentSortDir={routeSort.dir} onSort={(k) => setRouteSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                                    <SortableTh label="Revenue" sortKey="totalRevenue" currentSortKey={routeSort.key} currentSortDir={routeSort.dir} onSort={(k) => setRouteSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                                    <SortableTh label="Costs" sortKey="totalCosts" currentSortKey={routeSort.key} currentSortDir={routeSort.dir} onSort={(k) => setRouteSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))} />
                                    <SortableTh label="Profit" sortKey="grossProfit" currentSortKey={routeSort.key} currentSortDir={routeSort.dir} onSort={(k) => setRouteSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                                    <SortableTh label="Margin" sortKey="profitMargin" currentSortKey={routeSort.key} currentSortDir={routeSort.dir} onSort={(k) => setRouteSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                                    <SortableTh label="Rev/km" sortKey="revenuePerKm" currentSortKey={routeSort.key} currentSortDir={routeSort.dir} onSort={(k) => setRouteSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRoutes.map((r) => (
                                    <tr key={r.key}>
                                        <td style={{ ...S.td, fontWeight: 700, color: S.mtitle?.color }}>{r.origin} → {r.dest}</td>
                                        <td style={S.td}>{r.tripCount}</td>
                                        <td style={{ ...S.td, color: '#10b981' }}>{fmt(r.totalRevenue)}</td>
                                        <td style={{ ...S.td, color: '#f59e0b' }}>{fmt(r.totalCosts)}</td>
                                        <td style={{ ...S.td, color: r.grossProfit >= 0 ? '#3b82f6' : '#ef4444' }}>{fmt(r.grossProfit)}</td>
                                        <td style={S.td}>{r.profitMargin.toFixed(1)}%</td>
                                        <td style={S.td}>KES {r.revenuePerKm.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {pnlTab === 'tax' && (
                <>
                    <div className="mb-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400 mr-2">Tax year:</span>
                        <button type="button" onClick={() => setTaxYearStart('jan')} className={`px-3 py-1 rounded-lg text-sm font-medium ${taxYearStart === 'jan' ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Jan–Dec</button>
                        <button type="button" onClick={() => setTaxYearStart('jul')} className={`ml-2 px-3 py-1 rounded-lg text-sm font-medium ${taxYearStart === 'jul' ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Jul–Jun</button>
                    </div>
                    <div id="tax-print-area">
                        <div style={{ fontWeight: 700, color: S.mtitle?.color, marginBottom: 12, fontSize: 14 }}>VAT Summary (16%)</div>
                        <div style={{ ...S.card(), overflowX: 'auto' as any, marginBottom: 24 }}>
                            <table style={S.tbl}>
                                <thead><tr><th style={S.th}>Month</th><th style={S.th}>Gross (Inc. VAT)</th><th style={S.th}>VAT (16%)</th><th style={S.th}>Net (Ex. VAT)</th><th style={S.th}>Input VAT (Fuel)</th><th style={S.th}>VAT Payable</th></tr></thead>
                                <tbody>
                                    {vatRows.map((r) => (
                                        <tr key={r.monthKey}>
                                            <td style={S.td}>{r.label}</td>
                                            <td style={S.td}>{fmt(r.gross)}</td>
                                            <td style={S.td}>{fmt(r.outputVAT)}</td>
                                            <td style={S.td}>{fmt(r.net)}</td>
                                            <td style={S.td}>{fmt(r.inputVAT)}</td>
                                            <td style={{ ...S.td, color: r.vatPayable > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{fmt(r.vatPayable)}</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-t-2 border-slate-300">
                                        <td style={S.td}>ANNUAL TOTAL</td>
                                        <td style={S.td}>{fmt(totalGross)}</td>
                                        <td style={S.td}>{fmt(totalOutputVAT)}</td>
                                        <td style={S.td}>{fmt(totalNet)}</td>
                                        <td style={S.td}>{fmt(totalInputVAT)}</td>
                                        <td style={{ ...S.td, color: totalVATPayable > 0 ? '#ef4444' : '#10b981' }}>{fmt(totalVATPayable)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontWeight: 700, color: S.mtitle?.color, marginBottom: 12, fontSize: 14 }}>Driver PAYE / WHT</div>
                        <div style={{ ...S.card(), overflowX: 'auto' as any }}>
                            <table style={S.tbl}>
                                <thead><tr><th style={S.th}>Driver</th><th style={S.th}>Month</th><th style={S.th}>Gross</th><th style={S.th}>NHIF</th><th style={S.th}>NSSF</th><th style={S.th}>PAYE</th><th style={S.th}>Net Pay</th></tr></thead>
                                <tbody>
                                    {payeRows.map((row, i) => (
                                        <tr key={i}>
                                            <td style={S.td}>{row.driverName}</td>
                                            <td style={S.td}>{row.month}</td>
                                            <td style={S.td}>{fmt(row.gross)}</td>
                                            <td style={S.td}>{fmt(row.nhif)}</td>
                                            <td style={S.td}>{fmt(row.nssf)}</td>
                                            <td style={S.td}>{fmt(row.paye)}</td>
                                            <td style={S.td}>{fmt(row.netPay)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {pnlTab === 'pnl' && (
            <>
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
            </>
            )}
        </AppLayout>
    )
}
