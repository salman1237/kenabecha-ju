"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listAdminListings, removeAdminListing } from "@/lib/api/admin";
import { formatPrice } from "@/lib/utils";
import type { Listing } from "@/types/api";

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listAdminListings()
      .then((page) => setListings(page.items))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onRemove = async (listing: Listing) => {
    if (!confirm(`Remove "${listing.title}"?`)) return;
    await removeAdminListing(listing.id);
    load();
  };

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
          <th className="py-2">Title</th>
          <th className="py-2">Seller</th>
          <th className="py-2">Price</th>
          <th className="py-2">Status</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {listings.map((l) => (
          <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
            <td className="py-2">
              <Link href={`/listings/${l.id}`} className="hover:underline">
                {l.title}
              </Link>
            </td>
            <td className="py-2 text-zinc-500">{l.seller.full_name}</td>
            <td className="py-2 text-zinc-500">{formatPrice(l.price, l.price_type)}</td>
            <td className="py-2">{l.status}</td>
            <td className="py-2 text-right">
              {l.status !== "removed" && (
                <button
                  onClick={() => onRemove(l)}
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
