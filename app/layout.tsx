import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ErpProvider } from '@/lib/ErpContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Segecha Group ERP',
  description: 'Fleet Operations Management System',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErpProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            }}
          />
          <SpeedInsights />
        </ErpProvider>
      </body>
    </html>
  )
}
