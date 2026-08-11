"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
} from "@/components/ui";
import { isApiError } from "@/lib/api";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(
        user.role === "ADMIN" || user.role === "SUPER_ADMIN"
          ? "/admin"
          : "/app",
      );
    }
  }, [user, loading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const normalizedIdentifier = identifier.trim();
      const normalizedPassword = password.trim();
      const u = await login(normalizedIdentifier, normalizedPassword);
      router.replace(
        u.role === "ADMIN" || u.role === "SUPER_ADMIN" ? "/admin" : "/app",
      );
    } catch (err) {
      setError(isApiError(err) ? err.message : "Unable to authenticate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Car className="h-5 w-5 text-brand-600" /> SafeRide Kigali
            </span>
          }
          subtitle="Sign in to SafeRide"
        />
        <CardBody>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div>
              <Label>Email, username or phone</Label>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-gray-400" />
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin, customer@saferide.com, or 0785222261"
                  required
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <Label>Password</Label>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  minLength={3}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>
              Log in
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>New to SafeRide?</span>
            <Link
              href="/auth/signup"
              className="font-semibold text-brand-700 hover:text-brand-900"
            >
              Create an account
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Login with your email, username, or phone and password.
            Password-based authentication is enabled for the MVP.
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure sign in · SafeRide Kigali
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
