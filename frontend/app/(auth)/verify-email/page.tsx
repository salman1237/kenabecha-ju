"use client";

import { CheckCircle2, MailCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Suspense, useState } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/ErrorState";
import { OtpInput } from "@/components/ui/OtpInput";
import { resendOtp, verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

function VerifyEmailForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";

  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (value: string) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setServerError(null);
    try {
      await verifyEmail(email, value);
      router.push("/login?verified=1");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Verification failed.");
      // Clear so the next attempt starts from an empty field rather than
      // making the user backspace six times.
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    setServerError(null);
    setResendMessage(null);
    setResending(true);
    try {
      await resendOtp(email);
      setResendMessage("A new code has been sent to your email.");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not resend code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle={`Enter the 6-digit code we sent to ${email || "your email"}.`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-7" strokeWidth={1.75} />
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(code);
          }}
          className="flex flex-col gap-5"
        >
          <OtpInput
            value={code}
            onChange={setCode}
            disabled={verifying}
            // Auto-submit on the sixth digit — nobody wants to type the
            // code and then hunt for a button.
            onComplete={submit}
          />

          <AnimatePresence>
            <FieldError className="text-center text-sm">{serverError}</FieldError>
          </AnimatePresence>

          {resendMessage && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="size-4" />
              {resendMessage}
            </p>
          )}

          <Button
            type="submit"
            loading={verifying}
            loadingText="Verifying…"
            disabled={code.length !== 6}
            className="h-10"
          >
            Verify
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onResend}
            loading={resending}
            loadingText="Sending…"
          >
            Resend code
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
