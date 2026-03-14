'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt, today } from '@/lib/ErpContext'
import { ErpModal, F } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function CargoPage() {
  const { S } = useErpContext()
  const [data, setData] = useState<{ journeys: any[]; trucks: any[]; drivers: any[]; clients: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [cargoTab, setCargoTab] = useState<'active' | 'waybill'>('active')
  const [waybillJourney, setWaybillJourney] = useState<any>(null)
  const [waybillForm, setWaybillForm] = useState<Record<string, any>>({})

  const loadData = async () => {
    setLoading(true)
    const [
      { data: journeys },
      { data: trucks },
      { data: drivers },
      { data: clients },
    ] = await Promise.all([
      supabase.from('journeys').select('*').order('date', { ascending: false }),
      supabase.from('trucks').select('*'),
      supabase.from('drivers').select('*'),
      supabase.from('clients').select('*'),
    ])
    setData({ journeys: journeys || [], trucks: trucks || [], drivers: drivers || [], clients: clients || [] })
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const activeLoads = (data?.journeys || []).filter((j: any) => (j.status || '') === 'Loading' || (j.status || '') === 'In Transit')

  const updateStatus = async (journeyId: string, newStatus: string) => {
    const { error } = await supabase.from('journeys').update({ status: newStatus }).eq('id', journeyId)
    if (error) return toast.error(error.message)
    toast.success(newStatus === 'In Transit' ? 'Marked as In Transit' : 'Marked as Delivered')
    loadData()
  }

  const setFormFromJourney = (j: any, waybillNum?: string) => {
    setWaybillForm({
      waybill_number: waybillNum ?? j.waybill_number ?? '',
      shipper: j.shipper || '',
      shipper_address: j.shipper_address || '',
      consignee: j.consignee || '',
      consignee_address: j.consignee_address || '',
      cargo_description: j.cargo_description || j.cargo || '',
      packages_count: j.packages_count ?? '',
      weight: j.weight ?? '',
      cargo_value: j.cargo_value ?? '',
      special_instructions: j.special_instructions || '',
    })
  }

  const getNextWaybillNumber = async () => {
    const y = new Date().getFullYear()
    const prefix = `WB-${y}-`
    const { data: rows } = await supabase.from('journeys').select('waybill_number').not('waybill_number', 'is', null).like('waybill_number', `${prefix}%`)
    const nums = (rows || []).map((r: any) => parseInt(String(r.waybill_number).replace(prefix, ''), 10)).filter((n: number) => !Number.isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${prefix}${String(next).padStart(4, '0')}`
  }

  const openNewWaybill = async (j: any) => {
    setWaybillJourney(j)
    const nextNum = await getNextWaybillNumber()
    setFormFromJourney(j, nextNum)
  }

  const openEditWaybill = (j: any) => {
    setWaybillJourney(j)
    setFormFromJourney(j)
  }

  const saveWaybill = async () => {
    if (!waybillJourney?.id) return
    const payload = {
      waybill_number: waybillForm.waybill_number || null,
      shipper: waybillForm.shipper || null,
      shipper_address: waybillForm.shipper_address || null,
      consignee: waybillForm.consignee || null,
      consignee_address: waybillForm.consignee_address || null,
      cargo_description: waybillForm.cargo_description || null,
      packages_count: waybillForm.packages_count != null && waybillForm.packages_count !== '' ? Number(waybillForm.packages_count) : null,
      weight: waybillForm.weight != null && waybillForm.weight !== '' ? Number(waybillForm.weight) : null,
      cargo_value: waybillForm.cargo_value != null && waybillForm.cargo_value !== '' ? Number(waybillForm.cargo_value) : null,
      special_instructions: waybillForm.special_instructions || null,
    }
    const { error } = await supabase.from('journeys').update(payload).eq('id', waybillJourney.id)
    if (error) return toast.error(error.message)
    toast.success('Waybill saved')
    setWaybillJourney(null)
    loadData()
  }

  const printWaybill = (id: string) => {
    window.open(`/api/waybill/${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading || !data) return <AppLayout><div style={S.ph}>Loading Cargo…</div></AppLayout>

  return (
    <AppLayout>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div style={S.ph}>📦 Cargo & Waybill</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCargoTab('active')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${cargoTab === 'active' ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            Active Loads
          </button>
          <button type="button" onClick={() => setCargoTab('waybill')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${cargoTab === 'waybill' ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            Waybill Generator
          </button>
        </div>
      </div>

      {cargoTab === 'active' && (
        <div className="space-y-4">
          {activeLoads.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">No active loads (Loading or In Transit).</p>
          ) : (
            activeLoads.map((j: any) => {
              const truck = data.trucks.find((t: any) => t.id === j.truck)
              const driver = data.drivers.find((d: any) => d.id === j.driver)
              const client = data.clients.find((c: any) => c.id === j.client_id)
              return (
                <div key={j.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">{j.origin ?? '—'} → {j.dest ?? '—'}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {truck?.reg ?? '—'} · {driver?.name ?? '—'} · {j.cargo ?? '—'} · {j.weight != null ? `${j.weight} t` : '—'} · {client?.name ?? '—'}
                      </div>
                    </div>
                    <span style={S.badge(j.status)}>{j.status}</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {j.status === 'Loading' && (
                      <button type="button" style={S.btn('green')} onClick={() => updateStatus(j.id, 'In Transit')}>Mark Loaded → In Transit</button>
                    )}
                    {(j.status === 'Loading' || j.status === 'In Transit') && (
                      <button type="button" style={S.btn()} onClick={() => updateStatus(j.id, 'Completed')}>Mark Delivered</button>
                    )}
                    <button type="button" className="text-sm text-orange-500 hover:text-orange-600 font-semibold" onClick={() => openNewWaybill(j)}>Generate Waybill</button>
                    {j.waybill_number && (
                      <button type="button" style={S.btn('sm')} onClick={() => printWaybill(j.id)}>Print Waybill</button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {cargoTab === 'waybill' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Select a journey to generate or edit a waybill. You can also use “Generate Waybill” on an active load card.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(data.journeys || []).slice(0, 50).map((j: any) => {
              const truck = data.trucks.find((t: any) => t.id === j.truck)
              return (
                <div key={j.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-white">{j.origin ?? '—'} → {j.dest ?? '—'}</span>
                    <span className="text-xs text-slate-500 ml-2">{j.date} · {truck?.reg ?? '—'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" style={S.btn('sm')} onClick={() => j.waybill_number ? openEditWaybill(j) : openNewWaybill(j)}>{j.waybill_number ? 'Edit' : 'Generate'} Waybill</button>
                    {j.waybill_number && <button type="button" style={S.btn('sm')} onClick={() => printWaybill(j.id)}>Print</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {waybillJourney && (
        <ErpModal title="Waybill" onClose={() => setWaybillJourney(null)} onSave={saveWaybill} wide>
          <div style={S.fgg(2)}>
            <F label="Waybill Number" k="waybill_number" form={waybillForm} setForm={setWaybillForm} />
            <F label="Shipper" k="shipper" form={waybillForm} setForm={setWaybillForm} full />
            <F label="Shipper Address" k="shipper_address" form={waybillForm} setForm={setWaybillForm} full />
            <F label="Consignee" k="consignee" form={waybillForm} setForm={setWaybillForm} full />
            <F label="Consignee Address" k="consignee_address" form={waybillForm} setForm={setWaybillForm} full />
            <F label="Cargo Description" k="cargo_description" form={waybillForm} setForm={setWaybillForm} full />
            <F label="Number of Packages" k="packages_count" type="number" form={waybillForm} setForm={setWaybillForm} />
            <F label="Weight (tonnes)" k="weight" type="number" form={waybillForm} setForm={setWaybillForm} />
            <F label="Declared Value (KES)" k="cargo_value" type="number" form={waybillForm} setForm={setWaybillForm} />
            <F label="Special Instructions" k="special_instructions" form={waybillForm} setForm={setWaybillForm} full />
          </div>
          {waybillJourney.waybill_number && (
            <div className="mt-4">
              <button type="button" style={S.btn('orange')} onClick={() => { printWaybill(waybillJourney.id); }}>Print Waybill</button>
            </div>
          )}
        </ErpModal>
      )}
    </AppLayout>
  )
}
