'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminStaffPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin?tab=staff')
  }, [router])
  return null
}
