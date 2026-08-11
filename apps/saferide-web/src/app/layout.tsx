import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'SafeRide Kigali',
  description: 'Safe ride-hailing for Kigali, Rwanda',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#2d8a5b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
