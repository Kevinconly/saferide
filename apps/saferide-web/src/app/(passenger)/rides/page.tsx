'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatDate, formatMoney, humanizeState } from '@/lib/format'
import { Card, CardBody, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { RideStatusBadge } from '@/components/RideStatusBadge'

interface Ride {
  id: string
  state: string
  fareCents: number
  pickupLabel?: string | null
  dropoffLabel?: string | null
  createdAt: string
}

export default function RidesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['rides'],
    queryFn: async () => api.get<{ items: Ride[]; total: number }>('/rides?pageSize=50'),
  })

  const rides = data?.items ?? []

  return (
    <div>
      <PageHeader title="Ride history" subtitle={data ? `${data.total} ride(s)` : undefined} />
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : rides.length === 0 ? (
        <Card>
          <EmptyState title="No rides yet" hint="Request your first ride from the book page." />
        </Card>
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => (
            <Link key={ride.id} href={`/app/rides/${ride.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">
                        {ride.pickupLabel ?? 'Pickup'} → {ride.dropoffLabel ?? 'Dropoff'}
                      </p>
                      <p className="mt-0.5 text-gray-500">{formatDate(ride.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RideStatusBadge state={ride.state} />
                      <span className="text-sm font-semibold text-gray-900">{formatMoney(ride.fareCents)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
