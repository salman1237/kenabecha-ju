import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatPrice, mediaUrl } from "@/lib/utils";
import type { Listing } from "@/types/api";

export function ListingCard({ listing }: { listing: Listing }) {
  const image = listing.images[0];

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col gap-2 rounded-xl border border-emerald-500/15 bg-card/60 p-2.5 backdrop-blur-xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 dark:border-emerald-400/15 dark:hover:border-emerald-400/40"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(image.image_url)}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No photo
          </div>
        )}
        {listing.is_top && (
          <Badge className="absolute left-2 top-2 bg-gradient-to-r from-amber-500 to-emerald-600 text-white shadow-xs text-[10px] uppercase font-bold tracking-wider">
            ★ TOP
          </Badge>
        )}
        {listing.status !== "active" && (
          <Badge variant="secondary" className="absolute right-2 top-2 capitalize text-[10px]">
            {listing.status.replace("_", " ")}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1 px-1 pb-1">
        <p className="truncate text-sm font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {listing.title}
        </p>
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {formatPrice(listing.price, listing.price_type, listing.unit)}
        </p>
        {listing.shop && <p className="truncate text-[11px] text-muted-foreground">🏪 {listing.shop.shop_name}</p>}
      </div>
    </Link>
  );
}
