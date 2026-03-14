'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NAV = [
  { href: '/dashboard', icon: '◈', label: 'Dashboard' },
  { href: '/account', icon: '👤', label: 'Account' },
  { href: '/fleet', icon: '🚛', label: 'Fleet' },
  { href: '/drivers', icon: '👤', label: 'Drivers' },
  { href: '/journeys', icon: '🗺️', label: 'Journeys' },
  { href: '/fuel', icon: '⛽', label: 'Fuel Log' },
  { href: '/expenses', icon: '💸', label: 'Expenses' },
  { href: '/invoices', icon: '📄', label: 'Invoices' },
  { href: '/transactions', icon: '💳', label: 'M-Pesa' },
  { href: '/payroll', icon: '💰', label: 'Payroll' },
  { href: '/tyres', icon: '🔵', label: 'Tyre Monitor' },
  { href: '/maintenance', icon: '🔧', label: 'Maintenance' },
  { href: '/pnl', icon: '📈', label: 'P&L Report' },
  { href: '/driver', icon: '🚚', label: 'Driver' },
]
const ADMIN_NAV = [
  { href: '/admin/users', icon: '👥', label: 'Manage Users' },
  { href: '/admin/settings', icon: '⚙️', label: 'Settings (M-Pesa)' },
  { href: '/admin/driver-submissions', icon: '✅', label: 'Driver approvals' },
]

interface AppUser { id: string; email: string; name: string; role: 'admin' | 'director' | 'viewer'; driver_id?: string | null }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sideOpen, setSideOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }

        const { data: profile, error: profileError } = await supabase
          .from('users').select('id,email,name,role,driver_id').eq('id', session.user.id).single()

        if (profile) {
          setUser(profile as AppUser)
        } else if (!profileError || profileError.code === 'PGRST116') {
          // No row or not found: try client upsert (may fail with RLS)
          const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
          const { data: np } = await supabase.from('users')
            .upsert({ id: session.user.id, email: session.user.email, name, role: 'admin' })
            .select('id,email,name,role,driver_id').single()
          setUser(np as AppUser)
        }
        // If users table errors (400/403 etc), leave user null so they can use Account → Create my admin profile
      } catch (e) {
        console.error('Layout auth error:', e)
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }
    loadUser()
    const saved = localStorage.getItem('segecha-dark')
    if (saved === 'true') { setDark(true); document.documentElement.classList.add('dark') }
  }, [])

  const toggleDark = () => {
    const next = !dark; setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('segecha-dark', String(next))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.replace('/login')
  }

  const roleColor: Record<string, string> = { admin: 'bg-red-500', director: 'bg-orange-500', viewer: 'bg-blue-500' }
  const roleBadge: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    director: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
    viewer: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
            <img src="/logo.png" alt="Segecha Group Logo" className="object-contain w-full h-full" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-900 dark:text-white">Segecha Group</div>
            <div className="text-[10px] text-slate-400">Fleet ERP · Nairobi</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Menu</p>
        {(NAV.filter(n => n.href !== '/driver' || user?.driver_id)).map(n => {
          const active = pathname === n.href
          return (
            <Link key={n.href} href={n.href} onClick={() => setSideOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-l-2 border-orange-500'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
              <span className="text-base w-5 text-center">{n.icon}</span><span>{n.label}</span>
            </Link>
          )
        })}
        {user?.role === 'admin' && (
          <>
            <p className="px-3 pt-4 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin</p>
            {ADMIN_NAV.map(n => (
              <Link key={n.href} href={n.href} onClick={() => setSideOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <span className="text-base w-5 text-center">{n.icon}</span><span>{n.label}</span>
              </Link>
            ))}
          </>
        )}
      </div>
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {user && (
          <div className="flex items-center gap-2.5 px-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${roleColor[user.role] || 'bg-slate-500'}`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400 capitalize">{user.role}</div>
            </div>
          </div>
        )}
        <button onClick={handleSignOut} className="w-full text-xs text-slate-400 hover:text-red-500 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left px-2">
          🚪 Sign out
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center"><div className="text-4xl mb-3 animate-bounce">🚛</div>
        <div className="text-sm text-slate-400">Loading Segecha ERP…</div></div>
    </div>
  )

  return (
    <div className={`flex h-screen overflow-hidden w-full bg-slate-50 dark:bg-slate-950 ${dark ? 'dark' : ''}`}>
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <SidebarContent />
      </aside>
      {sideOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSideOpen(false)} />
          <aside className="relative z-10 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setSideOpen(true)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="hidden sm:block text-xs text-slate-400 font-medium">
              📍 Nairobi, KE · {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
            {user && (
              <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${roleBadge[user.role]}`}>
                {user.name.split(' ')[0]} · {user.role}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
