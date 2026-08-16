"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
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

type Phase = "ENTER_PASSWORD" | "SUCCESS" | "INVALID";

export function ResetPasswordForm() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>(token ? "ENTER_PASSWORD" : "INVALID");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const steps = ["New password", "Confirmed"];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await resetPassword(token, password);
      setPhase("SUCCESS");
    } catch (err) {
      if (isApiError(err) && err.status === 400) {
        setPhase("INVALID");
        return;
      }
      setError(
        isApiError(err)
          ? err.message
          : "Unable to reset your password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase === "INVALID") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Car className="h-5 w-5 text-brand-600" /> Reset your password
              </span>
            }
            subtitle="Something went wrong with this link"
          />
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="rounded-full bg-red-50 p-3">
                <Lock className="h-8 w-8 text-red-500" />
              </div>
              <p className="font-medium text-gray-900">
                This reset link is invalid or expired
              </p>
              <p className="text-sm text-gray-500">
                Reset links are single-use and expire after 15 minutes. Request
                a new one and try again.
              </p>
              <Button
                type="button"
                className="mt-2"
                onClick={() => router.push("/auth/forgot-password")}
              >
                <RefreshCw className="h-4 w-4" /> Request a new link
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>Remembered your password?</span>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Sign in
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (phase === "SUCCESS") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Car className="h-5 w-5 text-brand-600" /> Reset your password
              </span>
            }
            subtitle="Your password has been updated"
          />
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="rounded-full bg-green-50 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <p className="font-medium text-gray-900">Password updated</p>
              <p className="text-sm text-gray-500">
                Your password has been changed. All devices are signed out for
                security.
              </p>
              <Button
                type="button"
                className="mt-2"
                onClick={() => router.push("/auth/login")}
              >
                Sign in with your new password
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Car className="h-5 w-5 text-brand-600" /> Choose a new password
            </span>
          }
          subtitle="Pick a new password for your SafeRide account"
        />
        <CardBody>
          <div className="mb-6 flex items-center gap-2">
            {steps.map((label, i) => {
              const n = i + 1;
              const active = n === 1;
              return (
                <div key={label} className="flex flex-1 flex-col gap-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      active ? "bg-brand-600" : "bg-gray-200"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      active ? "font-semibold text-brand-700" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>New password</Label>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <Label>Confirm new password</Label>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-gray-400" />
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError("");
                  }}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" loading={busy}>
              Reset password
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>Remembered your password?</span>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Sign in
            </Link>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-500" />
            Resetting your password signs out every device.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
