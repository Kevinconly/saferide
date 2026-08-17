'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Car, History, ShieldCheck, UserRound, Wallet, RefreshCw, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { Card, CardBody, CardHeader, Spinner, Button, Select, Badge } from '@/components/ui'
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

interface ActiveRide {
  id: string
  state: string
  fareCents: number
  distanceKm?: number | null
  createdAt: string
  pickupLabel?: string | null
  dropoffLabel?: string | null
  passenger: { name?: string | null; phone: string }
  driver?: { user: { name?: string | null; phone: string } } | null
}

export default function AdminDashboard() {
  const [stateFilter, setStateFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => api.get<Stats>('/admin/stats'),
    refetchInterval: 10_000,
  })

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['admin-active-rides', stateFilter],
    queryFn: async () =>
      api.get<{ items: ActiveRide[]; total: number }>(
        `/admin/rides/active${stateFilter ? `?state=${encodeURIComponent(stateFilter)}` : ''}`,
      ),
    refetchInterval: 5_000,
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

  const activeRides = activeData?.items ?? []

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

      {/* Active/Ongoing Rides Section */}
      <Card className="mb-6">
        <CardHeader
          title="Active Rides"
          subtitle={activeData ? `${activeData.total} ongoing ride(s) — refreshing every 5s` : undefined}
          action={
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-brand-600" />
              <Filter className="h-5 w-5 text-brand-600" />
            </div>
          }
        />
        <CardBody>
          <div className="mb-4">
            <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-56">
              <option value="">All active states</option>
              <option value="REQUESTED">Requested</option>
              <option value="MATCHING">Matching</option>
              <option value="RESERVED">Reserved</option>
              <option value="OFFERED">Offered</option>
              <option value="EN_ROUTE_TO_PICKUP">En route to pickup</option>
              <option value="ARRIVED_AT_PICKUP">Arrived at pickup</option>
              <option value="PICKED_UP">Picked up</option>
              <option value="EN_ROUTE_TO_DROPOFF">En route to dropoff</option>
            </Select>
          </div>
          {activeLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : activeRides.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No active rides right now</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeRides.map((ride) => (
                <div key={ride.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-gray-900">
                      {ride.passenger.name ?? ride.passenger.phone}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {ride.pickupLabel ?? 'Pickup'} → {ride.dropoffLabel ?? 'Dropoff'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(ride.createdAt)}
                      {ride.driver
                        ? ` · Driver: ${ride.driver.user.name ?? ride.driver.user.phone}`
                        : ' · No driver assigned'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold">{formatMoney(ride.fareCents)}</span>
                    <RideStatusBadge state={ride.state} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

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
