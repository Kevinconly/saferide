export interface LatLng {
  lat: number;
  lng: number;
}

const KIGALI_BOUNDS = {
  minLat: -2.1,
  maxLat: -1.85,
  minLng: 29.98,
  maxLng: 30.32,
};

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isInServiceArea(point: LatLng): boolean {
  return (
    point.lat >= KIGALI_BOUNDS.minLat &&
    point.lat <= KIGALI_BOUNDS.maxLat &&
    point.lng >= KIGALI_BOUNDS.minLng &&
    point.lng <= KIGALI_BOUNDS.maxLng
  );
}

const BASE_FARE_CENTS = 1000; // 10 RWF == 1000? Use RWF cents: 10 RWF base
const PER_KM_CENTS = 450; // 4.5 RWF per km

export function computeFareCents(distanceKm: number): number {
  return Math.round(BASE_FARE_CENTS + distanceKm * PER_KM_CENTS);
}
