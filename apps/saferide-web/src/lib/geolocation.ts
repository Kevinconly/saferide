"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface UseGeolocationState {
  position: GeoPoint | null;
  error: string | null;
  loading: boolean;
  supported: boolean;
  getPosition: () => void;
}

function toGeoPoint(pos: GeolocationPosition): GeoPoint {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
    altitudeAccuracy: pos.coords.altitudeAccuracy,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    timestamp: pos.timestamp,
  };
}

export function useGeolocation(options?: PositionOptions): UseGeolocationState {
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supported] = useState<boolean>(
    typeof navigator !== "undefined" && "geolocation" in navigator,
  );

  const watchIdRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const getPosition = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(toGeoPoint(pos));
        setLoading(false);
      },
      (err) => {
        setError(geolocationErrorMessage(err));
        setLoading(false);
      },
      optionsRef.current,
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setPosition(toGeoPoint(pos)),
      (err) => setError(geolocationErrorMessage(err)),
      optionsRef.current,
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, error, loading, supported, getPosition };
}

export function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Enable access in your browser settings.";
    case err.POSITION_UNAVAILABLE:
      return "Location is unavailable right now. Check your GPS signal and try again.";
    case err.TIMEOUT:
      return "Timed out getting your location. Try again.";
    default:
      return "Could not determine your location.";
  }
}
