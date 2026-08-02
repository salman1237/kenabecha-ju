"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField, inputClass } from "@/components/ui/FormField";
import { forgotPassword } from "@/lib/api/auth";
import { type ForgotPasswordFormValues, forgotPasswordSchema } from "@/lib/validation/auth";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async ({ email }: ForgotPasswordFormValues) => {
    await forgotPassword(email).catch(() => {});
    setSubmitted(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {submitted ? (
        <p className="text-sm text-green-600">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" className={inputClass} {...register("email")} />
          </FormField>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>

          <p className="text-center text-sm text-zinc-500">
            <a href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
              Back to login
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
