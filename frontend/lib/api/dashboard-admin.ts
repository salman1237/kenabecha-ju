import { apiFetch } from "@/lib/api/client";
import type { AdminAnnouncement, AdminDashboard, AssistantSettings, BulkResult } from "@/types/api";

export function getAdminDashboard(days: number) {
  return apiFetch<AdminDashboard>(`/admin/dashboard?days=${days}`);
}

export function bulkRemoveListings(ids: string[]) {
  return apiFetch<BulkResult>("/admin/listings/bulk-remove", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function bulkSetListingTop(ids: string[], isTop: boolean) {
  return apiFetch<BulkResult>("/admin/listings/bulk-top", {
    method: "POST",
    body: JSON.stringify({ ids, is_top: isTop }),
  });
}

export function bulkRemoveShops(ids: string[]) {
  return apiFetch<BulkResult>("/admin/shops/bulk-remove", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function getAnnouncement() {
  return apiFetch<AdminAnnouncement>("/admin/announcement");
}

/** Only the keys sent are changed. */
export function setAnnouncement(payload: Partial<AdminAnnouncement>) {
  return apiFetch<AdminAnnouncement>("/admin/announcement", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getAssistantSettings() {
  return apiFetch<AssistantSettings>("/admin/assistant");
}

export function setAssistantSettings(payload: Partial<AssistantSettings>) {
  return apiFetch<AssistantSettings>("/admin/assistant", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
