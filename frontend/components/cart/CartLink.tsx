"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getCart } from "@/lib/api/cart";
import { onCartChanged } from "@/lib/cartEvents";

export function CartLink() {
  const [count, setCount] = useState(0);

  const refresh = () => {
    getCart()
      .then((items) => setCount(items.reduce((sum, i) => sum + i.quantity, 0)))
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
    return onCartChanged(refresh);
  }, []);

  return (
    <Link href="/cart" className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted" aria-label="Cart">
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
