"use client";

import { ArrowDown, ArrowUp, Bell, Package, PlusCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ListingCard } from "@/components/listings/ListingCard";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable-list";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getMyListings, renewListing, reorderListings } from "@/lib/api/listings";
import { getMyShops } from "@/lib/api/shops";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn, mediaUrl } from "@/lib/utils";
import type { Listing, Shop } from "@/types/api";

const STATUS_FILTER_KEYS = ["all", "active", "sold", "out_of_stock", "paused", "expired"] as const;

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
      {listing.status === "out_of_stock" && (listing.restock_request_count ?? 0) > 0 && (
        <p className="flex items-center gap-1 px-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <Bell className="size-3" />
          {fmt.number(listing.restock_request_count ?? 0)}{" "}
          {listing.restock_request_count === 1
            ? t.dashboard.restockRequest
            : t.dashboard.restockRequests}
        </p>
      )}
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

/** One shop's inventory, reorderable. Only offered for a single shop with no
 *  status filter applied — the API demands every one of the shop's listings
 *  in the order, so reordering a filtered-down subset can't be expressed. */
function ReorderableShopListings({
  shopId,
  listings,
  onReordered,
}: {
  shopId: string;
  listings: Listing[];
  onReordered: (updated: Listing[]) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const ordered = [...listings].sort((a, b) => a.sort_order - b.sort_order);

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    await applyOrder(next.map((l) => l.id));
  };

  const applyOrder = async (nextIds: string[]) => {
    setBusy(true);
    try {
      onReordered(await reorderListings(shopId, nextIds));
    } catch {
      toast.error(t.dashboard.reorderFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SortableList
      ids={ordered.map((l) => l.id)}
      onReorder={applyOrder}
      disabled={busy}
      className="flex flex-col gap-2"
    >
      {ordered.map((listing, index) => {
        const image = listing.images[0];
        return (
          <SortableItem
            key={listing.id}
            id={listing.id}
            disabled={busy}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
          >
            <DragHandle />
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t.listingForm.moveLeft}
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t.listingForm.moveRight}
                disabled={busy || index === ordered.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </div>

            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(image.image_url)}
                alt=""
                className="size-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Package className="size-4 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`/listings/${listing.id}`}
                className="block truncate text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                {listing.title}
              </Link>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Badge variant={listing.status === "active" ? "secondary" : "outline"} className="text-[11px]">
                  {t.statuses[listing.status]}
                </Badge>
                {listing.status === "out_of_stock" && (listing.restock_request_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <Bell className="size-3" />
                    {listing.restock_request_count}
                  </span>
                )}
              </div>
            </div>
          </SortableItem>
        );
      })}
    </SortableList>
  );
}

export default function MyListingsPage() {
  const { user } = useAuth();
  const { t, fmt } = useLanguage();
  const [personal, setPersonal] = useState<Listing[]>([]);
  const [shopListings, setShopListings] = useState<Listing[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  // "all" merges everything (the original view); "personal" and a shop id
  // narrow to one source, which is also what unlocks manual reordering —
  // an "all shops" order has no single owner to resolve conflicts.
  const [shopFilter, setShopFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [mine, myShops] = await Promise.all([
        getMyListings().catch(() => [] as Listing[]),
        getMyShops().catch(() => [] as Shop[]),
      ]);
      setPersonal(mine);
      setShops(myShops);

      const perShop = await Promise.all(
        myShops.map((s) => getMyListings(s.id).catch(() => [] as Listing[]))
      );
      setShopListings(perShop.flat());
    };

    load().finally(() => setLoading(false));
  }, [user]);

  const all = [...personal, ...shopListings];
  const bySource =
    shopFilter === "all"
      ? all
      : shopFilter === "personal"
        ? personal
        : shopListings.filter((l) => l.shop?.id === shopFilter);
  const filtered = status === "all" ? bySource : bySource.filter((l) => l.status === status);
  const totalViews = all.reduce((sum, l) => sum + l.view_count, 0);

  // Renewing (or reordering) returns the updated listing(s); patch them into
  // whichever list they came from rather than refetching every shop's
  // inventory again.
  const patchListings = (updated: Listing[]) => {
    const byId = new Map(updated.map((l) => [l.id, l]));
    const patch = (rows: Listing[]) => rows.map((r) => byId.get(r.id) ?? r);
    setPersonal(patch);
    setShopListings(patch);
  };

  const showReorder = status === "all" && shopFilter !== "all" && shopFilter !== "personal";

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

      {shops.length > 0 && (
        <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
          {[
            { key: "all", label: t.dashboard.all },
            { key: "personal", label: t.dashboard.personal },
            ...shops.map((s) => ({ key: s.id, label: s.shop_name })),
          ].map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setShopFilter(key)}>
              <Badge
                variant={shopFilter === key ? "default" : "outline"}
                className="cursor-pointer transition-colors"
              >
                {label}
              </Badge>
            </button>
          ))}
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
        {STATUS_FILTER_KEYS.map((key) => {
          const count = key === "all" ? bySource.length : bySource.filter((l) => l.status === key).length;
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
      ) : showReorder ? (
        <motion.div variants={staggerItem} className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{t.dashboard.reorderHint}</p>
          <ReorderableShopListings
            shopId={shopFilter}
            listings={filtered}
            onReordered={patchListings}
          />
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer(0.03)}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {filtered.map((l) => (
            <motion.div key={l.id} variants={staggerItem}>
              <SellerListing listing={l} onRenewed={(updated) => patchListings([updated])} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
