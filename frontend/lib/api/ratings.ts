import { apiFetch } from "@/lib/api/client";
import type { Rating, RatingEligibility } from "@/types/api";

export function getRatingEligibility(listingId: string) {
  return apiFetch<RatingEligibility>(`/listings/${listingId}/rating-eligibility`);
}

export function createRating(listingId: string, stars: number, reviewText?: string) {
  return apiFetch<Rating>(`/listings/${listingId}/ratings`, {
    method: "POST",
    body: JSON.stringify({ stars, review_text: reviewText || null }),
  });
}
