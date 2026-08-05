"use client";

import { Bookmark, CheckCircle2, MessageSquare, Package, PlusCircle, Star, Store } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { ListingCard } from "@/components/listings/ListingCard";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { getActivity, getDashboardStats } from "@/lib/api/dashboard";
import { getMyListings } from "@/lib/api/listings";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ActivityPoint, DashboardStats, Listing } from "@/types/api";

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  accent,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-2xl border p-4 shadow-[var(--shadow-soft-xs)] transition-all",
        href && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft-md)]",
        accent
          ? "border-emerald-500/25 bg-emerald-500/[0.06]"
          : "border-border bg-card/60 hover:border-emerald-500/30"
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          accent ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [recent, setRecent] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDashboardStats().then(setStats).catch(() => {}),
      getActivity(30).then(setActivity).catch(() => {}),
      getMyListings().then((l) => setRecent(l.slice(0, 4))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-8"
    >
      <motion.div variants={staggerItem} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{user ? `, ${user.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">Here&apos;s how your marketplace activity looks.</p>
        </div>
        <Link href="/listings/new" className={cn(buttonVariants())}>
          <PlusCircle /> New listing
        </Link>
      </motion.div>

      {stats && (
        <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={Package}
            label="Active listings"
            value={stats.active_listings}
            href="/dashboard/listings"
            accent
          />
          <StatCard icon={CheckCircle2} label="Sold" value={stats.sold_listings} />
          <StatCard
            icon={MessageSquare}
            label={stats.unread_messages > 0 ? "Unread messages" : "Conversations"}
            value={stats.unread_messages > 0 ? stats.unread_messages : stats.conversations}
            href="/inbox"
          />
          <StatCard
            icon={Bookmark}
            label="Saved listings"
            value={stats.saved_count}
            href="/dashboard/saved"
          />
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
          {activity.length > 0 ? (
            <ActivityChart data={activity} />
          ) : (
            <p className="text-sm text-muted-foreground">No activity data yet.</p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
          <h2 className="text-sm font-medium">Your seller reputation</h2>
          {stats && stats.rating_count > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums">
                  {stats.average_rating?.toFixed(1)}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="size-4 fill-amber-500 text-amber-500" />
                  from {stats.rating_count} {stats.rating_count === 1 ? "rating" : "ratings"}
                </span>
              </div>
              <Link
                href={user ? `/profile/${user.id}` : "#"}
                className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
              >
                View your public profile →
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No ratings yet. Buyers can rate you after a completed trade.
            </p>
          )}

          {stats && (
            <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-sm">
              <Store className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {stats.shops} {stats.shops === 1 ? "shop" : "shops"}
              </span>
              <Link
                href="/shops/dashboard"
                className="ml-auto text-xs text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Manage →
              </Link>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Recent listings</h2>
          <Link
            href="/dashboard/listings"
            className="text-sm text-emerald-600 hover:underline dark:text-emerald-400"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={Package}
            title="You haven't listed anything yet"
            description="Sell something you no longer need — it takes about a minute."
            action={
              <Link href="/listings/new" className={cn(buttonVariants())}>
                <PlusCircle /> Create your first listing
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recent.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
