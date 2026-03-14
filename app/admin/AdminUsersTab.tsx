'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function AdminUsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">Current Users ({users.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading users…</div>
        ) : (
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
                <tr key={u.id} className={i % 2 === 0 ? '' : 'bg-slate-50 dark:bg-slate-800/20'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${roleColors[u.role]?.split(' ')[0] || 'bg-slate-400'}`}>
                        {u.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${roleColors[u.role] || 'bg-slate-100 text-slate-700'}`}>{u.role}{u.staff_type ? ` · ${u.staff_type}` : ''}</span>
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('en-KE') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setResetUser({ id: u.id, name: u.name, email: u.email })}
                      className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
                      title="Set a new password for this user"
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
