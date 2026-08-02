import { apiFetch } from "@/lib/api/client";
import type { UserProfile } from "@/types/api";

export function getUserProfile(userId: string) {
  return apiFetch<UserProfile>(`/users/${userId}`);
}
