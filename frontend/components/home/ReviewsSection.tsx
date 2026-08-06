"use client";

import { Quote } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { useLanguage } from "@/context/LanguageContext";
import { StarRating } from "@/components/ratings/StarRating";
import { SmartImage } from "@/components/ui/SmartImage";
import { getRecentReviews } from "@/lib/api/public";
import { hoverLift, revealOnScroll, staggerContainer, staggerItem } from "@/lib/motion";
import { sectionCopy, sectionDefaults } from "@/lib/sectionCopy";
import type { PublicReview } from "@/types/api";

import type { SectionProps } from "./sections/types";

/** `section` is optional so this still renders if mounted outside the
 *  data-driven landing page. */
export function ReviewsSection({ section }: Partial<SectionProps>) {
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("reviews", t));
  const [reviews, setReviews] = useState<PublicReview[]>([]);

  useEffect(() => {
    getRecentReviews(6)
      .then(setReviews)
      .catch(() => {});
  }, []);

  // Real testimonials or nothing — never a placeholder wall.
  if (reviews.length === 0) return null;

  return (
    <motion.section
      variants={staggerContainer(0.07)}
      {...revealOnScroll}
      className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
    >
      <motion.div variants={staggerItem} className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">{copy("title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {copy("subtitle")}
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <motion.div key={review.id} variants={staggerItem} {...hoverLift}>
            <Link
              href={review.target_url}
              className="flex h-full flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-5 shadow-[var(--shadow-soft-xs)] backdrop-blur-xs transition-colors hover:border-emerald-500/40 hover:shadow-[var(--shadow-soft-md)] dark:hover:border-emerald-400/40"
            >
              <div className="flex items-center justify-between gap-2">
                <StarRating value={review.stars} />
                <Quote className="size-4 shrink-0 text-emerald-500/40" />
              </div>

              <p className="flex-1 text-sm leading-relaxed text-foreground/90">
                &ldquo;{review.review_text}&rdquo;
              </p>

              <div className="flex items-center gap-2.5 border-t border-border/60 pt-3">
                <div className="size-8 shrink-0 overflow-hidden rounded-full">
                  <SmartImage
                    src={review.rater.avatar_url}
                    alt=""
                    fallback={
                      <span className="text-xs font-semibold">
                        {review.rater.full_name.charAt(0).toUpperCase()}
                      </span>
                    }
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{review.rater.full_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    on {review.target_name}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
