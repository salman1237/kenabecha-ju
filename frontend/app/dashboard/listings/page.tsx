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
import { getMyListings, renewListing } from "@/lib/api/listings";
import { getMyShops } from "@/lib/api/shops";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Listing, Shop } from "@/types/api";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "sold", label: "Sold" },
  { key: "out_of_stock", label: "Out of stock" },
  { key: "expired", label: "Expired" },
] as const;

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
      setError("Could not renew — try again.");
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
              ? "Expired — not visible to buyers"
              : `Expires in ${left} day${left === 1 ? "" : "s"}`}
          </p>
          <Button size="sm" variant="outline" onClick={renew} disabled={renewing} className="h-7 text-xs">
            <RefreshCw className={cn("size-3", renewing && "animate-spin")} />
            {renewing ? "Renewing…" : "Renew for 30 days"}
          </Button>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function MyListingsPage() {
  const { user } = useAuth();
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
          <h1 className="text-2xl font-bold tracking-tight">My listings</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} total · {personal.length} personal · {shopListings.length} from shops
            {totalViews > 0 && ` · ${totalViews} view${totalViews === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link href="/listings/new" className={cn(buttonVariants())}>
          <PlusCircle /> New listing
        </Link>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.key === "all" ? all.length : all.filter((l) => l.status === f.key).length;
          return (
            <button key={f.key} type="button" onClick={() => setStatus(f.key)}>
              <Badge
                variant={status === f.key ? "default" : "outline"}
                className="cursor-pointer transition-colors"
              >
                {f.label} ({count})
              </Badge>
            </button>
          );
        })}
      </motion.div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={status === "all" ? "No listings yet" : `No ${status.replace("_", " ")} listings`}
          description={
            status === "all"
              ? "Anything you list — personal or through a shop — shows up here."
              : "Try a different status filter."
          }
          action={
            status === "all" ? (
              <Link href="/listings/new" className={cn(buttonVariants())}>
                <PlusCircle /> Create a listing
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
