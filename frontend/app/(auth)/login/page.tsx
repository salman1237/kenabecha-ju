"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { FormField, inputClass } from "@/components/ui/FormField";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { type LoginFormValues, loginSchema } from "@/lib/validation/auth";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const { setUser } = useAuth();
  const justVerified = useSearchParams().get("verified") === "1";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      setUser(user);
      router.push("/");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Login failed.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        {justVerified && (
          <p className="mt-1 text-sm text-green-600">Email verified — you can log in now.</p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" className={inputClass} {...register("email")} />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <input id="password" type="password" className={inputClass} {...register("password")} />
        </FormField>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-medium text-zinc-900 dark:text-zinc-100">
            Sign up
          </a>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
