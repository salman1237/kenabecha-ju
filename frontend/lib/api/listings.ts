import { apiFetch } from "@/lib/api/client";
import type { Condition, FulfillmentType, Listing, ListingImage, Page, PriceType } from "@/types/api";

export interface ListingPayload {
  title: string;
  description: string;
  price?: number | null;
  price_type: PriceType;
  unit?: string | null;
  condition?: Condition | null;
  quantity?: number | null;
  shop_id?: string | null;
  tags: string[];
  fulfillment_type: FulfillmentType;
  pickup_address?: string | null;
}

export function createListing(payload: ListingPayload) {
  return apiFetch<Listing>("/listings", { method: "POST", body: JSON.stringify(payload) });
}

export interface BrowseFilters {
  q?: string;
  tags?: string[];
  min_price?: number;
  max_price?: number;
  condition?: Condition;
  shop_id?: string;
  seller_id?: string;
  personal_only?: boolean;
  sort?: "newest" | "price_asc" | "price_desc";
  limit?: number;
  offset?: number;
}

export function browseListings(filters: BrowseFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return apiFetch<Page<Listing>>(`/listings${qs ? `?${qs}` : ""}`);
}

export function getMyListings(shopId?: string | null) {
  const qs = shopId ? `?shop_id=${shopId}` : "";
  return apiFetch<Listing[]>(`/listings/mine${qs}`);
}

export function getListing(id: string) {
  return apiFetch<Listing>(`/listings/${id}`);
}

export function updateListing(id: string, payload: Partial<ListingPayload>) {
  return apiFetch<Listing>(`/listings/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteListing(id: string) {
  return apiFetch<void>(`/listings/${id}`, { method: "DELETE" });
}

export function markSold(id: string) {
  return apiFetch<Listing>(`/listings/${id}/mark-sold`, { method: "POST" });
}

export function uploadListingImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<ListingImage>(`/listings/${id}/images`, { method: "POST", body: formData });
}

export function deleteListingImage(id: string, imageId: string) {
  return apiFetch<void>(`/listings/${id}/images/${imageId}`, { method: "DELETE" });
}
