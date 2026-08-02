"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { FormField, inputClass } from "@/components/ui/FormField";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { type ResetPasswordFormValues, resetPasswordSchema } from "@/lib/validation/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  if (!token) {
    return (
      <p className="text-sm text-red-600">
        This reset link is missing its token. Request a new one from the{" "}
        <a href="/forgot-password" className="font-medium underline">
          forgot password
        </a>{" "}
        page.
      </p>
    );
  }

  const onSubmit = async ({ password }: ResetPasswordFormValues) => {
    setServerError(null);
    try {
      await resetPassword(token, password);
      router.push("/login?reset=1");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not reset password.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="New password" htmlFor="password" error={errors.password?.message}>
        <input id="password" type="password" className={inputClass} {...register("password")} />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <input id="confirmPassword" type="password" className={inputClass} {...register("confirmPassword")} />
      </FormField>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {isSubmitting ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
