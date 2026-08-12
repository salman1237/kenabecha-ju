"use client";

import { AlertTriangle, Eye, MessageSquare, Package, Store, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ActivityChart } from "@/components/admin/ActivityChart";
import { AnnouncementEditor } from "@/components/admin/AnnouncementEditor";
import { AssistantEditor } from "@/components/admin/AssistantEditor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminDashboard } from "@/lib/api/dashboard-admin";
import { cn } from "@/lib/utils";
import type { AdminDashboard, DashboardTotals } from "@/types/api";

const WINDOWS = [7, 30, 90] as const;

const CARDS: {
  total: keyof DashboardTotals;
  delta?: keyof DashboardTotals;
  label: string;
  icon: typeof Users;
  href?: string;
}[] = [
  { total: "total_users", delta: "new_users", label: "Users", icon: Users, href: "/admin/users" },
  {
    total: "total_active_listings",
    delta: "new_listings",
    label: "Active listings",
    icon: Package,
    href: "/admin/listings",
  },
  { total: "total_shops", delta: "new_shops", label: "Shops", icon: Store, href: "/admin/shops" },
  {
    total: "total_messages",
    delta: "new_messages",
    label: "Messages",
    icon: MessageSquare,
  },
  {
    total: "pending_reports",
    label: "Pending reports",
    icon: AlertTriangle,
    href: "/admin/reports",
  },
];

export default function AdminDashboardPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AdminDashboard | null>(null);

  const load = useCallback((window: number) => {
    getAdminDashboard(window)
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => load(days), [days, load]);

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const { totals } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everything below covers the last {data.days} days.
        </p>
        <div className="flex gap-1 rounded-xl border border-border p-1">
          {WINDOWS.map((window) => (
            <Button
              key={window}
              variant={days === window ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setDays(window)}
            >
              {window}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {CARDS.map(({ total, delta, label, icon: Icon, href }) => {
          const alert = total === "pending_reports" && totals[total] > 0;
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
              <span className="text-2xl font-extrabold tabular-nums">{totals[total]}</span>
              <span className="flex flex-wrap items-baseline gap-1.5 text-xs text-muted-foreground">
                {label}
                {/* The delta is what turns a size into a trend. Omitted at
                    zero rather than shown as "+0", which reads as noise. */}
                {delta !== undefined && totals[delta] > 0 && (
                  <span className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                    +{totals[delta]}
                  </span>
                )}
              </span>
            </div>
          );
          return href ? (
            <Link key={total} href={href}>
              {card}
            </Link>
          ) : (
            <div key={total}>{card}</div>
          );
        })}
      </div>

      <ActivityChart series={data.series} />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <AnnouncementEditor />

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
          <h2 className="text-sm font-semibold">Most viewed right now</h2>
          {data.top_listings.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing on sale yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {data.top_listings.map((listing, index) => (
                <li key={listing.id}>
                  <Link
                    href={`/listings/${listing.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{listing.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <Eye className="size-3.5" />
                      {listing.view_count}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}

          {totals.pending_reports > 0 && (
            <Link
              href="/admin/reports"
              className="mt-auto flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {totals.pending_reports} report{totals.pending_reports === 1 ? "" : "s"} awaiting
              review
            </Link>
          )}
        </div>
      </div>

      <AssistantEditor />
    </div>
  );
}
