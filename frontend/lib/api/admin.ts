import { apiFetch } from "@/lib/api/client";
import type { AdminStats, AdminUser, AuditLogEntry, Listing, Page, Report, ReportStatus, Shop, UserRole } from "@/types/api";

export function getAdminStats() {
  return apiFetch<AdminStats>("/admin/stats");
}

export function listAdminUsers(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<Page<AdminUser>>(`/admin/users${qs}`);
}

export function setUserActive(userId: string, isActive: boolean) {
  return apiFetch<AdminUser>(`/admin/users/${userId}/active?is_active=${isActive}`, { method: "PATCH" });
}

/** Grant or revoke moderator/admin. The API refuses a change to your own role
 *  and refuses to demote the last active admin. */
export function setUserRole(userId: string, role: UserRole) {
  return apiFetch<AdminUser>(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function listAdminListings() {
  return apiFetch<Page<Listing>>("/admin/listings");
}

export function removeAdminListing(listingId: string) {
  return apiFetch<Listing>(`/admin/listings/${listingId}`, { method: "DELETE" });
}

export function listAdminShops() {
  return apiFetch<Page<Shop>>("/admin/shops");
}

export function removeAdminShop(shopId: string) {
  return apiFetch<Shop>(`/admin/shops/${shopId}`, { method: "DELETE" });
}

export function listAdminReports(status?: ReportStatus) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<Report[]>(`/admin/reports${qs}`);
}

export function resolveReport(reportId: string, action: "dismiss" | "remove" | "warn" | "ban", resolutionNote?: string) {
  return apiFetch<Report>(`/admin/reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, resolution_note: resolutionNote || null }),
  });
}


/** Read-only by design — there is no create, update or delete counterpart. */
export function listAuditLog(params: { actorId?: string; action?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.actorId) q.set("actor_id", params.actorId);
  if (params.action) q.set("action", params.action);
  q.set("limit", String(params.limit ?? 100));
  return apiFetch<Page<AuditLogEntry>>(`/admin/audit?${q}`);
}

export function listAuditActions() {
  return apiFetch<string[]>("/admin/audit/actions");
}
