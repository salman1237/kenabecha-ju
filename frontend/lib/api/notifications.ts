import { apiFetch } from "@/lib/api/client";
import type { Notification, NotificationList } from "@/types/api";

export function getNotifications() {
  return apiFetch<NotificationList>("/notifications");
}

export function markNotificationRead(id: string) {
  return apiFetch<Notification>(`/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiFetch<void>("/notifications/read-all", { method: "POST" });
}
