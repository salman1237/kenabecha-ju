"use client";

import { Package, PlusCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { getMyListings } from "@/lib/api/listings";
import { getMyShops } from "@/lib/api/shops";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Listing, Shop } from "@/types/api";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "sold", label: "Sold" },
  { key: "out_of_stock", label: "Out of stock" },
] as const;

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
              <ListingCard listing={l} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
