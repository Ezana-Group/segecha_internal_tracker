'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import AdminUsersTab from './AdminUsersTab'
import AdminStaffTab from './AdminStaffTab'
import AdminDriverApprovalsTab from './AdminDriverApprovalsTab'

function AdminPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'users'

  const tabs = [
    { key: 'users', label: 'Users' },
    { key: 'staff', label: 'Staff' },
    { key: 'approvals', label: 'Driver Approvals' },
  ] as const

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">⚙️ Admin Panel</h1>
        <div className="flex gap-2 flex-wrap">
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
        {tab === 'users' && <AdminUsersTab />}
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
