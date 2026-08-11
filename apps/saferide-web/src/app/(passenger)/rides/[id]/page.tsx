"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { MapPin, Navigation, Car } from "lucide-react";
import { api, isApiError } from "@/lib/api";
import { formatDate, formatMoney, humanizeState } from "@/lib/format";
import { Button, Card, CardBody, CardHeader, Spinner } from "@/components/ui";
import { MapPreview } from "@/components/MapPreview";
import { RideStatusBadge } from "@/components/RideStatusBadge";

interface RideEvent {
  id: string;
  actor?: string | null;
  type: string;
  payload?: { state?: string; reason?: string } | null;
  createdAt: string;
}

interface Ride {
  id: string;
  state: string;
  fareCents: number;
  currency: string;
  pickupLabel?: string | null;
  pickupLat: number;
  pickupLng: number;
  dropoffLabel?: string | null;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm?: number | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  driver?: {
    id: string;
    user: { id: string; name: string | null; phone: string };
  } | null;
  events?: RideEvent[];
  payment?: { id: string; status: string; amountCents: number } | null;
}

interface Payment {
  id: string;
  status: string;
  amountCents: number;
  providerReference?: string | null;
}

const CANCELLABLE = [
  "REQUESTED",
  "MATCHING",
  "RESERVED",
  "OFFERED",
  "EN_ROUTE_TO_PICKUP",
  "ARRIVED_AT_PICKUP",
];

export default function RideDetailPage() {
  const params = useParams<{ id: string }>();
  const rideId = params.id;

  const {
    data: ride,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["ride", rideId],
    queryFn: async () => api.get<Ride>(`/rides/${rideId}`),
    refetchInterval: 10_000,
  });

  const { data: payment } = useQuery({
    queryKey: ["payment", rideId],
    queryFn: async () => {
      try {
        return await api.get<Payment>(`/payments/ride/${rideId}`);
      } catch {
        return null;
      }
    },
    enabled: !!ride && ride.state === "COMPLETED",
  });

  const cancel = useMutation({
    mutationFn: async () =>
      api.post(`/rides/${rideId}/cancel`, { reason: "Cancelled by passenger" }),
    onSuccess: () => void refetch(),
  });

  const pay = useMutation({
    mutationFn: async () => api.post("/payments/initiate", { rideId }),
    onSuccess: () => void refetch(),
  });

  if (isLoading || !ride) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const isCancellable = CANCELLABLE.includes(ride.state);
  const needsPayment =
    ride.state === "COMPLETED" && payment && payment.status !== "SUCCESS";

  const mapCenter = {
    lat: (ride.pickupLat + ride.dropoffLat) / 2,
    lng: (ride.pickupLng + ride.dropoffLng) / 2,
  };

  const mapMarkers = [
    { lat: ride.pickupLat, lng: ride.pickupLng, label: "Pickup" },
    { lat: ride.dropoffLat, lng: ride.dropoffLng, label: "Dropoff" },
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="Ride details"
          action={<RideStatusBadge state={ride.state} />}
        />
        <CardBody className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-600" />
            <span className="font-medium">
              {ride.pickupLabel ??
                `${ride.pickupLat.toFixed(4)}, ${ride.pickupLng.toFixed(4)}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-red-500" />
            <span className="font-medium">
              {ride.dropoffLabel ??
                `${ride.dropoffLat.toFixed(4)}, ${ride.dropoffLng.toFixed(4)}`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <div>
              <p className="text-xs text-gray-500">Distance</p>
              <p className="font-medium">{ride.distanceKm?.toFixed(1)} km</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fare</p>
              <p className="font-semibold text-brand-700">
                {formatMoney(ride.fareCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Requested</p>
              <p className="font-medium">{formatDate(ride.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completed</p>
              <p className="font-medium">{formatDate(ride.completedAt)}</p>
            </div>
          </div>

          {ride.driver?.user && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <Car className="h-4 w-4 text-gray-500" />
              <span>
                Driver:{" "}
                <span className="font-medium">
                  {ride.driver.user.name ?? ride.driver.user.phone}
                </span>
              </span>
            </div>
          )}

          {ride.cancelReason && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Cancelled: {ride.cancelReason}
            </p>
          )}

          {isCancellable && (
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => cancel.mutate()}
              className="w-full"
            >
              Cancel ride
            </Button>
          )}
          {cancel.isError && (
            <p className="text-sm text-red-600">
              {isApiError(cancel.error)
                ? cancel.error.message
                : "Cancel failed"}
            </p>
          )}

          {needsPayment && payment && (
            <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-brand-800">
                  Payment due
                </span>
                <span className="text-lg font-bold text-brand-800">
                  {formatMoney(payment.amountCents)}
                </span>
              </div>
              <Button
                className="w-full"
                loading={pay.isPending}
                onClick={() => pay.mutate()}
              >
                Pay now (sandbox)
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Route preview" subtitle="Map view for this ride" />
        <CardBody className="p-0">
          <MapPreview center={mapCenter} markers={mapMarkers} />
        </CardBody>
      </Card>

      {ride.events && ride.events.length > 0 && (
        <Card>
          <CardHeader title="Timeline" />
          <CardBody>
            <ol className="space-y-3">
              {ride.events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {humanizeState(ev.type)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(ev.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
