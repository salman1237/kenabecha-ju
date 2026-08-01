"use client";

import { useEffect, useState } from "react";

import { inputClass } from "@/components/ui/FormField";
import { ListingCard } from "@/components/listings/ListingCard";
import { browseListings, type BrowseFilters } from "@/lib/api/listings";
import { trendingTags } from "@/lib/api/tags";
import { CONDITION_LABELS } from "@/lib/utils";
import type { Listing, Tag } from "@/types/api";

const PAGE_SIZE = 24;

export default function BrowseListingsPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Browse listings</h1>

      <div className="flex flex-col gap-4">
        <input
          className={inputClass}
          placeholder="Search by title or description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {trending.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trending.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.name.toLowerCase())}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  selectedTags.includes(tag.name.toLowerCase())
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Min price</label>
            <input
              type="number"
              className={`${inputClass} w-28`}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Max price</label>
            <input
              type="number"
              className={`${inputClass} w-28`}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Condition</label>
            <select className={inputClass} value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Any</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Sort by</label>
            <select
              className={inputClass}
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
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-zinc-500">No listings match your filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="disabled:opacity-40"
            >
              ← Previous
            </button>
            <span>
              {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
