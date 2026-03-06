'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getDashboardSummary, getTrucks, getInvoices } from '@/lib/api'

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null)
  const [trucks, setTrucks] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDashboardSummary(), getTrucks(), getInvoices()]).then(([s, t, i]) => {
      setSummary(s)
      setTrucks(t.data ?? [])
      setInvoices((i.data ?? []).slice(0, 5))
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64 text-slate-400">Loading dashboard…</div>
    </AppLayout>
  )

  const margin = summary.totalRevenue > 0 ? (summary.netProfit / summary.totalRevenue * 100).toFixed(1) : '0.0'
  const overdueInvoices = invoices.filter(i => i.status === 'Overdue')

  const kpis = [
    { label: 'Net Profit', value: fmt(summary.netProfit), sub: `${margin}% margin`, color: summary.netProfit >= 0 ? 'text-blue-500' : 'text-red-500', border: summary.netProfit >= 0 ? 'border-t-blue-500' : 'border-t-red-500' },
    { label: 'Revenue Collected', value: fmt(summary.invoicesPaid), sub: `${fmt(summary.invoicesPending)} outstanding`, color: 'text-emerald-500', border: 'border-t-emerald-500' },
    { label: 'Payroll Due', value: fmt(summary.payrollPending), sub: 'Unpaid this month', color: 'text-amber-500', border: 'border-t-amber-500' },
    { label: 'Fleet Efficiency', value: `${summary.kmPerL.toFixed(2)} km/L`, sub: `${summary.totalLitres.toLocaleString()}L fuel used`, color: 'text-purple-500', border: 'border-t-purple-500' },
    { label: 'Active Trucks', value: `${summary.activeTrucks}/${summary.totalTrucks}`, sub: 'Vehicles on road', color: 'text-orange-500', border: 'border-t-orange-500' },
    { label: 'Total Distance', value: `${summary.totalKm.toLocaleString()} km`, sub: `${summary.completedTrips} completed trips`, color: 'text-sky-500', border: 'border-t-sky-500' },
  ]

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Operations Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Welcome to Segecha Group Fleet ERP</p>
          </div>
          <span className="text-xs bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full font-semibold border border-orange-200 dark:border-orange-500/20">
            {new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Alerts */}
        {overdueInvoices.length > 0 && (
          <div className="space-y-2">
            {overdueInvoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm">
                <span className="text-red-500 text-lg">⚠️</span>
                <div>
                  <span className="font-semibold text-red-700 dark:text-red-400">Overdue Invoice: {inv.id}</span>
                  <span className="text-red-500 dark:text-red-400 ml-2">{inv.client} · {fmt(inv.amount)} · Due {inv.due}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((k, i) => (
            <div key={i} className={`bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 border-t-4 ${k.border} shadow-sm`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{k.label}</p>
              <p className={`text-xl font-extrabold ${k.color} leading-tight`}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Truck summary table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Fleet Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['Registration', 'Make', 'Type', 'Capacity', 'Odometer', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trucks.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}>
                    <td className="px-4 py-3 font-bold text-orange-600 dark:text-orange-400">{t.reg}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.make}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.type}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.capacity}T</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{(t.odom || 0).toLocaleString()} km</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                        t.status === 'Maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      }`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent invoices */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white">Recent Invoices</h2>
            <a href="/invoices" className="text-xs text-orange-500 hover:underline font-semibold">View all →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['Invoice', 'Client', 'Amount', 'Due', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}>
                    <td className="px-4 py-3 font-mono text-xs text-sky-600 dark:text-sky-400">{inv.id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{inv.client}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{inv.due}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                        inv.status === 'Overdue' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                      }`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
