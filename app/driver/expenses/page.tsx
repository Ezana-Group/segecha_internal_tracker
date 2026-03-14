'use client'

import React, { useState, useEffect } from 'react'
import DriverLayout from '@/components/DriverLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { uploadDriverPhoto } from '@/lib/driver-upload'

const CATEGORIES = ['Toll', 'Maintenance', 'Other'] as const

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function DriverExpensesPage() {
  const [user, setUser] = useState<{ driver_id?: string | null; name?: string } | null>(null)
  const [driverInfo, setDriverInfo] = useState<{ truck?: string } | null>(null)
  const [activeTrips, setActiveTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  const [form, setForm] = useState({
    category: 'Toll' as (typeof CATEGORIES)[number],
    amount: '',
    description: '',
    date: today(),
    journeyId: '',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: profile } = await supabase.from('users').select('id, name, driver_id').eq('id', session.user.id).single()
    const driverId = (profile as { driver_id?: string } | null)?.driver_id
    setUser(profile as any || null)
    if (!driverId) {
      setLoading(false)
      return
    }
    const { data: driverRow } = await supabase.from('drivers').select('truck').eq('id', driverId).single()
    setDriverInfo((driverRow as { truck?: string } | null) || null)

    const { data: trips } = await supabase
      .from('journeys')
      .select('id, origin, dest, date')
      .eq('driver', driverId)
      .eq('status', 'In Transit')
      .order('date', { ascending: false })
    setActiveTrips(trips || [])

    const { data: subData } = await supabase
      .from('driver_submissions')
      .select('*')
      .eq('driverId', driverId)
      .eq('type', 'expense')
      .order('createdAt', { ascending: false })
      .limit(10)
    setRecent(subData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({
      category: 'Toll',
      amount: '',
      description: '',
      date: today(),
      journeyId: '',
    })
    setReceiptFile(null)
    setReceiptPreview(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const driverId = user?.driver_id
    if (!driverId) return toast.error('Not linked to a driver')
    if (!driverInfo?.truck) return toast.error('No truck assigned')
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      toast.error('Amount and category are required')
      return
    }
    setSubmitting(true)
    try {
      let receiptUrl: string | null = null
      if (receiptFile) {
        receiptUrl = await uploadDriverPhoto(receiptFile, 'receipts')
      }
      const expenseId = 'E' + Date.now().toString().slice(-6)
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
          id: expenseId,
          truck: driverInfo.truck,
          cat: form.category,
          amount,
          date: form.date || today(),
          desc: form.description?.trim() || null,
          journey: form.journeyId || null,
        })
        .select()
        .single()
      if (error) throw error
      const subId = `DS-E-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await supabase.from('driver_submissions').insert({
        id: subId,
        type: 'expense',
        referenceId: expense.id,
        driverId,
        payload: {
          category: form.category,
          amount,
          description: form.description?.trim() || null,
          date: form.date,
        },
        photoUrls: receiptUrl ? [receiptUrl] : [],
        status: 'pending',
      })
      toast.success('Expense submitted for approval')
      resetForm()
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit expense')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DriverLayout title="Expenses">
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-base">Loading…</div>
      </DriverLayout>
    )
  }

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <DriverLayout title="Expenses" driverFirstName={firstName}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
        <h2 className="font-bold text-slate-800 dark:text-white text-base mb-4">Log Expense</h2>

        {activeTrips.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-800">
            <label className="block text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
              Link to active trip (optional)
            </label>
            <select
              value={form.journeyId}
              onChange={(e) => setForm((f) => ({ ...f, journeyId: e.target.value }))}
              className="w-full text-sm bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="">— Not linked to a trip —</option>
              {activeTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.origin} → {t.dest} ({t.date})
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Category</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`min-h-[44px] px-4 rounded-xl font-semibold text-base ${
                    form.category === cat
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Amount (KES)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Receipt photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setReceiptFile(f || null)
                setReceiptPreview(f ? URL.createObjectURL(f) : null)
              }}
              className="hidden"
              id="expense-receipt"
            />
            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Receipt"
                  className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-600"
                />
                <button
                  type="button"
                  onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label
                htmlFor="expense-receipt"
                className="flex items-center justify-center h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer text-slate-500 dark:text-slate-400 text-sm"
              >
                Tap to add receipt photo
              </label>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-70"
          >
            {submitting ? 'Submitting…' : 'Submit Expense'}
          </button>
        </form>
      </div>

      <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3">Recent Submissions</h3>
      {recent.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-base">
          No expense submissions yet.
        </div>
      ) : (
        <div className="space-y-3">
          {recent.map((s: any) => (
            <div
              key={s.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-white">
                    {s.payload?.category || '—'} · KES {(s.payload?.amount ?? 0).toLocaleString('en-KE')}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {s.payload?.date}
                    {s.payload?.description ? ` · ${s.payload.description}` : ''}
                  </div>
                  {s.status === 'rejected' && s.rejectionReason && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Rejected: {s.rejectionReason}
                    </div>
                  )}
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                    s.status === 'approved'
                      ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400'
                      : s.status === 'rejected'
                      ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                  }`}
                >
                  {s.status === 'pending' ? '🟡 Pending review' : s.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DriverLayout>
  )
}
