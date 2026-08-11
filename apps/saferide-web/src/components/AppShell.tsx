"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Car,
  LayoutDashboard,
  LogOut,
  History,
  Wallet,
  Bell,
  User,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/format";

const nav = [
  { href: "/app", label: "Book a ride", icon: MapPin },
  { href: "/app/rides", label: "Ride history", icon: History },
  { href: "/app/payments", label: "Payments", icon: Wallet },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/profile", label: "Profile", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <Car className="h-6 w-6 text-brand-600" />
            <span className="text-lg font-bold text-gray-900">SafeRide</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-gray-100"
              >
                <LayoutDashboard className="h-4 w-4" /> Admin
              </Link>
            )}
            <span>{user?.name ?? formatPhone(user?.phone)}</span>
            <button
              onClick={() => void logout()}
              className="rounded-lg p-1.5 hover:bg-gray-100"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
