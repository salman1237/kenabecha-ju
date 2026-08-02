import { apiFetch } from "@/lib/api/client";
import type { Order, OrderStatus } from "@/types/api";

export interface CheckoutPayload {
  buyer_phone: string;
  delivery_address?: string | null;
}

export function checkout(payload: CheckoutPayload) {
  return apiFetch<Order[]>("/orders/checkout", { method: "POST", body: JSON.stringify(payload) });
}

export function getMyOrders() {
  return apiFetch<Order[]>("/orders/mine");
}

export function getSellingOrders(shopId?: string) {
  const qs = shopId ? `?shop_id=${shopId}` : "";
  return apiFetch<Order[]>(`/orders/selling${qs}`);
}

export function getOrder(id: string) {
  return apiFetch<Order>(`/orders/${id}`);
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  return apiFetch<Order>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}
