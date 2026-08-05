import { apiFetch } from "@/lib/api/client";
import type { ActivityPoint, DashboardStats, Listing } from "@/types/api";

export function getDashboardStats() {
  return apiFetch<DashboardStats>("/dashboard/stats");
}

export function getActivity(days = 30) {
  return apiFetch<ActivityPoint[]>(`/dashboard/activity?days=${days}`);
}

export function getSavedListings() {
  return apiFetch<Listing[]>("/dashboard/saved");
}

export function getSavedIds() {
  return apiFetch<string[]>("/dashboard/saved/ids");
}

export function toggleSaved(listingId: string) {
  return apiFetch<{ saved: boolean }>(`/dashboard/saved/${listingId}`, { method: "POST" });
}
