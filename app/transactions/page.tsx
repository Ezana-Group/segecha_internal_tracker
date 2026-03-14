'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TransactionsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/invoices?tab=transactions')
  }, [router])
  return null
}
