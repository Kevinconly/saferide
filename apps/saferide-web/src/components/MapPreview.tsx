"use client";

import { useEffect, useRef, useState } from "react";

interface Marker {
  lat: number;
  lng: number;
  label?: string;
}

interface MapPreviewProps {
  center: { lat: number; lng: number };
  markers?: Marker[];
  zoom?: number;
  className?: string;
}

declare global {
  interface Window {
    google?: any;
    __googleMapsScriptLoaded?: boolean;
  }
}

// Use NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from environment; fall back to demo key
const API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
  "AIzaSyAeJrrphchoph6i9nMK0ERNDrU3P-EWaUM";
//open for demo (This doesn't count torward any cost) any developer must use his/shes own here
const SCRIPT_ID = "saferide-google-maps-script";

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Maps is not available on the server"));
      return;
    }

    if (window.google?.maps) {
      resolve();
      return;
    }

    if (window.__googleMapsScriptLoaded) {
      if (window.google?.maps) {
        resolve();
      } else {
        reject(new Error("Google Maps script loaded without API access"));
      }
      return;
    }

    const existingScript = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps script")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.__googleMapsScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load Google Maps"));
    document.head.appendChild(script);
  });
}

export function MapPreview({
  center,
  markers = [],
  zoom = 13,
  className = "",
}: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      setError(null);
      if (!API_KEY) {
        setError("Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable map previews.");
        return;
      }

      if (!containerRef.current) return;

      try {
        await loadGoogleMaps();
        if (cancelled) return;
        const google = window.google;
        if (!google?.maps) {
          throw new Error("Google Maps is not available.");
        }

        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom,
          mapTypeId: "roadmap",
          disableDefaultUI: true,
          zoomControl: true,
        });

        if (markers.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          markers.forEach((marker) => {
            const markerInstance = new google.maps.Marker({
              position: { lat: marker.lat, lng: marker.lng },
              map,
              title: marker.label,
            });
            if (marker.label) {
              const infoWindow = new google.maps.InfoWindow({
                content: marker.label,
              });
              markerInstance.addListener("click", () =>
                infoWindow.open(map, markerInstance),
              );
            }
            bounds.extend(markerInstance.getPosition());
          });

          if (markers.length > 1) {
            map.fitBounds(bounds, 80);
          } else {
            map.setCenter(markers[0]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "Unable to load map preview.");
        }
      }
    }

    void initializeMap();

    return () => {
      cancelled = true;
    };
  }, [center, markers, zoom]);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`}>
      {error ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-600">
          <p>{error}</p>
          <p className="text-xs text-gray-400">
            The map preview is available when a valid Google Maps API key is
            configured. A demo key may be used for local testing.
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-[240px] w-full" />
      )}
    </div>
  );
}
