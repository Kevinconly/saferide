"use client";

import { useEffect } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (err) {
    console.warn("SW registration failed", err);
    return null;
  }
}

async function subscribePush(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  if (!VAPID_PUBLIC_KEY) return;
  if (window.localStorage.getItem("sr_push_done") === "1") return;

  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  try {
    await api.post("/notifications/subscriptions", {
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
      auth: arrayBufferToBase64(sub.getKey("auth")),
    });
    window.localStorage.setItem("sr_push_done", "1");
  } catch (err) {
    console.warn("Push subscription sync failed", err);
  }
}

function arrayBufferToBase64(
  buffer: ArrayBuffer | ArrayBufferView | null,
): string {
  if (!buffer) return "";
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer as ArrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function PwaSetup() {
  const { user } = useAuth();

  useEffect(() => {
    void (async () => {
      const reg = await registerServiceWorker();
      if (reg && user) {
        try {
          await subscribePush(reg);
        } catch {
          // push not available
        }
      }
    })();
  }, [user]);

  return null;
}
