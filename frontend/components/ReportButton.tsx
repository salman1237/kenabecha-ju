"use client";

import { useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { createReport } from "@/lib/api/reports";
import type { ReportReason, ReportTargetType } from "@/types/api";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "scam_fraud", label: "Scam or fraud" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "counterfeit", label: "Counterfeit item" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

export function ReportButton({ targetType, targetId }: { targetType: ReportTargetType; targetId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.id === targetId) return null;

  const onSubmit = async () => {
    setError(null);
    try {
      await createReport(targetType, targetId, reason, note || undefined);
      setSubmitted(true);
    } catch {
      setError("Could not submit report.");
    }
  };

  if (submitted) return <p className="text-xs text-zinc-500">Report submitted — thanks for flagging this.</p>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-zinc-400 hover:text-red-600">
        Report {targetType}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note…"
        rows={2}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSubmit} className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">
          Submit report
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-zinc-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
