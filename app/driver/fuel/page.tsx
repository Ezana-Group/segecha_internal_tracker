'use client'

import React, { useState, useEffect } from 'react'
import DriverLayout from '@/components/DriverLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function DriverFuelPage() {
  const [user, setUser] = useState<{ driver_id?: string | null; name?: string } | null>(null)
  const [truckReg, setTruckReg] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    litres: '',
    pricePerL: '',
    station: '',
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
    const { data: driverRow } = await supabase.from('drivers').select('truck').eq('id', driverId).single()
    const truckId = (driverRow as { truck?: string } | null)?.truck
    if (truckId) {
      const { data: truck } = await supabase.from('trucks').select('reg').eq('id', truckId).single()
      setTruckReg((truck as { reg?: string } | null)?.reg || '—')
    } else setTruckReg('—')
    const { data: subData } = await supabase
      .from('driver_submissions')
      .select('*')
      .eq('driverId', driverId)
      .eq('type', 'fuel')
      .order('createdAt', { ascending: false })
      .limit(5)
    setRecent(subData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalCost = (Number(form.litres) || 0) * (Number(form.pricePerL) || 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const driverId = user?.driver_id
    if (!driverId) return toast.error('Not linked to a driver')
    const litres = Number(form.litres)
    const pricePerL = Number(form.pricePerL)
    if (!litres || litres <= 0 || !pricePerL || pricePerL <= 0) return toast.error('Enter litres and price per litre')
    setSubmitting(true)
    try {
      let photoUrls: string[] = []
      if (form.photo) {
        const fd = new FormData()
        fd.set('file', form.photo)
        fd.set('folder', 'fuel')
        const res = await fetch('/api/upload/driver-photo', { method: 'POST', body: fd })
        const json = await res.json()
        if (res.ok && json.url) photoUrls.push(json.url)
      }
      const id = `DS-F-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const { error } = await supabase.from('driver_submissions').insert({
        id,
        type: 'fuel',
        referenceId: null,
        driverId,
        payload: {
          date: form.date,
          litres,
          pricePerL,
          total: totalCost,
          station: form.station?.trim() || null,
        },
        photoUrls,
        status: 'pending',
      })
      if (error) throw error
      toast.success('Fuel entry submitted for approval.')
      setForm({ date: new Date().toISOString().slice(0, 10), litres: '', pricePerL: '', station: '', photo: null })
      load()
    } catch (e: any) {
      toast.error(e.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DriverLayout title="Fuel Log">
        <div className="text-center py-12 text-slate-500 text-base">Loading…</div>
      </DriverLayout>
    )
  }

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <DriverLayout title="Fuel Log" driverFirstName={firstName}>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
        <h2 className="font-bold text-slate-800 text-base mb-4">Log Fuel</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Truck</label>
            <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-base bg-slate-50 text-slate-600">{truckReg || '—'}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Litres</label>
            <input type="number" step="any" min="0" value={form.litres} onChange={e => setForm(f => ({ ...f, litres: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-2xl" placeholder="0" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Price per Litre (KES)</label>
            <input type="number" step="any" min="0" value={form.pricePerL} onChange={e => setForm(f => ({ ...f, pricePerL: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-2xl" placeholder="0" required />
          </div>
          <div className="text-lg font-bold text-slate-800">Total cost: KES {totalCost.toLocaleString('en-KE')}</div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Station name</label>
            <input type="text" value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" placeholder="e.g. Shell Nairobi" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Receipt photo</label>
            <input type="file" accept="image/*" capture="environment" onChange={e => setForm(f => ({ ...f, photo: e.target.files?.[0] || null }))} className="block text-base" />
          </div>
          <button type="submit" disabled={submitting} className="w-full min-h-[52px] rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-70">
            {submitting ? 'Submitting…' : 'Submit Fuel Entry'}
          </button>
        </form>
      </div>

      <h3 className="font-bold text-slate-800 text-base mb-3">Recent Submissions</h3>
      {recent.length === 0 ? (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-slate-500 text-base">No fuel submissions yet.</div>
      ) : (
        <div className="space-y-3">
          {recent.map((s: any) => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-800">{s.payload?.date || '—'}</div>
                  <div className="text-sm text-slate-500">{s.payload?.litres} L · KES {(s.payload?.total ?? 0).toLocaleString('en-KE')}</div>
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
