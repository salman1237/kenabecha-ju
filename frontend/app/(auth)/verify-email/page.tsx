"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendOtp, verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { type VerifyOtpFormValues, verifyOtpSchema } from "@/lib/validation/auth";

function VerifyEmailForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpFormValues>({ resolver: zodResolver(verifyOtpSchema) });

  const onSubmit = async ({ otp }: VerifyOtpFormValues) => {
    setServerError(null);
    try {
      await verifyEmail(email, otp);
      router.push("/login?verified=1");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Verification failed.");
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
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code we sent to <span className="font-medium text-foreground">{email || "your email"}</span>.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                className="text-center text-lg tracking-[0.5em]"
                {...register("otp")}
              />
              {errors.otp && <p className="text-xs text-destructive">{errors.otp.message}</p>}
            </div>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            {resendMessage && <p className="text-sm text-success">{resendMessage}</p>}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Verifying…" : "Verify"}
            </Button>

            <Button type="button" variant="ghost" onClick={onResend} disabled={resending}>
              {resending ? "Sending…" : "Resend code"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
