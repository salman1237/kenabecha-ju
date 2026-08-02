import { apiFetch } from "@/lib/api/client";
import type { ReportReason, ReportTargetType } from "@/types/api";

export function createReport(targetType: ReportTargetType, targetId: string, reasonCode: ReportReason, note?: string) {
  return apiFetch<{ detail: string }>("/reports", {
    method: "POST",
    body: JSON.stringify({ target_type: targetType, target_id: targetId, reason_code: reasonCode, note: note || null }),
  });
}
