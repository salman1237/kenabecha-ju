import { apiFetch } from "@/lib/api/client";
import type { Rating, Shop, ShopCollaborator, ShopInvite, ShopStats } from "@/types/api";

export interface ShopPayload {
  shop_name: string;
  description?: string;
  shop_type?: string;
}

export function createShop(payload: ShopPayload) {
  return apiFetch<Shop>("/shops", { method: "POST", body: JSON.stringify(payload) });
}

export function getMyShops() {
  return apiFetch<Shop[]>("/shops/mine");
}

export function getShops(limit: number = 6) {
  return apiFetch<Shop[]>(`/shops?limit=${limit}`);
}

export function getShopBySlug(slug: string) {
  return apiFetch<Shop>(`/shops/${slug}`);
}

export function updateShop(shopId: string, payload: Partial<ShopPayload>) {
  return apiFetch<Shop>(`/shops/${shopId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteShop(shopId: string) {
  return apiFetch<void>(`/shops/${shopId}`, { method: "DELETE" });
}

export function uploadShopLogo(shopId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<Shop>(`/shops/${shopId}/logo`, { method: "POST", body: formData });
}

export function getShopStats(slug: string) {
  return apiFetch<ShopStats>(`/shops/${slug}/stats`);
}

export function getShopReviews(slug: string) {
  return apiFetch<Rating[]>(`/shops/${slug}/reviews`);
}

export function toggleFollowShop(shopId: string) {
  return apiFetch<{ following: boolean }>(`/shops/${shopId}/follow`, { method: "POST" });
}

export function uploadShopCover(shopId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<Shop>(`/shops/${shopId}/cover`, { method: "POST", body: formData });
}

export function getCollaborators(shopId: string) {
  return apiFetch<ShopCollaborator[]>(`/shops/${shopId}/collaborators`);
}

export function inviteCollaborator(shopId: string, email: string) {
  return apiFetch<ShopCollaborator>(`/shops/${shopId}/collaborators`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function removeCollaborator(shopId: string, collaboratorId: string) {
  return apiFetch<void>(`/shops/${shopId}/collaborators/${collaboratorId}`, { method: "DELETE" });
}

export function getMyShopInvites() {
  return apiFetch<ShopInvite[]>("/shop-invites");
}

export function respondToShopInvite(inviteId: string, accept: boolean) {
  return apiFetch<void>(`/shop-invites/${inviteId}/respond`, {
    method: "POST",
    body: JSON.stringify({ accept }),
  });
}
