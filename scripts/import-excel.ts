/**
 * Import Trucking 2025.xlsx into Segecha Group ERP Supabase database.
 * Run: npm run import-excel   or   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-excel.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EXCEL_PATH = 'Trucking 2025.xlsx'
const warnings: string[] = []
const calcErrors: { row: number; message: string }[] = []

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function num(val: unknown): number {
  if (val === undefined || val === null || val === '') return 0
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const n = Number(val)
  return Number.isNaN(n) ? 0 : n
}

function dateVal(val: unknown): string | null {
  if (val === undefined || val === null || val === '') return null
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (typeof val === 'string') {
    const m = val.match(/(\d{4})-(\d{2})-(\d{2})/) || val.match(/(\d+)\/(\d+)\/(\d+)/)
    if (m) {
      if (m[0].includes('-')) return m[0]
      const [, d, mon, y] = m
      const year = y!.length === 2 ? `20${y}` : y
      return `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return null
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Load Excel
// ---------------------------------------------------------------------------
let workbook: XLSX.WorkBook
try {
  workbook = XLSX.readFile(EXCEL_PATH)
} catch (e) {
  console.error('Failed to read', EXCEL_PATH, (e as Error).message)
  process.exit(1)
}

function getSheet(name: string): XLSX.WorkSheet {
  const sh = workbook.Sheets[name]
  if (!sh) throw new Error(`Sheet "${name}" not found`)
  return sh
}

// Trips_2025: headers row 1 (0-indexed), data from row 2
function getTripsRows(): Record<string, unknown>[] {
  const sh = getSheet('Trips_2025')
  const data = XLSX.utils.sheet_to_json(sh, { header: 1 }) as unknown[][]
  const headers = (data[1] || []) as string[]
  const rows: Record<string, unknown>[] = []
  for (let i = 2; i < data.length; i++) {
    const row = (data[i] || []) as unknown[]
    const obj: Record<string, unknown> = {}
    headers.forEach((h, j) => { obj[h] = row[j] })
    rows.push(obj)
  }
  return rows
}

// Maintenance: headers row 2, data from row 3
function getMaintenanceRows(): Record<string, unknown>[] {
  const sh = getSheet('Maintenance')
  const data = XLSX.utils.sheet_to_json(sh, { header: 1 }) as unknown[][]
  const headers = (data[2] || []) as string[]
  const rows: Record<string, unknown>[] = []
  for (let i = 3; i < data.length; i++) {
    const row = (data[i] || []) as unknown[]
    const obj: Record<string, unknown> = {}
    headers.forEach((h, j) => { obj[h] = row[j] })
    rows.push(obj)
  }
  return rows
}

// Fixed_Expenses: headers row 1, data from row 2
function getFixedExpensesRows(): Record<string, unknown>[] {
  const sh = getSheet('Fixed_Expenses')
  const data = XLSX.utils.sheet_to_json(sh, { header: 1 }) as unknown[][]
  const headers = (data[1] || []) as string[]
  const rows: Record<string, unknown>[] = []
  for (let i = 2; i < data.length; i++) {
    const row = (data[i] || []) as unknown[]
    const obj: Record<string, unknown> = {}
    headers.forEach((h, j) => { obj[h] = row[j] })
    rows.push(obj)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Step 1 — Trucks & Drivers
// ---------------------------------------------------------------------------
async function insertTrucksAndDrivers(): Promise<{ truckKdrId: string; truckZhId: string; driverId: string }> {
  // Use only columns common across schemas; some DBs require explicit id (TEXT PK)
  const truckPayloads = [
    { id: 'T-KDR381K', reg: 'KDR 381K', make: 'Mercedes-Benz Actros', year: 2019, type: 'Semi-Trailer', capacity: 28, status: 'Active', odom: 15159 },
    { id: 'T-ZH5825', reg: 'ZH 5825', make: 'Trailer', year: 2018, type: 'Trailer', capacity: 30, status: 'Active', odom: 0 },
  ]
  let { data: trucksData } = await supabase.from('trucks').select('id, reg').in('reg', ['KDR 381K', 'ZH 5825'])
  const haveKdr = trucksData?.some((t: { reg: string }) => t.reg === 'KDR 381K')
  const haveZh = trucksData?.some((t: { reg: string }) => t.reg === 'ZH 5825')
  if (!haveKdr) {
    const { error: e } = await supabase.from('trucks').insert(truckPayloads[0])
    if (e) throw new Error('Trucks: ' + e.message)
  }
  if (!haveZh) {
    const { error: e } = await supabase.from('trucks').insert(truckPayloads[1])
    if (e) throw new Error('Trucks: ' + e.message)
  }
  const { data: after } = await supabase.from('trucks').select('id, reg').in('reg', ['KDR 381K', 'ZH 5825'])
  trucksData = after
  const truckKdr = trucksData?.find((t: { reg: string }) => t.reg === 'KDR 381K')
  const truckZh = trucksData?.find((t: { reg: string }) => t.reg === 'ZH 5825')
  if (!truckKdr || !truckZh) throw new Error('Could not resolve truck ids')
  const truckKdrId = truckKdr.id as string
  const truckZhId = truckZh.id as string

  // DB may use truck (text id) or truck_id (UUID); some require explicit id
  const driverIdFallback = 'D-KDR381K'
  const driverPayload = { id: driverIdFallback, name: 'Driver 1', truck: truckKdrId, salary: 30000, status: 'Active' } as Record<string, unknown>
  const { data: existingList } = await supabase.from('drivers').select('id').eq('name', 'Driver 1')
  const existing = existingList?.[0]
  let driverId: string
  if (existing?.id) {
    driverId = existing.id
  } else {
    let { data: ins, error: insErr } = await supabase.from('drivers').insert(driverPayload).select('id').single()
    if (insErr && String(insErr.message).includes('truck_id')) {
      delete driverPayload.truck
      driverPayload.truck_id = truckKdrId
      const res = await supabase.from('drivers').insert(driverPayload).select('id').single()
      ins = res.data
      insErr = res.error
    }
    if (insErr && String(insErr.message).includes('id')) {
      delete driverPayload.id
      const res = await supabase.from('drivers').insert(driverPayload).select('id').single()
      ins = res.data
      insErr = res.error
    }
    if (insErr || !ins?.id) throw new Error('Drivers: ' + (insErr?.message ?? 'no id'))
    driverId = ins.id
  }
  return { truckKdrId, truckZhId, driverId }
}

// ---------------------------------------------------------------------------
// Step 2–4 — Journeys, Fuel, Variable Expenses (from Trips_2025)
// ---------------------------------------------------------------------------
interface JourneyRow {
  id: string
  truck_id: string
  driver_id: string
  origin: string
  destination: string
  date_start: string
  date_end: string | null
  distance: number
  revenue: number
  status: string
  notes: string | null
  _rowIndex: number
  _fuelL: number
  _pricePerL: number
  _fuelCost: number
  _driverMillage: number
  _turnBoy: number
  _roadUsers: number
  _otherExp: number
  _totalExp: number
  _netIncome: number
  _depositReceived: number
  _moneyDeposited: number
  _dateDeposited: string | null
}

async function insertJourneysFuelExpenses(
  truckKdrId: string,
  truckZhId: string,
  driverId: string,
  trips: Record<string, unknown>[]
): Promise<{ journeys: JourneyRow[]; useOldSchema: boolean }> {
  const inserted: JourneyRow[] = []
  let lastDate: string | null = null
  const regToTruckId: Record<string, string> = { 'KDR 381K': truckKdrId, 'ZH 5825': truckZhId }
  let useOldSchema: boolean | null = null

  for (let i = 0; i < trips.length; i++) {
    const r = trips[i]
    const rawDate = r['Date']
    let dateStart = dateVal(rawDate)
    const hasOrigin = r['Origin'] !== undefined && r['Origin'] !== null && String(r['Origin']).trim() !== ''
    const hasDestination = r['Destination'] !== undefined && r['Destination'] !== null && String(r['Destination']).trim() !== ''
    if (!dateStart && hasOrigin) {
      if (lastDate) {
        dateStart = addDays(lastDate, 7)
        warnings.push(`Trips_2025 row ${i + 3}: No Date — used previous + 7 days (${dateStart}). Date estimated.`)
      } else {
        warnings.push(`Trips_2025 row ${i + 3}: No Date and no previous row — skipping.`)
        continue
      }
    }
    if (!dateStart && !hasOrigin) continue
    if (!dateStart) continue

    lastDate = dateStart
    const vehicle = String(r['Vehicle'] ?? '').trim() || 'KDR 381K'
    const truckId = regToTruckId[vehicle] ?? truckKdrId
    const origin = String(r['Origin'] ?? '').replace(/^Export:\s*/i, '').trim() || 'Unknown'
    const destination = String(r['Destination'] ?? '').trim() || 'Unknown'
    const distance = num(r['Standard Distance'])
    const grossIncome = num(r['Gross Income'])
    const fuelL = num(r['Fuel(L)'])
    const pricePerL = num(r['Fuel Price (Per Litre)'])
    const fuelCost = num(r['Fuel Cost'])
    const driverMillage = num(r['Driver Millage'])
    const turnBoy = num(r['Turn-Boy'])
    const roadUsers = num(r['Road Users fee'])
    const otherExp = num(r['Other Expenses'])
    let totalExp = num(r['Total Expense'])
    if (totalExp === 0 && (fuelCost || driverMillage || turnBoy || roadUsers || otherExp)) {
      totalExp = fuelCost + driverMillage + turnBoy + roadUsers + otherExp
      if (i + 3 === 15 || i + 3 === 16) warnings.push(`Trips_2025 row ${i + 3}: Total Expense was blank — calculated from components.`)
    }
    const netIncome = num(r['Net Income'])
    const depositReceived = num(r['Deposit Received'])
    const moneyDeposited = num(r['Money Deposited at Bank'])
    const dateDeposited = dateVal(r['Date Deposited'])

    if (Math.abs(fuelL * pricePerL - fuelCost) > 5) {
      calcErrors.push({ row: i + 3, message: `Fuel Cost mismatch: Fuel(L)*Price=${fuelL * pricePerL} vs Fuel Cost=${fuelCost}` })
    }
    if (totalExp > 0 && Math.abs(totalExp - (fuelCost + driverMillage + turnBoy + roadUsers + otherExp)) > 5) {
      calcErrors.push({ row: i + 3, message: `Total Expense != sum of components` })
    }
    if (netIncome !== 0 && Math.abs(netIncome - (grossIncome - totalExp)) > 5) {
      calcErrors.push({ row: i + 3, message: `Net Income != Gross Income - Total Expense` })
    }
    if (i + 3 === 26 && fuelL > 0 && fuelL < 400) {
      warnings.push('Trips_2025 row 26: Abnormally low fuel (280L for Mombasa→Kampala) — imported as-is.')
    }

    const status = Number.isNaN(Number(r['Net Income'])) || r['Net Income'] === '' ? 'In Transit' : 'Completed'
    const importFlags: string[] = []
    if (!dateVal(rawDate) && hasOrigin) importFlags.push('Date estimated (no date in source).')
    if (totalExp > 0 && num(r['Total Expense']) === 0 && (fuelCost || driverMillage || turnBoy || roadUsers || otherExp)) importFlags.push('Total expense was blank – calculated from components.')
    if (i + 3 === 26 && fuelL > 0 && fuelL < 400) importFlags.push('Unusually low fuel – verify.')
    if (Math.abs(fuelL * pricePerL - fuelCost) > 5) importFlags.push(`Fuel cost mismatch: Fuel(L)×Price=${fuelL * pricePerL} vs sheet=${fuelCost} – verify.`)
    if (totalExp > 0 && Math.abs(totalExp - (fuelCost + driverMillage + turnBoy + roadUsers + otherExp)) > 5) importFlags.push('Total expense ≠ sum of components – verify.')
    if (netIncome !== 0 && Math.abs(netIncome - (grossIncome - totalExp)) > 5) importFlags.push('Net income ≠ Gross − Total expense – verify.')

    let notes: string | null = null
    if (depositReceived > 0) notes = `Deposit: KES ${depositReceived}`
    if (importFlags.length) notes = (notes ? notes + '\n\n' : '') + '[Import – fix and clear when done]: ' + importFlags.join(' ')

    let journeyId: string
    if (useOldSchema) {
      const journeyIdNew = 'J-' + String(i + 1).padStart(3, '0')
      const oldPayload = { id: journeyIdNew, truck: truckId, driver: driverId, origin, dest: destination, date: dateStart, endDate: dateDeposited || null, distance, revenue: grossIncome, status, notes }
      const { error: insErr } = await supabase.from('journeys').insert(oldPayload)
      if (insErr) {
        const { error: upErr } = await supabase.from('journeys').update({ truck: truckId, driver: driverId, origin, dest: destination, date: dateStart, endDate: dateDeposited || null, distance, revenue: grossIncome, status, notes }).eq('id', journeyIdNew)
        if (upErr) throw new Error(`Journey row ${i + 3}: ${insErr.message}`)
      }
      journeyId = journeyIdNew
    } else {
      const newPayload = { truck_id: truckId, driver_id: driverId, origin, destination, date_start: dateStart, date_end: dateDeposited || null, distance, revenue: grossIncome, status, notes }
      const { data: journeyData, error: journeyErr } = await supabase.from('journeys').insert(newPayload).select('id').single()
      if (journeyErr) {
        if (useOldSchema === null && (String(journeyErr.message).includes('date_end') || String(journeyErr.message).includes('destination') || String(journeyErr.message).includes('truck_id'))) {
          useOldSchema = true
          const journeyIdNew = 'J-' + String(i + 1).padStart(3, '0')
          const oldPayload = { id: journeyIdNew, truck: truckId, driver: driverId, origin, dest: destination, date: dateStart, endDate: dateDeposited || null, distance, revenue: grossIncome, status, notes }
          const { error: e2 } = await supabase.from('journeys').insert(oldPayload)
          if (e2) {
            const { error: upErr } = await supabase.from('journeys').update({ truck: truckId, driver: driverId, origin, dest: destination, date: dateStart, endDate: dateDeposited || null, distance, revenue: grossIncome, status, notes }).eq('id', journeyIdNew)
            if (upErr) throw new Error(`Journey row ${i + 3}: ${e2.message}`)
          }
          journeyId = journeyIdNew
        } else {
          throw new Error(`Journey row ${i + 3}: ${journeyErr.message}`)
        }
      } else {
        journeyId = journeyData!.id
      }
    }

    inserted.push({
      id: journeyId,
      truck_id: truckId,
      driver_id: driverId,
      origin,
      destination,
      date_start: dateStart,
      date_end: dateDeposited || null,
      distance,
      revenue: grossIncome,
      status,
      notes,
      _rowIndex: i + 3,
      _fuelL: fuelL,
      _pricePerL: pricePerL,
      _fuelCost: fuelCost,
      _driverMillage: driverMillage,
      _turnBoy: turnBoy,
      _roadUsers: roadUsers,
      _otherExp: otherExp,
      _totalExp: totalExp,
      _netIncome: netIncome,
      _depositReceived: depositReceived,
      _moneyDeposited: moneyDeposited,
      _dateDeposited: dateDeposited,
    } as JourneyRow)

    if (fuelL > 0) {
      if (useOldSchema) {
        const fuelId = 'F-' + String(i + 1).padStart(3, '0')
        const { error: fuelErr } = await supabase.from('fuel').upsert({ id: fuelId, truck: truckId, journey: journeyId, date: dateStart, litres: fuelL, pricePerL: pricePerL, station: 'Field record', odom: null }, { onConflict: 'id' })
        if (fuelErr) throw new Error(`Fuel row ${i + 3}: ${fuelErr.message}`)
      } else {
        const { error: fuelErr } = await supabase.from('fuel_log').insert({ truck_id: truckId, journey_id: journeyId, date: dateStart, litres: fuelL, price_per_l: pricePerL, station: 'Field record', odom: null })
        if (fuelErr) throw new Error(`Fuel row ${i + 3}: ${fuelErr.message}`)
      }
    }

    const expenseRowsNew = [
      ...(driverMillage > 0 ? [{ truck_id: truckId, journey_id: journeyId, category: 'Allowance' as const, amount: driverMillage, description: 'Driver mileage allowance', date: dateStart }] : []),
      ...(turnBoy > 0 ? [{ truck_id: truckId, journey_id: journeyId, category: 'Allowance' as const, amount: turnBoy, description: 'Turn-boy allowance', date: dateStart }] : []),
      ...(roadUsers > 0 ? [{ truck_id: truckId, journey_id: journeyId, category: 'Toll' as const, amount: roadUsers, description: 'Road users fee / toll', date: dateStart }] : []),
      ...(otherExp > 0 ? [{ truck_id: truckId, journey_id: journeyId, category: 'Other' as const, amount: otherExp, description: 'Other trip expenses', date: dateStart }] : []),
    ]
    for (let ei = 0; ei < expenseRowsNew.length; ei++) {
      const ex = expenseRowsNew[ei]
      if (useOldSchema) {
        const expId = 'E-J' + String(i + 1).padStart(3, '0') + '-' + ei
        const { error: exErr } = await supabase.from('expenses').upsert({ id: expId, truck: truckId, journey: journeyId, cat: ex.category, amount: ex.amount, date: ex.date, desc: ex.description }, { onConflict: 'id' })
        if (exErr) throw new Error(`Expense row ${i + 3}: ${exErr.message}`)
      } else {
        const { error: exErr } = await supabase.from('expenses').insert(ex)
        if (exErr) throw new Error(`Expense row ${i + 3}: ${exErr.message}`)
      }
    }

    if ((i + 1) % 10 === 0) console.log(`Importing trip ${i + 1}/${trips.length}...`)
  }

  return { journeys: inserted, useOldSchema: useOldSchema === true }
}

