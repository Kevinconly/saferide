"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Car } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (loading || redirectedRef.current) return;

    const target = user
      ? user.role === "ADMIN" || user.role === "SUPER_ADMIN"
        ? "/admin"
        : "/rides"
      : "/auth/login";

    if (typeof window !== "undefined" && window.location.pathname !== target) {
      router.replace(target);
    }

    redirectedRef.current = true;
    // We intentionally omit `router` from deps to avoid router identity changes
    // causing repeated redirects. Depend on `loading` and `user?.role` only.
  }, [loading, user?.role]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 text-white">
      <Car className="h-16 w-16" />
      <h1 className="mt-4 text-3xl font-bold">SafeRide Kigali</h1>
      <p className="mt-2 text-sm text-white/80">Loading...</p>
    </div>
  );
}
