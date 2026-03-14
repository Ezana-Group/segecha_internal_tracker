'use client'

import ClientPortalLayout from '@/components/ClientPortalLayout'
import { Toaster } from 'react-hot-toast'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClientPortalLayout>{children}</ClientPortalLayout>
      <Toaster position="top-center" />
    </>
  )
}
