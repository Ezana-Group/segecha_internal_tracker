'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const STAFF_TYPES = [
  { value: 'driver', label: 'Driver — Dashboard, Account, Driver portal' },
  { value: 'marketing', label: 'Marketing — Dashboard, Account, Invoices, M-Pesa' },
  { value: 'office', label: 'Office — Dashboard, Account, Journeys, Fuel, Expenses, Invoices, Payroll, Tyres, Maintenance, P&L' },
]

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteStaffType, setInviteStaffType] = useState('office')
  const [inviting, setInviting] = useState(false)
  const [editingType, setEditingType] = useState<{ id: string; staff_type: string } | null>(null)

  const loadStaff = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'staff')
      .order('name')
    setStaff(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadStaff() }, [])

  const inviteStaff = async () => {
    if (!inviteEmail?.trim() || !inviteName?.trim()) return toast.error('Email and name required')
    setInviting(true)
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: 'staff',
          staff_type: inviteStaffType,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Invite sent to ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      setInviteStaffType('office')
      loadStaff()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setInviting(false)
    }
  }

  const updateStaffType = async (userId: string, staffType: string) => {
    const { error } = await supabase
      .from('users')
      .update({ staff_type: staffType })
      .eq('id', userId)
    if (error) toast.error('Failed to update')
    else {
      toast.success('Staff type updated')
      setEditingType(null)
      loadStaff()
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Staff</h1>
            <p className="text-sm text-slate-500 mt-0.5">Add and manage staff with limited access (Marketing, Driver, Office)</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition"
          >
            + Add Staff
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Staff members ({staff.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading…</div>
          ) : staff.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No staff yet. Click &quot;+ Add Staff&quot; to invite someone with limited access.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['Name', 'Email', 'Type', 'Last Login', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? '' : 'bg-slate-50 dark:bg-slate-800/20'}>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.email}</td>
                    <td className="px-4 py-3">
                      {editingType?.id === s.id ? (
                        <select
                          value={editingType?.staff_type ?? 'office'}
                          onChange={e => setEditingType(prev => prev ? { ...prev, staff_type: e.target.value } : null)}
                          onBlur={() => editingType && updateStaffType(s.id, editingType.staff_type)}
                          className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5"
                        >
                          {STAFF_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 capitalize">
                          {s.staff_type || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {s.last_login ? new Date(s.last_login).toLocaleDateString('en-KE') : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditingType(editingType?.id === s.id ? null : { id: s.id, staff_type: s.staff_type || 'office' })}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        {editingType?.id === s.id ? 'Done' : 'Change type'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showInvite && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add Staff</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Staff get limited access based on their type. They will receive an email to set their password.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                    placeholder="e.g. Jane Wanjiku"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                    placeholder="jane@segechagroup.co.ke"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Staff type (access)</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                    value={inviteStaffType}
                    onChange={e => setInviteStaffType(e.target.value)}
                  >
                    {STAFF_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={inviteStaff}
                  disabled={inviting}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-60"
                >
                  {inviting ? 'Sending…' : 'Send invite'}
                </button>
                <button
                  onClick={() => setShowInvite(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
