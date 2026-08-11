import { Badge } from './ui'

const tones: Record<string, 'gray' | 'green' | 'amber' | 'blue' | 'red'> = {
  REQUESTED: 'amber',
  MATCHING: 'blue',
  RESERVED: 'blue',
  OFFERED: 'blue',
  EN_ROUTE_TO_PICKUP: 'blue',
  ARRIVED_AT_PICKUP: 'blue',
  PICKED_UP: 'green',
  EN_ROUTE_TO_DROPOFF: 'green',
  COMPLETED: 'green',
  CANCELLED: 'red',
  FAILED: 'red',
}

export function RideStatusBadge({ state }: { state: string }) {
  return <Badge tone={tones[state] ?? 'gray'}>{state.toLowerCase().replace(/_/g, ' ')}</Badge>
}
