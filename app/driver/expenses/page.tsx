'use client'

import React, { useState, useEffect } from 'react'
import DriverLayout from '@/components/DriverLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const CATEGORIES = ['Toll', 'Maintenance', 'Other'] as const

export default function DriverExpensesPage() {
  const [user, setUser] = useState<{ driver_id?: string | null; name?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  const [form, setForm] = useState({
    category: 'Toll' as (typeof CATEGORIES)[number],
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    photo: null as File | null,
  })

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
    const { data: subData } = await supabase
      .from('driver_submissions')
      .select('*')
      .eq('driverId', driverId)
      .eq('type', 'expense')
      .order('createdAt', { ascending: false })
      .limit(5)
    setRecent(subData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const driverId = user?.driver_id
    if (!driverId) return toast.error('Not linked to a driver')
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return toast.error('Enter amount')
    setSubmitting(true)
    try {
      let photoUrls: string[] = []
      if (form.photo) {
        const fd = new FormData()
        fd.set('file', form.photo)
        fd.set('folder', 'expenses')
        const res = await fetch('/api/upload/driver-photo', { method: 'POST', body: fd })
        const json = await res.json()
        if (res.ok && json.url) photoUrls.push(json.url)
      }
      const id = `DS-E-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const { error } = await supabase.from('driver_submissions').insert({
        id,
        type: 'expense',
        referenceId: null,
        driverId,
        payload: {
          category: form.category,
          amount,
          description: form.description?.trim() || null,
          date: form.date,
        },
        photoUrls,
        status: 'pending',
      })
      if (error) throw error
      toast.success('Expense submitted for approval.')
      setForm({ category: 'Toll', amount: '', description: '', date: new Date().toISOString().slice(0, 10), photo: null })
      load()
    } catch (e: any) {
      toast.error(e.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DriverLayout title="Expenses">
        <div className="text-center py-12 text-slate-500 text-base">Loading…</div>
      </DriverLayout>
    )
  }

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <DriverLayout title="Expenses" driverFirstName={firstName}>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
        <h2 className="font-bold text-slate-800 text-base mb-4">Log Expense</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Category</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat }))}
                  className={`min-h-[44px] px-4 rounded-xl font-semibold text-base ${form.category === cat ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Amount (KES)</label>
            <input type="number" min="0" step="any" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-2xl" placeholder="0" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Receipt photo</label>
            <input type="file" accept="image/*" capture="environment" onChange={e => setForm(f => ({ ...f, photo: e.target.files?.[0] || null }))} className="block text-base" />
          </div>
          <button type="submit" disabled={submitting} className="w-full min-h-[52px] rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-70">
            {submitting ? 'Submitting…' : 'Submit Expense'}
          </button>
        </form>
      </div>

      <h3 className="font-bold text-slate-800 text-base mb-3">Recent Submissions</h3>
      {recent.length === 0 ? (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-slate-500 text-base">No expense submissions yet.</div>
      ) : (
        <div className="space-y-3">
          {recent.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-800">{s.payload?.category || '—'} · KES {(s.payload?.amount ?? 0).toLocaleString('en-KE')}</div>
                  <div className="text-sm text-slate-500">{s.payload?.date} {s.payload?.description ? `· ${s.payload.description}` : ''}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === 'approved' ? 'bg-green-100 text-green-800' : s.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DriverLayout>
  )
}
