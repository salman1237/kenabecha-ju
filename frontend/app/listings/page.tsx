"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { Badge } from "@/components/ui/badge";
import { selectClass } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { browseListings, type BrowseFilters } from "@/lib/api/listings";
import { trendingTags } from "@/lib/api/tags";
import { cn, CONDITION_LABELS } from "@/lib/utils";
import type { Listing, Tag } from "@/types/api";

const PAGE_SIZE = 24;

function BrowseListingsContent() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(() => searchParams.get("q") ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    searchParams.getAll("tags").map((t) => t.toLowerCase())
  );
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [sort, setSort] = useState<BrowseFilters["sort"]>("newest");
  const [offset, setOffset] = useState(0);

  const [trending, setTrending] = useState<Tag[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trendingTags().then(setTrending).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, selectedTags, minPrice, maxPrice, condition, sort]);

  useEffect(() => {
    setLoading(true);
    browseListings({
      q: debouncedQ || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
      condition: (condition as BrowseFilters["condition"]) || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    })
      .then((page) => {
        setListings(page.items);
        setTotal(page.total);
      })
      .finally(() => setLoading(false));
  }, [debouncedQ, selectedTags, minPrice, maxPrice, condition, sort, offset]);

  const toggleTag = (name: string) => {
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Browse listings</h1>

      <div className="flex flex-col gap-4">
        <Input placeholder="Search by title or description…" value={q} onChange={(e) => setQ(e.target.value)} />

        {trending.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trending.map((tag) => {
              const active = selectedTags.includes(tag.name.toLowerCase());
              return (
                <button type="button" key={tag.id} onClick={() => toggleTag(tag.name.toLowerCase())}>
                  <Badge variant={active ? "default" : "outline"} className="cursor-pointer">
                    {tag.name}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Min price</Label>
            <Input
              type="number"
              className="w-24"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Max price</Label>
            <Input
              type="number"
              className="w-24"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Condition</Label>
            <select className={cn(selectClass, "w-40")} value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Any</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Sort by</Label>
            <select
              className={cn(selectClass, "w-44")}
              value={sort}
              onChange={(e) => setSort(e.target.value as BrowseFilters["sort"])}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-md" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No listings match your filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Previous
            </Button>
            <span>
              {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function BrowseListingsPage() {
  return (
    <Suspense>
      <BrowseListingsContent />
    </Suspense>
  );
}
