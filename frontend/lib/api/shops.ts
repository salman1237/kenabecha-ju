import { apiFetch } from "@/lib/api/client";
import type { Shop } from "@/types/api";

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
