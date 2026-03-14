'use client'

import React, { useState, useEffect } from 'react'
import DriverLayout from '@/components/DriverLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { uploadDriverPhoto } from '@/lib/driver-upload'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function DriverFuelPage() {
  const [user, setUser] = useState<{ driver_id?: string | null; name?: string } | null>(null)
  const [driverInfo, setDriverInfo] = useState<{ truck?: string; truckReg?: string } | null>(null)
  const [activeTrips, setActiveTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [recent, setRecent] = useState<any[]>([])
  const [form, setForm] = useState({
    date: today(),
    litres: '',
    pricePerL: '',
    station: '',
    journeyId: '',
    odomReading: '',
  })
  const [odomPhotoFile, setOdomPhotoFile] = useState<File | null>(null)
  const [odomPreview, setOdomPreview] = useState<string | null>(null)

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
    let truckReg: string | undefined
    if (truckId) {
      const { data: truck } = await supabase.from('trucks').select('reg').eq('id', truckId).single()
      truckReg = (truck as { reg?: string } | null)?.reg
    }
    setDriverInfo(driverRow ? { truck: truckId, truckReg } : null)

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
      .eq('type', 'fuel')
      .order('createdAt', { ascending: false })
      .limit(5)
    setRecent(subData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalCost = (Number(form.litres) || 0) * (Number(form.pricePerL) || 0)

  const resetForm = () => {
    setForm({
      date: today(),
      litres: '',
      pricePerL: '',
      station: '',
      journeyId: '',
      odomReading: '',
    })
    setOdomPhotoFile(null)
    setOdomPreview(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const driverId = user?.driver_id
    if (!driverId) return toast.error('Not linked to a driver')
    if (!driverInfo?.truck) return toast.error('No truck assigned')
    const litres = Number(form.litres)
    const pricePerL = Number(form.pricePerL)
    if (!litres || litres <= 0 || !pricePerL || pricePerL <= 0) {
      toast.error('Litres and price per litre are required')
      return
    }
    if (!odomPhotoFile) {
      toast.error('Odometer photo is required when logging fuel')
      return
    }
    setSubmitting(true)
    try {
      const odomUrl = await uploadDriverPhoto(odomPhotoFile, 'odometer/fuel')
      const fuelId = 'F' + Date.now().toString().slice(-6)
      const { data: fuelEntry, error } = await supabase
        .from('fuel')
        .insert({
          id: fuelId,
          truck: driverInfo.truck,
          date: form.date || today(),
          litres,
          pricePerL,
          station: form.station?.trim() || null,
          journey: form.journeyId || null,
          odom: form.odomReading ? Number(form.odomReading) : null,
        })
        .select()
        .single()
      if (error) throw error
      const subId = `DS-F-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await supabase.from('driver_submissions').insert({
        id: subId,
        type: 'fuel',
        referenceId: fuelEntry.id,
        driverId,
        payload: {
          date: form.date,
          litres,
          pricePerL,
          station: form.station?.trim() || null,
          totalCost,
          odomReading: form.odomReading || null,
        },
        photoUrls: [odomUrl],
        status: 'pending',
      })
      toast.success('Fuel entry logged!')
      resetForm()
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to log fuel')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DriverLayout title="Fuel Log">
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-base">Loading…</div>
      </DriverLayout>
    )
  }

  const firstName = user?.name?.split(' ')[0] || ''
  const truckReg = driverInfo?.truckReg ?? '—'

  return (
    <DriverLayout title="Fuel Log" driverFirstName={firstName}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
        <h2 className="font-bold text-slate-800 dark:text-white text-base mb-4">Log Fuel</h2>

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
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Truck</label>
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2.5 text-base bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {truckReg}
            </div>
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
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Litres</label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.litres}
              onChange={(e) => setForm((f) => ({ ...f, litres: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Price per Litre (KES)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.pricePerL}
              onChange={(e) => setForm((f) => ({ ...f, pricePerL: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="0"
              required
            />
          </div>
          <div className="text-lg font-bold text-slate-800 dark:text-white">
            Total cost: KES {totalCost.toLocaleString('en-KE')}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Station name</label>
            <input
              type="text"
              value={form.station}
              onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="e.g. Shell Nairobi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Odometer reading (km)</label>
            <input
              type="number"
              min="0"
              value={form.odomReading}
              onChange={(e) => setForm((f) => ({ ...f, odomReading: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              📷 Odometer Photo at Fueling <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
              Take a clear photo of the odometer when refuelling.
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setOdomPhotoFile(f || null)
                setOdomPreview(f ? URL.createObjectURL(f) : null)
              }}
              className="hidden"
              id="fuel-odom-input"
            />
            {odomPreview ? (
              <div className="relative">
                <img
                  src={odomPreview}
                  alt="Odometer"
                  className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-600"
                />
                <button
                  type="button"
                  onClick={() => { setOdomPhotoFile(null); setOdomPreview(null) }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label
                htmlFor="fuel-odom-input"
                className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-orange-300 dark:border-orange-600 rounded-xl bg-orange-50 dark:bg-orange-500/10 cursor-pointer"
              >
                <span className="text-3xl mb-2">📸</span>
                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Take odometer photo</span>
              </label>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-70"
          >
            {submitting ? 'Submitting…' : 'Submit Fuel Entry'}
          </button>
        </form>
      </div>

      <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3">Recent Submissions</h3>
      {recent.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-base">
          No fuel submissions yet.
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
                    {s.payload?.date || '—'}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {s.payload?.litres} L · KES {(s.payload?.totalCost ?? s.payload?.total ?? 0).toLocaleString('en-KE')}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
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
