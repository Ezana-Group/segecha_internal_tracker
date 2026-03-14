'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Supabase puts the recovery tokens in the URL hash
    // e.g. #access_token=xxx&refresh_token=yyy&type=recovery
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
          // Clear the hash from URL for security
          window.history.replaceState(null, '', window.location.pathname)
          setReady(true)
        } else {
          setError('This reset link has expired or is invalid. Please request a new one.')
        }
      } else {
        // Check if already has a recovery session (e.g. refreshed the page after setting session)
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          setReady(true)
        } else {
          setError('Invalid or expired reset link. Please request a new password reset.')
        }
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
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast.success('Password updated successfully!')

      // Sign out so they log in fresh with new password
      await supabase.auth.signOut()
      router.replace('/login?reset=success')
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white text-3xl mb-4 shadow-xl">
            🚛
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Segecha Group</h1>
          <p className="text-slate-400 mt-1 text-sm">Fleet Operations Management</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-2">Set new password</h2>
          <p className="text-slate-400 text-sm mb-6">
            Choose a strong password for your account.
          </p>

          {/* Error state — invalid/expired link */}
          {error && !ready && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🔗</div>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={() => router.replace('/login')}
                className="text-sm text-orange-400 hover:text-orange-300 underline"
              >
                Back to login
              </button>
            </div>
          )}

          {/* Loading state */}
          {!error && !ready && (
            <div className="text-center py-8">
              <div className="text-slate-400 text-sm">Verifying reset link…</div>
            </div>
          )}

          {/* Reset form */}
          {ready && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition text-sm pr-16"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your new password"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition text-sm"
                  required
                />
              </div>

              {/* Password strength hint */}
              {password.length > 0 && (
                <div className="flex gap-1.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= 8 + i * 4
                        ? i < 1 ? 'bg-red-500' : i < 2 ? 'bg-amber-500' : i < 3 ? 'bg-yellow-400' : 'bg-emerald-500'
                        : 'bg-slate-700'
                    }`} />
                  ))}
                </div>
              )}

              {/* Validation error */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-sm shadow-lg"
              >
                {loading ? 'Updating password…' : 'Set New Password'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <button
              onClick={() => router.replace('/login')}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              ← Back to login
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          🔒 Secure · Internal use only · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
