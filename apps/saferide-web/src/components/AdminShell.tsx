"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Car,
  History,
  LayoutDashboard,
  LogOut,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/drivers", label: "Drivers", icon: Car },
  { href: "/admin/rides", label: "Rides", icon: History },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/audit", label: "Audit log", icon: Shield },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 px-4 py-4">
          <Shield className="h-6 w-6 text-brand-600" />
          <span className="text-base font-bold text-gray-900">
            SafeRide Admin
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
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
        <div className="border-t border-gray-200 p-3">
          <Link
            href="/app"
            className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" /> Passenger app
          </Link>
          <div className="flex items-center justify-between px-3 py-1 text-xs text-gray-500">
            <span>{user?.name ?? user?.phone}</span>
            <button
              onClick={() => void logout()}
              className="rounded p-1 hover:bg-gray-100"
              title="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto px-6 py-6">{children}</main>
    </div>
  );
}
