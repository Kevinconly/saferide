"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, KeyRound, Phone, ShieldCheck } from "lucide-react";
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

export default function SignupPage() {
  const { user, loading, signUp } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PASSENGER" | "DRIVER">("PASSENGER");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    router.replace(
      user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/admin" : "/app",
    );
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await signUp(
        phone.trim(),
        password.trim(),
        username.trim() || undefined,
        email.trim() || undefined,
        name.trim() || undefined,
        role,
      );
      router.replace(
        u.role === "ADMIN" || u.role === "SUPER_ADMIN" ? "/admin" : "/app",
      );
    } catch (err) {
      setError(isApiError(err) ? err.message : "Unable to create account");
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
              <Car className="h-5 w-5 text-brand-600" /> Create your SafeRide
              account
            </span>
          }
          subtitle="Register as a passenger or driver for the SafeRide MVP"
        />
        <CardBody>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div>
              <Label>Phone number</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0785222261"
                  required
                  inputMode="tel"
                  autoComplete="tel"
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
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@saferide.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div>
              <Label>Account type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={role === "PASSENGER" ? "primary" : "outline"}
                  onClick={() => setRole("PASSENGER")}
                >
                  Passenger
                </Button>
                <Button
                  type="button"
                  variant={role === "DRIVER" ? "primary" : "outline"}
                  onClick={() => setRole("DRIVER")}
                >
                  Driver
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>
              Create account
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>Already have an account?</span>
            <Link
              href="/auth/login"
              className="font-semibold text-brand-700 hover:text-brand-900"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Accounts are created for the SafeRide MVP with password-based
            authentication. Driver onboarding is available through the same
            signup flow.
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure registration · SafeRide Kigali
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
