"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  KeyRound,
  Phone,
  ShieldCheck,
  User,
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

const RW_PHONE_RE = /^(?:\+250|00250|250|0)?7\d{8}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function normalizePhone(raw: string): string {
  const phone = raw.replace(/[\s-]/g, "");
  if (phone.startsWith("+")) return phone;
  if (phone.startsWith("00")) return `+${phone.slice(2)}`;
  if (phone.startsWith("0")) return `+250${phone.slice(1)}`;
  if (phone.startsWith("7")) return `+250${phone}`;
  return `+${phone}`;
}

function isValidRwPhone(raw: string): boolean {
  return RW_PHONE_RE.test(raw.replace(/[\s-]/g, ""));
}

const STEPS = ["Account", "Security", "Verify phone"];

export default function SignupPage() {
  const { signUp, requestOtp, verifyOtp } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"PASSENGER" | "DRIVER">("PASSENGER");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [otpMode, setOtpMode] = useState<"code" | "auto" | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [otpCode, setOtpCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const normalizedPhone = normalizePhone(phone);

  function validateStep1(): string | null {
    if (!phone.trim()) return "Phone number is required";
    if (!isValidRwPhone(phone))
      return "Enter a Rwandan phone number, e.g. 0785222261 or +250785222261";
    if (email.trim() && !EMAIL_RE.test(email.trim()))
      return "Enter a valid email address";
    return null;
  }

  function validateStep2(): string | null {
    if (password.trim().length < 6)
      return "Password must be at least 6 characters";
    if (password.trim() !== confirm.trim())
      return "Passwords do not match";
    return null;
  }

  async function sendOtp() {
    const res = await requestOtp(phone.trim());
    setOtpMode(res.mode ?? (res.devCode ? "code" : "auto"));
    setDevCode(res.devCode);
  }

  async function onStep1Submit(e: FormEvent) {
    e.preventDefault();
    const v = validateStep1();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setStep(2);
  }

  async function onStep2Submit(e: FormEvent) {
    e.preventDefault();
    const v = validateStep2();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await signUp(
        phone.trim(),
        password.trim(),
        username.trim() || undefined,
        email.trim() || undefined,
        name.trim() || undefined,
        role,
      );
      await sendOtp();
      setStep(3);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Unable to create account");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (otpMode === "code" && !/^\d{6}$/.test(otpCode.trim())) {
      setError("Enter the 6-digit code sent to your phone");
      return;
    }
    setError("");
    setBusy(true);
    try {
      if (otpMode === "auto") {
        try {
          await verifyOtp(phone.trim(), undefined);
        } catch (err) {
          // Auto mode must never block signup (e.g. old backend / no SMS).
          console.error("OTP auto-verify skipped", err);
        }
      } else {
        await verifyOtp(phone.trim(), otpCode.trim());
      }
      router.replace("/app");
    } catch (err) {
      setError(
        isApiError(err) ? err.message : "Verification failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError("");
    setBusy(true);
    try {
      await sendOtp();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Unable to resend code");
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
          <div className="mb-5 flex items-center gap-2">
            {STEPS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3;
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
            <form onSubmit={(e) => void onStep1Submit(e)} className="space-y-4">
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
                {isValidRwPhone(phone) && phone.trim() && (
                  <p className="mt-1 text-xs text-gray-500">
                    Will be stored as {normalizedPhone}
                  </p>
                )}
                {!isValidRwPhone(phone) && phone.trim() && (
                  <p className="mt-1 text-xs text-gray-400">
                    Use 07XXXXXXXX, 7XXXXXXXX, or +2507XXXXXXXX
                  </p>
                )}
              </div>
              <div>
                <Label>Full name</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
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
                <Label>Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
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
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={(e) => void onStep2Submit(e)} className="space-y-4">
              <div>
                <Label>Password</Label>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div>
                <Label>Confirm password</Label>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/3"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="submit" className="flex-1" loading={busy}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={(e) => void onVerify(e)} className="space-y-4">
              <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-brand-800">
                  <Phone className="h-4 w-4" /> {normalizedPhone}
                </p>
              </div>

              {otpMode === "auto" ? (
                <p className="text-sm text-gray-500">
                  We couldn&apos;t send an SMS code just yet. Tap below to
                  finish creating your account.
                </p>
              ) : (
                <div>
                  <Label>Verification code</Label>
                  <Input
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  {devCode && (
                    <p className="mt-1 text-xs text-gray-500">
                      Demo mode code:{" "}
                      <span className="font-mono font-semibold text-brand-700">
                        {devCode}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/3"
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="submit" className="flex-1" loading={busy}>
                  {otpMode === "auto" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Finish
                    </>
                  ) : (
                    "Verify & create account"
                  )}
                </Button>
              </div>

              {otpMode === "code" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onResend()}
                  className="w-full text-center text-sm font-semibold text-brand-700 hover:text-brand-900"
                >
                  Resend code
                </button>
              )}
            </form>
          )}

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
            Driver accounts are created with a pending profile that admins
            review before they can start driving.
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
