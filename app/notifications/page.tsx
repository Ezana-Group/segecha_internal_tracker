'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { TableSearch, SortableTh, sortCompare, ClearFiltersButton } from '@/components/ErpShared'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function NotificationsPage() {
  const { S } = useErpContext()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTrigger, setFilterTrigger] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'created_at', dir: 'desc' })
  const [resending, setResending] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const triggers = [...new Set(data.map((n: any) => n.trigger_type).filter(Boolean))].sort()
  const q = searchQuery.trim().toLowerCase()
  const filtered = data.filter((n: any) => {
    if (filterStatus && (n.status || '') !== filterStatus) return false
    if (filterTrigger && (n.trigger_type || '') !== filterTrigger) return false
    if (!q) return true
    const recipient = (n.recipient || '').toLowerCase()
    const msg = (n.message || '').toLowerCase()
    const name = (n.recipient_name || '').toLowerCase()
    return recipient.includes(q) || msg.includes(q) || name.includes(q)
  })
  const getSortVal = (n: any, key: string) => {
    switch (key) {
      case 'recipient': return (n.recipient || '').toString()
      case 'trigger_type': return (n.trigger_type || '').toString()
      case 'status': return (n.status || '').toString()
      case 'created_at': return n.created_at || ''
      case 'sent_at': return n.sent_at || ''
      default: return ''
    }
  }
  const sorted = [...filtered].sort((a, b) => sortCompare(getSortVal(a, sort.key), getSortVal(b, sort.key), sort.dir))
  const hasActiveFilters = searchQuery.trim() !== '' || filterStatus !== '' || filterTrigger !== ''
  const clearFilters = () => { setSearchQuery(''); setFilterStatus(''); setFilterTrigger('') }

  const resend = async (id: string) => {
    const row = data.find((n: any) => n.id === id)
    if (!row || row.status !== 'failed') return
    setResending(id)
    try {
      const res = await fetch('/api/notify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: row.recipient,
          message: row.message,
          triggerType: row.trigger_type,
          referenceId: row.reference_id,
          recipientName: row.recipient_name,
        }),
      })
      const json = await res.json()
      if (json.success) toast.success('SMS resent'); else toast.error(json.error || 'Resend failed')
      loadData()
    } catch (e: any) {
      toast.error(e.message || 'Resend failed')
    } finally {
      setResending(null)
    }
  }

  if (loading) return <AppLayout><div style={S.ph}>Loading SMS log…</div></AppLayout>

  return (
    <AppLayout>
      <div style={S.ph}>📱 SMS Log</div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search recipient, message…" />
        <select style={{ ...S.inp, width: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <select style={{ ...S.inp, width: 180 }} value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)}>
          <option value="">All triggers</option>
          {triggers.map((t: string) => <option key={t} value={t}>{t}</option>)}
        </select>
        <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
      </div>
      <div style={{ ...S.card(), overflowX: 'auto' as any }}>
        <table style={{ ...S.tbl, minWidth: 700 }}>
          <thead>
            <tr>
              <SortableTh label="Recipient" sortKey="recipient" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={k => setSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
              <th style={S.th}>Name</th>
              <th style={S.th}>Message (preview)</th>
              <SortableTh label="Trigger" sortKey="trigger_type" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={k => setSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
              <SortableTh label="Status" sortKey="status" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={k => setSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
              <SortableTh label="Sent at" sortKey="sent_at" currentSortKey={sort.key} currentSortDir={sort.dir} onSort={k => setSort(prev => ({ key: k, dir: prev.key === k ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))} />
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: S.textDim }}>No notifications yet.</td></tr>
            ) : (
              sorted.map((n: any) => (
                <tr key={n.id}>
                  <td style={S.td}>{n.recipient || '—'}</td>
                  <td style={S.td}>{n.recipient_name || '—'}</td>
                  <td style={{ ...S.td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.message}>{n.message?.slice(0, 60) || '—'}…</td>
                  <td style={S.td}>{n.trigger_type || '—'}</td>
                  <td style={S.td}><span style={S.badge(n.status || 'pending')}>{n.status || 'pending'}</span></td>
                  <td style={S.td}>{n.sent_at ? new Date(n.sent_at).toLocaleString() : n.error_message ? <span className="text-red-500 text-xs">{n.error_message}</span> : '—'}</td>
                  <td style={S.td}>
                    {n.status === 'failed' && (
                      <button style={S.btn('sm')} onClick={() => resend(n.id)} disabled={resending === n.id}>{resending === n.id ? 'Sending…' : 'Resend'}</button>
                    )}
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
