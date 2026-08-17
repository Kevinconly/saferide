"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Locate, LocateFixed, MapPin, Navigation } from "lucide-react";
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
import { useGeolocation } from "@/lib/geolocation";

const LOCATIONS: { label: string; lat: number; lng: number }[] = [
  { label: "City Centre (Nyarugenge)", lat: -1.9536, lng: 30.0606 },
  { label: "Remera", lat: -1.9583, lng: 30.1006 },
  { label: "Kicukiro", lat: -1.9878, lng: 30.1193 },
  { label: "Kimironko", lat: -1.9659, lng: 30.1193 },
  { label: "Nyarutarama", lat: -1.958, lng: 30.13 },
  { label: "Gisozi", lat: -1.9424, lng: 30.0681 },
  { label: "Kigali Intl Airport", lat: -1.9686, lng: 30.1395 },
];

const PICKUP_GPS = "gps";
const PICKUP_CUSTOM = "custom";

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

interface Coordinates {
  lat: number;
  lng: number;
  label: string;
}

function parseCoord(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function BookRidePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pickup, setPickup] = useState("0");
  const [dropoff, setDropoff] = useState("2");
  const [customPickup, setCustomPickup] = useState("");
  const [manualPickupLat, setManualPickupLat] = useState("");
  const [manualPickupLng, setManualPickupLng] = useState("");

  const geolocation = useGeolocation({ enableHighAccuracy: true });

  const dropoffLoc = LOCATIONS[Number(dropoff)] ?? LOCATIONS[1];

  let pickupLoc: Coordinates;
  if (pickup === PICKUP_GPS && geolocation.position) {
    pickupLoc = {
      lat: geolocation.position.lat,
      lng: geolocation.position.lng,
      label: "My current location",
    };
  } else if (pickup === PICKUP_CUSTOM) {
    const hasManualCoords = manualPickupLat !== "" && manualPickupLng !== "";
    if (hasManualCoords) {
      pickupLoc = {
        lat: parseCoord(manualPickupLat, LOCATIONS[0].lat),
        lng: parseCoord(manualPickupLng, LOCATIONS[0].lng),
        label: customPickup || "Custom pickup",
      };
    } else {
      pickupLoc = {
        lat: LOCATIONS[0].lat,
        lng: LOCATIONS[0].lng,
        label: customPickup || "Custom pickup",
      };
    }
  } else {
    pickupLoc = LOCATIONS[Number(pickup)] ?? LOCATIONS[0];
  }

  const mapCenter = {
    lat: (pickupLoc.lat + dropoffLoc.lat) / 2,
    lng: (pickupLoc.lng + dropoffLoc.lng) / 2,
  };

  const mapMarkers = [
    { lat: pickupLoc.lat, lng: pickupLoc.lng, label: pickupLoc.label },
    { lat: dropoffLoc.lat, lng: dropoffLoc.lng, label: dropoffLoc.label },
  ];

  const { data: currentRide } = useQuery({
    queryKey: ["current-ride"],
    queryFn: async () => (await api.get<Ride | null>("/rides/current")) ?? null,
    refetchInterval: 10_000,
  });

  const estimate = useQuery({
    queryKey: [
      "fare-estimate",
      pickupLoc.lat,
      pickupLoc.lng,
      dropoffLoc.lat,
      dropoffLoc.lng,
    ],
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
        pickupLabel: pickupLoc.label,
        dropoffLat: dropoffLoc.lat,
        dropoffLng: dropoffLoc.lng,
        dropoffLabel: dropoffLoc.label,
      }),
    onSuccess: (ride) => router.push(`/rides/${ride.id}`),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    requestRide.mutate();
  }

  if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
    return (
      <div className="space-y-4">
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-lg font-semibold text-gray-900">Admin Dashboard</p>
            <p className="mt-2 text-sm text-gray-500">
              Admins manage the platform and do not book rides.
            </p>
            <Button className="mt-4" onClick={() => router.push("/admin")}>
              Go to Admin Dashboard
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (user?.role === "DRIVER") {
    return (
      <div className="space-y-4">
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-lg font-semibold text-gray-900">Driver Account</p>
            <p className="mt-2 text-sm text-gray-500">
              Drivers cannot book rides. You will receive ride requests from passengers.
            </p>
          </CardBody>
        </Card>
      </div>
    );
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
                  onClick={() => router.push(`/rides/${currentRide.id}`)}
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

  const pickupReady =
    (pickup !== PICKUP_GPS && pickup !== PICKUP_CUSTOM) ||
    (pickup === PICKUP_GPS && geolocation.position !== null) ||
    (pickup === PICKUP_CUSTOM &&
      manualPickupLat !== "" &&
      manualPickupLng !== "");

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
                <option value={PICKUP_GPS}>Use my current location (GPS)</option>
                <option value={PICKUP_CUSTOM}>Manual configuration</option>
              </Select>
              {pickup === PICKUP_GPS && (
                <div className="mt-2 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    loading={geolocation.loading}
                    disabled={!geolocation.supported}
                    onClick={geolocation.getPosition}
                  >
                    <LocateFixed className="h-4 w-4" />
                    {geolocation.position
                      ? "Refresh location"
                      : "Detect my location"}
                  </Button>
                  {!geolocation.supported && (
                    <p className="text-xs text-gray-500">
                      Geolocation is not supported on this device.
                    </p>
                  )}
                  {geolocation.position ? (
                    <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                      <Locate className="h-4 w-4" />
                      <span>
                        {geolocation.position.lat.toFixed(5)},{" "}
                        {geolocation.position.lng.toFixed(5)} (±
                        {Math.round(geolocation.position.accuracy)} m)
                      </span>
                    </div>
                  ) : geolocation.error ? (
                    <p className="text-sm text-red-600">{geolocation.error}</p>
                  ) : null}
                </div>
              )}
              {pickup === PICKUP_CUSTOM && (
                <div className="mt-2 space-y-3">
                  <Input
                    value={customPickup}
                    onChange={(e) => setCustomPickup(e.target.value)}
                    placeholder="Describe pickup location (e.g. Kigali City Market)"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Latitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={manualPickupLat}
                        onChange={(e) => setManualPickupLat(e.target.value)}
                        placeholder="-1.9536"
                      />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input
                        type="number"
                        step="any"
                        value={manualPickupLng}
                        onChange={(e) => setManualPickupLng(e.target.value)}
                        placeholder="30.0606"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Leave latitude/longitude blank to use the default city
                    centre coordinates.
                  </p>
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
              disabled={
                !pickupReady || pickup === dropoff || user?.isEmailVerified === false
              }
            >
              Request ride
            </Button>
            {pickup === PICKUP_GPS && !geolocation.position && (
              <p className="text-xs text-gray-500">
                Detect your location with GPS before requesting a ride.
              </p>
            )}
            {user?.isEmailVerified === false && (
              <p className="text-sm text-amber-700">
                Verify Email to book ride.
              </p>
            )}
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
