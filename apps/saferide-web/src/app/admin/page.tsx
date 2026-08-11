'use client'

import { useQuery } from '@tanstack/react-query'
import { Car, History, ShieldCheck, UserRound, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { Card, CardBody, CardHeader, Spinner } from '@/components/ui'
import { RideStatusBadge } from '@/components/RideStatusBadge'

interface Stats {
  counts: {
    users: number
    drivers: number
    pendingDrivers: number
    rides: number
    activeRides: number
    completedRides: number
  }
  revenueCents: number
  recentRides: {
    id: string
    state: string
    fareCents: number
    createdAt: string
    passenger: { name?: string | null; phone: string }
    driver?: { user: { name?: string | null; phone: string } } | null
  }[]
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => api.get<Stats>('/admin/stats'),
    refetchInterval: 15_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  const cards = [
    { label: 'Users', value: data.counts.users, icon: UserRound },
    { label: 'Drivers', value: data.counts.drivers, icon: Car, sub: `${data.counts.pendingDrivers} pending` },
    { label: 'Rides', value: data.counts.rides, icon: History, sub: `${data.counts.activeRides} active` },
    { label: 'Revenue', value: formatMoney(data.revenueCents), icon: Wallet },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardBody>
                <div className="flex items-center gap-2 text-gray-500">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{c.label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{c.value}</p>
                {c.sub && <p className="text-xs text-gray-400">{c.sub}</p>}
              </CardBody>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader
          title="Recent rides"
          subtitle="Latest 10 rides across the platform"
          action={<ShieldCheck className="h-5 w-5 text-brand-600" />}
        />
        <CardBody className="divide-y divide-gray-100">
          {data.recentRides.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No rides yet</p>}
          {data.recentRides.map((ride) => (
            <div key={ride.id} className="flex items-center justify-between py-3">
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  {ride.passenger.name ?? ride.passenger.phone}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(ride.createdAt)}
                  {ride.driver ? ` · ${ride.driver.user.name ?? ride.driver.user.phone}` : ' · no driver'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatMoney(ride.fareCents)}</span>
                <RideStatusBadge state={ride.state} />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
