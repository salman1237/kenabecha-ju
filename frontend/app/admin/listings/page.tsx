"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DataTable, type Column } from "@/components/admin/DataTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAdminListings, removeAdminListing } from "@/lib/api/admin";
import { formatPrice } from "@/lib/utils";
import type { Listing } from "@/types/api";

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listAdminListings()
      .then((page) => setListings(page.items))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRemove = async (listing: Listing) => {
    await removeAdminListing(listing.id);
    load();
  };

  const columns: Column<Listing>[] = [
    {
      key: "title",
      header: "Title",
      cell: (l) => (
        <Link href={`/listings/${l.id}`} className="font-medium hover:underline">
          {l.title}
        </Link>
      ),
      sortValue: (l) => l.title,
    },
    {
      key: "seller",
      header: "Seller",
      cell: (l) => <span className="text-muted-foreground">{l.seller.full_name}</span>,
      sortValue: (l) => l.seller.full_name,
    },
    {
      key: "shop",
      header: "Shop",
      cell: (l) => <span className="text-muted-foreground">{l.shop?.shop_name ?? "Personal"}</span>,
      sortValue: (l) => l.shop?.shop_name ?? "Personal",
      hideOnMobile: true,
    },
    {
      key: "price",
      header: "Price",
      cell: (l) => (
        <span className="text-muted-foreground">{formatPrice(l.price, l.price_type, l.unit)}</span>
      ),
      // Sort numerically on the raw value — sorting the formatted string
      // would put ৳1000 before ৳90.
      sortValue: (l) => Number(l.price ?? 0),
    },
    {
      key: "status",
      header: "Status",
      cell: (l) => (
        <Badge variant={l.status === "removed" ? "destructive" : "secondary"} className="capitalize">
          {l.status.replace("_", " ")}
        </Badge>
      ),
      sortValue: (l) => l.status,
    },
    {
      key: "created_at",
      header: "Listed",
      cell: (l) => (
        <span className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</span>
      ),
      sortValue: (l) => l.created_at,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight">Listings</h1>
      <DataTable
        rows={listings}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by title, seller, or shop…"
        searchKeys={(l) => `${l.title} ${l.seller.full_name} ${l.shop?.shop_name ?? ""}`}
        exportName="listings"
        emptyTitle="No listings"
        actions={(l) =>
          l.status !== "removed" ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="ghost" size="sm" className="text-destructive" />}
              >
                Remove
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove &quot;{l.title}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This soft-deletes the listing immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRemove(l)} variant="destructive">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null
        }
      />
    </div>
  );
}
