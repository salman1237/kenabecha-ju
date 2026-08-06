"use client";

import { PlusCircle, Search, Store } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { ShopCard } from "@/components/shops/ShopCard";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { selectClass } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getShops } from "@/lib/api/shops";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Shop } from "@/types/api";

type SortKey = "newest" | "rating" | "listings";

/**
 * The shops browse page.
 *
 * There was previously no such route — shops were reachable only from the six
 * shown on the landing page, and the navbar had nowhere to point. Filtering
 * and sorting happen client-side because the API returns the full list and
 * the shop count on a single campus stays small; if that changes this should
 * move to query parameters rather than growing a bigger client-side sort.
 */
export default function ShopsBrowsePage() {
  const { t, fmt } = useLanguage();
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    getShops(100)
      .then(setShops)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? shops.filter(
          (s) =>
            s.shop_name.toLowerCase().includes(needle) ||
            (s.shop_type ?? "").toLowerCase().includes(needle)
        )
      : shops;

    const sorted = [...filtered];
    if (sort === "rating") {
      // Unrated shops sort last rather than as zero, so a brand-new shop
      // isn't ranked below a badly-reviewed one.
      sorted.sort((a, b) => (b.average_rating ?? -1) - (a.average_rating ?? -1));
    } else if (sort === "listings") {
      sorted.sort((a, b) => b.listing_count - a.listing_count);
    } else {
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return sorted;
  }, [shops, q, sort]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{t.shops.browseTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {t.shops.subtitle}
            {!loading && ` — ${fmt.number(visible.length)}`}
          </p>
        </div>
        {user && (
          <Link href="/shops/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
            <PlusCircle /> {t.shops.openYours}
          </Link>
        )}
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.shops.searchPlaceholder}
            aria-label={t.shops.searchPlaceholder}
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label={t.browse.sortBy}
          className={cn(selectClass, "h-11 rounded-xl sm:w-56")}
        >
          <option value="newest">{t.shops.sortNewest}</option>
          <option value="rating">{t.shops.sortRating}</option>
          <option value="listings">{t.shops.sortListings}</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState icon={Store} title={t.browse.failed} description={t.errors.network} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Store}
          title={shops.length === 0 ? t.shops.noShops : t.shops.noResults}
          description={shops.length === 0 ? t.shops.noShopsBody : t.shops.noResultsBody}
        />
      ) : (
        <motion.div
          variants={staggerContainer(0.04)}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((shop) => (
            <motion.div key={shop.id} variants={staggerItem}>
              <ShopCard shop={shop} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
