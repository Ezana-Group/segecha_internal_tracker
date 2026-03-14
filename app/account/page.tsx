'use client'

import React, { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useErpContext } from '@/lib/ErpContext'
import { supabase } from '@/lib/supabase'

export default function AccountPage() {
  const { S } = useErpContext()
  const [profile, setProfile] = useState<{ id: string; email: string; name: string; role: string; driver_id?: string | null } | null>(null)
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <AppLayout><div style={S.ph}>Loading account…</div></AppLayout>
  if (!profile) return (
    <AppLayout>
      <div style={S.ph}>Could not load profile.</div>
      <p style={{ fontSize: 13, color: S.textDim }}>
        Your login is valid but no user record was found. An admin can add you in <strong>Admin → Manage Users</strong>, or try refreshing the page.
      </p>
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
