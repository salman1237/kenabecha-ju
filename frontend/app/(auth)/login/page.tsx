"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Separator } from "@/components/ui/separator";
import { login } from "@/lib/api/auth";
import { useLanguage } from "@/context/LanguageContext";
import { translateApiError } from "@/lib/i18n/errors";
import { type LoginFormValues, loginSchema } from "@/lib/validation/auth";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const { setUser } = useAuth();
  const searchParams = useSearchParams();
  const justVerified = searchParams.get("verified") === "1";
  const justReset = searchParams.get("reset") === "1";
  const next = searchParams.get("next") || "/";
  const [serverError, setServerError] = useState<string | null>(null);
  const { t } = useLanguage();

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
      router.push(next);
    } catch (err) {
      setServerError(translateApiError(err, t));
    }
  };

  return (
    <AuthShell
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            {t.auth.signup}
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {(justVerified || justReset) && (
          <p className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            {justVerified
              ? "Email verified — you can log in now."
              : "Password reset — log in with your new password."}
          </p>
        )}

        <GoogleSignInButton next={next} onError={setServerError} />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or continue with email</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@juniv.edu"
              className="h-10"
              {...register("email")}
            />
            <AnimatePresence>
              <FieldError>{errors.email?.message}</FieldError>
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              className="h-10"
              {...register("password")}
            />
            <AnimatePresence>
              <FieldError>{errors.password?.message}</FieldError>
            </AnimatePresence>
          </div>

          <AnimatePresence>
            <FieldError className="text-sm">{serverError}</FieldError>
          </AnimatePresence>

          <Button type="submit" loading={isSubmitting} loadingText="Logging in…" className="mt-1 h-10">
            {t.auth.login}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
