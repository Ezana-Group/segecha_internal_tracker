'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function DriverPage() {
  const { S } = useErpContext()
  const [user, setUser] = useState<{ id: string; driver_id?: string | null } | null>(null)
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
    const { data: profile } = await supabase.from('users').select('id').eq('id', session.user.id).single()
    const profileWithDriver = profile as { id: string; driver_id?: string } | null
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
      supabase.from('journeys').select('*').eq('driver', driverId).order('date', { ascending: false }),
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

  if (loading) return <AppLayout><div style={S.ph}>Loading…</div></AppLayout>

  if (!user?.driver_id) {
    return (
      <AppLayout>
        <div style={{ ...S.card(), maxWidth: 480, margin: '40px auto' }}>
          <div style={{ ...S.mtitle, marginBottom: 8 }}>🚚 Driver section</div>
          <p style={{ color: S.textDim, fontSize: 14 }}>
            You are not linked to a driver account. Ask an admin to assign you to a driver in <strong>Manage Users</strong> so you can submit trip start/end and odometer photos.
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div style={{ ...S.ph, marginBottom: 24 }}>🚚 My trips</div>
      <p style={{ fontSize: 13, color: S.textDim, marginBottom: 20 }}>
        Submit trip start and end with odometer photos. Each submission waits for admin approval before it appears in the main ERP.
      </p>

      <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
        {journeys.length === 0 ? (
          <div style={{ ...S.card(), padding: 24, textAlign: 'center', color: S.textDim }}>No trips assigned to you yet.</div>
        ) : (
          journeys.map((j: any) => (
            <div key={j.id} style={{ ...S.card(), padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: S.mtitle.color }}>{j.origin} → {j.dest}</div>
                  <div style={{ fontSize: 12, color: S.kpi.color }}>{j.date} · {j.cargo || '—'} · <span style={S.badge(j.status)}>{j.status}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {j.status !== 'Completed' && j.status !== 'Cancelled' && (
                    <>
                      <button style={S.btn('sm')} onClick={() => { setShowStart(showStart === j.id ? null : j.id); setShowEnd(null) }}>Submit start (odometer + photo)</button>
                      <button style={S.btn('green')} onClick={() => { setShowEnd(showEnd === j.id ? null : j.id); setShowStart(null) }}>Submit end (odometer + photo)</button>
                    </>
                  )}
                </div>
              </div>

              {showStart === j.id && (
                <div style={{ marginTop: 16, padding: 16, background: S.wrap?.background || '#f8fafc', borderRadius: 8, border: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Trip start — odometer + photo</div>
                  <input type="number" placeholder="Odometer (km)" value={odometer} onChange={e => setOdometer(e.target.value)} style={{ ...S.inp, width: 160, marginRight: 10, marginBottom: 10 }} />
                  <input type="file" accept="image/*" capture="environment" onChange={e => setPhotoFile(e.target.files?.[0] || null)} style={{ fontSize: 12, marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={S.btn()} onClick={() => submitStart(j.id)} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</button>
                    <button style={S.btn('ghost')} onClick={() => setShowStart(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {showEnd === j.id && (
                <div style={{ marginTop: 16, padding: 16, background: S.wrap?.background || '#f8fafc', borderRadius: 8, border: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Trip end — odometer + photo</div>
                  <input type="number" placeholder="Odometer (km)" value={odometer} onChange={e => setOdometer(e.target.value)} style={{ ...S.inp, width: 160, marginRight: 10, marginBottom: 10 }} />
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...S.inp, width: 140, marginRight: 10, marginBottom: 10 }} />
                  <input type="file" accept="image/*" capture="environment" onChange={e => setPhotoFile(e.target.files?.[0] || null)} style={{ fontSize: 12, marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={S.btn()} onClick={() => submitEnd(j.id)} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</button>
                    <button style={S.btn('ghost')} onClick={() => setShowEnd(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ ...S.mtitle, marginBottom: 12 }}>My submissions</div>
      <div style={{ ...S.card(), overflowX: 'auto' }}>
        <table style={S.tbl}>
          <thead>
            <tr>
              <th style={S.th}>Date</th>
              <th style={S.th}>Type</th>
              <th style={S.th}>Trip / Ref</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Photo</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr><td colSpan={5} style={S.td}>No submissions yet.</td></tr>
            ) : (
              submissions.map((s: any) => (
                <tr key={s.id}>
                  <td style={S.td}>{s.createdAt ? new Date(s.createdAt).toLocaleString('en-KE') : '—'}</td>
                  <td style={S.td}>{s.type === 'journey_start' ? 'Trip start' : s.type === 'journey_end' ? 'Trip end' : s.type}</td>
                  <td style={S.td}>{s.referenceId || '—'}</td>
                  <td style={S.td}><span style={S.badge(s.status)}>{s.status}</span></td>
                  <td style={S.td}>
                    {Array.isArray(s.photoUrls) && s.photoUrls.length > 0 ? (
                      <a href={s.photoUrls[0]} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontSize: 12 }}>View</a>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
