"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Inbox,
  Mail,
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

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function ForgotPasswordPage() {
  const { requestPasswordReset, checkEmailAvailable } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noAccount, setNoAccount] = useState<string>("");

  const steps = ["Email", "Check your inbox"];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target || !EMAIL_RE.test(target)) {
      setError("Enter a valid email address");
      return;
    }
    setError("");
    setNoAccount("");
    setBusy(true);
    try {
      const check = await checkEmailAvailable(target);
      if (check.available) {
        setNoAccount(target);
        return;
      }
      await requestPasswordReset(target);
      setStep(2);
    } catch (err) {
      setError(
        isApiError(err)
          ? err.message
          : "Unable to send a reset link. Try again.",
      );
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
              <Car className="h-5 w-5 text-brand-600" /> Reset your password
            </span>
          }
          subtitle="We&apos;ll email you a secure link to choose a new password"
        />
        <CardBody>
          <div className="mb-6 flex items-center gap-2">
            {steps.map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={label} className="flex flex-1 flex-col gap-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      active || done ? "bg-brand-600" : "bg-gray-200"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      active ? "font-semibold text-brand-700" : "text-gray-400"
                    }`}
                  >
                    {done ? "Done" : label}
                  </span>
                </div>
              );
            })}
          </div>

          {step === 1 && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label>Email address</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                      setNoAccount("");
                    }}
                    placeholder="you@saferide.com"
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>
                {email.trim() && EMAIL_RE.test(email.trim()) && (
                  <p className="mt-1 text-xs text-gray-400">
                    The reset link is valid for 15 minutes.
                  </p>
                )}
              </div>
              {noAccount ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
                  <span className="text-amber-800">
                    No account is registered with{" "}
                    <span className="font-medium">{noAccount}</span>
                  </span>
                  <Link
                    href="/auth/signup"
                    className="shrink-0 font-semibold text-brand-700 hover:text-brand-900"
                  >
                    Create account
                  </Link>
                </div>
              ) : (
                error && <p className="text-sm text-red-600">{error}</p>
              )}
              <Button type="submit" className="w-full" loading={busy}>
                Send reset link
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="rounded-full bg-brand-50 p-3">
                <Inbox className="h-8 w-8 text-brand-600" />
              </div>
              <p className="font-medium text-gray-900">Check your inbox</p>
              <p className="text-sm text-gray-500">
                A password reset link was sent to{" "}
                <span className="font-medium">{email.trim().toLowerCase()}</span>.
                Open it within 15 minutes to choose a new password.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={() => router.push("/auth/login")}
              >
                Back to sign in
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>Remembered your password?</span>
            <Link
              href="/auth/login"
              className="font-semibold text-brand-700 hover:text-brand-900"
            >
              <span className="inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Sign in
              </span>
            </Link>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />
            For security, reset links are single-use and expire after 15
            minutes.
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure password recovery · SafeRide Kigali
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
