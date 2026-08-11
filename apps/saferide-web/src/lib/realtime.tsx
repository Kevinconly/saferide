"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { WS_URL, getTokens, clearSession } from "./api";
import { useAuth } from "./auth";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface RealtimeContextValue {
  toasts: Toast[];
  notify: (kind: ToastKind, title: string, body?: string) => void;
  dismiss: (id: number) => void;
  connect: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

let socket: Socket | null = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;
  const { access } = getTokens();
  if (!access) return null;
  socket = io(WS_URL, {
    auth: { token: access },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
  socket.on("connect_error", () => {
    // token may be stale
    clearSession();
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function RealtimeProvider({
  children,
  onEvent,
}: {
  children: ReactNode;
  onEvent?: (event: string, data: unknown) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const handleEvent = useCallback(
    (event: string, _data: unknown) => {
      if (onEvent) {
        onEvent(event, _data);
        return;
      }
      if (event === "notification:new") {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      void queryClient.invalidateQueries({ queryKey: ["rides"] });
      void queryClient.invalidateQueries({ queryKey: ["current-ride"] });
    },
    [onEvent, queryClient],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, title: string, body?: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-4), { id, kind, title, body }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        6000,
      );
    },
    [],
  );

  const connect = useCallback(() => {
    const s = connectSocket();
    if (!s) return;
    s.removeAllListeners();
    s.on("notification:new", (data) => {
      const n = data as { title?: string; body?: string };
      notify("info", n.title ?? "Notification", n.body);
      handleEvent("notification:new", data);
    });
    s.on("ride:assigned", (data) => {
      notify(
        "success",
        "Driver assigned",
        "Your SafeRide driver is on the way.",
      );
      handleEvent("ride:assigned", data);
    });
    s.on("ride:cancelled", (data) => {
      notify("error", "Ride cancelled", "Your ride was cancelled.");
      handleEvent("ride:cancelled", data);
    });
    s.on("ride:status_changed", (data) => {
      const d = data as { state?: string };
      notify(
        "info",
        "Ride update",
        `Status: ${String(d.state ?? "")
          .toLowerCase()
          .replace(/_/g, " ")}`,
      );
      handleEvent("ride:status_changed", data);
    });
    s.on("ride:completed", (data) => {
      notify("success", "Ride completed", "Thanks for riding with SafeRide!");
      handleEvent("ride:completed", data);
    });
  }, [notify, handleEvent]);

  useEffect(() => {
    if (user) connect();
    else disconnectSocket();
    return () => disconnectSocket();
  }, [user, connect]);

  const value = useMemo(
    () => ({ toasts, notify, dismiss, connect }),
    [toasts, notify, dismiss, connect],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
