'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { MoreHorizontal, Pencil, Ban, KeyRound, Trash2, RotateCcw } from 'lucide-react'

export default function AdminUsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('director')
  const [inviting, setInviting] = useState(false)
  const [showCreateDriver, setShowCreateDriver] = useState(false)
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', mpesa: '', license: '', status: 'Active' })
  const [creatingDriver, setCreatingDriver] = useState(false)
  const [resetUser, setResetUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [editUser, setEditUser] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'viewer', staff_type: '', driver_id: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (openActionsId && actionsRef.current && !actionsRef.current.contains(e.target as Node)) setOpenActionsId(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openActionsId])

  const loadUsers = async () => {
    const [{ data: uData }, { data: dData }] = await Promise.all([
      supabase.from('users').select('*').order('created_at'),
      supabase.from('drivers').select('id, name').order('name')
    ])
    setUsers(uData ?? [])
    setDrivers(dData ?? [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null))
  }, [])

  const updateRole = async (id: string, role: string) => {
    const { error } = await supabase.from('users').update({ role }).eq('id', id)
    if (error) toast.error('Failed to update role')
    else { toast.success('Role updated'); loadUsers() }
  }

  const updateDriver = async (userId: string, driverId: string) => {
    const { error } = await supabase.from('users').update({ driver_id: driverId || null }).eq('id', userId)
    if (error) toast.error('Failed to update driver')
    else { toast.success(driverId ? 'User linked to driver' : 'Driver link removed'); loadUsers() }
  }

  const inviteUser = async () => {
    if (!inviteEmail || !inviteName) return toast.error('Email and name required')
    setInviting(true)
    try {
      const body: { email: string; name: string; role: string; staff_type?: string } = {
        email: inviteEmail,
        name: inviteName,
        role: inviteRole === 'driver' ? 'staff' : inviteRole,
      }
      if (inviteRole === 'driver') body.staff_type = 'driver'
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Invite sent to ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail(''); setInviteName(''); setInviteRole('director')
      loadUsers()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setInviting(false)
    }
  }

  const createDriver = async () => {
    if (!driverForm.name?.trim()) return toast.error('Driver name is required')
    setCreatingDriver(true)
    try {
      const id = 'D' + Date.now().toString().slice(-6)
      const { error } = await supabase.from('drivers').insert({
        id,
        name: driverForm.name.trim(),
        phone: driverForm.phone.trim() || null,
        mpesa: driverForm.mpesa.trim() || null,
        license: driverForm.license.trim() || null,
        status: driverForm.status || 'Active',
      })
      if (error) throw error
      toast.success(`Driver "${driverForm.name.trim()}" created (${id})`)
      setShowCreateDriver(false)
      setDriverForm({ name: '', phone: '', mpesa: '', license: '', status: 'Active' })
      loadUsers()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreatingDriver(false)
    }
  }

  const resetPassword = async () => {
    if (!resetUser) return
    if (!newPassword || newPassword.length < 6) return toast.error('Password must be at least 6 characters')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')
    setResetting(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetUser.id, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to reset password')
      toast.success(`Password reset for ${resetUser.name}. They must sign in with the new password.`)
      setResetUser(null)
      setNewPassword('')
      setConfirmPassword('')
      loadUsers()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setResetting(false)
    }
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    director: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
    viewer: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    staff: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  }

  const revokeAccess = async (userId: string, previousRole: string) => {
    if (!confirm('Revoke access for this user? They will be immediately logged out.')) return
    try {
      await supabase.from('users').update({
        role: 'revoked',
        staff_type: 'was_' + previousRole,
      }).eq('id', userId)
      const res = await fetch('/api/admin/revoke-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'revoke' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Access revoked')
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Revoke failed')
    }
  }

  const restoreAccess = async (userId: string, staffType: string) => {
    const previousRole = staffType?.startsWith('was_') ? staffType.replace('was_', '') : 'viewer'
    try {
      await supabase.from('users').update({ role: previousRole, staff_type: null }).eq('id', userId)
      const res = await fetch('/api/admin/revoke-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'restore' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Access restored')
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Restore failed')
    }
  }

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Permanently delete "${userName}"? This cannot be undone.`)) return
    try {
      await supabase.from('users').delete().eq('id', userId)
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`${userName} deleted`)
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  const saveEdit = async () => {
    if (!editUser) return
    const userId = editUser.id
    setSavingEdit(true)
    try {
      await supabase.from('users').update({
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        staff_type: editForm.role === 'staff' ? (editForm.staff_type || null) : null,
        driver_id: editForm.driver_id || null,
      }).eq('id', userId)
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: editForm.email,
          name: editForm.name,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('User updated')
      setEditUser(null)
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Update failed')
    } finally {
      setSavingEdit(false)
    }
  }

  const openEdit = (u: any) => {
    setEditUser(u)
    setEditForm({
      name: u.name ?? '',
      email: u.email ?? '',
      role: u.role === 'revoked' ? (u.staff_type?.replace('was_', '') || 'viewer') : (u.role ?? 'viewer'),
      staff_type: u.role === 'staff' ? (u.staff_type ?? '') : '',
      driver_id: u.driver_id ?? '',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">User Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage who has access to the Segecha Group ERP</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateDriver(true)}
            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
          >
            + Create Driver
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition"
          >
            + Invite User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { role: 'Admin', color: 'border-red-200 dark:border-red-800', desc: 'Full access. Can invite users, manage roles, see all data.' },
          { role: 'Director', color: 'border-orange-200 dark:border-orange-800', desc: 'Can view and edit all fleet, journey, invoice, and payroll data.' },
          { role: 'Viewer', color: 'border-blue-200 dark:border-blue-800', desc: 'Read-only access. Cannot create, edit, or delete records.' },
        ].map(r => (
          <div key={r.role} className={`bg-white dark:bg-slate-900 rounded-xl p-4 border ${r.color}`}>
            <div className="font-bold text-slate-800 dark:text-white text-sm mb-1">{r.role}</div>
            <div className="text-xs text-slate-500">{r.desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">Current Users ({users.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                {['User', 'Email', 'Role', 'Driver', 'Last Login', 'Change Role', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={`${i % 2 === 0 ? '' : 'bg-slate-50 dark:bg-slate-800/20'} ${u.role === 'revoked' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.role === 'revoked' ? 'bg-slate-400' : roleColors[u.role]?.split(' ')[0] || 'bg-slate-400'}`}>
                        {u.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role === 'revoked' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 line-through">Revoked</span>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${roleColors[u.role] || 'bg-slate-100 text-slate-700'}`}>{u.role}{u.staff_type ? ` · ${u.staff_type}` : ''}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'revoked' ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <select
                        value={u.driver_id ?? ''}
                        onChange={e => updateDriver(u.id, e.target.value)}
                        className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                        title="Link to driver for Driver portal"
                      >
                        <option value="">— None —</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('en-KE') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'revoked' && (
                      <select
                        value={u.role}
                        onChange={e => updateRole(u.id, e.target.value)}
                        className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="director">Director</option>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative flex items-center justify-end" ref={openActionsId === u.id ? actionsRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenActionsId(openActionsId === u.id ? null : u.id)
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition"
                        aria-label="Actions"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openActionsId === u.id && (
                        <div className="absolute right-0 top-full mt-1 z-[100] min-w-[180px] py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                          {currentUserId !== u.id && u.role !== 'revoked' && (
                            <button
                              type="button"
                              onClick={() => { openEdit(u); setOpenActionsId(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Pencil className="w-4 h-4 text-slate-500" /> Edit
                            </button>
                          )}
                          {currentUserId !== u.id && (
                            u.role === 'revoked' ? (
                              <button
                                type="button"
                                onClick={() => { restoreAccess(u.id, u.staff_type); setOpenActionsId(null) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              >
                                <RotateCcw className="w-4 h-4" /> Restore
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { revokeAccess(u.id, u.role); setOpenActionsId(null) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              >
                                <Ban className="w-4 h-4" /> Revoke
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => { setResetUser({ id: u.id, name: u.name, email: u.email }); setOpenActionsId(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                          >
                            <KeyRound className="w-4 h-4" /> Reset password
                          </button>
                          {currentUserId !== u.id && (
                            <button
                              type="button"
                              onClick={() => { deleteUser(u.id, u.name); setOpenActionsId(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showCreateDriver && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create Driver Profile</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Add a new driver. You can link them to a user and set salary/truck from the Drivers page later.</p>
            <div className="space-y-3">
              {['name', 'phone', 'mpesa', 'license'].map(field => (
                <div key={field}>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {field === 'name' ? 'Full Name *' : field === 'mpesa' ? 'M-Pesa Number' : field === 'phone' ? 'Phone' : 'License No.'}
                  </label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder={field === 'name' ? 'e.g. John Kamau' : field === 'phone' || field === 'mpesa' ? '07XXXXXXXX' : 'Optional'}
                    value={(driverForm as any)[field]}
                    onChange={e => setDriverForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  value={driverForm.status}
                  onChange={e => setDriverForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={createDriver} disabled={creatingDriver} className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-60 transition">
                {creatingDriver ? 'Creating…' : 'Create Driver'}
              </button>
              <button onClick={() => setShowCreateDriver(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold py-2 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit User</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                <input type="email" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Role</label>
                <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="director">Director</option>
                  <option value="viewer">Viewer</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              {editForm.role === 'staff' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Staff Type</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={editForm.staff_type} onChange={e => setEditForm(f => ({ ...f, staff_type: e.target.value }))}>
                    <option value="">— None —</option>
                    <option value="driver">Driver</option>
                    <option value="office">Office</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Linked Driver</label>
                <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" value={editForm.driver_id} onChange={e => setEditForm(f => ({ ...f, driver_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveEdit} disabled={savingEdit} className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-60">{savingEdit ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setEditUser(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {resetUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Reset Password</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Set a new password for <strong>{resetUser.name}</strong> ({resetUser.email}). They will need to sign in again with this password.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                <input type="password" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500" placeholder="Min 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Confirm Password</label>
                <input type="password" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500" placeholder="Same as above" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={resetPassword} disabled={resetting || newPassword.length < 6 || newPassword !== confirmPassword} className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-60 transition">{resetting ? 'Resetting…' : 'Set New Password'}</button>
              <button onClick={() => { setResetUser(null); setNewPassword(''); setConfirmPassword('') }} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold py-2 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Invite New User</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <input className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500" placeholder="e.g. John Kamau" value={inviteName} onChange={e => setInviteName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <input type="email" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500" placeholder="john@segechagroup.co.ke" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Role</label>
                <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="viewer">Viewer — read only</option>
                  <option value="director">Director — full access</option>
                  <option value="admin">Admin — manage users too</option>
                  <option value="driver">Driver — Driver portal only (staff + driver)</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">An email invite will be sent. They set their own password on first login.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={inviteUser} disabled={inviting} className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-60 transition">{inviting ? 'Sending…' : 'Send Invite'}</button>
              <button onClick={() => setShowInvite(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold py-2 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
