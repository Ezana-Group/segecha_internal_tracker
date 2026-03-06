'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { AppUser } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NAV = [
  { href: '/dashboard', icon: '◈', label: 'Dashboard' },
  { href: '/fleet', icon: '🚛', label: 'Fleet' },
  { href: '/drivers', icon: '👤', label: 'Drivers' },
  { href: '/journeys', icon: '🗺️', label: 'Journeys' },
  { href: '/fuel', icon: '⛽', label: 'Fuel Log' },
  { href: '/expenses', icon: '💸', label: 'Expenses' },
  { href: '/invoices', icon: '📄', label: 'Invoices' },
  { href: '/payroll', icon: '💰', label: 'Payroll' },
  { href: '/tyres', icon: '🔵', label: 'Tyre Monitor' },
  { href: '/pnl', icon: '📈', label: 'P&L Report' },
]

const ADMIN_NAV = [
  { href: '/admin/users', icon: '⚙️', label: 'Manage Users' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AppUser | null>(null)
  const [sideOpen, setSideOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push('/login'); return }
      supabase.from('users').select('*').eq('id', u.id).single().then(({ data, error }) => {
        if (error || !data) {
          toast.error('Profile not found. Please contact admin.')
          supabase.auth.signOut().then(() => router.push('/login'))
          return
        }
        setUser(data as AppUser)
      })
    })
    // Restore dark mode preference
    const saved = localStorage.getItem('dark')
    if (saved === 'true') { setDark(true); document.documentElement.classList.add('dark') }
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('dark', String(next))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  const roleColor = { admin: 'bg-red-500', director: 'bg-orange-500', viewer: 'bg-blue-500' }

  const Sidebar = ({ mobile = false }) => (
    <nav className={`${mobile ? 'w-64' : 'w-56'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full`}>
      {/* Brand */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-base flex-shrink-0">🚛</div>
          <div>
            <div className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">Segecha Group</div>
            <div className="text-xs text-slate-400">Fleet ERP</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Menu</p>
        {NAV.map(n => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/')
          return (
            <Link key={n.href} href={n.href}
              onClick={() => setSideOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-l-2 border-orange-500'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <span className="text-base w-5 text-center">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          )
        })}

        {user?.role === 'admin' && (
          <>
            <p className="px-3 py-1 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin</p>
            {ADMIN_NAV.map(n => (
              <Link key={n.href} href={n.href}
                onClick={() => setSideOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
              >
                <span className="text-base w-5 text-center">{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* User profile */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        {user && (
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${roleColor[user.role] || 'bg-slate-500'}`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400 capitalize">{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full text-xs text-slate-400 hover:text-red-500 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left px-2"
        >
          Sign out →
        </button>
      </div>
    </nav>
  )

  return (
    <div className={`flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 ${dark ? 'dark' : ''}`}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sideOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSideOpen(false)} />
          <div className="relative z-10 flex flex-col h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setSideOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 hidden sm:block">
              📍 Nairobi, KE &nbsp;·&nbsp; {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>

            {/* User badge */}
            {user && (
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white ${roleColor[user.role] || 'bg-slate-500'}`}>
                {user.name.split(' ')[0]} · {user.role}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
