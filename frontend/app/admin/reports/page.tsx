"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listAdminReports, resolveReport } from "@/lib/api/admin";
import type { Report, ReportStatus } from "@/types/api";

const STATUS_OPTIONS: { value: ReportStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
  { value: "resolved_dismissed", label: "Dismissed" },
  { value: "resolved_removed", label: "Removed" },
  { value: "resolved_warned", label: "Warned" },
  { value: "resolved_banned", label: "Banned" },
];

type Action = "dismiss" | "remove" | "warn" | "ban";

const ACTION_COPY: Record<Action, { note: string; confirm: string; destructive: boolean }> = {
  dismiss: { note: "Not a violation", confirm: 'Resolve as "dismiss"?', destructive: false },
  remove: { note: "Removed per policy", confirm: "Remove the reported content?", destructive: true },
  warn: { note: "Warned user", confirm: "Warn the responsible user?", destructive: false },
  ban: { note: "Banned user", confirm: "Ban the responsible user? This revokes all their active sessions.", destructive: true },
};

const targetHref = (report: Report) => {
  if (report.target_type === "listing") return `/listings/${report.target_id}`;
  if (report.target_type === "user") return `/profile/${report.target_id}`;
  return null;
};

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("pending");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ report: Report; action: Action } | null>(null);

  useEffect(() => {
    listAdminReports(statusFilter === "all" ? undefined : statusFilter)
      .then(setReports)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const onConfirm = async () => {
    if (!pending) return;
    const { report, action } = pending;
    setError(null);
    try {
      await resolveReport(report.id, action, ACTION_COPY[action].note);
      setPending(null);
      load();
    } catch {
      setError("Could not resolve report.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button type="button" key={opt.value} onClick={() => setStatusFilter(opt.value)}>
            <Badge variant={statusFilter === opt.value ? "default" : "outline"} className="cursor-pointer">
              {opt.label}
            </Badge>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports here.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {reports.map((report) => {
            const href = targetHref(report);
            return (
              <div key={report.id} className="flex flex-col gap-2 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="capitalize">
                      {report.target_type}
                    </Badge>
                    {href ? (
                      <Link href={href} className="font-medium hover:underline">
                        {report.target_label}
                      </Link>
                    ) : (
                      <span className="font-medium">{report.target_label}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Reported by {report.reporter.full_name} for <span className="font-medium">{report.reason_code}</span>
                  {report.note && `: "${report.note}"`}
                </p>
                {report.status === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPending({ report, action: "dismiss" })}>
                      Dismiss
                    </Button>
                    {(report.target_type === "listing" || report.target_type === "shop") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 dark:text-amber-400"
                        onClick={() => setPending({ report, action: "remove" })}
                      >
                        Remove content
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-amber-600 dark:text-amber-400"
                      onClick={() => setPending({ report, action: "warn" })}
                    >
                      Warn user
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setPending({ report, action: "ban" })}
                    >
                      Ban user
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Resolved ({report.status.replace("resolved_", "")}) by {report.resolved_by?.full_name}
                    {report.resolution_note && ` — ${report.resolution_note}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending && ACTION_COPY[pending.action].confirm}</AlertDialogTitle>
            <AlertDialogDescription>
              Target: {pending?.report.target_label}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              variant={pending && ACTION_COPY[pending.action].destructive ? "destructive" : "default"}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
