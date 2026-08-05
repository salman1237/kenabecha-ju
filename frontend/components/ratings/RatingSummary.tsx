"use client";

import { Star } from "lucide-react";
import { motion } from "motion/react";

import { StarRating } from "@/components/ratings/StarRating";
import { SmartImage } from "@/components/ui/SmartImage";
import type { SellerReviews } from "@/types/api";

/**
 * Aggregate score + 5→1 distribution bars + the written reviews. Previously
 * the detail page showed only a bare rating form with no way to see what
 * anyone had actually said.
 */
export function RatingSummary({ data }: { data: SellerReviews }) {
  const { average_rating, rating_count, breakdown, reviews } = data;

  if (rating_count === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No ratings yet for {data.target_name}. Be the first after a completed trade.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Headline score */}
        <div className="flex shrink-0 flex-col items-center gap-1 sm:w-36">
          <span className="text-4xl font-extrabold tabular-nums">
            {average_rating?.toFixed(1)}
          </span>
          <StarRating value={average_rating} size="md" />
          <span className="text-xs text-muted-foreground">
            {rating_count} {rating_count === 1 ? "rating" : "ratings"}
          </span>
        </div>

        {/* Distribution */}
        <div className="flex flex-1 flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = breakdown[String(star)] ?? 0;
            const pct = rating_count > 0 ? (count / rating_count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="flex w-8 shrink-0 items-center gap-0.5 tabular-nums text-muted-foreground">
                  {star}
                  <Star className="size-3 fill-amber-500 text-amber-500" />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-amber-500"
                  />
                </div>
                <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Written reviews */}
      {reviews.length > 0 && (
        <div className="flex flex-col divide-y divide-border border-t border-border">
          {reviews.map((r) => (
            <div key={r.id} className="flex gap-3 py-4">
              <div className="size-8 shrink-0 overflow-hidden rounded-full">
                <SmartImage
                  src={r.rater.avatar_url}
                  alt=""
                  fallback={
                    <span className="text-xs font-semibold">
                      {r.rater.full_name.charAt(0).toUpperCase()}
                    </span>
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.rater.full_name}</span>
                  <StarRating value={r.stars} />
                </div>
                {r.review_text && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {r.review_text}
                  </p>
                )}
                <span className="mt-1 block text-[11px] text-muted-foreground/70">
                  {new Date(r.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
