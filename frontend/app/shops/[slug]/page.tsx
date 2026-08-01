"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { browseListings } from "@/lib/api/listings";
import { getShopBySlug } from "@/lib/api/shops";
import type { Listing, Shop } from "@/types/api";

export default function ShopStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    getShopBySlug(params.slug)
      .then((s) => {
        setShop(s);
        return browseListings({ shop_id: s.id, limit: 50 });
      })
      .then((page) => setListings(page.items))
      .catch(() => setError(true));
  }, [params.slug]);

  if (error) return <p className="mx-auto max-w-3xl px-6 py-12 text-sm text-red-600">Shop not found.</p>;
  if (!shop) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight">{shop.shop_name}</h1>
        {shop.shop_type && <p className="text-sm text-zinc-500">{shop.shop_type}</p>}
        {shop.description && <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{shop.description}</p>}
      </div>

      {listings.length === 0 ? (
        <p className="text-sm text-zinc-500">No active listings from this shop yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
