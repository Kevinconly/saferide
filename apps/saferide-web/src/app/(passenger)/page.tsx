"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MapPin, Navigation } from "lucide-react";
import { api, isApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { MapPreview } from "@/components/MapPreview";
import { RideStatusBadge } from "@/components/RideStatusBadge";

const LOCATIONS: { label: string; lat: number; lng: number }[] = [
  { label: "City Centre (Nyarugenge)", lat: -1.9536, lng: 30.0606 },
  { label: "Remera", lat: -1.9583, lng: 30.1006 },
  { label: "Kicukiro", lat: -1.9878, lng: 30.1193 },
  { label: "Kimironko", lat: -1.9659, lng: 30.1193 },
  { label: "Nyarutarama", lat: -1.958, lng: 30.13 },
  { label: "Gisozi", lat: -1.9424, lng: 30.0681 },
  { label: "Kigali Intl Airport", lat: -1.9686, lng: 30.1395 },
];

interface Ride {
  id: string;
  state: string;
  fareCents: number;
  currency: string;
  pickupLabel?: string | null;
  dropoffLabel?: string | null;
  distanceKm?: number | null;
  driver?: { user: { id: string; name: string | null; phone: string } } | null;
}

export default function BookRidePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pickup, setPickup] = useState("0");
  const [dropoff, setDropoff] = useState("2");
  const [customPickup, setCustomPickup] = useState("");

  const pickupLoc = LOCATIONS[Number(pickup)] ?? LOCATIONS[0];
  const dropoffLoc = LOCATIONS[Number(dropoff)] ?? LOCATIONS[1];

  const mapCenter = {
    lat: (pickupLoc.lat + dropoffLoc.lat) / 2,
    lng: (pickupLoc.lng + dropoffLoc.lng) / 2,
  };

  const mapMarkers = [
    { lat: pickupLoc.lat, lng: pickupLoc.lng, label: "Pickup" },
    { lat: dropoffLoc.lat, lng: dropoffLoc.lng, label: "Dropoff" },
  ];

  const { data: currentRide } = useQuery({
    queryKey: ["current-ride"],
    queryFn: async () => (await api.get<Ride | null>("/rides/current")) ?? null,
    refetchInterval: 10_000,
  });

  const estimate = useQuery({
    queryKey: ["fare-estimate", pickup, dropoff],
    queryFn: async () =>
      api.get<{ distanceKm: number; fareCents: number; currency: string }>(
        `/rides/fare-estimate?pickupLat=${pickupLoc.lat}&pickupLng=${pickupLoc.lng}&dropoffLat=${dropoffLoc.lat}&dropoffLng=${dropoffLoc.lng}`,
      ),
    enabled: pickup !== dropoff,
  });

  const requestRide = useMutation({
    mutationFn: async () =>
      api.post<Ride>("/rides", {
        pickupLat: pickupLoc.lat,
        pickupLng: pickupLoc.lng,
        pickupLabel:
          pickup === "custom" ? customPickup || undefined : pickupLoc.label,
        dropoffLat: dropoffLoc.lat,
        dropoffLng: dropoffLoc.lng,
        dropoffLabel: dropoffLoc.label,
      }),
    onSuccess: (ride) => router.push(`/app/rides/${ride.id}`),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    requestRide.mutate();
  }

  if (currentRide) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Active ride"
            subtitle="You have an ongoing ride"
            action={<RideStatusBadge state={currentRide.state} />}
          />
          <CardBody>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-600" />
                <span>{currentRide.pickupLabel ?? "Pickup"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-red-500" />
                <span>{currentRide.dropoffLabel ?? "Dropoff"}</span>
              </div>
              {currentRide.driver?.user && (
                <p className="text-gray-600">
                  Driver:{" "}
                  {currentRide.driver.user.name ??
                    currentRide.driver.user.phone}
                </p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/app/rides/${currentRide.id}`)}
                >
                  View ride
                </Button>
                <Badge tone="green">{formatMoney(currentRide.fareCents)}</Badge>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Map preview"
            subtitle="View the ride route or service area"
          />
          <CardBody className="p-0">
            <MapPreview center={mapCenter} markers={mapMarkers} />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Book a ride"
            subtitle="Choose your pickup and dropoff"
          />
          <CardBody className="space-y-4">
            <div>
              <Label>Pickup</Label>
              <Select
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
              >
                {LOCATIONS.map((l, i) => (
                  <option key={l.label} value={i}>
                    {l.label}
                  </option>
                ))}
                <option value="custom">Custom location</option>
              </Select>
              {pickup === "custom" && (
                <div className="mt-2">
                  <Input
                    value={customPickup}
                    onChange={(e) => setCustomPickup(e.target.value)}
                    placeholder="Describe pickup location"
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Dropoff</Label>
              <Select
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
              >
                {LOCATIONS.map((l, i) => (
                  <option key={l.label} value={i}>
                    {l.label}
                  </option>
                ))}
                <option value="custom">Custom location</option>
              </Select>
            </div>
            {estimate.data && pickup !== dropoff && (
              <div className="rounded-lg bg-brand-50 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-800">
                    {estimate.data.distanceKm.toFixed(1)} km
                  </span>
                  <span className="text-lg font-bold text-brand-800">
                    {formatMoney(estimate.data.fareCents)}
                  </span>
                </div>
              </div>
            )}
            {requestRide.isError && (
              <p className="text-sm text-red-600">
                {isApiError(requestRide.error)
                  ? requestRide.error.message
                  : "Could not request ride"}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              loading={requestRide.isPending}
              disabled={pickup === dropoff || user?.isVerified === false}
            >
              Request ride
            </Button>
            {user?.isVerified === false && (
              <p className="text-sm text-amber-700">
                Your account is not verified yet. Please verify your phone
                before requesting rides.
              </p>
            )}{" "}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Map preview"
            subtitle="See the selected pickup and dropoff points"
          />
          <CardBody className="p-0">
            <MapPreview center={mapCenter} markers={mapMarkers} />
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
