"use client";

import { Star } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Rate this transaction</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              onMouseEnter={() => setHoverStars(n)}
              onMouseLeave={() => setHoverStars(0)}
              className="p-0.5"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Star
                className={cn(
                  "size-6 transition-colors",
                  (hoverStars || stars) >= n ? "fill-amber-500 text-amber-500" : "fill-none text-muted-foreground/40"
                )}
              />
            </button>
          ))}
        </div>
        <Textarea rows={3} placeholder="Optional review…" value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={onSubmit} disabled={submitting} className="self-start">
          {submitting ? "Submitting…" : "Submit rating"}
        </Button>
      </CardContent>
    </Card>
  );
}
