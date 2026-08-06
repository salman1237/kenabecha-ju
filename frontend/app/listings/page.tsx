"use client";

import { LayoutGrid, List, Loader2, PackageSearch, Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { useLanguage } from "@/context/LanguageContext";
import {
  DEFAULT_FILTERS,
  ListingFilters,
  PRICE_MAX,
  type FilterState,
} from "@/components/listings/ListingFilters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { browseListings } from "@/lib/api/listings";
import { getCategories } from "@/lib/api/categories";
import { trendingTags } from "@/lib/api/tags";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Category, Listing, Tag } from "@/types/api";

const PAGE_SIZE = 24;
type ViewMode = "grid" | "list";

function ResultsSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function BrowseListingsContent() {
  const searchParams = useSearchParams();
  const { t, fmt } = useLanguage();

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const debouncedQ = useDebounce(q, 350);
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    tags: searchParams.getAll("tags").map((t) => t.toLowerCase()),
    category: searchParams.get("category") ?? "",
  }));
  const [view, setView] = useState<ViewMode>("grid");

  const [categories, setCategories] = useState<Category[]>([]);
  const [trending, setTrending] = useState<Tag[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  // Bumped to force a refetch on "Try again" without touching the filters.
  const [reloadKey, setReloadKey] = useState(0);

  // The state initializers above only read the URL once, at mount. Searching
  // from the navbar while already on this page is a client-side navigation —
  // the params change but the component never remounts, so without this the
  // URL would update and the results would not. Depends on primitives rather
  // than the searchParams object so that typing in the on-page search box
  // (which doesn't touch the URL) doesn't get clobbered.
  const urlQ = searchParams.get("q") ?? "";
  const urlCategory = searchParams.get("category") ?? "";
  const urlTags = searchParams.getAll("tags").join(",");
  useEffect(() => {
    setQ(urlQ);
    setFilters((prev) => ({
      ...prev,
      category: urlCategory,
      tags: urlTags ? urlTags.split(",").map((t) => t.toLowerCase()) : [],
    }));
  }, [urlQ, urlCategory, urlTags]);

  useEffect(() => {
    Promise.all([trendingTags(), getCategories()])
      .then(([tags, cats]) => {
        setTrending(tags);
        setCategories(cats);
      })
      .catch(() => {});
  }, []);

  const buildQuery = useCallback(
    (offset: number) => ({
      q: debouncedQ || undefined,
      tags: filters.tags.length ? filters.tags : undefined,
      min_price: filters.price[0] > 0 ? filters.price[0] : undefined,
      // At the top of the slider the max filter is dropped so the range
      // reads as "and above" instead of hiding anything more expensive.
      max_price: filters.price[1] < PRICE_MAX ? filters.price[1] : undefined,
      condition: (filters.condition || undefined) as never,
      category: filters.category || undefined,
      sort: filters.sort,
      limit: PAGE_SIZE,
      offset,
    }),
    [debouncedQ, filters]
  );

  // First page — refetches whenever the query changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    browseListings(buildQuery(0))
      .then((page) => {
        if (cancelled) return;
        setListings(page.items);
        setTotal(page.total);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));

    // Guards against an older, slower request landing after a newer one and
    // overwriting fresher results with stale ones.
    return () => {
      cancelled = true;
    };
  }, [buildQuery, reloadKey]);

  const hasMore = listings.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await browseListings(buildQuery(listings.length));
      // Concatenate by id to stay safe if a sentinel fires twice before
      // state settles — duplicate keys would otherwise crash the list.
      setListings((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...page.items.filter((l) => !seen.has(l.id))];
      });
      setTotal(page.total);
    } catch {
      /* keep what's already rendered; the sentinel can retry on next scroll */
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, hasMore, listings.length, loading, loadingMore]);

  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "400px",
  });

  useEffect(() => {
    if (isIntersecting) loadMore();
  }, [isIntersecting, loadMore]);

  const filterPanel = (
    <ListingFilters
      filters={filters}
      onChange={setFilters}
      categories={categories}
      trending={trending}
    />
  );

  const resultCount = loading ? null : `${fmt.number(total)} ${t.shops.listings}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t.browse.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.browse.subtitleCount}
          {resultCount ? ` — ${resultCount}` : ""}
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sticky desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pb-4">
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Search + view controls */}
          <div className="mb-5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.browse.searchPlaceholder}
                aria-label={t.browse.searchPlaceholder}
                className="h-10 rounded-xl pl-9 shadow-[var(--shadow-soft-xs)]"
              />
            </div>

            {/* Filters live in a sheet below lg, where there's no room for a sidebar */}
            <Sheet>
              <SheetTrigger
                render={<Button variant="outline" className="h-10 shrink-0 rounded-xl lg:hidden" />}
              >
                <SlidersHorizontal /> {t.browse.filters}
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{t.browse.filters}</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-8">{filterPanel}</div>
              </SheetContent>
            </Sheet>

            <div className="hidden items-center gap-1 rounded-xl border border-border p-0.5 sm:flex">
              {([
                ["grid", LayoutGrid, t.browse.gridView],
                ["list", List, t.browse.listView],
              ] as const).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  aria-label={label}
                  aria-pressed={view === mode}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    view === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {failed ? (
            <ErrorState
              title={t.browse.failed}
              description={t.errors.network}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          ) : loading ? (
            <ResultsSkeleton view={view} />
          ) : listings.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title={t.browse.noResults}
              description={t.browse.noResultsBody}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setQ("");
                  }}
                >
                  {t.browse.clearFilters}
                </Button>
              }
            />
          ) : (
            <>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  // Re-keying on view makes the grid/list swap crossfade
                  // instead of snapping between two very different layouts.
                  key={view}
                  variants={staggerContainer(0.03)}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  className={cn(
                    view === "grid"
                      ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
                      : "flex flex-col gap-3"
                  )}
                >
                  {listings.map((listing) => (
                    <motion.div key={listing.id} variants={staggerItem}>
                      <ListingCard listing={listing} variant={view} />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Infinite-scroll sentinel */}
              <div ref={sentinelRef} className="flex h-16 items-center justify-center">
                {loadingMore && (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading more…
                  </span>
                )}
                {!hasMore && listings.length > PAGE_SIZE && (
                  <span className="text-sm text-muted-foreground">
                    That&apos;s everything — {total} listings
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
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
