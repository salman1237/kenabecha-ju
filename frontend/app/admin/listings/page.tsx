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
import { listAdminListings, removeAdminListing } from "@/lib/api/admin";
import { formatPrice } from "@/lib/utils";
import type { Listing } from "@/types/api";

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAdminListings()
      .then((page) => setListings(page.items))
      .finally(() => setLoading(false));
  }, []);

  const onRemove = async (listing: Listing) => {
    await removeAdminListing(listing.id);
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
          <TableHead>Title</TableHead>
          <TableHead>Seller</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listings.map((l) => (
          <TableRow key={l.id}>
            <TableCell>
              <Link href={`/listings/${l.id}`} className="font-medium hover:underline">
                {l.title}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{l.seller.full_name}</TableCell>
            <TableCell className="text-muted-foreground">{formatPrice(l.price, l.price_type, l.unit)}</TableCell>
            <TableCell>
              <Badge variant={l.status === "removed" ? "destructive" : "secondary"} className="capitalize">
                {l.status.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {l.status !== "removed" && (
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
                    Remove
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove &quot;{l.title}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>This soft-deletes the listing immediately.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onRemove(l)} variant="destructive">
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
