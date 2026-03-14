'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DriverLayout from '@/components/DriverLayout'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function DriverProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [driver, setDriver] = useState<any>(null)
  const [truckReg, setTruckReg] = useState<string>('—')
  const [loading, setLoading] = useState(true)
  const [sendingReset, setSendingReset] = useState(false)

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: profile } = await supabase.from('users').select('id, name, email, driver_id').eq('id', session.user.id).single()
    setUser(profile as any || null)
    const driverId = (profile as { driver_id?: string } | null)?.driver_id
    if (driverId) {
      const { data: driverRow } = await supabase.from('drivers').select('*').eq('id', driverId).single()
      setDriver(driverRow || null)
      const truckId = (driverRow as { truck?: string } | null)?.truck
      if (truckId) {
        const { data: truck } = await supabase.from('trucks').select('reg').eq('id', truckId).single()
        setTruckReg((truck as { reg?: string } | null)?.reg ?? '—')
      } else setTruckReg('—')
    } else setDriver(null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendPasswordReset = async () => {
    if (!user?.email) return
    setSendingReset(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
      })
      if (error) throw error
      toast.success('Password reset email sent.')
    } catch (e: any) {
      toast.error(e.message || 'Failed to send')
    } finally {
      setSendingReset(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.replace('/login')
  }

  if (loading) {
    return (
      <DriverLayout title="Profile">
        <div className="text-center py-12 text-slate-500 text-base">Loading…</div>
      </DriverLayout>
    )
  }

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <DriverLayout title="Profile" driverFirstName={firstName}>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
        <h2 className="font-bold text-slate-800 text-base mb-4">My Profile</h2>
        <div className="space-y-3 text-base">
          <div>
            <div className="text-sm text-slate-500">Name</div>
            <div className="font-semibold text-slate-800">{driver?.name ?? user?.name ?? '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Phone</div>
            <div className="font-semibold text-slate-800">{driver?.phone ?? '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">License number</div>
            <div className="font-semibold text-slate-800">{driver?.license ?? '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">License class</div>
            <div className="font-semibold text-slate-800">{driver?.class ?? '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Assigned truck</div>
            <div className="font-semibold text-slate-800">{truckReg}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Status</div>
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${driver?.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
              {driver?.status ?? '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={sendPasswordReset}
          disabled={sendingReset}
          className="w-full min-h-[52px] rounded-xl font-bold text-base border-2 border-orange-500 text-orange-500 bg-white disabled:opacity-70"
        >
          {sendingReset ? 'Sending…' : 'Reset Password'}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="w-full min-h-[52px] rounded-xl font-bold text-base border-2 border-red-400 text-red-600 bg-white"
        >
          Sign Out
        </button>
      </div>
    </DriverLayout>
  )
}
