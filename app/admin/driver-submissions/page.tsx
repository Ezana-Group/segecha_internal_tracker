'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DriverSubmissionsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin?tab=approvals')
  }, [router])
  return null
}
