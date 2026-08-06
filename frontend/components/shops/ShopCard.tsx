"use client";

import { Package, Users } from "lucide-react";
import Link from "next/link";

import { StarRating } from "@/components/ratings/StarRating";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import type { Shop } from "@/types/api";

/**
 * A shop, as it appears in a grid.
 *
 * Replaces a centred stack of plain text. The cover image and follower count
 * were both already available and unused — the cover is what makes a shop
 * recognisable at a glance, and the follower count is the only social proof
 * a shop with no reviews yet can show.
 */
export function ShopCard({ shop }: { shop: Shop }) {
  const { t, fmt } = useLanguage();

  return (
    <Link
      href={`/shops/${shop.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-500/15 bg-card/60",
        "shadow-[var(--shadow-soft-xs)] backdrop-blur-xs transition-all duration-300",
        "hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[var(--shadow-soft-lg)]",
        "dark:border-emerald-400/15 dark:hover:border-emerald-400/40"
      )}
    >
      {/* Cover band. Falls back to a brand gradient rather than an empty grey
          box, so a shop without a cover still reads as designed. */}
      <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-emerald-600/25">
        {shop.cover_url && (
          <SmartImage
            src={shop.cover_url}
            alt=""
            sizes="(max-width: 640px) 100vw, 380px"
            fallback={<span />}
            className="transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>

      <div className="relative flex flex-1 flex-col gap-2 px-4 pb-4">
        {/* Logo straddles the cover edge — the standard storefront cue, and it
            keeps the identity visible even when the cover is busy. */}
        <span className="-mt-8 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-muted text-lg font-bold shadow-sm">
          <SmartImage
            src={shop.logo_url}
            alt=""
            sizes="64px"
            fallback={<span>{shop.shop_name.charAt(0).toUpperCase()}</span>}
          />
        </span>

        <div className="flex flex-col gap-1">
          <p className="truncate font-semibold leading-tight transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
            {shop.shop_name}
          </p>
          {shop.shop_type && (
            <Badge variant="secondary" className="w-fit text-[10px] font-medium">
              {shop.shop_type}
            </Badge>
          )}
        </div>

        {shop.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {shop.description}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <StarRating value={shop.average_rating} count={shop.rating_count} />
          <div className="flex items-center gap-4 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="size-3" />
              {fmt.number(shop.listing_count)} {t.shops.listings}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {fmt.number(shop.follower_count)} {t.shops.followers}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
