'use client'

import React, { useState, useEffect } from 'react'
import { usePortalClient } from '@/components/ClientPortalLayout'
import { supabase } from '@/lib/supabase'

export default function PortalTripsPage() {
  const { clientId } = usePortalClient()
  const [journeys, setJourneys] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: jData },
        { data: tData },
      ] = await Promise.all([
        supabase.from('journeys').select('*').eq('client_id', clientId).order('date', { ascending: false }),
        supabase.from('trucks').select('id, reg'),
      ])
      setJourneys(jData || [])
      setTrucks(tData || [])
      setLoading(false)
    }
    load()
  }, [clientId])

  const activeTrips = journeys.filter((j: any) => (j.status || '') !== 'Completed' && (j.status || '').length > 0)

  if (loading) return <div className="text-slate-500">Loading trips…</div>

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">My Trips</h1>
      {activeTrips.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          🚛 In Transit: You have {activeTrips.length} active trip(s).
        </div>
      )}
      <div className="space-y-3">
        {journeys.length === 0 ? (
          <p className="text-slate-500">No trips yet.</p>
        ) : (
          journeys.map((j) => {
            const truck = trucks.find((t: any) => t.id === j.truck)
            const status = j.status || 'Pending'
            const statusLabel = status === 'Completed' ? 'Completed' : status === 'In Transit' || status === 'InProgress' ? 'In Transit' : 'Loading'
            return (
              <div key={j.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800">{j.origin ?? '—'} → {j.dest ?? '—'}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {j.date} · {truck?.reg ?? '—'} · {j.cargo ?? '—'}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    statusLabel === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                    statusLabel === 'In Transit' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
