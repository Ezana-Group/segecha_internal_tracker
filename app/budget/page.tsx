'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const BUDGET_CATEGORIES = [
  { key: 'revenue', label: 'Revenue Target', icon: '💰', positive: true },
  { key: 'Fuel', label: 'Fuel Budget', icon: '⛽', positive: false },
  { key: 'Maintenance', label: 'Maintenance', icon: '🔧', positive: false },
  { key: 'Salary', label: 'Driver Salaries', icon: '👤', positive: false },
  { key: 'Tyre', label: 'Tyres', icon: '🔵', positive: false },
  { key: 'Other', label: 'Other Expenses', icon: '📦', positive: false },
]

function getPrevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}
function getNextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
}
function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0)
  return last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0')
}

export default function BudgetPage() {
  const { S } = useErpContext()
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [data, setData] = useState<{
    budgets: any[]
    trucks: any[]
    expenses: any[]
    fuel: any[]
    journeys: any[]
    payroll: any[]
    drivers: any[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<{ truckId: string | null; category: string } | null>(null)

  const firstDay = `${selectedMonth}-01`
  const lastDay = lastDayOfMonth(selectedMonth)

  const loadData = async () => {
    setLoading(true)
    const [
      { data: budgets },
      { data: trucks },
      { data: expenses },
      { data: fuel },
      { data: journeys },
      { data: payroll },
      { data: drivers },
    ] = await Promise.all([
      supabase.from('budgets').select('*').eq('month', selectedMonth),
      supabase.from('trucks').select('*').order('reg'),
      supabase.from('expenses').select('truck, cat, amount, date').gte('date', firstDay).lte('date', lastDay),
      supabase.from('fuel').select('truck, litres, pricePerL, date').gte('date', firstDay).lte('date', lastDay),
      supabase.from('journeys').select('truck, revenue, date, status').gte('date', firstDay).lte('date', lastDay),
      supabase.from('payroll').select('driver, baseSalary, allowance, deductions, month').eq('month', selectedMonth),
      supabase.from('drivers').select('id, truck'),
    ])
    setData({
      budgets: budgets || [],
      trucks: trucks || [],
      expenses: expenses || [],
      fuel: fuel || [],
      journeys: journeys || [],
      payroll: payroll || [],
      drivers: drivers || [],
    })
    setLoading(false)
  }

  useEffect(() => { loadData() }, [selectedMonth])

  const getBudget = (truckId: string | null, category: string): number => {
    const row = data?.budgets?.find((b: any) => (b.truck_id ?? b.truckId) === truckId && (b.category || '') === category)
    return Number(row?.amount ?? 0)
  }

  const getActualRevenue = (truckId: string | null): number => {
    const list = data?.journeys?.filter((j: any) => j.status === 'Completed' && (truckId ? j.truck === truckId : true)) || []
    return list.reduce((s: number, j: any) => s + Number(j.revenue || 0), 0)
  }
  const getActualFuel = (truckId: string | null): number => {
    const list = data?.fuel?.filter((f: any) => truckId ? f.truck === truckId : true) || []
    return list.reduce((s: number, f: any) => s + Number(f.litres || 0) * Number(f.pricePerL || 0), 0)
  }
  const getActualExpenseByCat = (truckId: string | null, cat: string): number => {
    const list = data?.expenses?.filter((e: any) => (truckId ? e.truck === truckId : true) && (e.cat || '') === cat) || []
    return list.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  }
  const getActualSalary = (truckId: string | null): number => {
    if (!data?.payroll?.length || !data?.drivers?.length) return 0
    const driverIdsForTruck = truckId ? data.drivers.filter((d: any) => d.truck === truckId).map((d: any) => d.id) : []
    const payrollList = truckId
      ? data.payroll.filter((p: any) => driverIdsForTruck.includes(p.driver))
      : data.payroll
    return payrollList.reduce((s: number, p: any) => s + Number(p.baseSalary || 0) + Number(p.allowance || 0) - Number(p.deductions || 0), 0)
  }
  const getActualOther = (truckId: string | null): number => {
    const others = ['Other', 'Toll', 'Permit', 'Allowance', 'Insurance']
    return others.reduce((sum, cat) => sum + getActualExpenseByCat(truckId, cat), 0)
  }

  const getActual = (truckId: string | null, category: string): number => {
    switch (category) {
      case 'revenue': return getActualRevenue(truckId)
      case 'Fuel': return getActualFuel(truckId)
      case 'Maintenance': return getActualExpenseByCat(truckId, 'Maintenance')
      case 'Salary': return getActualSalary(truckId)
      case 'Tyre': return getActualExpenseByCat(truckId, 'Tyre')
      case 'Other': return getActualOther(truckId)
      default: return 0
    }
  }

  const saveBudget = async (truckId: string | null, category: string, value: string) => {
    const amount = Math.max(0, Number(value) || 0)
    const existing = data?.budgets?.find((b: any) => (b.truck_id ?? b.truckId) === truckId && (b.category || '') === category)
    if (existing) {
      const { error } = await supabase.from('budgets').update({ amount, updated_at: new Date().toISOString() }).eq('id', existing.id)
      if (error) return toast.error(error.message)
    } else {
      const { error } = await supabase.from('budgets').insert({ month: selectedMonth, truck_id: truckId ?? null, category, amount })
      if (error) return toast.error(error.message)
    }
    toast.success('Budget updated')
    setEditingCell(null)
    loadData()
  }

  const copyFromPrevMonth = async () => {
    const prev = getPrevMonth(selectedMonth)
    const { data: prevBudgets } = await supabase.from('budgets').select('*').eq('month', prev)
    if (!prevBudgets?.length) {
      toast.error('No budget found for previous month')
      return
    }
    await supabase.from('budgets').delete().eq('month', selectedMonth)
    const toInsert = prevBudgets.map((b: any) => ({
      month: selectedMonth,
      truck_id: b.truck_id ?? b.truckId ?? null,
      category: b.category,
      amount: b.amount,
      notes: b.notes,
    }))
    const { error } = await supabase.from('budgets').insert(toInsert)
    if (error) return toast.error(error.message)
    toast.success('Budget copied from ' + monthLabel(prev))
    loadData()
  }

  if (loading || !data) return <AppLayout><div style={S.ph}>Loading Budget…</div></AppLayout>

  const tractors = data.trucks.filter((t: any) => !t.type || !['Trailer', 'Skeletal Trailer'].includes(t.type))

  return (
    <AppLayout>
      <div style={S.ph}>📊 Budget vs Actual</div>

      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => setSelectedMonth(getPrevMonth(selectedMonth))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          ‹
        </button>
        <span className="font-bold text-lg text-slate-800 dark:text-white min-w-[160px] text-center">
          {monthLabel(selectedMonth)}
        </span>
        <button type="button" onClick={() => setSelectedMonth(getNextMonth(selectedMonth))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          ›
        </button>
        <button type="button" onClick={copyFromPrevMonth} className="ml-auto text-xs text-orange-500 border border-orange-200 dark:border-orange-800 px-3 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition">
          Copy from previous month
        </button>
      </div>

      {/* Company-wide summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {BUDGET_CATEGORIES.map((cat) => {
          const budgeted = getBudget(null, cat.key)
          const actual = getActual(null, cat.key)
          const remaining = cat.positive ? actual - budgeted : budgeted - actual
          const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0
          return (
            <div key={cat.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{cat.icon}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{cat.label}</span>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Budget</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">{fmt(budgeted)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Actual</span>
                  <span className={`font-bold ${cat.positive ? (actual >= budgeted ? 'text-emerald-600' : 'text-amber-600') : (actual > budgeted ? 'text-red-600' : 'text-emerald-600')}`}>
                    {fmt(actual)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Remaining</span>
                  <span className={`font-bold ${remaining >= 0 ? 'text-slate-600 dark:text-slate-400' : 'text-red-600'}`}>
                    {remaining >= 0 ? fmt(remaining) : `(${fmt(Math.abs(remaining))} over)`}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400">{pct.toFixed(0)}% used</span>
                {pct > 100 && <span className="text-[10px] font-bold text-red-500">OVER BUDGET</span>}
                {pct > 80 && pct <= 100 && <span className="text-[10px] font-bold text-amber-500">NEAR LIMIT</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Per-truck table */}
      <div className="mb-4 font-semibold text-slate-700 dark:text-slate-300">Per-truck budget</div>
      <div style={{ ...S.card(), overflowX: 'auto' as any }}>
        <table style={{ ...S.tbl, minWidth: 800 }}>
          <thead>
            <tr>
              <th style={S.th}>Truck</th>
              {BUDGET_CATEGORIES.map((cat) => (
                <th key={cat.key} style={S.th}>{cat.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Company-wide row (truck_id null) */}
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <td style={{ ...S.td, fontWeight: 700, color: S.mtitle?.color }}>Company (all trucks)</td>
              {BUDGET_CATEGORIES.map((cat) => {
                const budgeted = getBudget(null, cat.key)
                const actual = getActual(null, cat.key)
                const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0
                const isEditing = editingCell?.truckId === null && editingCell?.category === cat.key
                return (
                  <td
                    key={cat.key}
                    onClick={() => !isEditing && setEditingCell({ truckId: null, category: cat.key })}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                    style={S.td}
                  >
                    {isEditing ? (
                      <input
                        type="number"
                        defaultValue={budgeted}
                        onBlur={(e) => saveBudget(null, cat.key, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(null, cat.key, (e.target as HTMLInputElement).value) }}
                        className="w-24 text-xs border border-orange-400 rounded px-1 py-0.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        autoFocus
                      />
                    ) : (
                      <span>{fmt(budgeted)}</span>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5">Actual: {fmt(actual)} · {pct.toFixed(0)}%</div>
                  </td>
                )
              })}
            </tr>
            {tractors.map((truck: any) => (
              <tr key={truck.id}>
                <td style={{ ...S.td, fontWeight: 700, color: S.mtitle?.color }}>{truck.reg}</td>
                {BUDGET_CATEGORIES.map((cat) => {
                  const budgeted = getBudget(truck.id, cat.key)
                  const actual = getActual(truck.id, cat.key)
                  const remaining = cat.positive ? actual - budgeted : budgeted - actual
                  const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0
                  const isEditing = editingCell?.truckId === truck.id && editingCell?.category === cat.key
                  return (
                    <td
                      key={cat.key}
                      onClick={() => !isEditing && setEditingCell({ truckId: truck.id, category: cat.key })}
                      className="px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                      style={S.td}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          defaultValue={budgeted}
                          onBlur={(e) => saveBudget(truck.id, cat.key, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(truck.id, cat.key, (e.target as HTMLInputElement).value) }}
                          className="w-24 text-xs border border-orange-400 rounded px-1 py-0.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          autoFocus
                        />
                      ) : (
                        <span>{fmt(budgeted)}</span>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Actual: {fmt(actual)} · {pct.toFixed(0)}% {pct > 100 ? '🔴' : pct > 80 ? '🟡' : '🟢'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 hidden">Tip: Set company-wide targets by editing the first row (or add a “Company” row in a future update). For now, use the per-truck table above.</div>
    </AppLayout>
  )
}
