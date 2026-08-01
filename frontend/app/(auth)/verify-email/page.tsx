"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { FormField, inputClass } from "@/components/ui/FormField";
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
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the 6-digit code we sent to <span className="font-medium">{email || "your email"}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField label="Verification code" htmlFor="otp" error={errors.otp?.message}>
          <input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            {...register("otp")}
          />
        </FormField>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        {resendMessage && <p className="text-sm text-green-600">{resendMessage}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isSubmitting ? "Verifying…" : "Verify"}
        </button>

        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </form>
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
