import { Car } from 'lucide-react'
import { Button } from '@/components/ui'
import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <Car className="h-12 w-12 text-brand-600" />
      <h1 className="mt-4 text-xl font-bold text-gray-900">You're offline</h1>
      <p className="mt-2 text-sm text-gray-500">
        Check your connection and try again. Your ride request will resume once you're back online.
      </p>
      <div className="mt-6">
        <Link href="/app">
          <Button variant="outline">Try again</Button>
        </Link>
      </div>
    </div>
  )
}
