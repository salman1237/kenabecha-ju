"use client";

import { Bell, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { requestRestock, withdrawRestockRequest } from "@/lib/api/listings";
import { cn } from "@/lib/utils";

/**
 * "Notify me when back in stock" — only ever rendered for a shop listing
 * that's currently out_of_stock (the page decides that; this component just
 * toggles). Initial state comes from `listing.has_pending_restock_request`
 * on the detail payload rather than a separate fetch, since the page has
 * already paid for that query.
 */
export function RestockButton({
  listingId,
  initiallyRequested,
  className,
}: {
  listingId: string;
  /** null means signed-out — clicking sends them to log in first, same gate
   *  as every other intent-to-act control in this app. */
  initiallyRequested: boolean | null;
  className?: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [requested, setRequested] = useState(initiallyRequested ?? false);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (initiallyRequested === null) {
      router.push(`/login?next=/listings/${listingId}`);
      return;
    }

    const next = !requested;
    setRequested(next); // optimistic
    setBusy(true);
    try {
      if (next) await requestRestock(listingId);
      else await withdrawRestockRequest(listingId);
    } catch {
      setRequested(!next); // roll back
      toast.error(t.listing.restockRequestFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={requested ? "secondary" : "outline"}
      disabled={busy}
      aria-pressed={requested}
      onClick={onClick}
      className={cn("h-10 w-full", className)}
    >
      {requested ? <BellRing className="fill-current" /> : <Bell />}
      {requested ? t.listing.restockRequested : t.listing.notifyRestock}
    </Button>
  );
}
