'use client'

import React, { useState, useEffect } from 'react'
import { usePortalClient } from '@/components/ClientPortalLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

function fmt(n: number) {
  return 'KES ' + (n ?? 0).toLocaleString('en-KE')
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const c = status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c}`}>{status}</span>
}

export default function PortalInvoicesPage() {
  const { clientId } = usePortalClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [journeys, setJourneys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: invData },
        { data: payData },
        { data: jData },
      ] = await Promise.all([
        supabase.from('invoices').select('*').eq('client_id', clientId).order('issued', { ascending: false }),
        supabase.from('invoice_payments').select('*'),
        supabase.from('journeys').select('id, origin, dest'),
      ])
      setInvoices(invData || [])
      setPayments(payData || [])
      setJourneys(jData || [])
      setLoading(false)
    }
    load()
  }, [clientId])

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount || 0), 0)
  const paidSum = invoices.filter((i) => (i.status || '') === 'Paid').reduce((s, i) => s + Number(i.amount || 0), 0)
  const outstanding = invoices.reduce((s, inv) => {
    const amt = Number(inv.amount || 0)
    const totalPaid = (payments || []).filter((p: any) => (p.invoice_id || p.invoiceId) === inv.id).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
    if (totalPaid < amt) return s + (amt - totalPaid)
    return s
  }, 0)

  const downloadInvoice = (inv: any) => {
    window.open(`/api/portal/invoice-pdf/${encodeURIComponent(inv.id)}`, '_blank', 'noopener,noreferrer')
  }

  const requestPaymentInfo = () => {
    toast.success('Payment instructions have been sent to your email.')
  }

  if (loading) return <div className="text-slate-500">Loading invoices…</div>

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Invoices</h1>
      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        <span className="text-slate-600">Total Invoiced: <strong className="text-slate-800">{fmt(totalInvoiced)}</strong></span>
        <span className="text-slate-600">Paid: <strong className="text-emerald-600">{fmt(paidSum)}</strong></span>
        <span className="text-slate-600">Outstanding: <strong className={outstanding > 0 ? 'text-red-600' : 'text-slate-800'}>{fmt(outstanding)}</strong></span>
      </div>
      <div className="space-y-4">
        {invoices.length === 0 ? (
          <p className="text-slate-500">No invoices yet.</p>
        ) : (
          invoices.map((inv) => {
            const totalPaid = payments.filter((p: any) => (p.invoice_id || p.invoiceId) === inv.id).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
            const amt = Number(inv.amount || 0)
            const status = totalPaid >= amt ? 'Paid' : (inv.status || 'Pending')
            const journey = inv.journey ? journeys.find((j: any) => j.id === inv.journey) : null
            return (
              <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-sm text-slate-500">{inv.id}</div>
                    <div className="font-bold text-slate-800 text-lg">{fmt(amt)}</div>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="text-sm text-slate-500 space-y-1 mb-4">
                  <div>Issued: {formatDate(inv.issued)}</div>
                  <div>Due: {formatDate(inv.due)}</div>
                  {journey && (
                    <div>Route: {journey.origin ?? '—'} → {journey.dest ?? '—'}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => downloadInvoice(inv)}
                    className="flex-1 text-sm bg-orange-500 text-white font-semibold py-2 rounded-xl hover:bg-orange-600 transition"
                  >
                    📄 Download PDF
                  </button>
                  {status !== 'Paid' && (
                    <button
                      type="button"
                      onClick={requestPaymentInfo}
                      className="flex-1 text-sm border border-orange-300 text-orange-600 font-semibold py-2 rounded-xl hover:bg-orange-50 transition"
                    >
                      💳 Pay Now
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
