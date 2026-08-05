import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { CONDITION_LABELS, cn, formatPrice } from "@/lib/utils";
import type { Listing } from "@/types/api";

function TopBadge() {
  return (
    <Badge className="absolute left-2 top-2 bg-gradient-to-r from-amber-500 to-emerald-600 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
      ★ TOP
    </Badge>
  );
}

function StatusBadge({ status }: { status: Listing["status"] }) {
  return (
    <Badge variant="secondary" className="absolute right-2 top-2 text-[10px] capitalize">
      {status.replace("_", " ")}
    </Badge>
  );
}

export function ListingCard({
  listing,
  variant = "grid",
}: {
  listing: Listing;
  /** `list` is the horizontal row used by the browse page's list view. */
  variant?: "grid" | "list";
}) {
  const image = listing.images[0];
  const price = formatPrice(listing.price, listing.price_type, listing.unit);

  if (variant === "list") {
    return (
      <Link
        href={`/listings/${listing.id}`}
        className="group flex gap-4 rounded-2xl border border-emerald-500/15 bg-card/60 p-3 shadow-[var(--shadow-soft-xs)] backdrop-blur-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[var(--shadow-soft-md)] dark:border-emerald-400/15 dark:hover:border-emerald-400/40"
      >
        <div className="relative size-28 shrink-0 overflow-hidden rounded-xl sm:size-32">
          <SmartImage
            src={image?.image_url}
            alt={listing.title}
            className="transition-transform duration-500 group-hover:scale-105"
          />
          {listing.is_top && <TopBadge />}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate font-semibold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              {listing.title}
            </p>
            {listing.status !== "active" && (
              <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                {listing.status.replace("_", " ")}
              </Badge>
            )}
          </div>
          <p className="font-bold text-emerald-600 dark:text-emerald-400">{price}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {listing.description}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
            <span>{listing.shop ? "New" : CONDITION_LABELS[listing.condition]}</span>
            <span className="capitalize">{listing.fulfillment_type}</span>
            {listing.shop && <span className="truncate">🏪 {listing.shop.shop_name}</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border border-emerald-500/15 bg-card/60 p-2.5 shadow-[var(--shadow-soft-xs)] backdrop-blur-xs transition-all duration-300",
        "hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[var(--shadow-soft-lg)]",
        "dark:border-emerald-400/15 dark:hover:border-emerald-400/40"
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg">
        <SmartImage
          src={image?.image_url}
          alt={listing.title}
          className="transition-transform duration-500 group-hover:scale-108"
        />
        {listing.is_top && <TopBadge />}
        {listing.status !== "active" && <StatusBadge status={listing.status} />}
      </div>
      <div className="flex flex-col gap-1 px-1 pb-1">
        <p className="truncate text-sm font-semibold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
          {listing.title}
        </p>
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{price}</p>
        {listing.shop && (
          <p className="truncate text-[11px] text-muted-foreground">🏪 {listing.shop.shop_name}</p>
        )}
      </div>
    </Link>
  );
}
