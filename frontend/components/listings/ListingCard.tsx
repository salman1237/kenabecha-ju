import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatPrice, mediaUrl } from "@/lib/utils";
import type { Listing } from "@/types/api";

export function ListingCard({ listing }: { listing: Listing }) {
  const image = listing.images[0];

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col gap-2 rounded-lg border border-border p-2 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(image.image_url)}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No photo
          </div>
        )}
        {listing.status !== "active" && (
          <Badge variant="secondary" className="absolute right-1.5 top-1.5 capitalize">
            {listing.status.replace("_", " ")}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-1 pb-1">
        <p className="truncate text-sm font-medium">{listing.title}</p>
        <p className="text-sm text-muted-foreground">{formatPrice(listing.price, listing.price_type)}</p>
        {listing.shop && <p className="truncate text-xs text-muted-foreground">{listing.shop.shop_name}</p>}
      </div>
    </Link>
  );
}
