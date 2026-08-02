"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/client";
import { getOrder, updateOrderStatus } from "@/lib/api/orders";
import { formatPrice, mediaUrl } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/api";

const STATUS_VARIANT: Record<OrderStatus, "outline" | "default" | "destructive" | "secondary"> = {
  pending: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    getOrder(params.id)
      .then(setOrder)
      .catch(() => setError(true));
  };

  useEffect(load, [params.id]);

  if (error) return <p className="mx-auto max-w-2xl px-6 py-12 text-sm text-destructive">Order not found.</p>;
  if (!order || !user) return null;

  const isBuyer = user.id === order.buyer.id;
  const isSeller = user.id === order.seller.id;

  const onUpdateStatus = async (status: OrderStatus) => {
    setUpdating(true);
    try {
      const updated = await updateOrderStatus(order.id, status);
      setOrder(updated);
      toast.success(`Order marked ${status}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update order.");
    } finally {
      setUpdating(false);
    }
  };

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Order · {itemCount} item{itemCount !== 1 ? "s" : ""}
        </h1>
        <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.listing.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(item.listing.images[0].image_url)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/listings/${item.listing.id}`} className="truncate text-sm font-medium hover:underline">
                  {item.listing.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Qty {item.quantity} · {formatPrice(item.unit_price, item.price_type)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fulfillment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Method: </span>
            {order.fulfillment_type === "pickup" ? "Pickup" : "Delivery"}
          </p>
          {order.fulfillment_type === "pickup" ? (
            <p>
              <span className="text-muted-foreground">Pickup from: </span>
              {order.items[0]?.listing.pickup_address ?? "contact seller for details"}
            </p>
          ) : (
            <p>
              <span className="text-muted-foreground">Deliver to: </span>
              {order.delivery_address}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Contact number: </span>
            {order.buyer_phone}
          </p>
          <p>
            <span className="text-muted-foreground">{isBuyer ? "Seller" : "Buyer"}: </span>
            <Link
              href={`/profile/${isBuyer ? order.seller.id : order.buyer.id}`}
              className="hover:underline"
            >
              {isBuyer ? order.seller.full_name : order.buyer.full_name}
            </Link>
          </p>
        </CardContent>
      </Card>

      {(order.status === "pending" || order.status === "confirmed") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {isSeller && order.status === "pending" && (
              <Button disabled={updating} onClick={() => onUpdateStatus("confirmed")}>
                Confirm order
              </Button>
            )}
            {isSeller && order.status === "confirmed" && (
              <Button disabled={updating} onClick={() => onUpdateStatus("completed")}>
                Mark completed
              </Button>
            )}
            {(isSeller || (isBuyer && order.status === "pending")) && (
              <>
                <Separator orientation="vertical" className="h-8" />
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={updating}
                  onClick={() => onUpdateStatus("cancelled")}
                >
                  Cancel order
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
