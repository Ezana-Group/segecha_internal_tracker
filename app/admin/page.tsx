'use client'

import { Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import AdminUsersTab from './AdminUsersTab'
import AdminStaffTab from './AdminStaffTab'
import AdminDriverApprovalsTab from './AdminDriverApprovalsTab'

function AdminPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'users'
  const usersTabRef = useRef<{ openCreateDriverModal: () => void; openInviteModal: () => void } | null>(null)

  const tabs = [
    { key: 'users', label: 'Users' },
    { key: 'staff', label: 'Staff' },
    { key: 'approvals', label: 'Driver Approvals' },
  ] as const

  return (
    <AppLayout>
      <div className="w-full mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">⚙️ Admin Panel</h1>
            {tabs.map(({ key, label }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => router.replace(`/admin?tab=${key}`)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    active
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {tab === 'users' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => usersTabRef.current?.openCreateDriverModal()}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
              >
                + Create Driver
              </button>
              <button
                type="button"
                onClick={() => usersTabRef.current?.openInviteModal()}
                className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:opacity-90 transition"
              >
                + Invite User
              </button>
            </div>
          )}
        </div>
        {tab === 'users' && <AdminUsersTab ref={usersTabRef} />}
        {tab === 'staff' && <AdminStaffTab />}
        {tab === 'approvals' && <AdminDriverApprovalsTab />}
      </div>
    </AppLayout>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AppLayout><div className="p-8 text-center text-slate-500">Loading…</div></AppLayout>}>
      <AdminPageContent />
    </Suspense>
  )
}
