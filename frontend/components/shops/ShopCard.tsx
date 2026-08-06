"use client";

import Link from "next/link";

import { useLanguage } from "@/context/LanguageContext";
import { StarRating } from "@/components/ratings/StarRating";
import { SmartImage } from "@/components/ui/SmartImage";
import type { Shop } from "@/types/api";

export function ShopCard({ shop }: { shop: Shop }) {
  const { t, fmt } = useLanguage();
  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition hover:border-primary/50 hover:bg-muted/50"
    >
      <div className="size-14 overflow-hidden rounded-full">
        <SmartImage
          src={shop.logo_url}
          alt=""
          sizes="56px"
          fallback={
            <span className="text-lg font-semibold">{shop.shop_name.charAt(0).toUpperCase()}</span>
          }
        />
      </div>
      <p className="truncate text-sm font-medium">{shop.shop_name}</p>
      {shop.shop_type && <p className="text-xs text-muted-foreground">{shop.shop_type}</p>}
      <StarRating value={shop.average_rating} count={shop.rating_count} />
      <p className="text-xs text-muted-foreground">
        {fmt.number(shop.listing_count)} {t.shops.listings}
      </p>
    </Link>
  );
}
