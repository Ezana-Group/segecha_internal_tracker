'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext, fmt } from '@/lib/ErpContext'
import { ErpModal, F, TableSearch, SortableTh, sortCompare, ClearFiltersButton } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Client = {
  id: string
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  payment_terms?: number | null
  credit_limit?: number | null
  notes?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type ClientStats = {
  trips: number
  revenue: number
  outstanding: number
}

export default function ClientsPage() {
  const { S } = useErpContext()
  const [data, setData] = useState<{
    clients: Client[]
    invoices: any[]
    journeys: any[]
    invoicePayments: any[]
    trucks: any[]
    drivers: any[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [searchQuery, setSearchQuery] = useState('')
  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({})
  const [detailClientId, setDetailClientId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'invoices' | 'trips' | 'statement'>('overview')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<Partial<Client>>({})
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const [portalInvite, setPortalInvite] = useState<Client | null>(null)
  const [portalInviteForm, setPortalInviteForm] = useState({ name: '', email: '' })
  const [portalInviteSending, setPortalInviteSending] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const [
      { data: clients },
      { data: invoices },
      { data: journeys },
      { data: invoicePayments },
      { data: trucks },
      { data: drivers },
    ] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('invoices').select('*'),
      supabase.from('journeys').select('*'),
      supabase.from('invoice_payments').select('*'),
      supabase.from('trucks').select('*'),
      supabase.from('drivers').select('*'),
    ])
    setData({
      clients: clients || [],
      invoices: invoices || [],
      journeys: journeys || [],
      invoicePayments: invoicePayments || [],
      trucks: trucks || [],
      drivers: drivers || [],
    })
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Build client stats: trips (completed journeys), revenue (sum journey revenue), outstanding (unpaid invoice balance)
  useEffect(() => {
    if (!data) return
    const stats: Record<string, ClientStats> = {}
    const completed = data.journeys.filter((j: any) => j.status === 'Completed')
    data.invoices.forEach((inv: any) => {
      const cid = inv.client_id || inv.clientId
      if (!cid) return
      if (!stats[cid]) stats[cid] = { trips: 0, revenue: 0, outstanding: 0 }
      const totalPaid = (data.invoicePayments || [])
        .filter((p: any) => (p.invoice_id || p.invoiceId) === inv.id)
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
      const amount = Number(inv.amount || 0)
      if (totalPaid < amount) stats[cid].outstanding += amount - totalPaid
    })
    completed.forEach((j: any) => {
      const cid = j.client_id || j.clientId
      if (!cid) return
      if (!stats[cid]) stats[cid] = { trips: 0, revenue: 0, outstanding: 0 }
      stats[cid].trips += 1
      stats[cid].revenue += Number(j.revenue || 0)
    })
    setClientStats(stats)
  }, [data])

  const openModal = (type: 'add' | 'edit', client?: Client) => {
    setModal(type)
    setForm(type === 'add'
      ? { name: '', contact_person: '', phone: '', email: '', address: '', city: '', country: 'Kenya', payment_terms: 14, credit_limit: 0, notes: '', status: 'Active' }
      : { ...client }
    )
  }
  const closeModal = () => { setModal(null); setForm({}) }

  const openPortalInvite = (client: Client) => {
    setPortalInvite(client)
    setPortalInviteForm({ name: client.contact_person || '', email: client.email || '' })
  }
  const sendPortalInvite = async () => {
    if (portalInviteSending) return
    if (!portalInvite || !portalInviteForm.email?.trim() || !portalInviteForm.name?.trim()) {
      toast.error('Contact name and email are required')
      return
    }
    setPortalInviteSending(true)
    try {
      const res = await fetch('/api/portal/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: portalInvite.id,
          email: portalInviteForm.email.trim(),
          name: portalInviteForm.name.trim(),
          company_name: portalInvite.name,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Invite failed')
      toast.success(`Portal invite sent to ${portalInviteForm.email}`)
      setPortalInvite(null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to send invite')
    } finally {
      setPortalInviteSending(false)
    }
  }

  const saveClient = async () => {
    if (!form.name?.trim()) return toast.error('Company name is required')
    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || 'Kenya',
      payment_terms: form.payment_terms != null ? Number(form.payment_terms) : 14,
      credit_limit: form.credit_limit != null ? Number(form.credit_limit) : 0,
      notes: form.notes || null,
      status: form.status || 'Active',
      updated_at: new Date().toISOString(),
    }
    if (form.id) {
      const { error } = await supabase.from('clients').update(payload).eq('id', form.id)
      if (error) return toast.error(error.message)
      toast.success('Client updated')
    } else {
      const { error } = await supabase.from('clients').insert(payload)
      if (error) return toast.error(error.message)
      toast.success('Client added')
    }
    closeModal()
    loadData()
  }

  const q = searchQuery.trim().toLowerCase()
  const filtered = (data?.clients || []).filter((c) => {
    if (!q) return true
    const name = (c.name || '').toLowerCase()
    const city = (c.city || '').toLowerCase()
    const contact = (c.contact_person || '').toLowerCase()
    return name.includes(q) || city.includes(q) || contact.includes(q)
  })
  const getSortVal = (c: Client, key: string) => {
    switch (key) {
      case 'name': return (c.name || '').toString()
      case 'city': return (c.city || '').toString()
      case 'status': return (c.status || '').toString()
      case 'trips': return (clientStats[c.id]?.trips ?? 0)
      case 'revenue': return (clientStats[c.id]?.revenue ?? 0)
      case 'outstanding': return (clientStats[c.id]?.outstanding ?? 0)
      default: return ''
    }
  }
  const handleSort = (key: string) => setSort(prev => ({ key, dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))
  const sorted = [...filtered].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))

  const detailClient = detailClientId ? data?.clients.find((c) => c.id === detailClientId) : null
  const hasActiveFilters = searchQuery.trim() !== ''
  const clearFilters = () => setSearchQuery('')

  if (loading || !data) return <AppLayout><div style={S.ph}>Loading Clients…</div></AppLayout>

  return (
    <AppLayout>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div style={S.ph}>👥 Clients</div>
        <div className="flex flex-wrap items-center gap-3">
          <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search clients…" />
          <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            {viewMode === 'cards' ? 'Table' : 'Cards'}
          </button>
          <button style={S.btn()} onClick={() => openModal('add')}>+ Add Client</button>
        </div>
      </div>

      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-lg mb-2">
                    {client.name.charAt(0)}
                  </div>
                  <div className="font-bold text-slate-800 dark:text-white">{client.name}</div>
                  <div className="text-xs text-slate-400">{client.city || '—'}, {client.country || 'Kenya'}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${client.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}>
                  {client.status || 'Active'}
                </span>
              </div>
              <div className="space-y-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
                {client.contact_person && <div>👤 {client.contact_person}</div>}
                {client.phone && <div>📞 {client.phone}</div>}
                {client.email && <div>✉️ {client.email}</div>}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{clientStats[client.id]?.trips ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Trips</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                  <div className="text-xs font-bold text-emerald-600">{fmt(clientStats[client.id]?.revenue ?? 0)}</div>
                  <div className="text-[10px] text-slate-400">Revenue</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                  <div className={`text-xs font-bold ${(clientStats[client.id]?.outstanding ?? 0) > 0 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {fmt(clientStats[client.id]?.outstanding ?? 0)}
                  </div>
                  <div className="text-[10px] text-slate-400">Owed</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 mb-3">
                Payment terms: <span className="font-semibold text-slate-600 dark:text-slate-300">{client.payment_terms ?? 14} days</span>
                {(client.credit_limit ?? 0) > 0 && (
                  <span className="ml-2">· Limit: <span className="font-semibold">{fmt(client.credit_limit!)}</span></span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDetailClientId(client.id)}
                  className="flex-1 text-xs bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-semibold py-1.5 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-500/30 transition"
                >
                  View History
                </button>
                <button type="button" onClick={() => openPortalInvite(client)} className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 font-semibold px-2">
                  🔗 Invite to Portal
                </button>
                <button type="button" onClick={() => openModal('edit', client)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'table' && (
        <div style={{ ...S.card(), overflowX: 'auto' as any }}>
          <table style={{ ...S.tbl, minWidth: 800 }}>
            <thead>
              <tr>
                <SortableTh label="Company" sortKey="name" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                <SortableTh label="City" sortKey="city" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                <th style={S.th}>Contact</th>
                <SortableTh label="Status" sortKey="status" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                <SortableTh label="Trips" sortKey="trips" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                <SortableTh label="Revenue" sortKey="revenue" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                <SortableTh label="Owed" sortKey="outstanding" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={handleSort} />
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: S.textDim }}>No clients yet. Add one to get started.</td></tr>
              ) : (
                sorted.map((client) => (
                  <tr key={client.id}>
                    <td style={{ ...S.td, fontWeight: 700, color: S.mtitle?.color }}>{client.name}</td>
                    <td style={S.td}>{client.city || '—'}</td>
                    <td style={S.td}>{client.contact_person || client.phone || '—'}</td>
                    <td style={S.td}><span style={S.badge(client.status || 'Active')}>{client.status || 'Active'}</span></td>
                    <td style={S.td}>{clientStats[client.id]?.trips ?? 0}</td>
                    <td style={{ ...S.td, color: '#10b981', fontWeight: 600 }}>{fmt(clientStats[client.id]?.revenue ?? 0)}</td>
                    <td style={{ ...S.td, color: (clientStats[client.id]?.outstanding ?? 0) > 0 ? '#ef4444' : undefined }}>{fmt(clientStats[client.id]?.outstanding ?? 0)}</td>
                    <td style={S.td}>
                      <button style={S.btn('sm')} onClick={() => setDetailClientId(client.id)}>View</button>
                      <button type="button" className="ml-1.5 text-xs text-blue-500 hover:text-blue-700 font-semibold" onClick={() => openPortalInvite(client)}>🔗 Invite</button>
                      <button style={{ ...S.btn('sm'), marginLeft: 6 }} onClick={() => openModal('edit', client)}>Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {detailClient && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailClientId(null)} />
          <div className="relative z-10 ml-auto w-full max-w-[480px] md:w-[480px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{detailClient.name}</h2>
              <button type="button" onClick={() => setDetailClientId(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              {(['overview', 'invoices', 'trips', 'statement'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`px-4 py-3 text-sm font-medium capitalize ${detailTab === tab ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detailTab === 'overview' && (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {detailClient.contact_person && <p>👤 {detailClient.contact_person}</p>}
                    {detailClient.phone && <p>📞 {detailClient.phone}</p>}
                    {detailClient.email && <p>✉️ {detailClient.email}</p>}
                    {(detailClient.address || detailClient.city) && (
                      <p>📍 {[detailClient.address, detailClient.city, detailClient.country].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Payment terms: {detailClient.payment_terms ?? 14} days · Credit limit: {detailClient.credit_limit ? fmt(detailClient.credit_limit) : 'None'}</p>
                  {detailClient.notes && <p className="text-sm text-slate-600 dark:text-slate-400">{detailClient.notes}</p>}
                  <button type="button" style={S.btn('sm')} onClick={() => { setDetailClientId(null); openModal('edit', detailClient); }}>Edit client</button>
                </div>
              )}
              {detailTab === 'invoices' && (
                <div className="space-y-2">
                  {(data?.invoices || []).filter((inv: any) => (inv.client_id || inv.clientId) === detailClient.id).length === 0 ? (
                    <p className="text-sm text-slate-500">No invoices for this client.</p>
                  ) : (
                    (data?.invoices || [])
                      .filter((inv: any) => (inv.client_id || inv.clientId) === detailClient.id)
                      .sort((a: any, b: any) => (b.issued || '').localeCompare(a.issued || ''))
                      .map((inv: any) => {
                        const totalPaid = (data?.invoicePayments || []).filter((p: any) => (p.invoice_id || p.invoiceId) === inv.id).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
                        const status = totalPaid >= Number(inv.amount || 0) ? 'Paid' : (inv.status || 'Pending')
                        return (
                          <div key={inv.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 text-sm">
                            <span>{inv.id} · {inv.issued}</span>
                            <span className="font-semibold">{fmt(inv.amount)}</span>
                            <span style={S.badge(status)}>{status}</span>
                          </div>
                        )
                      })
                  )}
                </div>
              )}
              {detailTab === 'trips' && (
                <div className="space-y-2">
                  {(data?.journeys || []).filter((j: any) => (j.client_id || j.clientId) === detailClient.id).length === 0 ? (
                    <p className="text-sm text-slate-500">No trips for this client.</p>
                  ) : (
                    (data?.journeys || [])
                      .filter((j: any) => (j.client_id || j.clientId) === detailClient.id)
                      .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
                      .map((j: any) => {
                        const truck = data?.trucks?.find((t: any) => t.id === j.truck)
                        const driver = data?.drivers?.find((d: any) => d.id === j.driver)
                        return (
                          <div key={j.id} className="py-2 border-b border-slate-100 dark:border-slate-800 text-sm">
                            <div className="font-medium">{j.origin} → {j.dest}</div>
                            <div className="text-xs text-slate-500">{j.date} · {truck?.reg || '—'} · {driver?.name || '—'} · {fmt(j.revenue)}</div>
                          </div>
                        )
                      })
                  )}
                </div>
              )}
              {detailTab === 'statement' && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Total revenue (trips)</span><span className="font-semibold text-emerald-600">{fmt(clientStats[detailClient.id]?.revenue ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Outstanding (invoices)</span><span className={`font-semibold ${(clientStats[detailClient.id]?.outstanding ?? 0) > 0 ? 'text-red-500' : 'text-slate-500'}`}>{fmt(clientStats[detailClient.id]?.outstanding ?? 0)}</span></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Portal invite modal */}
      {portalInvite && (
        <ErpModal title="Invite to Client Portal" onClose={() => setPortalInvite(null)} onSave={sendPortalInvite}>
          <div style={S.fgg(2)}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Company</label>
              <div className="font-semibold text-slate-800 dark:text-white">{portalInvite.name}</div>
            </div>
            <F label="Contact person name *" k="name" form={portalInviteForm} setForm={setPortalInviteForm} />
            <F label="Email *" k="email" type="email" form={portalInviteForm} setForm={setPortalInviteForm} />
          </div>
          {portalInviteSending && <p className="text-sm text-slate-500">Sending invite…</p>}
        </ErpModal>
      )}

      {/* Add/Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <ErpModal title={modal === 'add' ? 'Add Client' : 'Edit Client'} onClose={closeModal} onSave={saveClient} wide>
          <div style={S.fgg(2)}>
            <F label="Company Name *" k="name" form={form} setForm={setForm} full />
            <F label="Contact Person" k="contact_person" form={form} setForm={setForm} />
            <F label="Phone" k="phone" form={form} setForm={setForm} placeholder="e.g. 0700 111 222" />
            <F label="Email" k="email" form={form} setForm={setForm} type="email" />
            <F label="Address" k="address" form={form} setForm={setForm} full />
            <F label="City" k="city" form={form} setForm={setForm} />
            <F label="Country" k="country" form={form} setForm={setForm} />
            <F label="Payment Terms (days)" k="payment_terms" type="number" form={form} setForm={setForm} />
            <F label="Credit Limit (KES, 0 = no limit)" k="credit_limit" type="number" form={form} setForm={setForm} />
            <F label="Status" k="status" options={['Active', 'Inactive']} form={form} setForm={setForm} />
            <F label="Notes" k="notes" form={form} setForm={setForm} full />
          </div>
        </ErpModal>
      )}
    </AppLayout>
  )
}
