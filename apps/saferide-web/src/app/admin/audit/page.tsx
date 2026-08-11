'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { Card, CardBody, EmptyState, PageHeader, Spinner } from '@/components/ui'

interface AuditEntry {
  id: string
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
  userAgent?: string | null
  createdAt: string
  actor?: { name?: string | null; phone: string } | null
}

export default function AdminAuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => api.get<{ items: AuditEntry[]; total: number }>('/admin/audit-logs?pageSize=50'),
  })

  const entries = data?.items ?? []

  return (
    <div>
      <PageHeader title="Audit log" subtitle={data ? `${data.total} entries` : undefined} />
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState title="No audit entries" />
        </Card>
      ) : (
        <Card>
          <CardBody className="divide-y divide-gray-100">
            {entries.map((e) => (
              <div key={e.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{e.action}</span>{' '}
                    {e.actor?.name ?? e.actor?.phone ?? 'system'}
                  </p>
                  <span className="text-xs text-gray-400">{formatDate(e.createdAt)}</span>
                </div>
                {e.entityType && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {e.entityType} · {e.entityId?.slice(0, 8)}
                  </p>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
