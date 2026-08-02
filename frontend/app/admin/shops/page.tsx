"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listAdminShops, removeAdminShop } from "@/lib/api/admin";
import type { Shop } from "@/types/api";

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listAdminShops()
      .then((page) => setShops(page.items))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onRemove = async (shop: Shop) => {
    if (!confirm(`Remove "${shop.shop_name}"?`)) return;
    await removeAdminShop(shop.id);
    load();
  };

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
          <th className="py-2">Name</th>
          <th className="py-2">Category</th>
          <th className="py-2">Listings</th>
          <th className="py-2">Status</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {shops.map((s) => (
          <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-900">
            <td className="py-2">
              <Link href={`/shops/${s.slug}`} className="hover:underline">
                {s.shop_name}
              </Link>
            </td>
            <td className="py-2 text-zinc-500">{s.shop_type ?? "—"}</td>
            <td className="py-2 text-zinc-500">{s.listing_count}</td>
            <td className="py-2">
              <span className={!s.is_active ? "text-red-600" : "text-green-600"}>
                {!s.is_active ? "Removed" : "Active"}
              </span>
            </td>
            <td className="py-2 text-right">
              {s.is_active && (
                <button
                  onClick={() => onRemove(s)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
