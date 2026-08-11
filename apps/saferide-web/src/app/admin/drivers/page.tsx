'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { formatPhone } from '@/lib/format'
import { Badge, Button, Card, CardBody, EmptyState, Input, PageHeader, Spinner } from '@/components/ui'

interface AdminDriver {
  id: string
  vehicleMake?: string | null
  vehicleModel?: string | null
  plateNumber?: string | null
  rating?: number | null
  status: string
  isVerified: boolean
  createdAt: string
  user: { id: string; name?: string | null; phone: string; status: string }
  _count: { rides: number }
}

export default function AdminDriversPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers', query],
    queryFn: async () =>
      api.get<{ items: AdminDriver[]; total: number }>(`/admin/drivers?pageSize=50&search=${encodeURIComponent(query)}`),
  })

  const review = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.post(`/admin/drivers/${id}/${action}`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-drivers'] }),
  })

  const drivers = data?.items ?? []

  return (
    <div>
      <PageHeader title="Drivers" subtitle={data ? `${data.total} driver(s)` : undefined} />
      <Card>
        <CardBody className="flex gap-2">
          <Input
            placeholder="Search by plate, model or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search)
            }}
          />
          <Button variant="secondary" onClick={() => setQuery(search)}>
            Search
          </Button>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : drivers.length === 0 ? (
        <Card>
          <EmptyState title="No drivers found" />
        </Card>
      ) : (
        <Card>
          <CardBody className="divide-y divide-gray-100">
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-gray-900">
                    {d.user.name ?? formatPhone(d.user.phone)}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {d.vehicleMake && d.vehicleModel ? `${d.vehicleMake} ${d.vehicleModel}` : 'No vehicle'} ·{' '}
                    {d.plateNumber ?? 'no plate'} · {d._count.rides} ride(s) · rating {d.rating?.toFixed(1) ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={d.isVerified ? 'green' : 'amber'}>{d.status}</Badge>
                  {d.status === 'PENDING' || d.status === 'REJECTED' ? (
                    <>
                      <Button variant="primary" loading={review.isPending} onClick={() => review.mutate({ id: d.id, action: 'approve' })}>
                        Approve
                      </Button>
                      <Button variant="danger" loading={review.isPending} onClick={() => review.mutate({ id: d.id, action: 'reject' })}>
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" loading={review.isPending} onClick={() => review.mutate({ id: d.id, action: 'reject' })}>
                      Revoke
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
