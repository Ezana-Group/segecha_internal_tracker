'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function DriverSubmissionsPage() {
  const { S } = useErpContext()
  const [list, setList] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)

  const load = async () => {
    const [
      { data: sData },
      { data: dData }
    ] = await Promise.all([
      supabase.from('driver_submissions').select('*').eq('status', 'pending').order('createdAt', { ascending: true }),
      supabase.from('drivers').select('id, name')
    ])
    setList(sData || [])
    setDrivers(dData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const driverName = (id: string) => drivers.find(d => d.id === id)?.name || id

  const approve = async (sub: any) => {
    setActing(sub.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (sub.type === 'journey_start') {
        const payload = sub.payload || {}
        const photoUrl = Array.isArray(sub.photoUrls) && sub.photoUrls[0] ? sub.photoUrls[0] : null
        const { error } = await supabase.from('journeys').update({
          odometerStart: payload.odometerStart ?? null,
          odometerStartPhoto: photoUrl
        }).eq('id', sub.referenceId)
        if (error) throw error
      } else if (sub.type === 'journey_end') {
        const payload = sub.payload || {}
        const photoUrl = Array.isArray(sub.photoUrls) && sub.photoUrls[0] ? sub.photoUrls[0] : null
        const { error } = await supabase.from('journeys').update({
          odometerEnd: payload.odometerEnd ?? null,
          odometerEndPhoto: photoUrl,
          endDate: payload.endDate || null,
          status: 'Completed'
        }).eq('id', sub.referenceId)
        if (error) throw error
      }
      const { error: err2 } = await supabase.from('driver_submissions').update({
        status: 'approved',
        reviewedBy: user?.id ?? null,
        reviewedAt: new Date().toISOString()
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
        reviewedAt: new Date().toISOString()
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

  if (loading) return <AppLayout><div style={S.ph}>Loading…</div></AppLayout>

  return (
    <AppLayout>
      <div style={{ ...S.ph, marginBottom: 8 }}>✅ Driver submissions</div>
      <p style={{ fontSize: 13, color: S.textDim, marginBottom: 24 }}>
        Approve or reject driver trip start/end (odometer + photo). Approved data is written to the main ERP.
      </p>

      {list.length === 0 ? (
        <div style={{ ...S.card(), padding: 32, textAlign: 'center', color: S.textDim }}>No pending submissions.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.map((sub: any) => (
            <div key={sub.id} style={{ ...S.card(), padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: S.mtitle.color }}>{sub.type === 'journey_start' ? 'Trip start' : sub.type === 'journey_end' ? 'Trip end' : sub.type}</div>
                  <div style={{ fontSize: 12, color: S.kpi.color }}>Driver: {driverName(sub.driverId)} · Trip: {sub.referenceId || '—'} · {sub.createdAt ? new Date(sub.createdAt).toLocaleString('en-KE') : ''}</div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    {sub.payload?.odometerStart != null && <span>Odometer start: <strong>{sub.payload.odometerStart}</strong> km</span>}
                    {sub.payload?.odometerEnd != null && <span>Odometer end: <strong>{sub.payload.odometerEnd}</strong> km</span>}
                    {sub.payload?.endDate && <span> · End date: <strong>{sub.payload.endDate}</strong></span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {Array.isArray(sub.photoUrls) && sub.photoUrls.length > 0 && (
                    <a href={sub.photoUrls[0]} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                      <img src={sub.photoUrls[0]} alt="Odometer" style={{ maxWidth: 120, maxHeight: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${S.border}` }} />
                    </a>
                  )}
                  <div>
                    <button style={S.btn('green')} onClick={() => approve(sub)} disabled={!!acting}>Approve</button>
                    <button style={S.btn('del')} onClick={() => setRejectId(rejectId === sub.id ? null : sub.id)}>Reject</button>
                  </div>
                </div>
              </div>
              {rejectId === sub.id && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" placeholder="Reason (optional)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ ...S.inp, flex: 1, maxWidth: 280 }} />
                  <button style={S.btn()} onClick={() => reject(sub.id)} disabled={!!acting}>Confirm reject</button>
                  <button style={S.btn('ghost')} onClick={() => { setRejectId(null); setRejectReason('') }}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
