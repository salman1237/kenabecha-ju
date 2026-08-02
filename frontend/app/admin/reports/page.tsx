"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  const load = () => {
    setLoading(true);
    listAdminReports(statusFilter === "all" ? undefined : statusFilter)
      .then(setReports)
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const onResolve = async (report: Report, action: "dismiss" | "remove" | "warn" | "ban") => {
    const noteMap = { dismiss: "Not a violation", remove: "Removed per policy", warn: "Warned user", ban: "Banned user" };
    const confirmMsg = action === "ban" ? "Ban the responsible user? This revokes all their active sessions." : `Resolve as "${action}"?`;
    if (!confirm(confirmMsg)) return;
    setError(null);
    try {
      await resolveReport(report.id, action, noteMap[action]);
      load();
    } catch {
      setError("Could not resolve report.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              statusFilter === opt.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-zinc-500">No reports here.</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {reports.map((report) => {
            const href = targetHref(report);
            return (
              <div key={report.id} className="flex flex-col gap-2 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {report.target_type}
                    </span>
                    {href ? (
                      <Link href={href} className="font-medium hover:underline">
                        {report.target_label}
                      </Link>
                    ) : (
                      <span className="font-medium">{report.target_label}</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">{new Date(report.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Reported by {report.reporter.full_name} for <span className="font-medium">{report.reason_code}</span>
                  {report.note && `: "${report.note}"`}
                </p>
                {report.status === "pending" ? (
                  <div className="flex gap-3">
                    <button onClick={() => onResolve(report, "dismiss")} className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                      Dismiss
                    </button>
                    {(report.target_type === "listing" || report.target_type === "shop") && (
                      <button onClick={() => onResolve(report, "remove")} className="text-xs font-medium text-amber-600 hover:text-amber-700">
                        Remove content
                      </button>
                    )}
                    <button onClick={() => onResolve(report, "warn")} className="text-xs font-medium text-amber-600 hover:text-amber-700">
                      Warn user
                    </button>
                    <button onClick={() => onResolve(report, "ban")} className="text-xs font-medium text-red-600 hover:text-red-700">
                      Ban user
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Resolved ({report.status.replace("resolved_", "")}) by {report.resolved_by?.full_name}
                    {report.resolution_note && ` — ${report.resolution_note}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
