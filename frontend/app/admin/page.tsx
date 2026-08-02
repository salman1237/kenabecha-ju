"use client";

import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      {(Object.keys(LABELS) as (keyof AdminStats)[]).map((key) => (
        <Card key={key}>
          <CardContent>
            <p className="text-2xl font-semibold">{stats[key]}</p>
            <p className="text-xs text-muted-foreground">{LABELS[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
