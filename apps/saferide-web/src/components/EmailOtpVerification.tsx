"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useAuth, type WebUser } from "@/lib/auth";
import { Button, Card, CardBody, CardHeader, Input, Label } from "@/components/ui";
import { isApiError } from "@/lib/api";

type Stage = "ENTER_EMAIL" | "ENTER_OTP" | "VERIFIED";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const RESEND_SECONDS = 60;

interface EmailOtpVerificationProps {
  initialEmail?: string;
  onVerified?: (user: WebUser) => void;
  onSkip?: () => void;
}

export function EmailOtpVerification({
  initialEmail = "",
  onVerified,
  onSkip,
}: EmailOtpVerificationProps) {
  const { requestEmailOtp, verifyEmailOtp } = useAuth();

  const [stage, setStage] = useState<Stage>("ENTER_EMAIL");
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (stage === "ENTER_OTP") {
      inputRefs.current[0]?.focus();
    }
  }, [stage]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  const sendCode = useCallback(
    async (target: string) => {
      setBusy(true);
      setError("");
      try {
        await requestEmailOtp(target.trim());
        setCountdown(RESEND_SECONDS);
        setStage("ENTER_OTP");
      } catch (err) {
        setError(isApiError(err) ? err.message : "Unable to send the code");
      } finally {
        setBusy(false);
      }
    },
    [requestEmailOtp],
  );

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim();
    if (!target || !EMAIL_RE.test(target)) {
      setError("Enter a valid email address");
      return;
    }
    setDigits(Array(6).fill(""));
    await sendCode(target);
  }

  function onDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    setError("");
  }

  function onDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function onVerify() {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await verifyEmailOtp(email.trim(), code);
      setVerifiedEmail(email.trim());
      setStage("VERIFIED");
      onVerified?.(user);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Verification failed. Try again.");
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (countdown > 0) return;
    setDigits(Array(6).fill(""));
    setError("");
    await sendCode(email);
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-brand-600" /> Verify your email
          </span>
        }
        subtitle="Confirm your email address to secure your account"
      />
      <CardBody>
        {stage === "VERIFIED" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-medium text-gray-900">Email verified</p>
            <p className="text-sm text-gray-500">{verifiedEmail}</p>
          </div>
        ) : stage === "ENTER_OTP" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-brand-800">
                <Mail className="h-4 w-4" /> {email.trim()}
              </p>
            </div>

            <div>
              <Label>Verification code</Label>
              <div className="flex justify-between gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    value={d}
                    onChange={(e) => onDigitChange(i, e.target.value)}
                    onKeyDown={(e) => onDigitKeyDown(i, e)}
                    onPaste={onPaste}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${i + 1}`}
                    className="h-12 w-12 rounded-lg border border-gray-300 text-center text-lg font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="button"
              className="w-full"
              loading={busy}
              onClick={() => void onVerify()}
            >
              <KeyRound className="h-4 w-4" /> Verify
            </Button>

            <button
              type="button"
              disabled={countdown > 0 || busy}
              onClick={() => void onResend()}
              className="w-full text-center text-sm font-semibold text-brand-700 hover:text-brand-900 disabled:text-gray-400"
            >
              {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmitEmail(e)} className="space-y-4">
            <div>
              <Label>Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@saferide.com"
                autoComplete="email"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>
              Send verification code
            </Button>
          </form>
        )}

        {onSkip && stage !== "VERIFIED" && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600"
          >
            Skip for now
          </button>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Codes expire in 5 minutes and are never stored in plain text.
        </div>
      </CardBody>
    </Card>
  );
}
