'use client'

import React, { useState, useEffect } from 'react'
import { usePortalClient } from '@/components/ClientPortalLayout'
import { supabase } from '@/lib/supabase'

function fmt(n: number) {
  return (n ?? 0).toLocaleString('en-KE')
}

export default function PortalStatementPage() {
  const { clientId } = usePortalClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: invData },
        { data: payData },
      ] = await Promise.all([
        supabase.from('invoices').select('*').eq('client_id', clientId).order('issued', { ascending: true }),
        supabase.from('invoice_payments').select('*'),
      ])
      const clientInvs = invData || []
      const clientPayments = (payData || []).filter((p: any) =>
        clientInvs.some((inv: any) => inv.id === (p.invoice_id ?? p.invoiceId))
      )
      setInvoices(clientInvs)
      setPayments(clientPayments)
      setLoading(false)
    }
    load()
  }, [clientId])

  type Event = { date: string; description: string; debit: number; credit: number }
  const events: Event[] = []
  invoices.forEach((inv) => {
    events.push({
      date: inv.issued || '',
      description: `Invoice ${inv.id}`,
      debit: Number(inv.amount || 0),
      credit: 0,
    })
  })
  payments.forEach((p) => {
    events.push({
      date: p.paidDate || p.paid_date || '',
      description: `Payment${p.mpesaRef ? ` · ${p.mpesaRef}` : ''}`,
      debit: 0,
      credit: Number(p.amount || 0),
    })
  })
  events.sort((a, b) => a.date.localeCompare(b.date))
  type Row = { date: string; description: string; debit: number; credit: number; balance: number }
  const rows: Row[] = []
  let balance = 0
  events.forEach((e) => {
    balance += e.debit - e.credit
    rows.push({ ...e, balance })
  })

  const downloadCSV = () => {
    const header = 'Date,Description,Debit (KES),Credit (KES),Balance (KES)\n'
    const body = rows.map((r) => `${r.date},${r.description.replace(/,/g, ' ')},${r.debit},${r.credit},${r.balance}`).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `statement-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="text-slate-500">Loading statement…</div>

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Account Statement</h1>
      <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
        <div className="text-sm text-slate-500 mb-1">Current balance</div>
        <div className={`text-2xl font-bold ${balance > 0 ? 'text-red-600' : 'text-slate-800'}`}>
          KES {fmt(balance)}
        </div>
      </div>
      <div className="mb-4">
        <button
          type="button"
          onClick={downloadCSV}
          className="text-sm bg-orange-500 text-white font-semibold py-2 px-4 rounded-xl hover:bg-orange-600 transition"
        >
          Download Statement (CSV)
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="p-3 font-semibold text-slate-700">Date</th>
              <th className="p-3 font-semibold text-slate-700">Description</th>
              <th className="p-3 font-semibold text-slate-700 text-right">Debit</th>
              <th className="p-3 font-semibold text-slate-700 text-right">Credit</th>
              <th className="p-3 font-semibold text-slate-700 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-slate-500 text-center">No transactions.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-3 text-slate-600">{r.date}</td>
                  <td className="p-3 text-slate-800">{r.description}</td>
                  <td className="p-3 text-right text-slate-600">{r.debit ? fmt(r.debit) : '—'}</td>
                  <td className="p-3 text-right text-emerald-600">{r.credit ? fmt(r.credit) : '—'}</td>
                  <td className="p-3 text-right font-semibold text-slate-800">{fmt(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
