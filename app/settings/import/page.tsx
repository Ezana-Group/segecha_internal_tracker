'use client'

import React, { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, uid } from '@/lib/ErpContext'
import { ErpModal } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const REQUIRED_COLS = ['Vehicle', 'Date', 'Origin', 'Destination', 'Gross Income']
const OPTIONAL_COLS = [
  'Standard Distance', 'Fuel(L)', 'Fuel Price (Per Litre)', 'Fuel Cost',
  'Driver Millage', 'Turn-Boy', 'Road Users fee', 'Other Expenses',
  'Total Expense', 'Net Income', 'Money Deposited at Bank', 'Date Deposited',
  'Deposit Received', 'Notes',
]

type RowStatus = 'passed' | 'warning' | 'failed' | 'skipped' | 'imported'
interface ParsedRow {
  _rowNumber: number
  _status: RowStatus
  _issues: string[]
  _warnings: string[]
  _fixed: boolean
  [key: string]: unknown
}

type FilterType = 'all' | 'passed' | 'warning' | 'failed'
type TabType = 'import' | 'history'

function validateRows(rows: Record<string, unknown>[], _headers: string[]): ParsedRow[] {
  return rows.map((row) => {
    const issues: string[] = []
    const warnings: string[] = []
    const rowNum = row._rowNumber as number

    const hasAnyData = Object.entries(row)
      .filter(([k]) => !String(k).startsWith('_'))
      .some(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')

    if (!hasAnyData) {
      return {
        ...row,
        _rowNumber: rowNum,
        _status: 'skipped',
        _issues: [],
        _warnings: ['Empty row — skipped'],
        _fixed: false,
      } as ParsedRow
    }

    if (!row['Vehicle'] || String(row['Vehicle']).trim() === '') {
      issues.push('Missing vehicle registration number')
    }
    if (!row['Date'] || String(row['Date']).trim() === '') {
      issues.push('Missing departure date — cannot determine when this trip occurred')
    } else {
      const d = new Date(row['Date'] as string)
      if (isNaN(d.getTime())) {
        issues.push(`Invalid date format: "${row['Date']}" — use YYYY-MM-DD`)
      }
    }
    if (!row['Origin'] || String(row['Origin']).trim() === '') {
      issues.push('Missing origin location')
    }
    if (!row['Destination'] || String(row['Destination']).trim() === '') {
      issues.push('Missing destination')
    }
    if (!row['Gross Income'] || Number(row['Gross Income']) === 0) {
      issues.push('Missing or zero revenue — did this trip generate income?')
    }

    const fuelL = Number(row['Fuel(L)'] ?? 0)
    const fuelPrice = Number(row['Fuel Price (Per Litre)'] ?? 0)
    const statedFuelCost = Number(row['Fuel Cost'] ?? 0)
    const calcFuelCost = Math.round(fuelL * fuelPrice)
    if (fuelL > 0 && fuelPrice > 0 && statedFuelCost > 0) {
      if (Math.abs(calcFuelCost - statedFuelCost) > 5) {
        warnings.push(
          `Fuel cost mismatch: ${fuelL}L × KES ${fuelPrice} = KES ${calcFuelCost.toLocaleString()}, but column shows KES ${statedFuelCost.toLocaleString()} (difference: KES ${Math.abs(calcFuelCost - statedFuelCost).toLocaleString()})`
        )
      }
    }

    const driverMil = Number(row['Driver Millage'] ?? 0)
    const turnboy = Number(row['Turn-Boy'] ?? 0)
    const road = Number(row['Road Users fee'] ?? 0)
    const other = Number(row['Other Expenses'] ?? 0)
    const statedTotal = Number(row['Total Expense'] ?? 0)
    const calcTotal = statedFuelCost + driverMil + turnboy + road + other
    if (statedTotal > 0 && Math.abs(calcTotal - statedTotal) > 5) {
      warnings.push(
        `Total expense mismatch: fuel(${statedFuelCost.toLocaleString()}) + allowance(${driverMil.toLocaleString()}) + tolls(${road.toLocaleString()}) + other(${other.toLocaleString()}) = KES ${calcTotal.toLocaleString()}, but column shows KES ${statedTotal.toLocaleString()}`
      )
    }

    const gross = Number(row['Gross Income'] ?? 0)
    const net = Number(row['Net Income'] ?? 0)
    const calcNet = gross - statedTotal
    if (statedTotal > 0 && gross > 0 && Math.abs(calcNet - net) > 5) {
      warnings.push(
        `Net income mismatch: KES ${gross.toLocaleString()} − KES ${statedTotal.toLocaleString()} = KES ${calcNet.toLocaleString()}, but column shows KES ${net.toLocaleString()}`
      )
    }

    if (fuelL > 1500) warnings.push(`Unusually high fuel: ${fuelL}L — please verify`)
    if (fuelL < 50 && fuelL > 0) warnings.push(`Unusually low fuel: ${fuelL}L — please verify`)
    if (gross > 500000) warnings.push(`Very high revenue: KES ${gross.toLocaleString()} — please verify`)

    const status: RowStatus = issues.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed'
    return { ...row, _status: status, _issues: issues, _warnings: warnings, _fixed: false } as ParsedRow
  })
}

function EditableCell({
  row,
  col,
  onFix,
  status,
}: {
  row: ParsedRow
  col: string
  onFix: (rowNumber: number, col: string, val: string) => void
  status: RowStatus
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(row[col] ?? ''))

  if (status !== 'failed') {
    return (
      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
        {row[col] != null && row[col] !== '' ? String(row[col]) : '—'}
      </td>
    )
  }

  return (
    <td className="px-3 py-2" onClick={() => setEditing(true)}>
      {editing ? (
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            onFix(row._rowNumber, col, val)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onFix(row._rowNumber, col, val)
              setEditing(false)
            }
          }}
          className="border border-blue-400 rounded px-1 py-0.5 text-xs w-28 bg-white dark:bg-slate-800 dark:border-blue-500 dark:text-white"
          autoFocus
        />
      ) : (
        <span
          className={`cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 px-1 rounded ${
            !row[col] ? 'text-red-400 italic' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {row[col] != null && row[col] !== '' ? String(row[col]) : 'click to fix'}
        </span>
      )}
    </td>
  )
}

interface ImportSession {
  id: string
  filename: string
  sheet_name: string | null
  imported_by_name: string | null
  total_rows: number
  passed_rows: number
  failed_rows: number
  warning_rows: number
  status: string
  created_at: string
}

interface AppUser {
  id: string
  name: string
  role: string
}

export default function ImportPage() {
  const { S } = useErpContext()
  const [tab, setTab] = useState<TabType>('import')
  const [user, setUser] = useState<AppUser | null>(null)
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [validating, setValidating] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [fixModalRow, setFixModalRow] = useState<ParsedRow | null>(null)
  const [fixForm, setFixForm] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<{
    journeys: number
    fuel: number
    expenses: number
    invoices: number
    errors: string[]
  } | null>(null)
  const [sessions, setSessions] = useState<ImportSession[]>([])
  const [logModalSessionId, setLogModalSessionId] = useState<string | null>(null)
  const [logRows, setLogRows] = useState<any[]>([])

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('id', session.user.id)
        .single()
      if (profile) setUser(profile as AppUser)
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (tab === 'history') {
      supabase
        .from('import_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => setSessions((data as ImportSession[]) || []))
    }
  }, [tab])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) handleFile(file)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Maximum file size is 10MB')
      return
    }
    setFileName(file.name)
    setStep(2)
    setValidating(true)

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    setWorkbook(wb)
    const sheetNames = wb.SheetNames
    setAvailableSheets(sheetNames)
    const defaultSheet = sheetNames.includes('Trips_2025') ? 'Trips_2025' : sheetNames[0]
    setSelectedSheet(defaultSheet)
    parseSheet(wb, defaultSheet)
    setValidating(false)
  }

  const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const sheet = wb.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][]

    let headerRowIdx = 0
    for (let i = 0; i < Math.min(5, raw.length); i++) {
      const row = (raw[i] || []).map((v) => String(v ?? '').trim())
      if (row.includes('Vehicle') || row.includes('Date') || row.includes('Origin')) {
        headerRowIdx = i
        break
      }
    }

    const headers = (raw[headerRowIdx] || []).map((v) => String(v ?? '').trim())
    const dataRows = raw.slice(headerRowIdx + 1)

    const rowsMapped: Record<string, unknown>[] = dataRows.map((row, idx) => {
      const obj: Record<string, unknown> = { _rowNumber: idx + headerRowIdx + 2 }
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? null
      })
      return obj
    })

    setRows(validateRows(rowsMapped, headers))
  }

  const applyFix = (rowNumber: number, col: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._rowNumber !== rowNumber) return r
        const updated = { ...r, [col]: val, _fixed: true }
        const revalidated = validateRows([updated], [])
        return revalidated[0] ?? updated
      })
    )
  }

  const openFixModal = (row: ParsedRow) => {
    setFixModalRow(row)
    const form: Record<string, string> = {}
    REQUIRED_COLS.forEach((c) => {
      form[c] = row[c] != null ? String(row[c]) : ''
    })
    OPTIONAL_COLS.forEach((c) => {
      form[c] = row[c] != null ? String(row[c]) : ''
    })
    setFixForm(form)
  }

  const applyFixInModal = () => {
    if (!fixModalRow) return
    setRows((prev) =>
      prev.map((r) => {
        if (r._rowNumber !== fixModalRow._rowNumber) return r
        const updated = { ...r, ...fixForm, _fixed: true }
        const revalidated = validateRows([updated], [])
        return revalidated[0] ?? updated
      })
    )
    setFixModalRow(null)
    setFixForm({})
  }

  const skipRow = (rowNumber: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._rowNumber !== rowNumber) return r
        return { ...r, _status: 'skipped' as RowStatus, _issues: [...r._issues, 'Manually skipped'], _fixed: false }
      })
    )
    setFixModalRow(null)
  }

  const importableRows = useMemo(
    () => rows.filter((r) => r._status === 'passed' || r._status === 'warning'),
    [rows]
  )
  const failedRows = useMemo(() => rows.filter((r) => r._status === 'failed'), [rows])
  const skippedRows = useMemo(() => rows.filter((r) => r._status === 'skipped'), [rows])

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((r) => r._status === filter)
  }, [rows, filter])

  const runImport = async () => {
    if (!user) {
      toast.error('Not logged in')
      return
    }
    setImporting(true)
    setImportProgress(0)

    const { data: session, error: sessionErr } = await supabase
      .from('import_sessions')
      .insert({
        filename: fileName,
        sheet_name: selectedSheet,
        imported_by: user.id,
        imported_by_name: user.name,
        total_rows: rows.length,
        passed_rows: importableRows.length,
        failed_rows: failedRows.length,
        warning_rows: rows.filter((r) => r._status === 'warning').length,
        status: 'importing',
      })
      .select()
      .single()

    if (sessionErr || !session) {
      toast.error(sessionErr?.message || 'Failed to create import session')
      setImporting(false)
      return
    }

    const sessionId = session.id
    const results = { journeys: 0, fuel: 0, expenses: 0, invoices: 0, errors: [] as string[] }

    const { data: trucks } = await supabase.from('trucks').select('id, reg')
    const truckMap: Record<string, string> = {}
    trucks?.forEach((t: { id: string; reg: string }) => {
      truckMap[String(t.reg).trim().toUpperCase()] = t.id
    })

    const { data: drivers } = await supabase.from('drivers').select('id, name, truck')
    const driverByTruck: Record<string, string> = {}
    drivers?.forEach((d: { id: string; truck: string | null }) => {
      if (d.truck) driverByTruck[d.truck] = d.id
    })

    for (let i = 0; i < importableRows.length; i++) {
      const row = importableRows[i]
      setImportProgress(i + 1)

      try {
        const vehicleReg = String(row['Vehicle'] ?? '').trim().toUpperCase()
        const truckId = truckMap[vehicleReg]
        if (!truckId) {
          results.errors.push(`Row ${row._rowNumber}: Truck "${row['Vehicle']}" not found in fleet`)
          continue
        }

        const driverId = driverByTruck[truckId] ?? null
        const dateStr =
          row['Date'] instanceof Date
            ? (row['Date'] as Date).toISOString().split('T')[0]
            : String(row['Date']).split('T')[0].split(' ')[0]
        const origin = String(row['Origin'] ?? '').replace(/^Export:\s*/i, '').trim()
        const dest = String(row['Destination'] ?? '').trim()

        const journeyPayload = {
          id: `J-IMP-${uid()}`,
          truck: truckId,
          driver: driverId,
          origin,
          dest,
          date: dateStr,
          endDate: row['Date Deposited']
            ? row['Date Deposited'] instanceof Date
              ? (row['Date Deposited'] as Date).toISOString().split('T')[0]
              : String(row['Date Deposited']).split('T')[0]
            : null,
          distance: Number(row['Standard Distance'] ?? 0) || 0,
          revenue: Number(row['Gross Income'] ?? 0),
          status: 'Completed',
          notes: (row['Notes'] as string) ?? null,
        }

        const { data: journey, error: jErr } = await supabase
          .from('journeys')
          .upsert(journeyPayload, { onConflict: 'truck,date,origin,dest' })
          .select()
          .single()

        if (jErr) throw new Error(`Journey insert failed: ${jErr.message}`)
        results.journeys++

        // Fuel: one per journey — deterministic id so re-import updates, no duplicate
        const fuelL = Number(row['Fuel(L)'] ?? 0)
        const fuelPrice = Number(row['Fuel Price (Per Litre)'] ?? 0)
        if (fuelL > 0 && fuelPrice > 0 && journey) {
          await supabase.from('fuel').upsert(
            {
              id: `F-${journey.id}`,
              truck: truckId,
              journey: journey.id,
              date: dateStr,
              litres: fuelL,
              pricePerL: fuelPrice,
              station: 'Imported from Excel',
            },
            { onConflict: 'id' }
          )
          results.fuel++
        }

        // Expenses: deterministic id per journey + category so re-import updates, no duplicate
        const expenseMap = [
          { col: 'Driver Millage', slug: 'DriverMillage', cat: 'Allowance', desc: 'Driver mileage allowance' },
          { col: 'Turn-Boy', slug: 'TurnBoy', cat: 'Allowance', desc: 'Turn-boy allowance' },
          { col: 'Road Users fee', slug: 'RoadUsers', cat: 'Toll', desc: 'Road users fee' },
          { col: 'Other Expenses', slug: 'OtherExpenses', cat: 'Other', desc: 'Other trip expenses' },
        ]
        for (const { col, slug, cat, desc } of expenseMap) {
          const amount = Number(row[col] ?? 0)
          if (amount > 0 && journey) {
            await supabase.from('expenses').upsert(
              {
                id: `E-${journey.id}-${slug}`,
                truck: truckId,
                journey: journey.id,
                cat,
                amount,
                date: dateStr,
                desc,
              },
              { onConflict: 'id' }
            )
            results.expenses++
          }
        }

        // Invoice: one per journey — deterministic id so re-import updates, no duplicate
        const gross = Number(row['Gross Income'] ?? 0)
        if (gross > 0 && journey) {
          const deposited = Number(row['Money Deposited at Bank'] ?? 0)
          const invStatus = deposited >= gross * 0.9 ? 'Paid' : 'Pending'
          const paidDate = row['Date Deposited']
            ? row['Date Deposited'] instanceof Date
              ? (row['Date Deposited'] as Date).toISOString().split('T')[0]
              : String(row['Date Deposited']).split('T')[0]
            : null
          await supabase.from('invoices').upsert(
            {
              id: `INV-${journey.id}`,
              journey: journey.id,
              client: dest,
              amount: gross,
              issued: dateStr,
              due: new Date(new Date(dateStr).getTime() + 14 * 86400000).toISOString().split('T')[0],
              status: invStatus,
              paidDate,
              notes: `Deposit received: KES ${deposited.toLocaleString()}`,
            },
            { onConflict: 'id' }
          )
          results.invoices++
        }

        await supabase.from('import_log').insert({
          session_id: sessionId,
          row_number: row._rowNumber,
          sheet_name: selectedSheet,
          row_data: row,
          status: 'imported',
          issues: row._issues,
          warnings: row._warnings,
        })
      } catch (err: unknown) {
        results.errors.push(`Row ${row._rowNumber}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    await supabase
      .from('import_sessions')
      .update({
        status: 'completed',
        summary: results,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    setImportResults(results)
    setStep(5)
    setImporting(false)
  }

  const resetImport = () => {
    setStep(1)
    setRows([])
    setFileName('')
    setWorkbook(null)
    setImportResults(null)
    setImportProgress(0)
  }

  const viewSessionLog = async (sessionId: string) => {
    const { data } = await supabase
      .from('import_log')
      .select('*')
      .eq('session_id', sessionId)
      .order('row_number')
    setLogRows(data || [])
    setLogModalSessionId(sessionId)
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })

  const steps = [
    { n: 1, label: 'Upload' },
    { n: 2, label: 'Preview & Validate' },
    { n: 3, label: 'Fix Issues' },
    { n: 4, label: 'Import' },
    { n: 5, label: 'Results' },
  ]

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2">Import Data</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Upload Trucking_2025.xlsx or CSV and import historical trips, fuel, expenses, and invoices.
        </p>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm ${
              tab === 'import'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            New Import
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm ${
              tab === 'history'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Import History
          </button>
        </div>

        {tab === 'history' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left font-bold text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500">File</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500">Imported by</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500">Rows</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(s.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{s.filename}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.imported_by_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-600 dark:text-emerald-400">{s.passed_rows} ✅</span>
                      {' / '}
                      <span className="text-red-500">{s.failed_rows} ❌</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                          s.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : s.status === 'importing'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => viewSessionLog(s.id)}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        View log →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.length === 0 && (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">No import sessions yet.</div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {steps.map((s) => (
                <div key={s.n} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      step === s.n
                        ? 'bg-orange-500 text-white'
                        : step > s.n
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {step > s.n ? '✓' : s.n}
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{s.label}</span>
                  {s.n < 5 && <span className="text-slate-300 dark:text-slate-600">→</span>}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="max-w-2xl mx-auto">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Upload Excel or CSV</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Supports: <strong>Trucking_2025.xlsx</strong> format, or any CSV with matching columns. Maximum file
                  size: 10MB.
                </p>
                <label
                  htmlFor="file-input"
                  className={`flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10'
                      : 'border-slate-300 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <span className="text-4xl mb-3">📊</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    Drop your Excel or CSV file here
                  </span>
                  <span className="text-xs text-slate-400 mt-1">or click to browse</span>
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30">
                  <div className="font-semibold text-blue-700 dark:text-blue-400 text-sm mb-1">
                    📥 Expected format (Trucking_2025.xlsx)
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    Your file should have a sheet named <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">Trips_2025</code> with
                    headers on row 2. Required columns are marked with *.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {REQUIRED_COLS.map((col) => (
                      <span
                        key={col}
                        className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-mono"
                      >
                        {col}*
                      </span>
                    ))}
                    {OPTIONAL_COLS.map((col) => (
                      <span
                        key={col}
                        className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <>
                {workbook && availableSheets.length > 1 && (
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Sheet:</span>
                    <select
                      value={selectedSheet}
                      onChange={(e) => {
                        setSelectedSheet(e.target.value)
                        parseSheet(workbook, e.target.value)
                      }}
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                    >
                      {availableSheets.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-slate-800 dark:text-white">{rows.length}</div>
                    <div className="text-xs text-slate-400">Total rows</div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-emerald-600">
                      {rows.filter((r) => r._status === 'passed').length}
                    </div>
                    <div className="text-xs text-slate-400">✅ Ready to import</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-amber-500">
                      {rows.filter((r) => r._status === 'warning').length}
                    </div>
                    <div className="text-xs text-slate-400">⚠️ Import with warnings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-red-500">
                      {rows.filter((r) => r._status === 'failed').length}
                    </div>
                    <div className="text-xs text-slate-400">❌ Cannot import</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-extrabold text-slate-400">
                      {rows.filter((r) => r._status === 'skipped').length}
                    </div>
                    <div className="text-xs text-slate-400">⏭️ Skipped (empty)</div>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {(['all', 'passed', 'warning', 'failed'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                          filter === f
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {validating ? (
                  <div className="text-center py-8 text-slate-500">Validating…</div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          <th className="px-3 py-2 text-left font-bold text-slate-500 w-16">Row</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500 w-20">Status</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Vehicle</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Date</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Route</th>
                          <th className="px-3 py-2 text-right font-bold text-slate-500">Revenue</th>
                          <th className="px-3 py-2 text-right font-bold text-slate-500">Fuel (L)</th>
                          <th className="px-3 py-2 text-right font-bold text-slate-500">Total Exp.</th>
                          <th className="px-3 py-2 text-right font-bold text-slate-500">Net Income</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-500">Issues / Warnings</th>
                          <th className="px-3 py-2 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b border-slate-100 dark:border-slate-800 ${
                              row._status === 'failed'
                                ? 'bg-red-50 dark:bg-red-500/5'
                                : row._status === 'warning'
                                  ? 'bg-amber-50 dark:bg-amber-500/5'
                                  : row._status === 'skipped'
                                    ? 'bg-slate-50 dark:bg-slate-800/30 opacity-50'
                                    : row._fixed
                                      ? 'bg-blue-50 dark:bg-blue-500/5'
                                      : 'bg-white dark:bg-slate-900'
                            }`}
                          >
                            <td className="px-3 py-2 font-mono text-slate-400">{row._rowNumber}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                                  row._status === 'failed'
                                    ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                                    : row._status === 'warning'
                                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                                      : row._status === 'skipped'
                                        ? 'bg-slate-100 text-slate-400 dark:bg-slate-500/20'
                                        : row._fixed
                                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                                          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                }`}
                              >
                                {row._status === 'failed'
                                  ? '❌'
                                  : row._status === 'warning'
                                    ? '⚠️'
                                    : row._status === 'skipped'
                                      ? '⏭️'
                                      : row._fixed
                                        ? '🔧'
                                        : '✅'}
                                {' '}
                                {row._fixed ? 'fixed' : row._status}
                              </span>
                            </td>
                            <EditableCell row={row} col="Vehicle" onFix={applyFix} status={row._status} />
                            <EditableCell row={row} col="Date" onFix={applyFix} status={row._status} />
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {String(row['Origin'] ?? '')} → {String(row['Destination'] ?? '')}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                              {row['Gross Income'] ? fmt(Number(row['Gross Income'])) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500">
                              {row['Fuel(L)'] != null && row['Fuel(L)'] !== ''
                                ? String(row['Fuel(L)'])
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500">
                              {row['Total Expense'] ? Number(row['Total Expense']).toLocaleString() : '—'}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-semibold ${
                                Number(row['Net Income'] ?? 0) < 0 ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {row['Net Income'] ? Number(row['Net Income']).toLocaleString() : '—'}
                            </td>
                            <td className="px-3 py-2 max-w-xs">
                              {(row._issues || []).map((issue, j) => (
                                <div key={j} className="text-red-600 dark:text-red-400 text-[10px] mb-0.5">
                                  ❌ {issue}
                                </div>
                              ))}
                              {(row._warnings || []).map((warn, j) => (
                                <div key={j} className="text-amber-600 dark:text-amber-400 text-[10px] mb-0.5">
                                  ⚠️ {warn}
                                </div>
                              ))}
                            </td>
                            <td className="px-3 py-2">
                              {row._status === 'failed' && (
                                <button
                                  type="button"
                                  onClick={() => openFixModal(row)}
                                  className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg font-semibold hover:bg-blue-200 dark:hover:bg-blue-500/30 transition"
                                >
                                  Fix
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {rows.length > 0 && (
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-semibold text-sm"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:opacity-90"
                    >
                      Continue to Fix Issues →
                    </button>
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <div className="max-w-2xl">
                <h3 className="font-bold text-slate-800 dark:text-white mb-2">
                  {failedRows.length} rows need attention
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Fix these rows to include them in the import, or skip them. Rows without a date or vehicle cannot be
                  imported automatically — you can add them manually after import via the Journeys page.
                </p>

                {failedRows.map((row) => (
                  <div
                    key={row._rowNumber}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-500/30 p-4 mb-3"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-xs text-slate-400">Row {row._rowNumber}</span>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {row['Origin'] && row['Destination']
                            ? `${row['Origin']} → ${row['Destination']}`
                            : 'Unknown route'}
                          {row['Date'] ? ` · ${String(row['Date'])}` : null}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openFixModal(row)}
                          className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold"
                        >
                          🔧 Fix
                        </button>
                        <button
                          type="button"
                          onClick={() => skipRow(row._rowNumber)}
                          className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-lg font-semibold"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                    {(row._issues || []).map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 mb-1">
                      <span className="flex-shrink-0">❌</span>
                      <span>{issue}</span>
                    </div>
                    ))}
                  </div>
                ))}

                {failedRows.length === 0 && (
                  <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✅ All fixable issues resolved! Ready to import.
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-semibold text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:opacity-90"
                  >
                    Continue to Import →
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="max-w-lg mx-auto">
                <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-4">Ready to Import</h3>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 mb-4">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-3">This import will create or update:</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Rows matching an existing trip (same vehicle, date, origin, destination) are updated; only new trips add new records. Re-importing the same file will not create duplicates.
                  </p>
                  <div className="space-y-2">
                    {[
                      { icon: '🗺️', label: 'Journeys', count: importableRows.length },
                      {
                        icon: '⛽',
                        label: 'Fuel log entries',
                        count: importableRows.filter((r) => r['Fuel(L)']).length,
                      },
                      {
                        icon: '💸',
                        label: 'Expense entries',
                        count: importableRows.filter(
                          (r) =>
                            Number(r['Driver Millage'] || 0) +
                              Number(r['Road Users fee'] || 0) +
                              Number(r['Other Expenses'] || 0) >
                            0
                        ).length,
                      },
                      {
                        icon: '📄',
                        label: 'Invoice records',
                        count: importableRows.filter((r) => r['Gross Income']).length,
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {item.icon} {item.label}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-white">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {skippedRows.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/30 p-4 mb-4">
                    <div className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-1">
                      {skippedRows.length} rows will NOT be imported:
                    </div>
                    {skippedRows.slice(0, 5).map((r) => (
                      <div key={r._rowNumber} className="text-xs text-amber-600 dark:text-amber-400">
                        Row {r._rowNumber}: {r._issues[0] || 'Manually skipped'}
                      </div>
                    ))}
                    {skippedRows.length > 5 && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        …and {skippedRows.length - 5} more
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={runImport}
                  disabled={importing || importableRows.length === 0}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 rounded-2xl text-base hover:opacity-90 disabled:opacity-60 transition"
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin w-4 h-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Importing {importProgress}/{importableRows.length} rows…
                    </span>
                  ) : (
                    `Import ${importableRows.length} rows`
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="mt-3 w-full py-2 text-slate-500 dark:text-slate-400 text-sm font-medium"
                >
                  ← Back to fix issues
                </button>
              </div>
            )}

            {step === 5 && importResults && (
              <div className="max-w-lg mx-auto text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2">Import Complete!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Your historical data has been imported successfully.</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    {
                      icon: '🗺️',
                      label: 'Journeys created',
                      v: importResults.journeys,
                      c: 'emerald',
                    },
                    {
                      icon: '⛽',
                      label: 'Fuel entries created',
                      v: importResults.fuel,
                      c: 'orange',
                    },
                    {
                      icon: '💸',
                      label: 'Expense entries',
                      v: importResults.expenses,
                      c: 'amber',
                    },
                    {
                      icon: '📄',
                      label: 'Invoices created',
                      v: importResults.invoices,
                      c: 'blue',
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`rounded-2xl p-4 border ${
                        s.c === 'emerald'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                          : s.c === 'orange'
                            ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30'
                            : s.c === 'amber'
                              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                              : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'
                      }`}
                    >
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div
                        className={`text-2xl font-extrabold ${
                          s.c === 'emerald'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : s.c === 'orange'
                              ? 'text-orange-600 dark:text-orange-400'
                              : s.c === 'amber'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {s.v}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                    </div>
                  ))}
                </div>

                {importResults.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/30 p-4 mb-6 text-left">
                    <div className="font-bold text-red-700 dark:text-red-400 mb-2">
                      {importResults.errors.length} rows had errors during import:
                    </div>
                    {importResults.errors.slice(0, 10).map((e, i) => (
                      <div key={i} className="text-xs text-red-600 dark:text-red-400 mb-1">
                        ❌ {e}
                      </div>
                    ))}
                    {importResults.errors.length > 10 && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                        …and {importResults.errors.length - 10} more
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <a
                    href="/journeys"
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition text-center"
                  >
                    View Imported Journeys →
                  </a>
                  <button
                    type="button"
                    onClick={resetImport}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold py-3 rounded-2xl text-sm"
                  >
                    Import Another File
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {fixModalRow && (
          <ErpModal
            title={`Fix row ${fixModalRow._rowNumber}`}
            wide
            onSave={applyFixInModal}
            onClose={() => {
              setFixModalRow(null)
              setFixForm({})
            }}
          >
            <div className="space-y-3 mb-4">
              {(fixModalRow._issues || []).map((issue, i) => (
                <div key={i} className="text-sm text-red-600 dark:text-red-400 flex gap-2">
                  <span>❌</span>
                  <span>{issue}</span>
                </div>
              ))}
            </div>
            <div style={{ ...S.fgg?.(2), marginBottom: 14 } as React.CSSProperties}>
              {REQUIRED_COLS.map((col) => (
                <div key={col} style={S.fg}>
                  <label style={S.lbl}>{col}</label>
                  <input
                    style={S.inp}
                    value={fixForm[col] ?? ''}
                    onChange={(e) => setFixForm((f) => ({ ...f, [col]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" style={S.btn('ghost')} onClick={() => skipRow(fixModalRow._rowNumber)}>
                Skip this row
              </button>
            </div>
          </ErpModal>
        )}

        {logModalSessionId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setLogModalSessionId(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-4xl w-full max-h-[85vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Import log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Row</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Status</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Vehicle</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Date</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Route</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Issues / Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logRows.map((log: any) => (
                      <tr
                        key={log.id}
                        className={`border-b border-slate-100 dark:border-slate-800 ${
                          log.status === 'failed'
                            ? 'bg-red-50 dark:bg-red-500/5'
                            : log.status === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-500/5'
                              : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-slate-400">{log.row_number}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              log.status === 'imported' || log.status === 'passed'
                                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20'
                                : log.status === 'warning'
                                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20'
                                  : 'bg-red-100 text-red-600 dark:bg-red-500/20'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {log.row_data?.Vehicle ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {log.row_data?.Date ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {log.row_data?.Origin ?? '—'} → {log.row_data?.Destination ?? '—'}
                        </td>
                        <td className="px-3 py-2 max-w-xs">
                          {(log.issues || []).map((issue: string, j: number) => (
                            <div key={j} className="text-red-600 dark:text-red-400 text-[10px] mb-0.5">
                              ❌ {issue}
                            </div>
                          ))}
                          {(log.warnings || []).map((warn: string, j: number) => (
                            <div key={j} className="text-amber-600 dark:text-amber-400 text-[10px] mb-0.5">
                              ⚠️ {warn}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setLogModalSessionId(null)}
                className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-semibold text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
