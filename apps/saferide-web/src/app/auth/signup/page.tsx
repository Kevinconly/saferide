"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  X,
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
import { EmailOtpVerification } from "@/components/EmailOtpVerification";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type UsernameStatus =
  | { state: "idle" | "checking" | "error"; message?: string }
  | { state: "available"; message?: string }
  | { state: "taken"; message?: string; suggestions?: string[] };

type EmailStatus =
  | { state: "idle" | "checking" | "error"; message?: string }
  | { state: "available"; message?: string }
  | { state: "taken"; message?: string };

export default function SignupPage() {
  const { signUp, checkUsername, checkEmailAvailable } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"PASSENGER" | "DRIVER">("PASSENGER");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({
    state: "idle",
  });
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({
    state: "idle",
  });

  const usernameTimer = useRef<number | null>(null);
  const emailTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (usernameTimer.current) window.clearTimeout(usernameTimer.current);
      if (emailTimer.current) window.clearTimeout(emailTimer.current);
    };
  }, []);

  function validateEmail(value: string): string | null {
    const target = value.trim();
    if (!target) return "Enter your email address";
    if (!EMAIL_RE.test(target)) return "Enter a valid email address";
    return null;
  }

  function validatePassword(value: string): string | null {
    if (value.length < 6) return "Password must be at least 6 characters";
    return null;
  }

  async function checkEmailNow(raw: string): Promise<boolean | null> {
    const value = raw.trim().toLowerCase();
    if (!value) {
      setEmailStatus({ state: "idle" });
      return null;
    }
    if (!EMAIL_RE.test(value)) {
      setEmailStatus({
        state: "error",
        message: "Enter a valid email address",
      });
      return null;
    }
    setEmailStatus({ state: "checking" });
    try {
      const res = await checkEmailAvailable(value);
      if (res.available) {
        setEmailStatus({ state: "available", message: "Email available" });
        return true;
      }
      setEmailStatus({
        state: "taken",
        message: "This email is already registered",
      });
      return false;
    } catch {
      setEmailStatus({
        state: "error",
        message: "Could not check email. Try again.",
      });
      return null;
    }
  }

  function onEmailChange(value: string) {
    setEmail(value);
    setError("");
    if (emailTimer.current) window.clearTimeout(emailTimer.current);
    if (!value.trim()) {
      setEmailStatus({ state: "idle" });
      return;
    }
    setEmailStatus({ state: "checking" });
    emailTimer.current = window.setTimeout(
      () => void checkEmailNow(value),
      350,
    );
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateEmail(email);
    if (v) {
      setError(v);
      return;
    }
    setError("");
    if (emailTimer.current) window.clearTimeout(emailTimer.current);
    const ok = await checkEmailNow(email);
    if (ok === false) {
      setError("This email is already registered — sign in instead");
      return;
    }
    if (ok === null) {
      setError("Could not confirm your email is available. Try again.");
      return;
    }
    setStep(2);
  }

  function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validatePassword(password);
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setStep(3);
  }

  async function checkUsernameNow(raw: string) {
    const value = raw.trim().toLowerCase();
    if (!value) {
      setUsernameStatus({ state: "idle" });
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setUsernameStatus({
        state: "error",
        message:
          value.length < 3
            ? "Username must be at least 3 characters"
            : "Use 3–20 lowercase letters, numbers, or underscores",
      });
      return;
    }
    setUsernameStatus({ state: "checking" });
    try {
      const res = await checkUsername(value);
      if (res.available) {
        setUsernameStatus({ state: "available", message: "Username available" });
      } else {
        setUsernameStatus({
          state: "taken",
          message: "That username is taken",
          suggestions: res.suggestions,
        });
      }
    } catch {
      setUsernameStatus({
        state: "error",
        message: "Could not check username. Try again.",
      });
    }
  }

  function onUsernameChange(value: string) {
    setUsername(value);
    setError("");
    if (usernameTimer.current) window.clearTimeout(usernameTimer.current);
    if (!value.trim()) {
      setUsernameStatus({ state: "idle" });
      return;
    }
    setUsernameStatus({ state: "checking" });
    usernameTimer.current = window.setTimeout(
      () => void checkUsernameNow(value),
      350,
    );
  }

  function pickSuggestion(suggestion: string) {
    setUsername(suggestion);
    void checkUsernameNow(suggestion);
  }

  async function onProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your full name");
      return;
    }
    const target = username.trim().toLowerCase();
    if (!USERNAME_RE.test(target)) {
      setError("Choose a valid username (3–20 lowercase letters, numbers, or underscores)");
      return;
    }
    if (usernameStatus.state === "taken") {
      setError("That username is already taken — try one of the suggestions");
      return;
    }
    if (usernameStatus.state === "checking" || usernameStatus.state === "error") {
      setError("Confirm your username is available first");
      return;
    }

    setError("");
    setBusy(true);
    try {
      await signUp({
        email: email.trim().toLowerCase(),
        password,
        username: target,
        name: name.trim(),
        role,
      });
      setStep(4);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Unable to create account");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Email", "Password", "Profile", "Verify email"];

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
          subtitle="Get where you're going in a few easy steps"
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
            <form onSubmit={onEmailSubmit} className="space-y-4">
              <div>
                <Label>Email address</Label>
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => onEmailChange(e.target.value)}
                      placeholder="you@saferide.com"
                      autoComplete="email"
                      autoFocus
                      required
                      className="pr-9"
                    />
                  </div>
                  <span className="absolute inset-y-0 right-2 flex items-center">
                    {emailStatus.state === "checking" && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {emailStatus.state === "available" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {emailStatus.state === "taken" && (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    {emailStatus.state === "error" && (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                  </span>
                </div>
                {emailStatus.state === "available" && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" /> {emailStatus.message}
                  </p>
                )}
                {emailStatus.state === "taken" && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <X className="h-3 w-3" /> {emailStatus.message}
                    <Link
                      href="/auth/login"
                      className="font-semibold text-brand-700 underline hover:text-brand-900"
                    >
                      Sign in instead
                    </Link>
                  </p>
                )}
                {emailStatus.state === "error" && (
                  <p className="mt-1 text-xs text-gray-400">
                    {emailStatus.message}
                  </p>
                )}
                {emailStatus.state === "idle" && email.trim() && (
                  <p className="mt-1 text-xs text-gray-400">
                    We&apos;ll send a 6-digit code to confirm your email.
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={onPasswordSubmit} className="space-y-4">
              <div>
                <Label>Create a password</Label>
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
                <p className="mt-1 text-xs text-gray-400">
                  Use at least 6 characters — a mix of letters and numbers is
                  best.
                </p>
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
                <Button type="submit" className="flex-1">
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={onProfileSubmit} className="space-y-4">
              <div>
                <Label>Full name</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError("");
                    }}
                    placeholder="Your name"
                    autoComplete="name"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <Label>Username</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                    @
                  </span>
                  <Input
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    placeholder="username"
                    autoComplete="username"
                    className="pl-7"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center">
                    {usernameStatus.state === "checking" && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {usernameStatus.state === "available" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {usernameStatus.state === "taken" && (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    {usernameStatus.state === "error" && (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                  </span>
                </div>
                {usernameStatus.state === "available" && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" /> {usernameStatus.message}
                  </p>
                )}
                {usernameStatus.state === "taken" && (
                  <div className="mt-1">
                    <p className="flex items-center gap-1 text-xs text-red-600">
                      <X className="h-3 w-3" /> {usernameStatus.message}
                    </p>
                    {usernameStatus.suggestions &&
                      usernameStatus.suggestions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {usernameStatus.suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => pickSuggestion(s)}
                              className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                            >
                              @{s}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                )}
                {(usernameStatus.state === "error" ||
                  usernameStatus.state === "idle") &&
                  usernameStatus.state === "error" && (
                    <p className="mt-1 text-xs text-gray-400">
                      {usernameStatus.message}
                    </p>
                  )}
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
                  Create account
                </Button>
              </div>
            </form>
          )}

          {step === 4 && (
            <EmailOtpVerification
              initialEmail={email}
              onVerified={() => router.replace("/app")}
              onSkip={() => router.replace("/app")}
            />
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

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            <Sparkles className="h-4 w-4 shrink-0 text-brand-500" />
            {role === "DRIVER"
              ? "Driver accounts get a pending profile that admins review before you can start driving."
              : "Create an account in under a minute — no phone number needed."}
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
