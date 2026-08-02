"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { getCart, removeCartItem, updateCartItem } from "@/lib/api/cart";
import { ApiError } from "@/lib/api/client";
import { checkout } from "@/lib/api/orders";
import { emitCartChanged } from "@/lib/cartEvents";
import { formatPrice, mediaUrl } from "@/lib/utils";
import type { CartItem } from "@/types/api";

function groupBySeller(items: CartItem[]) {
  const groups = new Map<string, { label: string; items: CartItem[] }>();
  for (const item of items) {
    const key = item.listing.shop?.id ?? item.listing.seller.id;
    const label = item.listing.shop?.shop_name ?? item.listing.seller.full_name;
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)!.items.push(item);
  }
  return Array.from(groups.values());
}

export default function CartPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getCart()
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        <Link href="/login?next=/cart" className="font-medium text-foreground">
          Log in
        </Link>{" "}
        to view your cart.
      </div>
    );
  }

  const needsDelivery = items.some((i) => i.listing.fulfillment_type === "delivery");
  const total = items.reduce(
    (sum, i) => sum + (i.listing.price_type === "fixed" ? Number(i.listing.price ?? 0) * i.quantity : 0),
    0
  );

  const onQuantityChange = async (item: CartItem, quantity: number) => {
    if (quantity < 1) return;
    try {
      const updated = await updateCartItem(item.id, quantity);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update quantity.");
    }
  };

  const onRemove = async (item: CartItem) => {
    await removeCartItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    emitCartChanged();
  };

  const onCheckout = async () => {
    setServerError(null);
    if (!buyerPhone.trim()) {
      setServerError("Phone number is required.");
      return;
    }
    if (needsDelivery && !deliveryAddress.trim()) {
      setServerError("Delivery address is required for at least one item in your cart.");
      return;
    }
    setSubmitting(true);
    try {
      await checkout({ buyer_phone: buyerPhone, delivery_address: needsDelivery ? deliveryAddress : undefined });
      emitCartChanged();
      toast.success("Order placed! Sellers have been notified.");
      router.push("/orders");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not place order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your Cart</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your cart is empty.{" "}
          <Link href="/listings" className="font-medium text-foreground">
            Browse listings
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {groupBySeller(items).map((group) => (
              <Card key={group.label}>
                <CardHeader>
                  <CardTitle className="text-sm">{group.label}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {group.items.map((item) => (
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
                          {formatPrice(item.listing.price, item.listing.price_type)} ·{" "}
                          {item.listing.fulfillment_type === "pickup" ? "Pickup" : "Delivery"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => onQuantityChange(item, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          −
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => onQuantityChange(item, item.quantity + 1)}
                          disabled={item.quantity >= item.listing.quantity}
                        >
                          +
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onRemove(item)} className="text-destructive">
                        Remove
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
              {total > 0 && (
                <p className="text-sm text-muted-foreground">Estimated total: ৳{total.toLocaleString()}</p>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="buyer_phone">Your phone number</Label>
                <Input
                  id="buyer_phone"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="e.g. 01712345678"
                />
              </div>

              {needsDelivery && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delivery_address">Delivery address</Label>
                  <Input
                    id="delivery_address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Hall/room or full address"
                  />
                  <p className="text-xs text-muted-foreground">
                    Applies to the delivery item(s) in your cart. Pickup items use the seller&apos;s pickup address.
                  </p>
                </div>
              )}

              <Separator />

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}

              <Button onClick={onCheckout} disabled={submitting}>
                {submitting ? "Placing order…" : "Place order"}
              </Button>
              <p className="text-xs text-muted-foreground">
                No online payment — you&apos;ll arrange pickup or delivery directly with the seller.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
