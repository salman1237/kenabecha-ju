"use client";

import { AlertTriangle, MessageSquare, Package, Store, Users } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getAdminStats } from "@/lib/api/admin";
import { getPublicStats } from "@/lib/api/public";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { AdminStats } from "@/types/api";

const CARDS = [
  { key: "total_users", label: "Total users", icon: Users, href: "/admin/users" },
  { key: "total_active_listings", label: "Active listings", icon: Package, href: "/admin/listings" },
  { key: "total_shops", label: "Total shops", icon: Store, href: "/admin/shops" },
  { key: "total_messages", label: "Messages sent", icon: MessageSquare, href: undefined },
  { key: "pending_reports", label: "Pending reports", icon: AlertTriangle, href: "/admin/reports" },
] as const;

/**
 * Horizontal bars scaled against the largest figure. The five headline
 * numbers differ wildly in magnitude, so relative size communicates far
 * more than five bare numerals side by side.
 */
function CompositionChart({ stats }: { stats: AdminStats }) {
  const rows = CARDS.map((c) => ({ label: c.label, value: stats[c.key] }));
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
      <h2 className="text-sm font-semibold">Platform composition</h2>
      <div className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <div key={r.label} className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 text-muted-foreground">{r.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "h-full rounded-full",
                  r.label === "Pending reports" && r.value > 0
                    ? "bg-destructive"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                )}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-medium tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ratings, setRatings] = useState<number | null>(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
    getPublicStats()
      .then((s) => setRatings(s.total_ratings))
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
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
      <motion.div
        variants={staggerItem}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
      >
        {CARDS.map(({ key, label, icon: Icon, href }) => {
          const alert = key === "pending_reports" && stats[key] > 0;
          const card = (
            <div
              className={cn(
                "flex h-full flex-col gap-2 rounded-2xl border p-4 shadow-[var(--shadow-soft-xs)] transition-all",
                href && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft-md)]",
                alert
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-card/60 hover:border-emerald-500/30"
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl",
                  alert
                    ? "bg-destructive/10 text-destructive"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-2xl font-extrabold tabular-nums">{stats[key]}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          );
          return href ? (
            <Link key={key} href={href}>
              {card}
            </Link>
          ) : (
            <div key={key}>{card}</div>
          );
        })}
      </motion.div>

      <motion.div variants={staggerItem} className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CompositionChart stats={stats} />

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
          <h2 className="text-sm font-semibold">At a glance</h2>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Listings per shop</dt>
              <dd className="font-medium tabular-nums">
                {stats.total_shops > 0
                  ? (stats.total_active_listings / stats.total_shops).toFixed(1)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Messages per user</dt>
              <dd className="font-medium tabular-nums">
                {stats.total_users > 0 ? (stats.total_messages / stats.total_users).toFixed(1) : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ratings given</dt>
              <dd className="font-medium tabular-nums">{ratings ?? "—"}</dd>
            </div>
          </dl>

          {stats.pending_reports > 0 && (
            <Link
              href="/admin/reports"
              className="mt-auto flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {stats.pending_reports} report{stats.pending_reports === 1 ? "" : "s"} awaiting review
            </Link>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
