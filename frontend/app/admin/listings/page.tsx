"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BulkBar } from "@/components/admin/BulkBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { bulkRemoveListings, bulkSetListingTop } from "@/lib/api/dashboard-admin";
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
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listAdminListings, removeAdminListing } from "@/lib/api/admin";
import { featureListing } from "@/lib/api/listings";
import { formatPrice } from "@/lib/utils";
import type { Listing } from "@/types/api";

/** Promotion length granted from the admin panel. */
const FEATURE_DAYS = 7;

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  // Toggle rather than a duration picker: 7 days covers the case this exists
  // for, and an admin who wants it gone can click again.
  const onToggleFeature = async (listing: Listing) => {
    setBusyId(listing.id);
    try {
      await featureListing(listing.id, listing.is_featured ? null : FEATURE_DAYS);
      load();
    } finally {
      setBusyId(null);
    }
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
      key: "views",
      header: "Views",
      cell: (l) => <span className="text-muted-foreground tabular-nums">{l.view_count}</span>,
      sortValue: (l) => l.view_count,
      hideOnMobile: true,
    },
    {
      key: "featured",
      header: "Featured",
      cell: (l) =>
        l.is_featured ? (
          <Badge className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
            until {new Date(l.featured_until!).toLocaleDateString()}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (l) => (l.is_featured ? 1 : 0),
      hideOnMobile: true,
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
        selection={{
          selected,
          onChange: setSelected,
          bar: (ids, clear) => (
            <BulkBar
              ids={ids}
              clear={clear}
              onDone={load}
              actions={[
                { label: "Mark as top", run: (i) => bulkSetListingTop(i, true) },
                { label: "Remove from top", run: (i) => bulkSetListingTop(i, false) },
                {
                  label: "Remove",
                  destructive: true,
                  confirm:
                    "Remove the selected listings? Each seller is notified, exactly as if you removed them one at a time.",
                  run: bulkRemoveListings,
                },
              ]}
            />
          ),
        }}
        rows={listings}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by title, seller, or shop…"
        searchKeys={(l) => `${l.title} ${l.seller.full_name} ${l.shop?.shop_name ?? ""}`}
        exportName="listings"
        emptyTitle="No listings"
        actions={(l) =>
          l.status !== "removed" ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === l.id}
                onClick={() => onToggleFeature(l)}
              >
                <Sparkles className="size-3.5" />
                {l.is_featured ? "Unfeature" : "Feature"}
              </Button>
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
            </div>
          ) : null
        }
      />
    </div>
  );
}
