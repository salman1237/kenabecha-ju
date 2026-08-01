import Link from "next/link";

import { formatPrice, mediaUrl } from "@/lib/utils";
import type { Listing } from "@/types/api";

export function ListingCard({ listing }: { listing: Listing }) {
  const image = listing.images[0];

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-2 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="aspect-square w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(image.image_url)} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No photo</div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-1 pb-1">
        <p className="truncate text-sm font-medium">{listing.title}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatPrice(listing.price, listing.price_type)}
        </p>
        {listing.shop && <p className="truncate text-xs text-zinc-500">{listing.shop.shop_name}</p>}
      </div>
    </Link>
  );
}
