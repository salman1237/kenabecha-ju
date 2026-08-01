"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { FormField, inputClass } from "@/components/ui/FormField";
import { signup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getDepartments, getHalls, getSessions } from "@/lib/api/reference";
import { type SignupFormValues, signupSchema } from "@/lib/validation/auth";
import type { Department, Hall, SessionOption } from "@/types/api";

export default function SignupPage() {
  const router = useRouter();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          For Jahangirnagar University students. We&apos;ll verify your email with a one-time code.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField label="Full name" htmlFor="full_name" error={errors.full_name?.message}>
          <input id="full_name" className={inputClass} {...register("full_name")} />
        </FormField>

        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" className={inputClass} {...register("email")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Password" htmlFor="password" error={errors.password?.message}>
            <input id="password" type="password" className={inputClass} {...register("password")} />
          </FormField>
          <FormField
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <input
              id="confirmPassword"
              type="password"
              className={inputClass}
              {...register("confirmPassword")}
            />
          </FormField>
        </div>

        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message} hint="e.g. 01712345678">
          <input id="phone" className={inputClass} {...register("phone")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Student ID" htmlFor="student_id" error={errors.student_id?.message}>
            <input id="student_id" className={inputClass} {...register("student_id")} />
          </FormField>
          <FormField
            label="Registration No"
            htmlFor="registration_no"
            error={errors.registration_no?.message}
          >
            <input id="registration_no" className={inputClass} {...register("registration_no")} />
          </FormField>
        </div>

        <FormField label="Hall" htmlFor="hall_id" error={errors.hall_id?.message}>
          <select id="hall_id" className={inputClass} {...register("hall_id")} defaultValue="">
            <option value="" disabled>
              Select your hall
            </option>
            {halls.map((hall) => (
              <option key={hall.id} value={hall.id}>
                {hall.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Department" htmlFor="department_id" error={errors.department_id?.message}>
          <select id="department_id" className={inputClass} {...register("department_id")} defaultValue="">
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
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Session" htmlFor="session" error={errors.session?.message}>
            <select id="session" className={inputClass} {...register("session")} defaultValue="">
              <option value="" disabled>
                Select session
              </option>
              {sessions.map((s) => (
                <option key={s.session} value={s.session}>
                  {s.session}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Batch" htmlFor="batch">
            <input
              id="batch"
              className={inputClass}
              value={batch ?? ""}
              disabled
              placeholder="Auto-calculated"
            />
          </FormField>
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}
