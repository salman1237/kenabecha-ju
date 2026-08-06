"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
import { BulkBar } from "@/components/admin/BulkBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { bulkRemoveShops } from "@/lib/api/dashboard-admin";
import { listAdminShops, removeAdminShop } from "@/lib/api/admin";
import type { Shop } from "@/types/api";

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    listAdminShops()
      .then((page) => setShops(page.items))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRemove = async (shop: Shop) => {
    await removeAdminShop(shop.id);
    load();
  };

  const columns: Column<Shop>[] = [
    {
      key: "shop_name",
      header: "Name",
      cell: (s) => (
        <Link href={`/shops/${s.slug}`} className="font-medium hover:underline">
          {s.shop_name}
        </Link>
      ),
      sortValue: (s) => s.shop_name,
    },
    {
      key: "shop_type",
      header: "Category",
      cell: (s) => <span className="text-muted-foreground">{s.shop_type ?? "—"}</span>,
      sortValue: (s) => s.shop_type ?? "",
    },
    {
      key: "listing_count",
      header: "Listings",
      cell: (s) => <span className="text-muted-foreground">{s.listing_count}</span>,
      sortValue: (s) => s.listing_count,
    },
    {
      key: "created_at",
      header: "Created",
      cell: (s) => (
        <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
      ),
      sortValue: (s) => s.created_at,
      hideOnMobile: true,
    },
    {
      key: "is_active",
      header: "Status",
      cell: (s) => (
        <Badge variant={!s.is_active ? "destructive" : "secondary"}>
          {!s.is_active ? "Removed" : "Active"}
        </Badge>
      ),
      sortValue: (s) => (s.is_active ? "Active" : "Removed"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight">Shops</h1>
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
                {
                  label: "Remove",
                  destructive: true,
                  confirm: "Remove the selected shops? Their listings stay but the shops go.",
                  run: bulkRemoveShops,
                },
              ]}
            />
          ),
        }}
        rows={shops}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by shop name or category…"
        searchKeys={(s) => `${s.shop_name} ${s.shop_type ?? ""}`}
        exportName="shops"
        emptyTitle="No shops"
        actions={(s) =>
          s.is_active ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="ghost" size="sm" className="text-destructive" />}
              >
                Remove
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove &quot;{s.shop_name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This soft-deletes the shop immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRemove(s)} variant="destructive">
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
