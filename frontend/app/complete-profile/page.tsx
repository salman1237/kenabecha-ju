"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectClass } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { completeProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getDepartments, getHalls, getSessions } from "@/lib/api/reference";
import { type CompleteProfileFormValues, juProfileSchema } from "@/lib/validation/auth";
import type { Department, Hall, SessionOption } from "@/types/api";

function CompleteProfileForm() {
  const router = useRouter();
  const { user, isLoading: authLoading, setUser } = useAuth();
  const next = useSearchParams().get("next") || "/";
  const [halls, setHalls] = useState<Hall[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompleteProfileFormValues>({ resolver: zodResolver(juProfileSchema) });

  useEffect(() => {
    getHalls().then(setHalls).catch(() => {});
    getDepartments().then(setDepartments).catch(() => {});
    getSessions().then(setSessions).catch(() => {});
  }, []);

  const selectedSession = watch("session");
  const batch = sessions.find((s) => s.session === selectedSession)?.batch;

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        <a href={`/login?next=${encodeURIComponent(`/complete-profile?next=${next}`)}`} className="font-medium text-foreground">
          Log in
        </a>{" "}
        to complete your profile.
      </div>
    );
  }

  if (user.profile_complete) {
    router.push(next);
    return null;
  }

  const onSubmit = async (values: CompleteProfileFormValues) => {
    setServerError(null);
    try {
      const updated = await completeProfile(values);
      setUser(updated);
      router.push(next);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not save your profile.");
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
          <CardTitle className="text-2xl">Complete your JU profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Required before opening a shop or listing an item — this is a one-time step.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              <select id="department_id" className={selectClass} {...register("department_id")} defaultValue="">
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
              {errors.department_id && <p className="text-xs text-destructive">{errors.department_id.message}</p>}
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
              {isSubmitting ? "Saving…" : "Save and continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileForm />
    </Suspense>
  );
}
