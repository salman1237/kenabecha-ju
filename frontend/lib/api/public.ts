import { apiFetch } from "@/lib/api/client";
import type { PublicReview, PublicStats } from "@/types/api";

export function getPublicStats() {
  return apiFetch<PublicStats>("/public/stats");
}

export function getRecentReviews(limit = 6) {
  return apiFetch<PublicReview[]>(`/public/reviews?limit=${limit}`);
}

export function subscribeNewsletter(email: string) {
  return apiFetch<void>("/public/newsletter", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
