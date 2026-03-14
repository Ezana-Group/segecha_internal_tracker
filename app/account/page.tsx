'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function AccountPage() {
  const { S } = useErpContext()
  const [profile, setProfile] = useState<{ id: string; email: string; name: string; role: string; driver_id?: string | null } | null>(null)
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [ensuring, setEnsuring] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      let { data: profileData } = await supabase.from('users').select('id, email, name, role, driver_id').eq('id', session.user.id).single()
      if (!profileData) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
        const { data: created } = await supabase.from('users')
          .upsert({ id: session.user.id, email: session.user.email, name, role: 'admin' })
          .select('id, email, name, role, driver_id').single()
        profileData = created ?? null
      }
      setProfile(profileData || null)
      if (profileData?.driver_id) {
        const { data: driverData } = await supabase.from('drivers').select('id, name').eq('id', profileData.driver_id).single()
        setDriver(driverData || null)
      } else {
        setDriver(null)
      }
      setLoading(false)
    }
    load()
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
        Your login is valid but no user record was found. You can create your admin profile below, or an existing admin can add you in <strong>Admin → Manage Users</strong>.
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

  return (
    <AppLayout>
      <div style={S.ph}>👤 Account information</div>
      <p style={{ fontSize: 13, color: S.textDim, marginBottom: 24 }}>
        Your profile and role. Directors and admins can manage users in Admin → Manage Users.
      </p>
      <div style={{ ...S.card(), maxWidth: 480 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div style={{ ...S.kpi, marginBottom: 4 }}>Name</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: S.mtitle.color }}>{profile.name || '—'}</div>
          </div>
          <div>
            <div style={{ ...S.kpi, marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: 15, color: S.text }}>{profile.email || '—'}</div>
          </div>
          <div>
            <div style={{ ...S.kpi, marginBottom: 4 }}>Role</div>
            <div><span style={S.badge(profile.role)}>{profile.role}</span></div>
          </div>
          {driver && (
            <div>
              <div style={{ ...S.kpi, marginBottom: 4 }}>Linked driver</div>
              <div style={{ fontSize: 15, color: S.text }}>{driver.name} ({driver.id})</div>
              <div style={{ fontSize: 12, color: S.textDim, marginTop: 4 }}>You can use the Driver section to submit trip start/end and odometer photos.</div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
