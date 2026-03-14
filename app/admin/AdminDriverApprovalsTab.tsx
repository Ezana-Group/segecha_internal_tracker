'use client'

import React, { useState, useEffect } from 'react'
import { useErpContext } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

function parsePhotoUrls(sub: any): string[] {
  const raw = sub?.photoUrls
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === 'string')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((u: any) => typeof u === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

const TYPE_LABELS: Record<string, string> = {
  journey_start: 'Trip start',
  journey_end: 'Trip end',
  fuel: 'Fuel',
  expense: 'Expense',
}

export default function AdminDriverApprovalsTab() {
  const { S } = useErpContext()
  const [list, setList] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const load = async () => {
    const [
      { data: sData },
      { data: dData },
    ] = await Promise.all([
      supabase.from('driver_submissions').select('*').eq('status', 'pending').order('createdAt', { ascending: true }),
      supabase.from('drivers').select('id, name'),
    ])
    setList(sData || [])
    setDrivers(dData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const driverName = (id: string) => drivers.find((d) => d.id === id)?.name || id

  const approve = async (sub: any) => {
    setActing(sub.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const photos = parsePhotoUrls(sub)
      const photoUrl = photos[0] || null
      if (sub.type === 'journey_start') {
        const payload = sub.payload || {}
        const { error } = await supabase.from('journeys').update({
          odometerStart: payload.odometerStart ?? payload.odomReading ?? null,
          odometerStartPhoto: photoUrl,
        }).eq('id', sub.referenceId)
        if (error) throw error
      } else if (sub.type === 'journey_end') {
        const payload = sub.payload || {}
        const { error } = await supabase.from('journeys').update({
          odometerEnd: payload.odometerEnd ?? payload.odomReading ?? null,
          odometerEndPhoto: photoUrl,
          endDate: payload.endDate || payload.arrivalDate || null,
          status: 'Completed',
        }).eq('id', sub.referenceId)
        if (error) throw error
      }
      const { error: err2 } = await supabase.from('driver_submissions').update({
        status: 'approved',
        reviewedBy: user?.id ?? null,
        reviewedAt: new Date().toISOString(),
      }).eq('id', sub.id)
      if (err2) throw err2
      toast.success('Approved')
      load()
    } catch (e: any) {
      toast.error(e.message || 'Approve failed')
    } finally {
      setActing(null)
    }
  }

  const reject = async (id: string) => {
    setActing(id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('driver_submissions').update({
        status: 'rejected',
        rejectionReason: rejectReason.trim() || null,
        reviewedBy: user?.id ?? null,
        reviewedAt: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      toast.success('Rejected')
      setRejectId(null)
      setRejectReason('')
      load()
    } catch (e: any) {
      toast.error(e.message || 'Reject failed')
    } finally {
      setActing(null)
    }
  }

  if (loading) return <div style={S.ph}>Loading…</div>

  return (
    <div className="space-y-6">
      <div style={{ ...S.ph, marginBottom: 8 }}>✅ Driver submissions</div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Approve or reject driver trip start/end, fuel, and expense submissions. Odometer and receipt photos can be viewed below.
      </p>

      {list.length === 0 ? (
        <div style={{ ...S.card(), padding: 32, textAlign: 'center', color: S.textDim }}>No pending submissions.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((sub: any) => {
            const photos = parsePhotoUrls(sub)
            return (
              <div key={sub.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 mr-2">
                      {TYPE_LABELS[sub.type] || sub.type}
                    </span>
                    <div className="font-bold text-slate-800 dark:text-white mt-1">
                      {driverName(sub.driverId)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Ref: {sub.referenceId || '—'} · {sub.createdAt ? new Date(sub.createdAt).toLocaleString('en-KE') : ''}
                    </div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {sub.payload?.odometerStart != null && (
                        <span>Odometer start: <strong>{sub.payload.odometerStart}</strong> km</span>
                      )}
                      {sub.payload?.odometerEnd != null && (
                        <span>Odometer end: <strong>{sub.payload.odometerEnd}</strong> km</span>
                      )}
                      {sub.payload?.odomReading != null && (
                        <span>Odometer: <strong>{sub.payload.odomReading}</strong> km</span>
                      )}
                      {sub.payload?.endDate && (
                        <span> · End date: <strong>{sub.payload.endDate}</strong></span>
                      )}
                      {sub.payload?.arrivalDate && (
                        <span> · Arrival: <strong>{sub.payload.arrivalDate}</strong></span>
                      )}
                      {sub.payload?.litres != null && (
                        <span> · {sub.payload.litres} L</span>
                      )}
                      {sub.payload?.amount != null && (
                        <span> · KES {Number(sub.payload.amount).toLocaleString()}</span>
                      )}
                      {sub.payload?.category && (
                        <span> · {sub.payload.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => approve(sub)}
                      disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectId(rejectId === sub.id ? null : sub.id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {photos.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Attached Photos
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {photos.map((url: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="group relative block"
                        >
                          <img
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="w-24 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-600 group-hover:opacity-80 transition cursor-zoom-in"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <span className="text-white text-lg bg-black/50 rounded-full w-8 h-8 flex items-center justify-center">🔍</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {rejectId === sub.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Rejection reason (optional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => reject(sub.id)}
                      disabled={!!acting}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectId(null); setRejectReason('') }}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Enlarged"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
            onClick={() => setLightboxUrl(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
