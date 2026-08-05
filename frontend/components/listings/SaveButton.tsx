"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { getSavedIds, toggleSaved } from "@/lib/api/dashboard";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Module-level cache of the current user's saved ids. Without it, every
 * card in a grid would fire its own /dashboard/saved/ids request on mount.
 * Cleared on logout via the effect below.
 */
let savedIdsCache: Set<string> | null = null;
let inFlight: Promise<Set<string>> | null = null;

function loadSavedIds(): Promise<Set<string>> {
  if (savedIdsCache) return Promise.resolve(savedIdsCache);
  if (!inFlight) {
    inFlight = getSavedIds()
      .then((ids) => {
        savedIdsCache = new Set(ids);
        return savedIdsCache;
      })
      .catch(() => new Set<string>())
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function invalidateSavedIds() {
  savedIdsCache = null;
}

export function SaveButton({ listingId, className }: { listingId: string; className?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      invalidateSavedIds();
      setSaved(false);
      return;
    }
    let active = true;
    loadSavedIds().then((ids) => active && setSaved(ids.has(listingId)));
    return () => {
      active = false;
    };
  }, [user, listingId]);

  const onClick = async (e: React.MouseEvent) => {
    // Cards are wrapped in a <Link>; without this the click navigates.
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push(`/login?next=/listings/${listingId}`);
      return;
    }

    const next = !saved;
    setSaved(next); // optimistic
    setBusy(true);
    try {
      const res = await toggleSaved(listingId);
      setSaved(res.saved);
      if (savedIdsCache) {
        if (res.saved) savedIdsCache.add(listingId);
        else savedIdsCache.delete(listingId);
      }
    } catch {
      setSaved(!next); // roll back
      toast.error("Couldn't update your saved listings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save listing"}
      whileTap={{ scale: 0.85 }}
      transition={springSnappy}
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-[var(--shadow-soft-sm)] backdrop-blur-sm transition-colors hover:text-emerald-600 dark:hover:text-emerald-400",
        saved && "text-emerald-600 dark:text-emerald-400",
        className
      )}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} />
    </motion.button>
  );
}
