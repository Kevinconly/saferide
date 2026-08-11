'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { Badge, Button, Card, CardBody, EmptyState, PageHeader, Select, Spinner } from '@/components/ui'

interface AdminPayment {
  id: string
  amountCents: number
  currency: string
  provider: string
  providerReference?: string | null
  status: string
  createdAt: string
  ride?: { id: string; state: string } | null
}

const statusTone: Record<string, 'gray' | 'green' | 'amber' | 'red'> = {
  PENDING: 'amber',
  PROCESSING: 'amber',
  SUCCESS: 'green',
  FAILED: 'red',
  REFUNDED: 'gray',
}

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', status],
    queryFn: async () => api.get<{ items: AdminPayment[]; total: number }>(`/admin/payments?pageSize=50&status=${encodeURIComponent(status)}`),
  })

  const refund = useMutation({
    mutationFn: async (id: string) => api.post(`/admin/payments/${id}/refund`, { reason: 'Refunded by admin' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
  })

  const payments = data?.items ?? []

  return (
    <div>
      <PageHeader title="Payments" subtitle={data ? `${data.total} payment(s)` : undefined} />
      <Card>
        <CardBody>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState title="No payments found" />
        </Card>
      ) : (
        <Card>
          <CardBody className="divide-y divide-gray-100">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-900">{formatMoney(p.amountCents)}</p>
                  <p className="truncate text-xs text-gray-500">
                    {p.provider} · {p.providerReference ?? p.id.slice(0, 8)} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={statusTone[p.status] ?? 'gray'}>{p.status}</Badge>
                  {p.status === 'SUCCESS' && (
                    <Button variant="outline" loading={refund.isPending} onClick={() => refund.mutate(p.id)}>
                      Refund
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
