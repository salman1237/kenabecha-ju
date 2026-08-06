"use client";

import { Package, PlusCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getMyListings, renewListing } from "@/lib/api/listings";
import { getMyShops } from "@/lib/api/shops";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Listing, Shop } from "@/types/api";

const STATUS_FILTER_KEYS = ["all", "active", "sold", "out_of_stock", "expired"] as const;

/** Warn this many days out, so a seller has a chance to renew before the
 *  listing actually drops out of browse rather than after. */
const EXPIRY_WARNING_DAYS = 7;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** A listing card plus the seller-only expiry state and Renew action. */
function SellerListing({ listing, onRenewed }: { listing: Listing; onRenewed: (l: Listing) => void }) {
  const { t, fmt } = useLanguage();
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpired = listing.status === "expired";
  const left = daysUntil(listing.expires_at);
  const expiringSoon =
    !isExpired && listing.status === "active" && left !== null && left <= EXPIRY_WARNING_DAYS;

  const renew = async () => {
    setRenewing(true);
    setError(null);
    try {
      onRenewed(await renewListing(listing.id));
    } catch {
      setError(t.dashboard.renewFailed);
    } finally {
      setRenewing(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <ListingCard listing={listing} />
      {(isExpired || expiringSoon) && (
        <div className="flex flex-col gap-1 px-1">
          <p
            className={cn(
              "text-[11px] font-medium",
              isExpired ? "text-destructive" : "text-amber-600 dark:text-amber-500"
            )}
          >
            {isExpired
              ? t.dashboard.expiredNotice
              : `${t.dashboard.expiresIn} ${fmt.number(left!)} ${
                  left === 1 ? t.dashboard.day : t.dashboard.days
                }`}
          </p>
          <Button size="sm" variant="outline" onClick={renew} disabled={renewing} className="h-7 text-xs">
            <RefreshCw className={cn("size-3", renewing && "animate-spin")} />
            {renewing ? t.dashboard.renewing : t.dashboard.renew}
          </Button>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function MyListingsPage() {
  const { user } = useAuth();
  const { t, fmt } = useLanguage();
  const [personal, setPersonal] = useState<Listing[]>([]);
  const [shopListings, setShopListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    if (!user) return;

    // `/listings/mine` returns personal listings unless a shop_id is given,
    // so shop inventory has to be fetched per shop and merged.
    const load = async () => {
      const [mine, shops] = await Promise.all([
        getMyListings().catch(() => [] as Listing[]),
        getMyShops().catch(() => [] as Shop[]),
      ]);
      setPersonal(mine);

      const perShop = await Promise.all(
        shops.map((s) => getMyListings(s.id).catch(() => [] as Listing[]))
      );
      setShopListings(perShop.flat());
    };

    load().finally(() => setLoading(false));
  }, [user]);

  const all = [...personal, ...shopListings];
  const filtered = status === "all" ? all : all.filter((l) => l.status === status);
  const totalViews = all.reduce((sum, l) => sum + l.view_count, 0);

  // Renewing returns the updated listing; patch it into whichever list it
  // came from rather than refetching every shop's inventory again.
  const applyRenewed = (updated: Listing) => {
    const patch = (rows: Listing[]) => rows.map((r) => (r.id === updated.id ? updated : r));
    setPersonal(patch);
    setShopListings(patch);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6"
    >
      <motion.div variants={staggerItem} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.dashboard.myListings}</h1>
          <p className="text-sm text-muted-foreground">
            {fmt.number(all.length)} {t.dashboard.total} · {fmt.number(personal.length)}{" "}
            {t.dashboard.personal} · {fmt.number(shopListings.length)} {t.dashboard.fromShops}
            {totalViews > 0 &&
              ` · ${fmt.number(totalViews)} ${totalViews === 1 ? t.common.view : t.common.views}`}
          </p>
        </div>
        <Link href="/listings/new" className={cn(buttonVariants())}>
          <PlusCircle /> {t.dashboard.newListing}
        </Link>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {STATUS_FILTER_KEYS.map((key) => {
          const count = key === "all" ? all.length : all.filter((l) => l.status === key).length;
          const label = key === "all" ? t.dashboard.all : t.statuses[key];
          return (
            <button key={key} type="button" onClick={() => setStatus(key)}>
              <Badge
                variant={status === key ? "default" : "outline"}
                className="cursor-pointer transition-colors"
              >
                {label} ({fmt.number(count)})
              </Badge>
            </button>
          );
        })}
      </motion.div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t.dashboard.noListings}
          description={
            status === "all" ? t.dashboard.noListingsBody : t.dashboard.tryAnotherFilter
          }
          action={
            status === "all" ? (
              <Link href="/listings/new" className={cn(buttonVariants())}>
                <PlusCircle /> {t.dashboard.createListing}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <motion.div
          variants={staggerContainer(0.03)}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {filtered.map((l) => (
            <motion.div key={l.id} variants={staggerItem}>
              <SellerListing listing={l} onRenewed={applyRenewed} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
