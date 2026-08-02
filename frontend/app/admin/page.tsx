"use client";

import { useEffect, useState } from "react";

import { getAdminStats } from "@/lib/api/admin";
import type { AdminStats } from "@/types/api";

const LABELS: Record<keyof AdminStats, string> = {
  total_users: "Total users",
  total_shops: "Total shops",
  total_active_listings: "Active listings",
  total_messages: "Messages sent",
  pending_reports: "Pending reports",
};

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    getAdminStats().then(setStats);
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      {(Object.keys(LABELS) as (keyof AdminStats)[]).map((key) => (
        <div key={key} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{stats[key]}</p>
          <p className="text-xs text-zinc-500">{LABELS[key]}</p>
        </div>
      ))}
    </div>
  );
}
