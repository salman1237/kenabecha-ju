"use client";

import { Bookmark, BookmarkX } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ListingCard } from "@/components/listings/ListingCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { getSavedListings, toggleSaved } from "@/lib/api/dashboard";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/api";

export default function SavedListingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSavedListings()
      .then(setSaved)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const onRemove = async (listing: Listing) => {
    // Optimistic removal — the row disappears immediately, and is restored
    // in place if the server rejects it.
    const previous = saved;
    setSaved((prev) => prev.filter((l) => l.id !== listing.id));
    try {
      await toggleSaved(listing.id);
    } catch {
      setSaved(previous);
      toast.error("Couldn't remove that — please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6"
    >
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight">Saved listings</h1>
        <p className="text-sm text-muted-foreground">
          {saved.length === 0
            ? "Bookmark listings to come back to them later."
            : `${saved.length} ${saved.length === 1 ? "listing" : "listings"} bookmarked`}
        </p>
      </motion.div>

      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Tap the bookmark icon on any listing to keep it here for later."
          action={
            <Link href="/listings" className={cn(buttonVariants())}>
              Browse listings
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {saved.map((l) => (
              <motion.div
                key={l.id}
                layout
                variants={staggerItem}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.92 }}
                className="group/saved relative"
              >
                <ListingCard listing={l} />
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={`Remove ${l.title} from saved`}
                  onClick={() => onRemove(l)}
                  className="absolute right-3.5 top-3.5 opacity-0 shadow-[var(--shadow-soft-sm)] transition-opacity group-hover/saved:opacity-100 focus-visible:opacity-100"
                >
                  <BookmarkX />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
