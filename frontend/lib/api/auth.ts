import { apiFetch } from "@/lib/api/client";
import type { User } from "@/types/api";

export interface SignupPayload {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  student_id: string;
  registration_no: string;
  hall_id: string;
  department_id: string;
  session: string;
}

export interface CompleteProfilePayload {
  phone: string;
  student_id: string;
  registration_no: string;
  hall_id: string;
  department_id: string;
  session: string;
}

export function signup(payload: SignupPayload) {
  return apiFetch<User>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithGoogle(credential: string) {
  return apiFetch<User>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function completeProfile(payload: CompleteProfilePayload) {
  return apiFetch<User>("/auth/complete-profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(email: string, otp: string) {
  return apiFetch<User>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
}

export function resendOtp(email: string) {
  return apiFetch<void>("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function login(email: string, password: string) {
  return apiFetch<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function me() {
  return apiFetch<User>("/auth/me");
}

export function forgotPassword(email: string) {
  return apiFetch<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiFetch<void>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
