"use client";

import { useState } from "react";

import { inputClass } from "@/components/ui/FormField";
import { ApiError } from "@/lib/api/client";
import { createRating } from "@/lib/api/ratings";
import type { Rating } from "@/types/api";

export function RatingForm({
  listingId,
  onSuccess,
}: {
  listingId: string;
  onSuccess: (rating: Rating) => void;
}) {
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (stars === 0) {
      setError("Select a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const rating = await createRating(listingId, stars, reviewText.trim() || undefined);
      onSuccess(rating);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit rating.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm font-medium">Rate this transaction</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHoverStars(n)}
            onMouseLeave={() => setHoverStars(0)}
            className="text-2xl leading-none text-amber-500"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            {(hoverStars || stars) >= n ? "★" : "☆"}
          </button>
        ))}
      </div>
      <textarea
        className={inputClass}
        rows={3}
        placeholder="Optional review…"
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {submitting ? "Submitting…" : "Submit rating"}
      </button>
    </div>
  );
}
