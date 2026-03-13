'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, today } from '@/lib/ErpContext'
import { ErpModal, F } from '@/components/ErpShared'
import { MAINTENANCE_TYPES } from '@/lib/seed-data'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const WARN_DAYS = 30
const WARN_KM = 2000
const COMPLIANCE_TYPES = ['COF / Inspection', 'Insurance']
const DUE_SOON_DAYS = 7

function addMonths(d: string, months: number): string {
  const date = new Date(d)
  date.setMonth(date.getMonth() + months)
  return date.toISOString().split('T')[0]
}

export default function MaintenancePage() {
  const { S } = useErpContext()
  const [data, setData] = useState<{ trucks: any[]; maintenance: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<string | null>(null)
  const [form, setForm] = useState<any>({})

  const loadData = async () => {
    setLoading(true)
    const [{ data: trucks }, { data: maintenance }] = await Promise.all([
      supabase.from('trucks').select('*').order('reg', { ascending: true }),
      supabase.from('maintenance').select('*')
    ])
    setData({ trucks: trucks || [], maintenance: maintenance || [] })
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const truckReg = (id: string) => data?.trucks.find((t: any) => t.id === id)?.reg ?? '—'
  const truckOdom = (id: string) => {
    const t = data?.trucks.find((t: any) => t.id === id)
    return t && typeof t.odom === 'number' ? t.odom : null
  }

  const getStatus = (m: any) => {
    const odom = truckOdom(m.truck)
    const todayStr = today()
    let nextDueKm: number | null = null
    let nextDueDate: string | null = null
    if (m.intervalKm != null && m.lastDoneOdom != null) nextDueKm = Number(m.lastDoneOdom) + Number(m.intervalKm)
    if (m.intervalMonths != null && m.lastDoneDate) nextDueDate = addMonths(m.lastDoneDate, m.intervalMonths)
    let status: 'OK' | 'Due Soon' | 'Overdue' = 'OK'
    if (nextDueKm != null && odom != null && odom >= nextDueKm) status = 'Overdue'
    else if (nextDueDate && todayStr >= nextDueDate) status = 'Overdue'
    else if (nextDueKm != null && odom != null && (nextDueKm - odom) <= WARN_KM) status = 'Due Soon'
    else if (nextDueDate) {
      const daysLeft = Math.floor((new Date(nextDueDate).getTime() - new Date(todayStr).getTime()) / (24 * 60 * 60 * 1000))
      if (daysLeft <= WARN_DAYS && daysLeft >= 0) status = 'Due Soon'
      else if (daysLeft < 0) status = 'Overdue'
    }
    return { nextDueKm, nextDueDate, status }
  }

  const getDaysLeft = (nextDueDate: string | null) => {
    if (!nextDueDate) return null
    return Math.floor((new Date(nextDueDate).getTime() - new Date(today()).getTime()) / (24 * 60 * 60 * 1000))
  }

  const complianceItems = (data?.maintenance || [])
    .filter((m: any) => m.intervalMonths != null && m.lastDoneDate)
    .map((m: any) => ({ m, nextDueDate: addMonths(m.lastDoneDate, m.intervalMonths || 0), truck: data?.trucks.find((t: any) => t.id === m.truck) }))
    .filter((x: any) => x.nextDueDate)
  const overdueCompliance = complianceItems.filter((x: any) => today() >= x.nextDueDate)
  const dueSoonCompliance = complianceItems.filter((x: any) => {
    const days = getDaysLeft(x.nextDueDate)
    return days != null && days >= 0 && days <= DUE_SOON_DAYS
  })

  const openModal = (type: string, item: any = {}) => { setModal(type); setForm({ ...item }) }
  const closeModal = () => { setModal(null); setForm({}) }

  const saveSchedule = async () => {
    if (!form.truck || !form.type) return toast.error('Truck and type are required')
    const payload = { ...form }
    payload.lastDoneOdom = payload.lastDoneOdom ? Number(payload.lastDoneOdom) : null
    payload.lastDoneDate = payload.lastDoneDate || null
    payload.intervalKm = payload.intervalKm ? Number(payload.intervalKm) : null
    payload.intervalMonths = payload.intervalMonths ? parseInt(payload.intervalMonths, 10) || null : null
    if (!payload.id) {
      payload.id = 'M' + Date.now().toString().slice(-6)
      const { error } = await supabase.from('maintenance').insert(payload)
      if (error) return toast.error(error.message)
      toast.success('Maintenance schedule added')
    } else {
      const { error } = await supabase.from('maintenance').update(payload).eq('id', payload.id)
      if (error) return toast.error(error.message)
      toast.success('Schedule updated')
    }
    closeModal()
    loadData()
  }

  const markDone = async () => {
    if (!form.id) return
    const payload = {
      lastDoneOdom: form.lastDoneOdom ? Number(form.lastDoneOdom) : null,
      lastDoneDate: form.lastDoneDate || null,
      notes: form.notes || null
    }
    const { error } = await supabase.from('maintenance').update(payload).eq('id', form.id)
    if (error) return toast.error(error.message)
    if (form.createExpense && form.expenseAmount && Number(form.expenseAmount) > 0) {
      const expense = {
        id: 'E' + Date.now().toString().slice(-6),
        truck: form.truck,
        cat: 'Maintenance',
        amount: Number(form.expenseAmount),
        date: form.lastDoneDate || today(),
        desc: form.expenseDesc?.trim() || `${form.type} – done`
      }
      const { error: exErr } = await supabase.from('expenses').insert(expense)
      if (exErr) toast.error('Maintenance updated but expense failed: ' + exErr.message)
      else toast.success('Marked as done and expense recorded')
    } else {
      toast.success('Marked as done')
    }
    closeModal()
    loadData()
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm('Remove this maintenance schedule?')) return
    const { error } = await supabase.from('maintenance').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Schedule removed')
    loadData()
  }

  if (loading || !data) return <AppLayout><div style={S.ph}>Loading maintenance…</div></AppLayout>

  const byTruck = data.trucks.map((t: any) => ({
    truck: t,
    items: data.maintenance.filter((m: any) => m.truck === t.id)
  }))

  return (
    <AppLayout>
      <div style={S.ph}>🔧 Truck Maintenance</div>
      <p style={{ fontSize: 13, color: S.textDim, marginBottom: 20 }}>
        Schedule and track oil, brakes, COF, insurance, etc. by km or date. Mark when done to see next due.
      </p>
      <div style={{ marginBottom: 16 }}>
        <button style={S.btn()} onClick={() => openModal('schedule', { lastDoneDate: today() })}>+ Add schedule</button>
      </div>

      {(overdueCompliance.length > 0 || dueSoonCompliance.length > 0) && (
        <div style={{ ...S.grid(3, 2, 1), marginBottom: 24 }}>
          {overdueCompliance.length > 0 && (
            <div style={S.card('#ef4444')}>
              <div style={S.kpi}>⚠️ Overdue (compliance)</div>
              <div style={{ ...S.val('#ef4444'), fontSize: 18 }}>{overdueCompliance.length} item{overdueCompliance.length !== 1 ? 's' : ''}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: S.textDim, marginTop: 8 }}>
                {overdueCompliance.slice(0, 5).map((x: any) => (
                  <li key={x.m.id}>
                    <strong>{x.truck?.reg ?? x.m.truck}</strong> — {x.m.type} (due {x.nextDueDate})
                  </li>
                ))}
                {overdueCompliance.length > 5 && <li>+{overdueCompliance.length - 5} more</li>}
              </ul>
            </div>
          )}
          {dueSoonCompliance.length > 0 && (
            <div style={S.card('#f59e0b')}>
              <div style={S.kpi}>📅 Due in next {DUE_SOON_DAYS} days</div>
              <div style={{ ...S.val('#f59e0b'), fontSize: 18 }}>{dueSoonCompliance.length} item{dueSoonCompliance.length !== 1 ? 's' : ''}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: S.textDim, marginTop: 8 }}>
                {dueSoonCompliance.slice(0, 5).map((x: any) => {
                  const days = getDaysLeft(x.nextDueDate)
                  return (
                    <li key={x.m.id}>
                      <strong>{x.truck?.reg ?? x.m.truck}</strong> — {x.m.type} ({x.nextDueDate}, {days} day{days !== 1 ? 's' : ''} left)
                    </li>
                  )
                })}
                {dueSoonCompliance.length > 5 && <li>+{dueSoonCompliance.length - 5} more</li>}
              </ul>
            </div>
          )}
          <div style={S.card('#3b82f6')}>
            <div style={S.kpi}>✓ Compliance types</div>
            <div style={{ fontSize: 12, color: S.textDim }}>{COMPLIANCE_TYPES.join(', ')} — track by date so you don’t miss renewals.</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {byTruck.map(({ truck, items }: any) => (
          <div key={truck.id} style={S.card()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 16, color: S.mtitle.color }}>{truck.reg}</span>
                <span style={{ fontSize: 12, color: S.kpi.color, marginLeft: 8 }}>{truck.make} · Odom: {(truck.odom ?? 0).toLocaleString()} km</span>
              </div>
              <button style={S.btn('sm')} onClick={() => openModal('schedule', { truck: truck.id, lastDoneDate: today() })}>+ Add for this truck</button>
            </div>
            {items.length === 0 ? (
              <div style={{ fontSize: 13, color: S.textDim }}>No maintenance schedules. Add one to track.</div>
            ) : (
              <table style={{ ...S.tbl, marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Last done</th>
                    <th style={S.th}>Interval</th>
                    <th style={S.th}>Next due</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m: any) => {
                    const { nextDueKm, nextDueDate, status } = getStatus(m)
                    const statusColor = status === 'Overdue' ? '#ef4444' : status === 'Due Soon' ? '#f97316' : '#10b981'
                    return (
                      <tr key={m.id}>
                        <td style={S.td}>{m.type}</td>
                        <td style={S.td}>
                          {m.lastDoneOdom != null && <span>{(m.lastDoneOdom).toLocaleString()} km</span>}
                          {m.lastDoneOdom != null && m.lastDoneDate && ' · '}
                          {m.lastDoneDate && <span>{m.lastDoneDate}</span>}
                          {!m.lastDoneOdom && !m.lastDoneDate && '—'}
                        </td>
                        <td style={S.td}>
                          {m.intervalKm != null && <span>{(m.intervalKm).toLocaleString()} km</span>}
                          {m.intervalKm != null && m.intervalMonths != null && ' / '}
                          {m.intervalMonths != null && <span>{m.intervalMonths} mo</span>}
                          {!m.intervalKm && !m.intervalMonths && '—'}
                        </td>
                        <td style={S.td}>
                          {nextDueKm != null && <span>{(nextDueKm).toLocaleString()} km</span>}
                          {nextDueKm != null && nextDueDate && ' · '}
                          {nextDueDate && <span>{nextDueDate}</span>}
                          {nextDueKm == null && !nextDueDate && '—'}
                        </td>
                        <td style={S.td}><span style={S.badge(status)}>{status}</span></td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button style={S.btn('sm')} onClick={() => openModal('done', { ...m, lastDoneDate: today(), lastDoneOdom: truckOdom(m.truck) ?? '' })}>Mark done</button>
                            <button style={S.btn('sm')} onClick={() => openModal('schedule', m)}>Edit</button>
                            <button style={S.btn('del')} onClick={() => deleteSchedule(m.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {modal === 'schedule' && (
        <ErpModal title={form.id ? 'Edit schedule' : 'Add maintenance schedule'} onClose={closeModal} onSave={saveSchedule}>
          <div style={S.fgg(2)}>
            <F label="Truck" k="truck" options={[{ v: '', l: '— Select —' }, ...data.trucks.map((t: any) => ({ v: t.id, l: `${t.reg} (${t.make})` }))]} form={form} setForm={setForm} />
            <F label="Type" k="type" options={[{ v: '', l: '— Select —' }, ...MAINTENANCE_TYPES.map(t => ({ v: t, l: t }))]} form={form} setForm={setForm} />
            <F label="Last done odometer (km)" k="lastDoneOdom" type="number" form={form} setForm={setForm} />
            <F label="Last done date" k="lastDoneDate" type="date" form={form} setForm={setForm} />
            <F label="Repeat every (km)" k="intervalKm" type="number" placeholder="e.g. 10000" form={form} setForm={setForm} />
            <F label="Repeat every (months)" k="intervalMonths" type="number" placeholder="e.g. 12" form={form} setForm={setForm} />
            <F label="Notes" k="notes" full form={form} setForm={setForm} />
          </div>
        </ErpModal>
      )}
      {modal === 'done' && (
        <ErpModal title="Mark as done" onClose={closeModal} onSave={markDone}>
          <p style={{ fontSize: 13, color: S.textDim, marginBottom: 12 }}>{form.type} for {truckReg(form.truck)}</p>
          <div style={S.fgg(2)}>
            <F label="Odometer when done (km)" k="lastDoneOdom" type="number" form={form} setForm={setForm} />
            <F label="Date done" k="lastDoneDate" type="date" form={form} setForm={setForm} />
            <F label="Notes" k="notes" full form={form} setForm={setForm} />
            <div style={{ gridColumn: '1 / -1', marginTop: 8, paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.createExpense} onChange={e => setForm((f: any) => ({ ...f, createExpense: e.target.checked }))} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Also record expense (P&L)</span>
              </label>
              {form.createExpense && (
                <>
                  <F label="Amount (KES)" k="expenseAmount" type="number" form={form} setForm={setForm} />
                  <F label="Description" k="expenseDesc" placeholder={form.type ? `${form.type} – done` : ''} full form={form} setForm={setForm} />
                </>
              )}
            </div>
          </div>
        </ErpModal>
      )}
    </AppLayout>
  )
}
