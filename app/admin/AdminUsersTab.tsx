'use client'

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { MoreHorizontal } from 'lucide-react'

const roleBadge: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  director: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  viewer: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  staff: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
}
const avatarBg: Record<string, string> = {
  admin: 'bg-red-500',
  director: 'bg-orange-500',
  viewer: 'bg-blue-500',
  staff: 'bg-emerald-500',
}

const AdminUsersTab = forwardRef(function AdminUsersTab(_, ref) {
  const [users, setUsers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('director')
  const [inviting, setInviting] = useState(false)
  const [showCreateDriver, setShowCreateDriver] = useState(false)
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', mpesa: '', license: '', status: 'Active' })
  const [creatingDriver, setCreatingDriver] = useState(false)
  const [sendingResetEmailFor, setSendingResetEmailFor] = useState<string | null>(null)
  const [editUser, setEditUser] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'viewer', staff_type: '', driver_id: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    openCreateDriverModal: () => setShowCreateDriver(true),
    openInviteModal: () => setShowInvite(true),
  }))

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (openActionsId && actionsRef.current && !actionsRef.current.contains(e.target as Node)) setOpenActionsId(null)
    }
    if (openActionsId) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openActionsId])

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

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

  const sendResetEmail = async (userId: string, userName: string, userEmail: string) => {
    setSendingResetEmailFor(userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const body: { userId: string; access_token?: string; refresh_token?: string } = { userId }
      if (session?.access_token && session?.refresh_token) {
        body.access_token = session.access_token
        body.refresh_token = session.refresh_token
      }
      const res = await fetch('/api/admin/send-reset-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send reset email')
      toast.success(`Password reset email sent to ${userEmail}. They can set a new password via the link.`)
      setOpenActionsId(null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSendingResetEmailFor(null)
    }
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
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <span className="text-xs text-slate-400 font-medium">Roles:</span>
        {[
          { role: 'Admin', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', desc: 'Full access' },
          { role: 'Director', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400', desc: 'Edit all data' },
          { role: 'Viewer', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', desc: 'Read only' },
          { role: 'Staff', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400', desc: 'Limited access' },
        ].map((r) => (
          <span
            key={r.role}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${r.color}`}
          >
            {r.role}
            <span className="opacity-60 font-normal">— {r.desc}</span>
          </span>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white">
              Users <span className="text-slate-400 font-normal text-sm">({filteredUsers.length})</span>
            </h3>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['User', 'Role', 'Last Login', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`${i % 2 === 0 ? '' : 'bg-slate-50 dark:bg-slate-800/20'} ${u.role === 'revoked' ? 'opacity-40' : ''} transition-opacity`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${u.role === 'revoked' ? 'bg-slate-400' : avatarBg[u.role] || 'bg-slate-400'}`}
                        >
                          {u.name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-white text-sm">{u.name}</div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'revoked' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400 dark:bg-slate-700 line-through">
                          Revoked
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${roleBadge[u.role] || 'bg-slate-100 text-slate-700'}`}>
                          {u.role?.charAt(0).toUpperCase() + u.role?.slice(1)}
                          {u.role === 'staff' && u.staff_type ? (
                            <span className="ml-1 opacity-60 font-normal">({u.staff_type})</span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {u.last_login ? (
                        new Date(u.last_login).toLocaleDateString('en-KE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">Never logged in</span>
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openActionsId === u.id && (
                          <div className="absolute right-0 top-8 z-[100] w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                            {currentUserId !== u.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  openEdit(u)
                                  setOpenActionsId(null)
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5"
                              >
                                ✏️ <span>Edit user</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                sendResetEmail(u.id, u.name, u.email)
                                setOpenActionsId(null)
                              }}
                              disabled={sendingResetEmailFor === u.id}
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2.5 disabled:opacity-50"
                            >
                              🔑 <span>Reset password</span>
                            </button>
                            {u.role !== 'revoked' ? (
                              currentUserId !== u.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    revokeAccess(u.id, u.role)
                                    setOpenActionsId(null)
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 flex items-center gap-2.5"
                                >
                                  🚫 <span>Revoke access</span>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  restoreAccess(u.id, u.staff_type)
                                  setOpenActionsId(null)
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-2.5"
                              >
                                ✅ <span>Restore access</span>
                              </button>
                            )}
                            {currentUserId !== u.id && (
                              <>
                                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteUser(u.id, u.name)
                                    setOpenActionsId(null)
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2.5"
                                >
                                  🗑️ <span>Delete user</span>
                                </button>
                              </>
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
})

export default AdminUsersTab
