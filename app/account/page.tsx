'use client'

import React, { useState, useEffect, useRef } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Profile = { id: string; email: string; name: string; role: string; driver_id?: string | null; staff_type?: string | null; avatar_url?: string | null; phone?: string | null; last_login?: string | null }

export default function AccountPage() {
  const { S } = useErpContext()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [ensuring, setEnsuring] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const ensuredOnce = useRef(false)

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    let { data: profileData } = await supabase.from('users').select('id, email, name, role, phone, last_login').eq('id', session.user.id).single()
    if (!profileData) {
      const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
      const { data: created } = await supabase.from('users')
        .upsert({ id: session.user.id, email: session.user.email, name, role: 'admin' })
        .select('id, email, name, role, phone, last_login').single()
      profileData = created ?? null
    }
    const driverId = (profileData as { driver_id?: string } | null)?.driver_id
    if (driverId) {
      const { data: driverData } = await supabase.from('drivers').select('id, name').eq('id', driverId).single()
      setDriver(driverData ?? null)
    } else setDriver(null)
    setProfile(profileData || null)
    if (profileData) {
      setEditName((profileData as Profile).name || '')
      setEditPhone((profileData as Profile).phone || '')
    }
    return profileData
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const profileData = await loadProfile()
      if (cancelled) return
      if (!profileData && !ensuredOnce.current) {
        ensuredOnce.current = true
        try {
          const res = await fetch('/api/auth/ensure-profile', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
          })
          if (res.ok) {
            const created = await loadProfile()
            if (created) window.location.reload()
          }
        } catch (_) {}
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const ensureProfile = async () => {
    setEnsuring(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Not signed in. Please sign in and try again.')
        setEnsuring(false)
        return
      }
      const res = await fetch('/api/auth/ensure-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      toast.success('Profile created. Reloading…')
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setEnsuring(false)
    }
  }

  if (loading) return <AppLayout><div style={S.ph}>Loading account…</div></AppLayout>
  if (!profile) return (
    <AppLayout>
      <div style={S.ph}>Could not load profile.</div>
      <p style={{ fontSize: 13, color: S.textDim, marginBottom: 16 }}>
        Your login is valid but no user record was found. Create your admin profile below (we’ll try this automatically too). Once created, <strong>Admin</strong> and <strong>Staff</strong> will appear in the sidebar.
      </p>
      <button
        type="button"
        onClick={ensureProfile}
        disabled={ensuring}
        style={{ ...S.btn(), opacity: ensuring ? 0.7 : 1 }}
      >
        {ensuring ? 'Creating…' : 'Create my admin profile'}
      </button>
    </AppLayout>
  )

  const sendPasswordReset = async () => {
    if (!profile?.email) return
    setSendingReset(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/account`,
      })
      if (error) throw error
      toast.success('Check your email for the password reset link.')
    } catch (e: any) {
      toast.error(e.message || 'Failed to send reset email')
    } finally {
      setSendingReset(false)
    }
  }

  const saveProfile = async () => {
    if (!profile) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('users').update({ name: editName.trim() || profile.name, phone: editPhone.trim() || null }).eq('id', profile.id)
      if (error) throw error
      setProfile({ ...profile, name: editName.trim() || profile.name, phone: editPhone.trim() || null })
      toast.success('Profile updated.')
    } catch (e: any) {
      toast.error(e.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const formatDate = profile?.last_login ? new Date(profile.last_login).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : null

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file.')
    setUploadingPhoto(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('folder', 'avatars')
      const res = await fetch('/api/upload/driver-photo', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const { error } = await supabase.from('users').update({ avatar_url: json.url }).eq('id', profile.id)
      if (error) throw error
      setProfile({ ...profile, avatar_url: json.url })
      toast.success('Photo updated.')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  return (
    <AppLayout>
      <div style={S.ph}>👤 Account</div>
      <p style={{ fontSize: 13, color: S.textDim, marginBottom: 24 }}>
        Your profile, security, and role. Admins also see <strong>Admin</strong> and <strong>Staff</strong> in the sidebar.
      </p>
      <div style={{ ...S.card(), maxWidth: 768 }} className="max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left column: Avatar, name, email, role */}
          <div className="flex flex-col items-start">
            <label className="block cursor-pointer">
              <div style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', background: S.slot?.background || '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border, #e2e8f0)' }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#64748b' }}>{(profile.name || profile.email || '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <input type="file" accept="image/*" className="sr-only" onChange={onPhotoChange} disabled={uploadingPhoto} />
              <div style={{ fontSize: 11, color: S.textDim, marginTop: 6, textAlign: 'center' }}>{uploadingPhoto ? 'Uploading…' : 'Change photo'}</div>
            </label>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: S.mtitle.color, marginBottom: 4 }}>{profile.name || '—'}</div>
              <div style={{ fontSize: 15, color: S.text, marginBottom: 8 }}>{profile.email || '—'}</div>
              <div><span style={S.badge(profile.role)}>{profile.role}{profile.staff_type ? ` · ${profile.staff_type}` : ''}</span></div>
            </div>
            {driver && (
              <div style={{ marginTop: 12, fontSize: 13, color: S.textDim }}>
                Linked driver: <strong style={{ color: S.text }}>{driver.name}</strong> ({driver.id})
              </div>
            )}
          </div>
          {/* Right column: Edit Profile + Security */}
          <div className="space-y-6">
            <div>
              <div style={{ ...S.kpi, marginBottom: 12 }}>Edit Profile</div>
              <div style={S.fg}>
                <label style={S.lbl}>Full Name</label>
                <input style={S.inp} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your name" />
              </div>
              <div style={{ ...S.fg, marginTop: 12 }}>
                <label style={S.lbl}>Phone Number</label>
                <input style={S.inp} value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="e.g. 254712345678" type="tel" />
              </div>
              <button type="button" onClick={saveProfile} disabled={savingProfile} style={{ ...S.btn(), marginTop: 12, opacity: savingProfile ? 0.7 : 1 }}>
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
            <div>
              <div style={{ ...S.kpi, marginBottom: 8 }}>Security</div>
              <p style={{ fontSize: 13, color: S.textDim, marginBottom: 8 }}>Last login: {formatDate || 'Never'}</p>
              <p style={{ fontSize: 13, color: S.textDim, marginBottom: 12 }}>Send yourself an email to set a new password. You will sign in again after changing it.</p>
              <button type="button" onClick={sendPasswordReset} disabled={sendingReset} style={{ ...S.btn(), opacity: sendingReset ? 0.7 : 1 }}>
                {sendingReset ? 'Sending…' : 'Send password reset email'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
