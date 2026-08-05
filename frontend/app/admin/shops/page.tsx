"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAdminShops, removeAdminShop } from "@/lib/api/admin";
import type { Shop } from "@/types/api";

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAdminShops()
      .then((page) => setShops(page.items))
      .finally(() => setLoading(false));
  }, []);

  const onRemove = async (shop: Shop) => {
    await removeAdminShop(shop.id);
    load();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Listings</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shops.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <Link href={`/shops/${s.slug}`} className="font-medium hover:underline">
                {s.shop_name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{s.shop_type ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{s.listing_count}</TableCell>
            <TableCell>
              <Badge variant={!s.is_active ? "destructive" : "secondary"}>{!s.is_active ? "Removed" : "Active"}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {s.is_active && (
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
                    Remove
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove &quot;{s.shop_name}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>This soft-deletes the shop immediately.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onRemove(s)} variant="destructive">
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
