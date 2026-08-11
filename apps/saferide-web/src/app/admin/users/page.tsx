'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { formatDate, formatPhone } from '@/lib/format'
import { Badge, Button, Card, CardBody, EmptyState, Input, PageHeader, Spinner } from '@/components/ui'

interface AdminUser {
  id: string
  phone: string
  name?: string | null
  email?: string | null
  role: string
  status: string
  isVerified: boolean
  createdAt: string
  _count: { rides: number; payments: number }
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', query],
    queryFn: async () => api.get<{ items: AdminUser[]; total: number }>(`/admin/users?pageSize=50&search=${encodeURIComponent(query)}`),
  })

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/users/${id}/status`, { status: status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const users = data?.items ?? []

  return (
    <div>
      <PageHeader title="Users" subtitle={data ? `${data.total} user(s)` : undefined} />
      <Card>
        <CardBody className="flex gap-2">
          <Input
            placeholder="Search by phone, name or email"
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
      ) : users.length === 0 ? (
        <Card>
          <EmptyState title="No users found" />
        </Card>
      ) : (
        <Card>
          <CardBody className="divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{u.name ?? formatPhone(u.phone)}</p>
                  <p className="text-xs text-gray-500">
                    {u.phone} · {u.role} · joined {formatDate(u.createdAt)} · {u._count.rides} ride(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge>
                  <Button
                    variant={u.status === 'SUSPENDED' ? 'outline' : 'danger'}
                    loading={toggle.isPending}
                    onClick={() => toggle.mutate({ id: u.id, status: u.status })}
                  >
                    {u.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                  </Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
