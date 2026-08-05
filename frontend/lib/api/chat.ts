import { apiFetch } from "@/lib/api/client";
import type { Conversation, Message } from "@/types/api";

export function contactSeller(listingId: string) {
  return apiFetch<Conversation>(`/listings/${listingId}/contact`, { method: "POST" });
}

export function getConversations(filters: { shopId?: string; personalOnly?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filters.shopId) params.append("shop_id", filters.shopId);
  if (filters.personalOnly) params.append("personal_only", "true");
  const qs = params.toString();
  return apiFetch<Conversation[]>(`/conversations${qs ? `?${qs}` : ""}`);
}

export function getConversation(id: string) {
  return apiFetch<Conversation>(`/conversations/${id}`);
}

export function getMessages(id: string, before?: string) {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiFetch<Message[]>(`/conversations/${id}/messages${qs}`);
}

export function sendMessage(id: string, content: string) {
  return apiFetch<Message>(`/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function markConversationRead(id: string) {
  return apiFetch<void>(`/conversations/${id}/read`, { method: "POST" });
}

export function sendAttachment(id: string, file: File, caption = "") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("caption", caption);
  return apiFetch<Message>(`/conversations/${id}/attachments`, {
    method: "POST",
    body: formData,
  });
}
