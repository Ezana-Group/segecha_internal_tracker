'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function PortalResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash
      if (hash && hash.includes('type=recovery')) {
        const params = new URLSearchParams(hash.slice(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) {
            setError('This reset link has expired or is invalid. Please request a new one.')
            return
          }
          window.history.replaceState(null, '', window.location.pathname)
          setReady(true)
        } else {
          setError('This reset link has expired or is invalid. Please request a new one.')
        }
      } else {
        const { data } = await supabase.auth.getSession()
        if (data.session) setReady(true)
        else setError('Invalid or expired reset link. Please request a new password reset.')
      }
    }
    setTimeout(handleHashChange, 100)
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      toast.success('Password updated successfully!')
      await supabase.auth.signOut()
      router.replace('/portal?reset=success')
    } catch (err: any) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-500 text-white font-bold text-2xl mb-4">SG</div>
          <h1 className="text-2xl font-bold text-slate-800">Segecha Group</h1>
          <p className="text-slate-500 mt-1 text-sm">Client Portal</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Set new password</h2>
          <p className="text-slate-500 text-sm mb-6">Choose a strong password for your portal account.</p>

          {error && !ready && (
            <div className="text-center py-4">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button type="button" onClick={() => router.replace('/portal')} className="text-sm text-orange-600 hover:underline">Back to login</button>
            </div>
          )}
          {!error && !ready && <div className="text-center py-8 text-slate-500 text-sm">Verifying reset link…</div>}
          {ready && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 pr-16 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{showPass ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Confirm</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50">
                {loading ? 'Updating…' : 'Set New Password'}
              </button>
            </form>
          )}
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <button type="button" onClick={() => router.replace('/portal')} className="text-xs text-slate-500 hover:text-orange-600">← Back to login</button>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">Powered by Segecha Group · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
