'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/RequireAuth'
import { AdminShell } from '@/components/AdminShell'
import { useAuth } from '@/lib/auth'

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      router.replace('/app')
    }
  }, [loading, user, router])

  if (loading || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return null
  }
  return <>{children}</>
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </RequireAuth>
  )
}
