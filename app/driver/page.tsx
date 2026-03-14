'use client'

import React, { useState, useEffect } from 'react'
import DriverLayout from '@/components/DriverLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const statusColor: Record<string, string> = {
  Loading: 'bg-amber-100 text-amber-800',
  'In Transit': 'bg-blue-100 text-blue-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-slate-100 text-slate-600',
}

export default function DriverPage() {
  const [user, setUser] = useState<{ id: string; driver_id?: string | null; name?: string } | null>(null)
  const [journeys, setJourneys] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showStart, setShowStart] = useState<string | null>(null)
  const [showEnd, setShowEnd] = useState<string | null>(null)
  const [odometer, setOdometer] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: profile } = await supabase.from('users').select('id, name, driver_id').eq('id', session.user.id).single()
    const profileWithDriver = profile as { id: string; driver_id?: string; name?: string } | null
    setUser(profileWithDriver || null)
    const driverId = profileWithDriver?.driver_id
    if (!driverId) {
      setLoading(false)
      return
    }
    const [
      { data: jData },
      { data: sData }
    ] = await Promise.all([
      supabase.from('journeys').select('*').eq('driver', driverId).order('date', { ascending: false }).limit(10),
      supabase.from('driver_submissions').select('*').eq('driverId', driverId).order('createdAt', { ascending: false })
    ])
    setJourneys(jData || [])
    setSubmissions(sData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null
    const form = new FormData()
    form.append('file', photoFile)
    form.append('folder', 'odometer')
    const res = await fetch('/api/upload/driver-photo', { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Upload failed')
    return json.url
  }

  const submitStart = async (journeyId: string) => {
    const driverId = user?.driver_id
    if (!driverId || !odometer.trim()) return toast.error('Enter odometer reading')
    setSubmitting(true)
    try {
      let photoUrls: string[] = []
      const url = await uploadPhoto()
      if (url) photoUrls.push(url)
      const id = `DS-ST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const { error } = await supabase.from('driver_submissions').insert({
        id,
        type: 'journey_start',
        referenceId: journeyId,
        driverId,
        payload: { odometerStart: Number(odometer) },
        photoUrls,
        status: 'pending'
      })
      if (error) throw error
      toast.success('Trip start submitted. Waiting for admin approval.')
      setShowStart(null)
      setOdometer('')
      setPhotoFile(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const submitEnd = async (journeyId: string) => {
    const driverId = user?.driver_id
    if (!driverId || !odometer.trim()) return toast.error('Enter odometer reading')
    setSubmitting(true)
    try {
      let photoUrls: string[] = []
      const url = await uploadPhoto()
      if (url) photoUrls.push(url)
      const id = `DS-EN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const { error } = await supabase.from('driver_submissions').insert({
        id,
        type: 'journey_end',
        referenceId: journeyId,
        driverId,
        payload: { odometerEnd: Number(odometer), endDate },
        photoUrls,
        status: 'pending'
      })
      if (error) throw error
      toast.success('Trip end submitted. Waiting for admin approval.')
      setShowEnd(null)
      setOdometer('')
      setPhotoFile(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (n: number) => (n ?? 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })

  if (loading) {
    return (
      <DriverLayout title="My Trips">
        <div className="text-center py-12 text-slate-500 text-base">Loading…</div>
      </DriverLayout>
    )
  }

  if (!user?.driver_id) {
    return (
      <DriverLayout title="My Trips">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 max-w-[430px] mx-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Driver section</h2>
          <p className="text-slate-600 text-base">
            You are not linked to a driver account. Ask an admin to assign you to a driver in Admin → Users so you can submit trips and fuel/expenses.
          </p>
        </div>
      </DriverLayout>
    )
  }

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <DriverLayout title="My Trips" driverFirstName={firstName}>
      <button
        type="button"
        onClick={() => document.getElementById('trip-list')?.scrollIntoView({ behavior: 'smooth' })}
        className="flex items-center justify-center w-full min-h-[52px] rounded-xl text-white font-bold text-base bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm mb-6"
      >
        ＋ Start New Trip
      </button>

      {journeys.length === 0 ? (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-600 text-base">No trips yet. Tap + to log your first trip.</p>
        </div>
      ) : (
        <div id="trip-list" className="space-y-4">
          {journeys.map((j: any) => (
            <div key={j.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="font-bold text-base text-slate-800">{j.origin} → {j.dest}</div>
              <div className="text-sm text-slate-500 mt-1">{j.date} · {j.cargo || '—'}</div>
              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor[j.status] || 'bg-slate-100 text-slate-600'}`}>
                  {j.status || '—'}
                </span>
                <span className="font-semibold text-green-700">{fmt(Number(j.revenue ?? 0))}</span>
              </div>
              {j.status !== 'Completed' && j.status !== 'Cancelled' && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setShowStart(showStart === j.id ? null : j.id); setShowEnd(null) }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700"
                  >
                    Submit start
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEnd(showEnd === j.id ? null : j.id); setShowStart(null) }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 text-white"
                  >
                    Submit end
                  </button>
                </div>
              )}

              {showStart === j.id && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm font-bold text-slate-700 mb-2">Trip start — odometer + photo</div>
                  <input type="number" placeholder="Odometer (km)" value={odometer} onChange={e => setOdometer(e.target.value)} className="w-full max-w-[160px] rounded-xl border border-slate-300 px-3 py-2 text-base mb-2" />
                  <input type="file" accept="image/*" capture="environment" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="block text-base mb-3" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => submitStart(j.id)} disabled={submitting} className="min-h-[44px] px-4 rounded-xl font-semibold bg-orange-500 text-white disabled:opacity-70">
                      {submitting ? 'Submitting…' : 'Submit'}
                    </button>
                    <button type="button" onClick={() => setShowStart(null)} className="min-h-[44px] px-4 rounded-xl font-semibold bg-slate-200 text-slate-700">Cancel</button>
                  </div>
                </div>
              )}

              {showEnd === j.id && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm font-bold text-slate-700 mb-2">Trip end — odometer + photo</div>
                  <input type="number" placeholder="Odometer (km)" value={odometer} onChange={e => setOdometer(e.target.value)} className="w-full max-w-[160px] rounded-xl border border-slate-300 px-3 py-2 text-base mb-2" />
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full max-w-[180px] rounded-xl border border-slate-300 px-3 py-2 text-base mb-2 block" />
                  <input type="file" accept="image/*" capture="environment" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="block text-base mb-3" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => submitEnd(j.id)} disabled={submitting} className="min-h-[44px] px-4 rounded-xl font-semibold bg-orange-500 text-white disabled:opacity-70">
                      {submitting ? 'Submitting…' : 'Submit'}
                    </button>
                    <button type="button" onClick={() => setShowEnd(null)} className="min-h-[44px] px-4 rounded-xl font-semibold bg-slate-200 text-slate-700">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {submissions.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-slate-800 text-base mb-3">My submissions</h3>
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
            <div className="divide-y divide-slate-200">
              {submissions.slice(0, 5).map((s: any) => (
                <div key={s.id} className="px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-slate-600">{s.type === 'journey_start' ? 'Trip start' : s.type === 'journey_end' ? 'Trip end' : s.type}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === 'approved' ? 'bg-green-100 text-green-800' : s.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DriverLayout>
  )
}
