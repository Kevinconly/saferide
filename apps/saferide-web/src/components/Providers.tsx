'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/lib/auth'
import { RealtimeProvider } from '@/lib/realtime'
import { PwaSetup } from '@/lib/pwa'
import { Toaster } from '@/components/ui'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          <PwaSetup />
          <Toaster />
          {children}
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
