import { apiFetch } from "@/lib/api/client";
import type { CartItem } from "@/types/api";

export function getCart() {
  return apiFetch<CartItem[]>("/cart");
}

export function addToCart(listingId: string, quantity: number = 1) {
  return apiFetch<CartItem>("/cart", {
    method: "POST",
    body: JSON.stringify({ listing_id: listingId, quantity }),
  });
}

export function updateCartItem(itemId: string, quantity: number) {
  return apiFetch<CartItem>(`/cart/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(itemId: string) {
  return apiFetch<void>(`/cart/${itemId}`, { method: "DELETE" });
}
