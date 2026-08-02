"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectClass } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getDepartments, getHalls, getSessions } from "@/lib/api/reference";
import { type SignupFormValues, signupSchema } from "@/lib/validation/auth";
import type { Department, Hall, SessionOption } from "@/types/api";

function SignupForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [halls, setHalls] = useState<Hall[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showFullForm, setShowFullForm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });

  useEffect(() => {
    getHalls().then(setHalls).catch(() => {});
    getDepartments().then(setDepartments).catch(() => {});
    getSessions().then(setSessions).catch(() => {});
  }, []);

  const selectedSession = watch("session");
  const batch = sessions.find((s) => s.session === selectedSession)?.batch;

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null);
    try {
      const user = await signup({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        phone: values.phone,
        student_id: values.student_id,
        registration_no: values.registration_no,
        hall_id: values.hall_id,
        department_id: values.department_id,
        session: values.session,
      });
      router.push(`/verify-email?email=${encodeURIComponent(user.email)}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Signup failed. Please try again.");
    }
  };

  const departmentsByFaculty = departments.reduce<Record<string, Department[]>>((acc, dept) => {
    (acc[dept.faculty] ??= []).push(dept);
    return acc;
  }, {});

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Join KenaBecha JU</CardTitle>
          <p className="text-sm text-muted-foreground">
            Buying? One click with Google gets you browsing and buying in seconds. Selling? You&apos;ll
            need your full JU details so buyers can trust who they&apos;re dealing with.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <GoogleSignInButton next={next} onError={setServerError} />
          <p className="text-center text-xs text-muted-foreground">
            Fast signup for buyers — add fuller details later if you decide to sell.
          </p>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          {!showFullForm ? (
            <Button type="button" variant="outline" onClick={() => setShowFullForm(true)}>
              Sign up with full JU details (for selling)
            </Button>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" {...register("full_name")} />
                {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" {...register("password")} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="e.g. 01712345678" {...register("phone")} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="student_id">Student ID</Label>
                  <Input id="student_id" {...register("student_id")} />
                  {errors.student_id && <p className="text-xs text-destructive">{errors.student_id.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="registration_no">Registration No</Label>
                  <Input id="registration_no" {...register("registration_no")} />
                  {errors.registration_no && (
                    <p className="text-xs text-destructive">{errors.registration_no.message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hall_id">Hall</Label>
                <select id="hall_id" className={selectClass} {...register("hall_id")} defaultValue="">
                  <option value="" disabled>
                    Select your hall
                  </option>
                  {halls.map((hall) => (
                    <option key={hall.id} value={hall.id}>
                      {hall.name}
                    </option>
                  ))}
                </select>
                {errors.hall_id && <p className="text-xs text-destructive">{errors.hall_id.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="department_id">Department</Label>
                <select
                  id="department_id"
                  className={selectClass}
                  {...register("department_id")}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select your department
                  </option>
                  {Object.entries(departmentsByFaculty).map(([faculty, depts]) => (
                    <optgroup key={faculty} label={faculty}>
                      {depts.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.department_id && (
                  <p className="text-xs text-destructive">{errors.department_id.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="session">Session</Label>
                  <select id="session" className={selectClass} {...register("session")} defaultValue="">
                    <option value="" disabled>
                      Select session
                    </option>
                    {sessions.map((s) => (
                      <option key={s.session} value={s.session}>
                        {s.session}
                      </option>
                    ))}
                  </select>
                  {errors.session && <p className="text-xs text-destructive">{errors.session.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="batch">Batch</Label>
                  <Input id="batch" value={batch ?? ""} disabled placeholder="Auto-calculated" />
                </div>
              </div>

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}

              <Button type="submit" disabled={isSubmitting} className="mt-1">
                {isSubmitting ? "Creating account…" : "Create account"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="font-medium text-foreground">
              Log in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
