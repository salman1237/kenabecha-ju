"use client";

import { Flag } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { selectClass } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/textarea";
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

  if (submitted) return <p className="text-xs text-muted-foreground">Report submitted — thanks for flagging this.</p>;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <Flag className="size-3" />
        Report {targetType}
      </button>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason)}
          className={selectClass}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" rows={2} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={onSubmit}>
            Submit report
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
