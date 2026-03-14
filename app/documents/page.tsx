'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, ClearFiltersButton } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import { DOC_LABELS, daysUntil, daysAgo } from '@/lib/documents'
import toast from 'react-hot-toast'

const DOC_TYPES_TRUCK = [
  'insurance_comprehensive', 'insurance_third_party', 'ntsa_inspection', 'comesa_certificate',
  'good_transit_licence', 'overload_permit', 'route_permit', 'customs_bond', 'fire_extinguisher', 'other_truck',
]
const DOC_TYPES_DRIVER = [
  'driving_licence', 'psv_badge', 'good_conduct', 'medical_certificate', 'nhif', 'nssf', 'other_driver',
]
const DOC_TYPES_COMPANY = ['business_permit', 'kra_pin', 'ntsa_operator', 'other_company']

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Doc = {
  id: string
  entity_type: string
  entity_id?: string | null
  entity_name?: string | null
  doc_type: string
  doc_number?: string | null
  issuer?: string | null
  issued_date?: string | null
  expiry_date: string
  file_url?: string | null
  notes?: string | null
  status?: string
}

export default function DocumentsPage() {
  const { S } = useErpContext()
  const [tab, setTab] = useState<'truck' | 'driver' | 'company'>('truck')
  const [data, setData] = useState<{ documents: Doc[]; trucks: any[]; drivers: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDocType, setFilterDocType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<Partial<Doc>>({})
  const [uploading, setUploading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const [
      { data: documents },
      { data: trucks },
      { data: drivers },
    ] = await Promise.all([
      supabase.from('documents').select('*').order('expiry_date', { ascending: true }),
      supabase.from('trucks').select('*').order('reg'),
      supabase.from('drivers').select('*').order('name'),
    ])
    setData({
      documents: documents || [],
      trucks: trucks || [],
      drivers: drivers || [],
    })
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const docTypesForTab = tab === 'truck' ? DOC_TYPES_TRUCK : tab === 'driver' ? DOC_TYPES_DRIVER : DOC_TYPES_COMPANY
  const entitiesForTab = tab === 'truck'
    ? (data?.trucks || []).map((t: any) => ({ id: t.id, name: `${t.reg} — ${t.make || ''} ${t.type || ''}`.trim() || t.reg }))
    : tab === 'driver'
      ? (data?.drivers || []).map((d: any) => ({ id: d.id, name: d.name }))
      : [{ id: 'company', name: 'Company' }]

  const docsForTab = (data?.documents || []).filter((d) => d.entity_type === tab)
  const expiredCount = docsForTab.filter((d) => d.status === 'Expired').length
  const expiringSoonCount = docsForTab.filter((d) => d.status === 'Expiring Soon').length
  const validCount = docsForTab.filter((d) => d.status === 'Valid').length

  const q = searchQuery.trim().toLowerCase()
  const filteredDocs = docsForTab.filter((d) => {
    if (filterDocType && d.doc_type !== filterDocType) return false
    if (filterStatus && d.status !== filterStatus) return false
    if (!q) return true
    const name = (d.entity_name || '').toLowerCase()
    const docLabel = (DOC_LABELS[d.doc_type] || d.doc_type).toLowerCase()
    const issuer = (d.issuer || '').toLowerCase()
    const num = (d.doc_number || '').toLowerCase()
    return name.includes(q) || docLabel.includes(q) || issuer.includes(q) || num.includes(q)
  })

  // Group by entity (company docs use key 'company')
  const byEntity = filteredDocs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const key = tab === 'company' ? 'company' : (doc.entity_id || 'unknown')
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  const openAddDoc = (entityType: string, entityId: string | null, entityName: string) => {
    setModal('add')
    setForm({
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      doc_type: docTypesForTab[0],
      doc_number: '',
      issuer: '',
      issued_date: '',
      expiry_date: '',
      file_url: '',
      notes: '',
    })
  }

  const openEdit = (doc: Doc) => {
    setModal('edit')
    setForm({ ...doc })
  }

  const closeModal = () => { setModal(null); setForm({}) }

  const saveDocument = async () => {
    if (!form.expiry_date) return toast.error('Expiry date is required')
    if (!form.doc_type) return toast.error('Document type is required')
    const payload = {
      entity_type: form.entity_type,
      entity_id: form.entity_id || null,
      entity_name: form.entity_name || null,
      doc_type: form.doc_type,
      doc_number: form.doc_number || null,
      issuer: form.issuer || null,
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date,
      file_url: form.file_url || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }
    if (form.id) {
      const { error } = await supabase.from('documents').update(payload).eq('id', form.id)
      if (error) return toast.error(error.message)
      toast.success('Document updated')
    } else {
      const { error } = await supabase.from('documents').insert(payload)
      if (error) return toast.error(error.message)
      toast.success('Document added')
    }
    closeModal()
    loadData()
  }

  const deleteDoc = async (id: string) => {
    if (!confirm('Delete this document record?')) return
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Document removed')
    loadData()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'documents')
      const res = await fetch('/api/upload/driver-photo', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setForm((f) => ({ ...f, file_url: json.url }))
      toast.success('File uploaded')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const hasActiveFilters = searchQuery.trim() !== '' || filterDocType !== '' || filterStatus !== ''
  const clearFilters = () => { setSearchQuery(''); setFilterDocType(''); setFilterStatus('') }

  if (loading || !data) return <AppLayout><div style={S.ph}>Loading Documents…</div></AppLayout>

  return (
    <AppLayout>
      <div style={S.ph}>📁 Documents</div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['truck', 'driver', 'company'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition ${tab === t ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            {t === 'truck' ? 'Trucks' : t === 'driver' ? 'Drivers' : 'Company'}
          </button>
        ))}
      </div>

      <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-wrap gap-6">
        <span className="text-sm font-semibold text-red-600 dark:text-red-400">🔴 Expired: {expiredCount}</span>
        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">🟡 Expiring in 30 days: {expiringSoonCount}</span>
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">🟢 Valid: {validCount}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search by name, doc type, issuer..." />
        <select style={{ ...S.inp, width: 200 }} value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)}>
          <option value="">All document types</option>
          {docTypesForTab.map((dt) => (
            <option key={dt} value={dt}>{DOC_LABELS[dt] || dt}</option>
          ))}
        </select>
        <select style={{ ...S.inp, width: 140 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="Expired">Expired</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Valid">Valid</option>
        </select>
        <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
      </div>

      <div className="space-y-6">
        {entitiesForTab.length > 0 && entitiesForTab.map((ent) => {
          const entityDocs = byEntity[ent.id ?? ''] || []
          const entityExpired = entityDocs.filter((d) => d.status === 'Expired').length
          const entityExpiringSoon = entityDocs.filter((d) => d.status === 'Expiring Soon').length
          return (
            <div key={ent.id ?? 'company'} className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold text-slate-800 dark:text-white">{ent.name}</span>
                {entityExpired > 0 && (
                  <span className="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {entityExpired} expired
                  </span>
                )}
                {entityExpiringSoon > 0 && (
                  <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {entityExpiringSoon} expiring soon
                  </span>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {entityDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      doc.status === 'Expired' ? 'bg-red-500' :
                      doc.status === 'Expiring Soon' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                        {DOC_LABELS[doc.doc_type] || doc.doc_type}
                      </div>
                      <div className="text-xs text-slate-400">
                        {doc.doc_number && <span className="mr-2">#{doc.doc_number}</span>}
                        {doc.issuer && <span>{doc.issuer}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${
                        doc.status === 'Expired' ? 'text-red-600 dark:text-red-400' :
                        doc.status === 'Expiring Soon' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {doc.status === 'Expired'
                          ? `Expired ${daysAgo(doc.expiry_date)}d ago`
                          : doc.status === 'Expiring Soon'
                            ? `Expires in ${daysUntil(doc.expiry_date)}d`
                            : formatDate(doc.expiry_date)}
                      </div>
                      <div className="text-xs text-slate-400">{doc.expiry_date}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                          📎 View
                        </a>
                      )}
                      <button type="button" onClick={() => openEdit(doc)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Edit</button>
                      <button type="button" onClick={() => deleteDoc(doc.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => openAddDoc(tab, ent.id === 'company' ? null : ent.id, ent.name)}
                  className="w-full px-4 py-2.5 text-xs text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-left font-semibold transition"
                >
                  + Add document for {ent.name}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <ErpModal title={modal === 'add' ? 'Add Document' : 'Edit Document'} onClose={closeModal} onSave={saveDocument} wide>
          <div style={S.fgg(2)}>
            <div style={S.fg}>
              <label style={S.lbl}>Entity type</label>
              <select
                style={S.inp}
                value={form.entity_type || ''}
                onChange={(e) => {
                  const v = e.target.value as 'truck' | 'driver' | 'company'
                  setForm((f) => ({ ...f, entity_type: v, entity_id: v === 'company' ? null : f.entity_id, entity_name: v === 'company' ? 'Company' : f.entity_name }))
                }}
              >
                <option value="truck">Truck</option>
                <option value="driver">Driver</option>
                <option value="company">Company</option>
              </select>
            </div>
            {form.entity_type === 'truck' && (
              <div style={S.fg}>
                <label style={S.lbl}>Truck</label>
                <select
                  style={S.inp}
                  value={form.entity_id || ''}
                  onChange={(e) => {
                    const t = data?.trucks?.find((x: any) => x.id === e.target.value)
                    setForm((f) => ({ ...f, entity_id: e.target.value || null, entity_name: t ? `${t.reg} — ${t.make || ''} ${t.type || ''}`.trim() : '' }))
                  }}
                >
                  <option value="">— Select —</option>
                  {(data?.trucks || []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.reg} — {t.make} {t.type}</option>
                  ))}
                </select>
              </div>
            )}
            {form.entity_type === 'driver' && (
              <div style={S.fg}>
                <label style={S.lbl}>Driver</label>
                <select
                  style={S.inp}
                  value={form.entity_id || ''}
                  onChange={(e) => {
                    const d = data?.drivers?.find((x: any) => x.id === e.target.value)
                    setForm((f) => ({ ...f, entity_id: e.target.value || null, entity_name: d?.name || '' }))
                  }}
                >
                  <option value="">— Select —</option>
                  {(data?.drivers || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
            <F label="Document type" k="doc_type" form={form} setForm={setForm} options={docTypesForTab.map((dt) => ({ v: dt, l: DOC_LABELS[dt] || dt }))} />
            <F label="Document number" k="doc_number" form={form} setForm={setForm} />
            <F label="Issuer" k="issuer" form={form} setForm={setForm} placeholder="e.g. NTSA, APA Insurance" />
            <F label="Issue date" k="issued_date" type="date" form={form} setForm={setForm} />
            <F label="Expiry date *" k="expiry_date" type="date" form={form} setForm={setForm} />
            {form.expiry_date && new Date(form.expiry_date) < new Date() && (
              <p className="text-xs text-red-500 mt-1 col-span-full">⚠️ This date is in the past — document is already expired</p>
            )}
            {form.expiry_date && daysUntil(form.expiry_date) <= 30 && daysUntil(form.expiry_date) > 0 && (
              <p className="text-xs text-amber-500 mt-1 col-span-full">⚠️ Expires in {daysUntil(form.expiry_date)} days</p>
            )}
            <div style={{ ...S.fg, gridColumn: '1 / -1' }}>
              <label style={S.lbl}>Upload file (PDF or image)</label>
              <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} disabled={uploading} style={{ ...S.inp, padding: 8 }} />
              {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
              {form.file_url && <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 mt-1 block">📎 Current file</a>}
            </div>
            <F label="Notes" k="notes" form={form} setForm={setForm} full />
          </div>
        </ErpModal>
      )}
    </AppLayout>
  )
}
