"use client";

import { Package, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { SmartImage } from "@/components/ui/SmartImage";
import { getMyListings } from "@/lib/api/listings";
import type { Listing } from "@/types/api";

const MAX_LISTINGS = 20;

export function ListingPicker({
  shopId,
  value,
  onChange,
}: {
  shopId: string | undefined;
  /** Selected listing ids. */
  value: string[];
  onChange: (listingIds: string[]) => void;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!shopId) {
      setListings([]);
      return;
    }
    getMyListings(shopId)
      .then(setListings)
      .catch(() => setListings([]));
  }, [shopId]);

  const byId = useMemo(() => new Map(listings.map((l) => [l.id, l])), [listings]);
  const selected = value.map((id) => byId.get(id)).filter((l): l is Listing => Boolean(l));

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const needle = query.trim().toLowerCase();
    return listings.filter((l) => !value.includes(l.id) && l.title.toLowerCase().includes(needle)).slice(0, 8);
  }, [listings, query, value]);

  const add = (id: string) => {
    if (value.includes(id) || value.length >= MAX_LISTINGS) return;
    onChange([...value, id]);
    setQuery("");
  };

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  if (!shopId) {
    return <p className="text-sm text-muted-foreground">Pick a shop above to link its listings.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((listing) => (
            <div
              key={listing.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card/60 py-1 pl-1 pr-2"
            >
              <div className="size-8 shrink-0 overflow-hidden rounded-lg">
                <SmartImage src={listing.images[0]?.image_url} alt="" sizes="32px" />
              </div>
              <span className="max-w-40 truncate text-xs font-medium">{listing.title}</span>
              <button
                type="button"
                onClick={() => remove(listing.id)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                aria-label={`Unlink ${listing.title}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            value.length >= MAX_LISTINGS
              ? `Max ${MAX_LISTINGS} listings`
              : listings.length === 0
                ? "This shop has no listings yet"
                : "Search your listings to link…"
          }
          disabled={value.length >= MAX_LISTINGS || listings.length === 0}
          className="pl-9"
        />
      </div>

      {results.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-soft-sm)]">
          {results.map((listing) => (
            <button
              type="button"
              key={listing.id}
              onClick={() => add(listing.id)}
              className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-muted"
            >
              <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                <SmartImage
                  src={listing.images[0]?.image_url}
                  alt=""
                  sizes="36px"
                  fallback={<Package className="size-4 text-muted-foreground" />}
                />
              </div>
              <span className="truncate text-sm">{listing.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
