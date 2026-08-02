import Link from "next/link";

import { StarRating } from "@/components/ratings/StarRating";
import { mediaUrl } from "@/lib/utils";
import type { Shop } from "@/types/api";

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link
      href={`/shops/${shop.slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center transition hover:border-primary/50 hover:bg-muted/50"
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-muted-foreground">
        {shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(shop.logo_url)} alt="" className="h-full w-full object-cover" />
        ) : (
          shop.shop_name.charAt(0).toUpperCase()
        )}
      </div>
      <p className="truncate text-sm font-medium">{shop.shop_name}</p>
      {shop.shop_type && <p className="text-xs text-muted-foreground">{shop.shop_type}</p>}
      <StarRating value={shop.average_rating} count={shop.rating_count} />
      <p className="text-xs text-muted-foreground">
        {shop.listing_count} listing{shop.listing_count !== 1 ? "s" : ""}
      </p>
    </Link>
  );
}
