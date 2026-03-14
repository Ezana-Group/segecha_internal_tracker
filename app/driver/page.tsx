'use client'

import React, { useState, useEffect } from 'react'
import DriverLayout from '@/components/DriverLayout'
import { supabase } from '@/lib/supabase'
import { notifyDirector, NOTIFY_MESSAGES } from '@/lib/notify'
import toast from 'react-hot-toast'
import { uploadDriverPhoto } from '@/lib/driver-upload'

const statusColor: Record<string, string> = {
  Loading: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400',
  'In Transit': 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400',
  Completed: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400',
  Cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DriverPage() {
  const [user, setUser] = useState<{ id: string; driver_id?: string | null; name?: string } | null>(null)
  const [driverInfo, setDriverInfo] = useState<{ truck?: string; truckReg?: string } | null>(null)
  const [journeys, setJourneys] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Start New Trip modal
  const [showStartNewModal, setShowStartNewModal] = useState(false)
  const [startForm, setStartForm] = useState({
    origin: '',
    destination: '',
    cargo: '',
    weight: '',
    client: '',
    notes: '',
    odomReading: '',
  })
  const [odomStartFile, setOdomStartFile] = useState<File | null>(null)
  const [odomStartPreview, setOdomStartPreview] = useState<string | null>(null)
  const [submittingStart, setSubmittingStart] = useState(false)

  // Start existing trip (Loading → In Transit)
  const [showStartTripModal, setShowStartTripModal] = useState<any | null>(null)
  const [startTripOdom, setStartTripOdom] = useState('')
  const [startTripPhoto, setStartTripPhoto] = useState<File | null>(null)
  const [startTripPreview, setStartTripPreview] = useState<string | null>(null)
  const [submittingStartTrip, setSubmittingStartTrip] = useState(false)

  // End Trip modal
  const [showEndModal, setShowEndModal] = useState<any | null>(null)
  const [endForm, setEndForm] = useState({ arrivalDate: today(), odomReading: '', notes: '' })
  const [odomEndFile, setOdomEndFile] = useState<File | null>(null)
  const [odomEndPreview, setOdomEndPreview] = useState<string | null>(null)
  const [submittingEnd, setSubmittingEnd] = useState(false)

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
    const { data: driverRow } = await supabase.from('drivers').select('truck').eq('id', driverId).single()
    const truckId = (driverRow as { truck?: string } | null)?.truck
    let truckReg: string | undefined
    if (truckId) {
      const { data: truck } = await supabase.from('trucks').select('reg').eq('id', truckId).single()
      truckReg = (truck as { reg?: string } | null)?.reg
    }
    setDriverInfo(driverRow ? { truck: truckId, truckReg } : null)
    const [
      { data: jData },
      { data: sData },
    ] = await Promise.all([
      supabase.from('journeys').select('*').eq('driver', driverId).order('date', { ascending: false }).limit(50),
      supabase.from('driver_submissions').select('*').eq('driverId', driverId).order('createdAt', { ascending: false }),
    ])
    setJourneys(jData || [])
    setSubmissions(sData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalTrips = journeys.length
  const thisMonth = new Date().getMonth()
  const thisYear = new Date().getFullYear()
  const thisMonthRevenue = journeys
    .filter((j: any) => {
      const d = j.date ? new Date(j.date) : null
      return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    .reduce((sum: number, j: any) => sum + Number(j.revenue || 0), 0)
  const pendingCount = submissions.filter((s: any) => s.status === 'pending').length

  const openStartNewModal = () => {
    setStartForm({
      origin: '',
      destination: '',
      cargo: '',
      weight: '',
      client: '',
      notes: '',
      odomReading: '',
    })
    setOdomStartFile(null)
    setOdomStartPreview(null)
    setShowStartNewModal(true)
  }

  const handleStartNewTrip = async () => {
    if (!startForm.origin?.trim() || !startForm.destination?.trim()) {
      toast.error('Origin and destination are required')
      return
    }
    if (!odomStartFile) {
      toast.error('Odometer photo is required to start a trip')
      return
    }
    const startOdom = startForm.odomReading != null && startForm.odomReading !== '' ? Number(startForm.odomReading) : null
    if (startOdom == null || Number.isNaN(startOdom) || startOdom < 0) {
      toast.error('Odometer reading (km) is required to start a trip')
      return
    }
    if (!user?.driver_id || !driverInfo?.truck) {
      toast.error('Driver or truck not assigned')
      return
    }
    setSubmittingStart(true)
    try {
      const odomStartUrl = await uploadDriverPhoto(odomStartFile, 'odometer/start')
      const journeyId = 'J' + Date.now().toString().slice(-8)
      const { data: journey, error } = await supabase
        .from('journeys')
        .insert({
          id: journeyId,
          truck: driverInfo.truck,
          driver: user.driver_id,
          origin: startForm.origin.trim(),
          dest: startForm.destination.trim(),
          date: today(),
          cargo: startForm.cargo.trim() || null,
          weight: startForm.weight ? Number(startForm.weight) : null,
          status: 'In Transit',
          notes: startForm.notes.trim() || null,
          odometerStart: startOdom,
          odometerStartPhoto: odomStartUrl,
        })
        .select()
        .single()
      if (error) throw error
      const subId = `DS-ST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await supabase.from('driver_submissions').insert({
        id: subId,
        type: 'journey_start',
        referenceId: journey.id,
        driverId: user.driver_id,
        payload: {
          origin: startForm.origin.trim(),
          destination: startForm.destination.trim(),
          cargo: startForm.cargo.trim() || null,
          odomReading: startOdom,
          client: startForm.client.trim() || null,
        },
        photoUrls: [odomStartUrl],
        status: 'approved',
      })
      toast.success('Trip started! Marked as In Transit. Safe travels 🚛')
      setShowStartNewModal(false)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to start trip')
    } finally {
      setSubmittingStart(false)
    }
  }

  const openStartTripModal = (trip: any) => {
    setShowStartTripModal(trip)
    setStartTripOdom('')
    setStartTripPhoto(null)
    setStartTripPreview(null)
  }

  const handleStartTrip = async () => {
    if (!showStartTripModal || !user?.driver_id) return
    if (!startTripPhoto) {
      toast.error('Odometer photo is required to start this trip')
      return
    }
    const startOdomVal = startTripOdom != null && startTripOdom !== '' ? Number(startTripOdom) : null
    if (startOdomVal == null || Number.isNaN(startOdomVal) || startOdomVal < 0) {
      toast.error('Odometer reading (km) is required to start this trip')
      return
    }
    setSubmittingStartTrip(true)
    try {
      const url = await uploadDriverPhoto(startTripPhoto, 'odometer/start')
      await supabase
        .from('journeys')
        .update({
          status: 'In Transit',
          odometerStart: startOdomVal,
          odometerStartPhoto: url,
        })
        .eq('id', showStartTripModal.id)
      const subId = `DS-ST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await supabase.from('driver_submissions').insert({
        id: subId,
        type: 'journey_start',
        referenceId: showStartTripModal.id,
        driverId: user.driver_id,
        payload: { odometerStart: startOdomVal },
        photoUrls: [url],
        status: 'approved',
      })
      const route = `${showStartTripModal.origin || ''}→${showStartTripModal.dest || ''}`
      notifyDirector(
        NOTIFY_MESSAGES.journey_started(user?.name || 'Driver', route, driverInfo?.truckReg || '—'),
        'journey_started',
        showStartTripModal.id
      )
      toast.success('Trip started! Marked as In Transit. Safe travels 🚛')
      setShowStartTripModal(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to start trip')
    } finally {
      setSubmittingStartTrip(false)
    }
  }

  const openEndModal = (trip: any) => {
    setShowEndModal(trip)
    setEndForm({ arrivalDate: today(), odomReading: '', notes: '' })
    setOdomEndFile(null)
    setOdomEndPreview(null)
  }

  const handleEndTrip = async () => {
    if (!showEndModal || !user?.driver_id) return
    if (!odomEndFile) {
      toast.error('End odometer photo is required to close this trip')
      return
    }
    const odomEndVal = endForm.odomReading != null && endForm.odomReading !== '' ? Number(endForm.odomReading) : null
    if (odomEndVal == null || Number.isNaN(odomEndVal) || odomEndVal < 0) {
      toast.error('Final odometer reading (km) is required to close this trip')
      return
    }
    setSubmittingEnd(true)
    try {
      const odomEndUrl = await uploadDriverPhoto(odomEndFile, 'odometer/end')
      const trip = showEndModal
      const odomEnd = odomEndVal
      const distance =
        odomEnd != null && trip.odometerStart != null
          ? odomEnd - Number(trip.odometerStart)
          : trip.distance
      await supabase
        .from('journeys')
        .update({
          status: 'Completed',
          endDate: endForm.arrivalDate || null,
          odometerEnd: odomEnd,
          odometerEndPhoto: odomEndUrl,
          distance: distance != null ? distance : trip.distance,
          notes: [trip.notes, endForm.notes].filter(Boolean).join('\n') || trip.notes,
        })
        .eq('id', trip.id)
      const subId = `DS-EN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await supabase.from('driver_submissions').insert({
        id: subId,
        type: 'journey_end',
        referenceId: trip.id,
        driverId: user.driver_id,
        payload: {
          odomReading: odomEndVal,
          arrivalDate: endForm.arrivalDate,
        },
        photoUrls: [odomEndUrl],
        status: 'pending',
      })
      const route = `${trip.origin || ''}→${trip.dest || ''}`
      notifyDirector(
        NOTIFY_MESSAGES.journey_completed(user?.name || 'Driver', route),
        'journey_completed',
        trip.id
      )
      toast.success('Trip marked as completed! Great work 👏')
      setShowEndModal(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to complete trip')
    } finally {
      setSubmittingEnd(false)
    }
  }

  if (loading) {
    return (
      <DriverLayout title="My Trips">
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-base">Loading…</div>
      </DriverLayout>
    )
  }

  if (!user?.driver_id) {
    return (
      <DriverLayout title="My Trips">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 max-w-[430px] mx-auto">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Driver section</h2>
          <p className="text-slate-600 dark:text-slate-400 text-base">
            You are not linked to a driver account. Ask an admin to assign you to a driver in Admin → Users so you can submit trips and fuel/expenses.
          </p>
        </div>
      </DriverLayout>
    )
  }

  const firstName = user?.name?.split(' ')[0] || ''
  const hasInTransitTrip = journeys.some((j: any) => j.status === 'In Transit')

  const handleOpenStartNewModal = () => {
    if (hasInTransitTrip) {
      toast.error('Finish your current trip before starting a new one.')
      return
    }
    openStartNewModal()
  }

  const handleOpenStartTripModal = (trip: any) => {
    if (hasInTransitTrip) {
      toast.error('Finish your current trip before starting another.')
      return
    }
    openStartTripModal(trip)
  }

  return (
    <DriverLayout title="My Trips" driverFirstName={firstName}>
      <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
        {greeting()}, {firstName}! 👋
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Trips</div>
          <div className="text-lg font-bold text-slate-800 dark:text-white">{totalTrips}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">This Month</div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            KES {thisMonthRevenue.toLocaleString('en-KE')}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending</div>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{pendingCount}</div>
        </div>
      </div>

      {hasInTransitTrip && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          You have a trip in progress. Mark it as completed before starting a new one.
        </div>
      )}
      <button
        type="button"
        onClick={handleOpenStartNewModal}
        disabled={hasInTransitTrip}
        className="flex items-center justify-center w-full min-h-[52px] rounded-xl text-white font-bold text-base bg-gradient-to-r from-orange-500 to-orange-600 shadow-sm mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ＋ Start New Trip
      </button>

      {journeys.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-600 dark:text-slate-400 text-base">No trips yet. Tap + to log your first trip.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {journeys.map((trip: any) => (
            <div
              key={trip.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-slate-800 dark:text-white text-base">
                    {trip.origin || '—'} → {trip.dest || '—'}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatDate(trip.date)} · {trip.cargo || 'No cargo specified'}
                  </div>
                </div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                    statusColor[trip.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'
                  }`}
                >
                  {trip.status || '—'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                <span>🚛 {trip.truck === driverInfo?.truck ? (driverInfo?.truckReg ?? trip.truck) : trip.truck ?? '—'}</span>
                {Number(trip.distance) > 0 && (
                  <span>📍 {Number(trip.distance).toLocaleString()} km</span>
                )}
                {trip.weight && <span>⚖️ {trip.weight}T</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  KES {Number(trip.revenue ?? 0).toLocaleString('en-KE')}
                </span>
                {trip.status === 'In Transit' && (
                  <button
                    type="button"
                    onClick={() => openEndModal(trip)}
                    className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Mark completed
                  </button>
                )}
                {trip.status === 'Loading' && (
                  <button
                    type="button"
                    onClick={() => handleOpenStartTripModal(trip)}
                    disabled={hasInTransitTrip}
                    className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start trip (In Transit)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {submissions.length > 0 && (
        <div className="mt-8">
          <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3">My submissions</h3>
          <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {submissions.slice(0, 5).map((s: any) => (
                <div key={s.id} className="px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {s.type === 'journey_start' ? 'Trip start' : s.type === 'journey_end' ? 'Trip end' : s.type}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      s.status === 'approved'
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400'
                        : s.status === 'rejected'
                        ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Start New Trip modal */}
      {showStartNewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl lg:rounded-2xl w-full max-h-[90vh] overflow-y-auto lg:max-w-lg shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Start New Trip</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Odometer photo + reading required. Trip will be In Transit.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartNewModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Origin *</label>
                <input
                  type="text"
                  value={startForm.origin}
                  onChange={(e) => setStartForm((f) => ({ ...f, origin: e.target.value }))}
                  placeholder="e.g. Mombasa"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination *</label>
                <input
                  type="text"
                  value={startForm.destination}
                  onChange={(e) => setStartForm((f) => ({ ...f, destination: e.target.value }))}
                  placeholder="e.g. Kampala"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Cargo</label>
                <input
                  type="text"
                  value={startForm.cargo}
                  onChange={(e) => setStartForm((f) => ({ ...f, cargo: e.target.value }))}
                  placeholder="e.g. Electronics"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Weight (Tonnes)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={startForm.weight}
                  onChange={(e) => setStartForm((f) => ({ ...f, weight: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client / Customer name</label>
                <input
                  type="text"
                  value={startForm.client}
                  onChange={(e) => setStartForm((f) => ({ ...f, client: e.target.value }))}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Odometer reading (km) *</label>
                <input
                  type="number"
                  min="0"
                  value={startForm.odomReading}
                  onChange={(e) => setStartForm((f) => ({ ...f, odomReading: e.target.value }))}
                  placeholder="Required to start trip"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea
                  value={startForm.notes}
                  onChange={(e) => setStartForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  📷 Odometer Photo at Trip Start <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                  Take a clear photo of the odometer reading before departure.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setOdomStartFile(f || null)
                    setOdomStartPreview(f ? URL.createObjectURL(f) : null)
                  }}
                  className="hidden"
                  id="odom-start-input"
                />
                {odomStartPreview ? (
                  <div className="relative">
                    <img
                      src={odomStartPreview}
                      alt="Odometer"
                      className="w-full h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOdomStartFile(null)
                        setOdomStartPreview(null)
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="odom-start-input"
                    className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-orange-300 dark:border-orange-600 rounded-xl bg-orange-50 dark:bg-orange-500/10 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-500/20 transition"
                  >
                    <span className="text-3xl mb-2">📸</span>
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Take odometer photo</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tap to open camera</span>
                  </label>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartNewTrip}
                  disabled={submittingStart}
                  className="flex-1 min-h-[48px] rounded-xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-70"
                >
                  {submittingStart ? 'Starting…' : 'Start Trip'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartNewModal(false)}
                  className="px-4 min-h-[48px] rounded-xl font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start existing trip (Loading) modal */}
      {showStartTripModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl lg:rounded-2xl w-full max-h-[90vh] overflow-y-auto lg:max-w-md shadow-2xl">
            <div className="p-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Start trip</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                {showStartTripModal.origin} → {showStartTripModal.dest}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                Take odometer photo and enter reading. Trip will be marked <strong>In Transit</strong>.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Odometer reading (km) *</label>
                <input
                  type="number"
                  min="0"
                  value={startTripOdom}
                  onChange={(e) => setStartTripOdom(e.target.value)}
                  placeholder="Required to start trip"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white mb-4"
                />
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  📷 Odometer Photo <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setStartTripPhoto(f || null)
                    setStartTripPreview(f ? URL.createObjectURL(f) : null)
                  }}
                  className="hidden"
                  id="start-trip-photo"
                />
                {startTripPreview ? (
                  <div className="relative">
                    <img src={startTripPreview} alt="Odometer" className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                    <button
                      type="button"
                      onClick={() => { setStartTripPhoto(null); setStartTripPreview(null) }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="start-trip-photo"
                    className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-orange-300 dark:border-orange-600 rounded-xl bg-orange-50 dark:bg-orange-500/10 cursor-pointer"
                  >
                    <span className="text-2xl mb-1">📸</span>
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Take photo</span>
                  </label>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleStartTrip}
                  disabled={submittingStartTrip}
                  className="flex-1 min-h-[48px] rounded-xl font-bold bg-blue-500 text-white disabled:opacity-70"
                >
                  {submittingStartTrip ? 'Starting…' : 'Start Trip'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartTripModal(null)}
                  className="px-4 min-h-[48px] rounded-xl font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark trip as completed modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl lg:rounded-2xl w-full max-h-[90vh] overflow-y-auto lg:max-w-md shadow-2xl">
            <div className="p-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Mark trip as completed</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                {showEndModal.origin} → {showEndModal.dest}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                Take a photo of the odometer, enter the final reading, then mark as completed.
              </p>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Arrival Date</label>
                  <input
                    type="date"
                    value={endForm.arrivalDate}
                    onChange={(e) => setEndForm((f) => ({ ...f, arrivalDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Final odometer (km) *</label>
                  <input
                    type="number"
                    min="0"
                    value={endForm.odomReading}
                    onChange={(e) => setEndForm((f) => ({ ...f, odomReading: e.target.value }))}
                    placeholder="Required to close trip"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                  <textarea
                    value={endForm.notes}
                    onChange={(e) => setEndForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional"
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    📷 Odometer Photo at Trip End <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      setOdomEndFile(f || null)
                      setOdomEndPreview(f ? URL.createObjectURL(f) : null)
                    }}
                    className="hidden"
                    id="odom-end-input"
                  />
                  {odomEndPreview ? (
                    <div className="relative">
                      <img
                        src={odomEndPreview}
                        alt="Odometer end"
                        className="w-full h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => { setOdomEndFile(null); setOdomEndPreview(null) }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="odom-end-input"
                      className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-orange-300 dark:border-orange-600 rounded-xl bg-orange-50 dark:bg-orange-500/10 cursor-pointer"
                    >
                      <span className="text-3xl mb-2">📸</span>
                      <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Take odometer photo</span>
                    </label>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleEndTrip}
                  disabled={submittingEnd}
                  className="flex-1 min-h-[48px] rounded-xl font-bold bg-orange-500 text-white disabled:opacity-70"
                >
                  {submittingEnd ? 'Submitting…' : 'Mark as completed'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEndModal(null)}
                  className="px-4 min-h-[48px] rounded-xl font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DriverLayout>
  )
}
