'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { formatDate, formatMoney, formatPhone } from '@/lib/format'
import { Badge, Card, CardBody, EmptyState, Input, PageHeader, Select, Spinner } from '@/components/ui'
import { MapPreview } from '@/components/MapPreview'
import { RideStatusBadge } from '@/components/RideStatusBadge'

interface AdminRide {
  id: string
  state: string
  fareCents: number
  distanceKm?: number | null
  createdAt: string
  pickupLabel?: string | null
  dropoffLabel?: string | null
  passenger: { name?: string | null; phone: string }
  driver?: { user: { name?: string | null; phone: string } } | null
  payment?: { status: string } | null
}

const SERVICE_AREA_POINTS = [
  { lat: -1.9536, lng: 30.0606, label: 'City Centre' },
  { lat: -1.9583, lng: 30.1006, label: 'Remera' },
  { lat: -1.9878, lng: 30.1193, label: 'Kicukiro' },
]

export default function AdminRidesPage() {
  const [state, setState] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-rides', state, query],
    queryFn: async () =>
      api.get<{ items: AdminRide[]; total: number }>(
        `/admin/rides?pageSize=50&state=${encodeURIComponent(state)}&search=${encodeURIComponent(query)}`,
      ),
  })

  const rides = data?.items ?? []

  return (
    <div className="space-y-4">
      <PageHeader title="Rides" subtitle={data ? `${data.total} ride(s)` : undefined} />
      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <MapPreview center={{ lat: -1.958, lng: 30.1 }} markers={SERVICE_AREA_POINTS} />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="flex flex-wrap items-center gap-2">
          <Select value={state} onChange={(e) => setState(e.target.value)} className="w-48">
            <option value="">All states</option>
            <option value="REQUESTED">Requested</option>
            <option value="MATCHING">Matching</option>
            <option value="RESERVED">Reserved</option>
            <option value="OFFERED">Offered</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
          </Select>
          <Input
            placeholder="Search by ride ID or passenger phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search)
            }}
            className="max-w-xs"
          />
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : rides.length === 0 ? (
        <Card>
          <EmptyState title="No rides found" />
        </Card>
      ) : (
        <Card>
          <CardBody className="divide-y divide-gray-100">
            {rides.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-gray-900">
                    {r.pickupLabel ?? 'Pickup'} → {r.dropoffLabel ?? 'Dropoff'}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {formatPhone(r.passenger.phone)}
                    {r.driver ? ` · ${r.driver.user.name ?? r.driver.user.phone}` : ''} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {r.payment && (
                    <Badge tone={r.payment.status === 'SUCCESS' ? 'green' : 'amber'}>{r.payment.status}</Badge>
                  )}
                  <span className="text-sm font-semibold">{formatMoney(r.fareCents)}</span>
                  <RideStatusBadge state={r.state} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
