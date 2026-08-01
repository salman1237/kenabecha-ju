import { apiFetch } from "@/lib/api/client";
import type { Department, Hall, SessionOption } from "@/types/api";

export function getHalls() {
  return apiFetch<Hall[]>("/reference/halls");
}

export function getDepartments() {
  return apiFetch<Department[]>("/reference/departments");
}

export function getSessions() {
  return apiFetch<SessionOption[]>("/reference/sessions");
}
