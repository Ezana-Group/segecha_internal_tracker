import { supabase } from './supabase'

// ── Trucks ────────────────────────────────────────────────────────
export const getTrucks = () => supabase.from('trucks').select('*').order('reg')
export const upsertTruck = (data: any) => supabase.from('trucks').upsert(data).select().single()
export const deleteTruck = (id: string) => supabase.from('trucks').delete().eq('id', id)

// ── Drivers ───────────────────────────────────────────────────────
export const getDrivers = () => supabase.from('drivers').select('*, truck:trucks(reg)').order('name')
export const upsertDriver = (data: any) => supabase.from('drivers').upsert(data).select().single()
export const deleteDriver = (id: string) => supabase.from('drivers').delete().eq('id', id)

// ── Journeys ──────────────────────────────────────────────────────
export const getJourneys = () =>
  supabase.from('journeys')
    .select('*, truck:trucks(reg), driver:drivers(name)')
    .order('date_start', { ascending: false })

export const upsertJourney = (data: any) => supabase.from('journeys').upsert(data).select().single()
export const deleteJourney = (id: string) => supabase.from('journeys').delete().eq('id', id)

// ── Fuel ──────────────────────────────────────────────────────────
export const getFuel = () =>
  supabase.from('fuel_log')
    .select('*, truck:trucks(reg)')
    .order('date', { ascending: false })

export const upsertFuel = (data: any) => supabase.from('fuel_log').upsert(data).select().single()
export const deleteFuel = (id: string) => supabase.from('fuel_log').delete().eq('id', id)

// ── Expenses ──────────────────────────────────────────────────────
export const getExpenses = () =>
  supabase.from('expenses')
    .select('*, truck:trucks(reg)')
    .order('date', { ascending: false })

export const upsertExpense = (data: any) => supabase.from('expenses').upsert(data).select().single()
export const deleteExpense = (id: string) => supabase.from('expenses').delete().eq('id', id)

// ── Invoices ──────────────────────────────────────────────────────
export const getInvoices = () =>
  supabase.from('invoices')
    .select('*, journey:journeys(origin, destination)')
    .order('issued', { ascending: false })

export const upsertInvoice = (data: any) => supabase.from('invoices').upsert(data).select().single()
export const deleteInvoice = (id: string) => supabase.from('invoices').delete().eq('id', id)

// ── Payroll ───────────────────────────────────────────────────────
export const getPayroll = (month?: string) => {
  let q = supabase.from('payroll').select('*, driver:drivers(name, mpesa)').order('month', { ascending: false })
  if (month) q = q.eq('month', month)
  return q
}
export const upsertPayroll = (data: any) => supabase.from('payroll').upsert(data).select().single()
export const deletePayroll = (id: string) => supabase.from('payroll').delete().eq('id', id)

// ── Audit log ─────────────────────────────────────────────────────
export const logAction = (userId: string, userName: string, action: string, tableName?: string, recordId?: string) =>
  supabase.from('audit_log').insert({ user_id: userId, user_name: userName, action, table_name: tableName, record_id: recordId })

// ── Dashboard summary ─────────────────────────────────────────────
export async function getDashboardSummary() {
  const [trucks, journeys, fuel, expenses, invoices, payroll] = await Promise.all([
    supabase.from('trucks').select('id, status'),
    supabase.from('journeys').select('id, revenue, status, distance'),
    supabase.from('fuel_log').select('litres, price_per_l'),
    supabase.from('expenses').select('amount, category'),
    supabase.from('invoices').select('amount, status'),
    supabase.from('payroll').select('base_salary, allowance, deductions, status'),
  ])

  const completedJourneys = journeys.data?.filter(j => j.status === 'Completed') ?? []
  const totalRevenue = completedJourneys.reduce((s, j) => s + Number(j.revenue), 0)
  const totalFuel = (fuel.data ?? []).reduce((s, f) => s + f.litres * f.price_per_l, 0)
  const totalOther = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses = totalFuel + totalOther
  const netProfit = totalRevenue - totalExpenses

  const invoicesPaid = (invoices.data ?? []).filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0)
  const invoicesPending = (invoices.data ?? []).filter(i => i.status !== 'Paid').reduce((s, i) => s + Number(i.amount), 0)
  const payrollPending = (payroll.data ?? []).filter(p => p.status === 'Pending').reduce((s, p) => s + Number(p.base_salary) + Number(p.allowance) - Number(p.deductions), 0)

  const totalKm = completedJourneys.reduce((s, j) => s + Number(j.distance), 0)
  const totalLitres = (fuel.data ?? []).reduce((s, f) => s + f.litres, 0)
  const kmPerL = totalLitres > 0 ? totalKm / totalLitres : 0

  return {
    totalRevenue, totalExpenses, netProfit, totalFuel,
    invoicesPaid, invoicesPending, payrollPending,
    totalKm, totalLitres, kmPerL,
    activeTrucks: (trucks.data ?? []).filter(t => t.status === 'Active').length,
    totalTrucks: (trucks.data ?? []).length,
    completedTrips: completedJourneys.length,
  }
}
