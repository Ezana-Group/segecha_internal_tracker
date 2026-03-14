'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/driver', icon: '🗺️', label: 'My Trips' },
  { href: '/driver/fuel', icon: '⛽', label: 'Fuel Log' },
  { href: '/driver/expenses', icon: '💸', label: 'Expenses' },
  { href: '/driver/profile', icon: '👤', label: 'Profile' },
]

function useWindowWidth() {
  const [width, setWidth] = useState(1024)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setWidth(window.innerWidth)
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export default function DriverLayout({
  children,
  title,
  driverFirstName = '',
}: {
  children: React.ReactNode
  title: string
  driverFirstName?: string
}) {
  const pathname = usePathname()
  const isDesktop = useWindowWidth() >= 1024

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex">
      {/* Desktop: fixed left sidebar */}
      {isDesktop && (
        <aside className="fixed left-0 top-0 h-full w-60 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚛</span>
              <span className="font-bold text-slate-800 dark:text-white">Segecha Group</span>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-0.5">
            {NAV_ITEMS.map(({ href, icon, label }) => {
              const active = pathname === href || (href !== '/driver' && pathname?.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm">
                {driverFirstName?.charAt(0)?.toUpperCase() || 'D'}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                {driverFirstName || 'Driver'}
              </span>
            </div>
            <SignOutButton />
          </div>
        </aside>
      )}

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-h-screen ${isDesktop ? 'ml-60' : ''}`}>
        {/* Top bar: full width on desktop, same on mobile */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20 lg:left-60">
          <div className="flex items-center gap-2 min-w-0">
            {!isDesktop && (
              <>
                <span className="text-xl flex-shrink-0">🚛</span>
                <span className="font-bold text-sm text-slate-800 dark:text-white truncate">Segecha Group</span>
              </>
            )}
            {isDesktop && (
              <span className="font-bold text-slate-800 dark:text-white truncate">{title}</span>
            )}
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 font-semibold text-base text-slate-800 dark:text-white truncate max-w-[140px] lg:hidden">
            {title}
          </div>
          <div className="font-medium text-sm text-slate-600 dark:text-slate-400 truncate max-w-[100px] text-right">
            {driverFirstName || 'Driver'}
          </div>
        </header>

        {/* Scrollable content */}
        <main
          className="flex-1 pt-14 pb-20 lg:pb-6 px-4 overflow-y-auto"
          style={{ minHeight: 'calc(100vh - 3.5rem)' }}
        >
          <div className="max-w-[900px] mx-auto w-full py-4 lg:py-6">
            {children}
          </div>
        </main>

        {/* Mobile: bottom nav */}
        {!isDesktop && (
          <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-stretch z-20">
            {NAV_ITEMS.map(({ href, icon, label }) => {
              const active = pathname === href || (href !== '/driver' && pathname?.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 py-2 transition ${
                    active ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className="text-2xl leading-none" style={{ fontSize: 24 }}>
                    {icon}
                  </span>
                  <span className="text-[10px] font-medium">{label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}

function SignOutButton() {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full text-left px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
    >
      Sign out
    </button>
  )
}
