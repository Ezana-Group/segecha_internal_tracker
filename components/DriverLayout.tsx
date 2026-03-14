'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/driver', label: 'Trips', icon: '🗺️' },
  { href: '/driver/fuel', label: 'Fuel', icon: '⛽' },
  { href: '/driver/expenses', label: 'Expenses', icon: '💸' },
  { href: '/driver/profile', label: 'Profile', icon: '👤' },
]

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

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top bar - fixed 56px */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">🚛</span>
          <span className="font-bold text-sm text-slate-800 truncate">Segecha Group</span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 font-semibold text-base text-slate-800 truncate max-w-[140px]">
          {title}
        </div>
        <div className="font-medium text-sm text-slate-600 truncate max-w-[100px] text-right">
          {driverFirstName || 'Driver'}
        </div>
      </header>

      {/* Scrollable content - padding for fixed bars */}
      <main className="flex-1 pt-14 pb-20 px-4 overflow-y-auto">
        <div className="max-w-[430px] mx-auto w-full py-4" style={{ minHeight: 'calc(100vh - 14rem)' }}>
          {children}
        </div>
      </main>

      {/* Bottom nav - fixed 60px */}
      <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-slate-200 flex items-stretch z-20">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/driver' && pathname?.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 py-2 transition ${
                active ? 'text-orange-500' : 'text-slate-500'
              }`}
            >
              <span className="text-2xl leading-none" style={{ fontSize: 24 }}>{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
