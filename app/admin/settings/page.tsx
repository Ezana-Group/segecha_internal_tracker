'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminSettingsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/invoices?tab=settings')
  }, [router])
  return null
}
