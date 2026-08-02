"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { getMyOrders, getSellingOrders } from "@/lib/api/orders";
import type { Order, OrderStatus } from "@/types/api";

const STATUS_VARIANT: Record<OrderStatus, "outline" | "default" | "destructive" | "secondary"> = {
  pending: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

function OrderRow({ order, viewer }: { order: Order; viewer: "buyer" | "seller" }) {
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const counterparty = viewer === "buyer" ? order.seller : order.buyer;
  return (
    <Link href={`/orders/${order.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center justify-between gap-4 py-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {itemCount} item{itemCount !== 1 ? "s" : ""} · {order.fulfillment_type === "pickup" ? "Pickup" : "Delivery"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {viewer === "buyer" ? "Seller" : "Buyer"}: {counterparty.full_name}
              {order.shop && ` · ${order.shop.shop_name}`}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [buying, setBuying] = useState<Order[]>([]);
  const [selling, setSelling] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getMyOrders(), getSellingOrders()])
      .then(([mine, sold]) => {
        setBuying(mine);
        setSelling(sold);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        <Link href="/login?next=/orders" className="font-medium text-foreground">
          Log in
        </Link>{" "}
        to view your orders.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Tabs defaultValue="buying">
          <TabsList>
            <TabsTrigger value="buying">Buying ({buying.length})</TabsTrigger>
            <TabsTrigger value="selling">Selling ({selling.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="buying" className="mt-4 flex flex-col gap-3">
            {buying.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              buying.map((o) => <OrderRow key={o.id} order={o} viewer="buyer" />)
            )}
          </TabsContent>
          <TabsContent value="selling" className="mt-4 flex flex-col gap-3">
            {selling.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              selling.map((o) => <OrderRow key={o.id} order={o} viewer="seller" />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
