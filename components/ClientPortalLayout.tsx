'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const PORTAL_NAV = [
  { href: '/portal/invoices', label: 'Invoices' },
  { href: '/portal/trips', label: 'My Trips' },
  { href: '/portal/statement', label: 'Statement' },
]

export type PortalUser = {
  id: string
  client_id: string
  email: string
  name: string
  phone?: string | null
  auth_user_id?: string | null
  status?: string | null
}

export type ClientProfile = {
  id: string
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
}

const PortalContext = createContext<{ clientId: string; client: ClientProfile | null } | null>(null)
export function usePortalClient() {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortalClient must be used inside ClientPortalLayout (portal pages only)')
  return ctx
}

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null)
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!pathname?.startsWith('/portal')) return
    if (pathname === '/portal' || pathname === '/portal/') {
      setLoading(false)
      return
    }
    if (pathname === '/portal/reset-password') {
      setLoading(false)
      return
    }

    const loadPortalUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.replace('/portal')
        setLoading(false)
        return
      }
      const { data: cu } = await supabase
        .from('client_users')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .eq('status', 'Active')
        .maybeSingle()
      if (!cu) {
        await supabase.auth.signOut()
        toast.error('This account is not a client portal user.')
        router.replace('/portal')
        setLoading(false)
        return
      }
      setPortalUser(cu as PortalUser)
      const { data: clientRow } = await supabase.from('clients').select('id, name, contact_person, phone, email').eq('id', cu.client_id).single()
      setClient((clientRow as ClientProfile) || null)
      await supabase.from('client_users').update({ last_login: new Date().toISOString() }).eq('id', cu.id)
      setLoading(false)
    }
    loadPortalUser()
  }, [pathname, router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.replace('/portal')
  }

  if (pathname === '/portal' || pathname === '/portal/' || pathname === '/portal/reset-password') {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center text-slate-500">Loading…</div>
      </div>
    )
  }

  return (
    <PortalContext.Provider value={{ clientId: portalUser!.client_id, client }}>
      <div className="min-h-screen flex flex-col bg-white">
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200 shadow-sm flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Link href="/portal/invoices" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">SG</div>
              <span className="font-bold text-slate-800 hidden sm:inline">Segecha Group</span>
            </Link>
          </div>
          <div className="text-center flex-1 mx-2 min-w-0">
            <span className="text-sm text-slate-600 truncate block">Welcome, {client?.name ?? 'Client'}</span>
          </div>
          <nav className="flex items-center gap-1 flex-wrap">
            {PORTAL_NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${pathname === n.href ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {n.label}
              </Link>
            ))}
            <button type="button" onClick={handleSignOut} className="ml-2 text-sm text-slate-500 hover:text-orange-600 font-medium px-2 py-1">
              Sign out
            </button>
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">{children}</main>
        <footer className="py-3 text-center text-xs text-slate-400 border-t border-slate-200">
          Powered by Segecha Group · {new Date().getFullYear()}
        </footer>
      </div>
    </PortalContext.Provider>
  )
}
