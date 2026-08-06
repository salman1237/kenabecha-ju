"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/admin/DataTable";
import { selectClass } from "@/components/ui/FormField";
import { useLanguage } from "@/context/LanguageContext";
import { listAuditActions, listAuditLog } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/types/api";

/** Human labels for the action constants the API records. */
const ACTION_LABELS: Record<string, string> = {
  "user.role_changed": "Role changed",
  "user.deactivated": "User deactivated",
  "user.reactivated": "User reactivated",
  "listing.removed": "Listing removed",
  "listing.top_changed": "Listing top changed",
  "listing.featured": "Listing featured",
  "shop.removed": "Shop removed",
  "report.resolved": "Report resolved",
};

/** Actions that took something away, worth showing differently at a glance. */
const DESTRUCTIVE = new Set([
  "user.deactivated",
  "listing.removed",
  "shop.removed",
]);

export default function AdminAuditPage() {
  const { fmt } = useLanguage();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback((filter: string) => {
    setLoading(true);
    listAuditLog({ action: filter || undefined })
      .then((page) => setEntries(page.items))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(action);
  }, [action, load]);

  useEffect(() => {
    // Read from the data rather than the constants, so the filter only offers
    // actions that would actually return something.
    listAuditActions().then(setActions).catch(() => {});
  }, []);

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "created_at",
      header: "When",
      cell: (e) => (
        <span className="whitespace-nowrap text-muted-foreground">{fmt.dateTime(e.created_at)}</span>
      ),
      sortValue: (e) => e.created_at,
    },
    {
      key: "actor",
      header: "Who",
      cell: (e) => (
        <div className="flex flex-col">
          <span className="font-medium">{e.actor_email}</span>
          <span className="text-xs capitalize text-muted-foreground">{e.actor_role}</span>
        </div>
      ),
      sortValue: (e) => e.actor_email,
    },
    {
      key: "action",
      header: "Action",
      cell: (e) => (
        <Badge variant={DESTRUCTIVE.has(e.action) ? "destructive" : "secondary"}>
          {ACTION_LABELS[e.action] ?? e.action}
        </Badge>
      ),
      sortValue: (e) => e.action,
    },
    {
      key: "target",
      header: "Target",
      cell: (e) => (
        <span className="text-muted-foreground">
          {e.target_label ?? (e.target_id ? e.target_id.slice(0, 8) : "—")}
        </span>
      ),
      sortValue: (e) => e.target_label ?? "",
    },
    {
      key: "detail",
      header: "Detail",
      hideOnMobile: true,
      cell: (e) =>
        e.detail && Object.keys(e.detail).length > 0 ? (
          <span className="font-mono text-xs text-muted-foreground">
            {Object.entries(e.detail)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(" · ")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: () => "",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Every privileged action, oldest preserved. This record cannot be edited or deleted.
          </p>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
          className={cn(selectClass, "h-9 w-56")}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a] ?? a}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        rows={entries}
        columns={columns}
        loading={loading}
        exportName="audit-log"
        emptyTitle="Nothing recorded yet"
        emptyDescription="Privileged actions appear here as they happen."
      />
    </div>
  );
}