// ---------------------------------------------------------------------------
// Step 5 — Maintenance expenses
// ---------------------------------------------------------------------------
async function insertMaintenanceExpenses(truckKdrId: string, truckZhId: string, useOldSchema: boolean): Promise<number> {
  const rows = getMaintenanceRows()
  const regToId: Record<string, string> = { 'KDR 381K': truckKdrId, 'ZH 5825': truckZhId }
  let count = 0
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const vehicleReg = r['Vehicle Reg']
    if (vehicleReg === undefined || vehicleReg === null || String(vehicleReg).trim() === '') {
      warnings.push(`Maintenance row ${i + 4}: No Vehicle Reg — assigning to KDR 381K. Vehicle not specified in source.`)
    }
    const costRaw = r['Cost']
    if (costRaw === '???' || costRaw === undefined || costRaw === null) {
      if (String(costRaw) === '???') warnings.push(`Maintenance row ${i + 4}: Cost = "???" — skipped.`)
      continue
    }
    const cost = num(costRaw)
    if (cost === 0) continue
    const truckId = regToId[String(vehicleReg || 'KDR 381K').trim()] ?? truckKdrId
    const task = String(r['Task'] ?? '')
    const notes = String(r['Notes'] ?? '')
    let desc = (task + (notes ? ': ' + notes : '')).slice(0, 180)
    if (vehicleReg === undefined || vehicleReg === null || String(vehicleReg).trim() === '') {
      desc = (desc + ' [Import: Vehicle not in source – assigned KDR 381K. Fix if wrong.]').slice(0, 200)
    }
    const dateUndertaken = dateVal(r['Date Undertaken'])
    if (!dateUndertaken) continue
    const category = /tyre/i.test(task) ? 'Tyre' : 'Maintenance'
    if (useOldSchema) {
      const { error } = await supabase.from('expenses').insert({ id: 'M-' + String(i + 1).padStart(3, '0'), truck: truckId, journey: null, cat: category, amount: cost, date: dateUndertaken, desc })
      if (error) throw new Error(`Maintenance row ${i + 4}: ${error.message}`)
    } else {
      const { error } = await supabase.from('expenses').insert({ truck_id: truckId, journey_id: null, category, amount: cost, description: desc, date: dateUndertaken })
      if (error) throw new Error(`Maintenance row ${i + 4}: ${error.message}`)
    }
    count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Step 6 — Fixed expenses (Jan–Apr 2025)
// ---------------------------------------------------------------------------
const FIXED_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr'] as const
const MONTH_ISO: Record<string, string> = { Jan: '2025-01-01', Feb: '2025-02-01', Mar: '2025-03-01', Apr: '2025-04-01' }
const FIXED_CATEGORY: Record<string, string> = {
  'Lorry Insurance': 'Insurance',
  'Trailer Insurance': 'Insurance',
  'Licence and Permits': 'Permit',
  'Driver Salaries': 'Salary',
  'Admin Salaries': 'Salary',
  'COMESA Lorry': 'Permit',
  'COMESA Trailer': 'Permit',
}

async function insertFixedExpenses(truckKdrId: string, useOldSchema: boolean): Promise<number> {
  const rows = getFixedExpensesRows()
  let count = 0
  let expIdx = 0
  for (const r of rows) {
    const item = String(r['Expense Item'] ?? '').trim()
    const category = FIXED_CATEGORY[item] ?? 'Other'
    for (const mon of FIXED_MONTHS) {
      const val = r[mon]
      const amount = num(val)
      if (amount === 0) continue
      const date = MONTH_ISO[mon]
      expIdx++
      if (useOldSchema) {
        const { error } = await supabase.from('expenses').insert({ id: 'FX-' + String(expIdx).padStart(3, '0'), truck: truckKdrId, journey: null, cat: category, amount, date, desc: item })
        if (error) throw new Error(`Fixed expense ${item} ${mon}: ${error.message}`)
      } else {
        const { error } = await supabase.from('expenses').insert({ truck_id: truckKdrId, journey_id: null, category, amount, description: item, date })
        if (error) throw new Error(`Fixed expense ${item} ${mon}: ${error.message}`)
      }
      count++
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// Step 7 — Invoices
// ---------------------------------------------------------------------------
async function insertInvoices(journeys: JourneyRow[], useOldSchema: boolean): Promise<number> {
  let count = 0
  for (let i = 0; i < journeys.length; i++) {
    const j = journeys[i]
    if (j.revenue <= 0) continue
    const id = `INV-${String(i + 1).padStart(3, '0')}`
    const due = addDays(j.date_start, 14)
    const status = j._moneyDeposited >= j.revenue * 0.7 ? 'Paid' : 'Pending'
    const balance = j.revenue - j._moneyDeposited
    const notes = `Deposit received: KES ${j._depositReceived}. Balance: KES ${balance}`
    const payload = useOldSchema
      ? { id, journey: j.id, client: 'Client - ' + j.destination, amount: j.revenue, issued: j.date_start, due, status, mpesaRef: null, paidDate: j._dateDeposited || null, notes }
      : { id, journey_id: j.id, client: 'Client - ' + j.destination, amount: j.revenue, issued: j.date_start, due, status, mpesa_ref: null, paid_date: j._dateDeposited || null, notes }
    const { error } = await supabase.from('invoices').upsert(payload, { onConflict: 'id' })
    if (error) throw new Error(`Invoice ${id}: ${error.message}`)
    count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Step 8 — Payroll (Jan–Apr 2025)
// ---------------------------------------------------------------------------
async function insertPayroll(driverId: string, useOldSchema: boolean): Promise<number> {
  const months = ['2025-01', '2025-02', '2025-03', '2025-04']
  for (let i = 0; i < months.length; i++) {
    const month = months[i]
    if (useOldSchema) {
      const payload = { id: 'PAY-2025-' + String(i + 1).padStart(2, '0'), driver: driverId, month, baseSalary: 30000, allowance: 0, deductions: 0, status: 'Paid' }
      const { error } = await supabase.from('payroll').upsert(payload, { onConflict: 'id' })
      if (error) throw new Error(`Payroll ${month}: ${error.message}`)
    } else {
      const { error } = await supabase.from('payroll').upsert({ driver_id: driverId, month, base_salary: 30000, allowance: 0, deductions: 0, status: 'Paid' }, { onConflict: 'driver_id,month' })
      if (error) throw new Error(`Payroll ${month}: ${error.message}`)
    }
  }
  return months.length
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
const EXPECTED_REVENUE = 11811200
const EXPECTED_FUEL_COST = 6295976
const EXPECTED_TRIPS = 51

async function runVerification(journeyCount: number, useOldSchema: boolean): Promise<void> {
  const { data: jData } = await supabase.from('journeys').select('revenue')
  const totalRevenue = (jData || []).reduce((s: number, r: { revenue: number }) => s + num(r.revenue), 0)
  const fTable = useOldSchema ? 'fuel' : 'fuel_log'
  const fCols = useOldSchema ? 'litres, pricePerL' : 'litres, price_per_l'
  const { data: fData } = await supabase.from(fTable).select(fCols)
  const priceKey = useOldSchema ? 'pricePerL' : 'price_per_l'
  const totalFuel = (fData || []).reduce((s: number, r: Record<string, number>) => s + num(r.litres) * num(r[priceKey]), 0)

  console.log('\nCALCULATION VERIFICATION:')
  console.log(`  Total Revenue:     KES ${totalRevenue.toLocaleString()}  ${Math.abs(totalRevenue - EXPECTED_REVENUE) < 100 ? '✅ matches Excel' : '❌ expected ' + EXPECTED_REVENUE.toLocaleString()}`)
  console.log(`  Total Fuel Cost:   KES ${Math.round(totalFuel).toLocaleString()}   ${Math.abs(totalFuel - EXPECTED_FUEL_COST) < 100 ? '✅ matches Excel' : '❌ expected ' + EXPECTED_FUEL_COST.toLocaleString()}`)
  console.log(`  Trips inserted:    ${journeyCount}  ${journeyCount === EXPECTED_TRIPS ? '✅' : '(expected ~' + EXPECTED_TRIPS + ')'}`)
  console.log(`  Trips with calc errors: ${calcErrors.length}`)

  const expCatCol = useOldSchema ? 'cat' : 'category'
  const { data: expData } = await supabase.from('expenses').select(`amount, date, ${expCatCol}`)
  const byMonth: Record<string, { revenue: number; fuel: number; otherVar: number; fixed: number }> = {}
  for (const e of expData || []) {
    const d = e.date as string
    const mon = d.slice(0, 7)
    if (!byMonth[mon]) byMonth[mon] = { revenue: 0, fuel: 0, otherVar: 0, fixed: 0 }
    const amt = num(e.amount)
    const cat = String((e as Record<string, string>)[expCatCol] || '')
    if (cat === 'Fuel') byMonth[mon].fuel += amt
    else if (['Allowance', 'Toll', 'Other'].includes(cat)) byMonth[mon].otherVar += amt
    else byMonth[mon].fixed += amt
  }
  const { data: fuelData } = await supabase.from(fTable).select('date, litres, ' + (useOldSchema ? 'pricePerL' : 'price_per_l'))
  const fuelRows = (fuelData || []) as unknown[]
  for (const f of fuelRows) {
    const row = f as Record<string, unknown>
    const mon = String(row.date).slice(0, 7)
    if (!byMonth[mon]) byMonth[mon] = { revenue: 0, fuel: 0, otherVar: 0, fixed: 0 }
    byMonth[mon].fuel += num(row.litres) * num(row[priceKey])
  }
  const journeyDateCol = useOldSchema ? 'date' : 'date_start'
  const { data: revData } = await supabase.from('journeys').select(`revenue, ${journeyDateCol}`)
  const revRows = (revData || []) as unknown[]
  for (const r of revRows) {
    const row = r as Record<string, unknown>
    const mon = String(row[journeyDateCol]).slice(0, 7)
    if (!byMonth[mon]) byMonth[mon] = { revenue: 0, fuel: 0, otherVar: 0, fixed: 0 }
    byMonth[mon].revenue += num(row.revenue)
  }
  console.log('\nMONTHLY P&L SUMMARY:')
  const monthsOrder = Object.keys(byMonth).sort()
  for (const mon of monthsOrder) {
    const m = byMonth[mon]
    const totalExp = m.fuel + m.otherVar + m.fixed
    const profit = m.revenue - totalExp
    console.log(`  ${mon} | Revenue: ${m.revenue.toLocaleString()}  | Expenses: ${totalExp.toLocaleString()}  | Profit: ${profit.toLocaleString()}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Loading', EXCEL_PATH, '...')
  const trips = getTripsRows()
  console.log('Trips_2025 total rows:', trips.length)

  console.log('\nStep 1 — Trucks & Drivers')
  const { truckKdrId, truckZhId, driverId } = await insertTrucksAndDrivers()
  console.log('✅ Trucks inserted: 2')
  console.log('✅ Drivers inserted: 1')

  console.log('\nStep 2–4 — Journeys, Fuel, Variable expenses')
  const { journeys, useOldSchema } = await insertJourneysFuelExpenses(truckKdrId, truckZhId, driverId, trips)
  const fuelCount = journeys.filter((j: JourneyRow) => j._fuelL > 0).length
  const varExpCount = journeys.reduce((s: number, j: JourneyRow) => {
    let n = 0
    if (j._driverMillage > 0) n++
    if (j._turnBoy > 0) n++
    if (j._roadUsers > 0) n++
    if (j._otherExp > 0) n++
    return s + n
  }, 0)
  console.log('✅ Journeys inserted:', journeys.length)
  console.log('✅ Fuel log entries:', fuelCount)
  console.log('✅ Variable expenses:', varExpCount)

  console.log('\nStep 5 — Maintenance expenses')
  const maintCount = await insertMaintenanceExpenses(truckKdrId, truckZhId, useOldSchema)
  console.log('✅ Maintenance expenses:', maintCount)

  console.log('\nStep 6 — Fixed expenses (Jan–Apr 2025)')
  const fixedCount = await insertFixedExpenses(truckKdrId, useOldSchema)
  console.log('✅ Fixed expenses:', fixedCount)

  console.log('\nStep 7 — Invoices')
  const invCount = await insertInvoices(journeys, useOldSchema)
  console.log('✅ Invoices:', invCount)

  console.log('\nStep 8 — Payroll (Jan–Apr 2025)')
  const payrollCount = await insertPayroll(driverId, useOldSchema)
  console.log('✅ Payroll records:', payrollCount)

  await runVerification(journeys.length, useOldSchema)

  if (warnings.length) {
    console.log('\n⚠️ WARNINGS:')
    warnings.forEach((w) => console.log('  ', w))
  }
  if (calcErrors.length) {
    console.log('\n❌ CALC ERRORS:')
    calcErrors.forEach((e) => console.log('  Row', e.row, e.message))
  }
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
