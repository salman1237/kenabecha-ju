"use client";

import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ListingForm } from "@/components/listings/ListingForm";
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
import { FormSection } from "@/components/ui/FormSection";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { deleteListing, getListing, markSold, renewListing } from "@/lib/api/listings";
import { translateApiError } from "@/lib/i18n/errors";
import type { Listing } from "@/types/api";

/**
 * Everything that can be changed about a listing, in one place.
 *
 * Previously this page rendered only the subset of fields the shared form
 * exposed in edit mode: no photos, no status, no stock. Photo management sat
 * on the *public* listing page instead, and marking something sold was only
 * possible from there too. Both now live here, which is where a seller looks
 * for them.
 */
export default function EditListingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { t, fmt } = useLanguage();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getListing(params.id)
      .then(setListing)
      .catch(() => setError(t.listing.notFound));
  }, [params.id, t.listing.notFound]);

  const act = async (action: () => Promise<Listing | void>, done?: () => void) => {
    setBusy(true);
    try {
      const updated = await action();
      if (updated) setListing(updated);
      done?.();
    } catch (err) {
      toast.error(translateApiError(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || (!listing && !error)) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  if (error) {
    return <p className="mx-auto max-w-3xl px-6 py-12 text-sm text-destructive">{error}</p>;
  }
  if (!user || (listing && listing.seller.id !== user.id)) {
    return (
      <p className="mx-auto max-w-3xl px-6 py-12 text-center text-sm text-muted-foreground">
        {t.errors.forbidden}
      </p>
    );
  }
  if (!listing) return null;

  const canMarkSold = listing.status === "active";
  const canRenew = listing.status === "active" || listing.status === "expired";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-3">
        <Link
          href={`/listings/${listing.id}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="size-4" />
          {t.common.back}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t.listingForm.editTitle}</h1>
          <Badge variant={listing.status === "active" ? "secondary" : "outline"}>
            {t.statuses[listing.status]}
          </Badge>
          {listing.view_count > 0 && (
            <span className="text-xs text-muted-foreground">
              {fmt.number(listing.view_count)}{" "}
              {listing.view_count === 1 ? t.common.view : t.common.views}
            </span>
          )}
        </div>
      </div>

      <ListingForm
        mode="edit"
        listing={listing}
        onSuccess={(updated) => router.push(`/listings/${updated.id}`)}
        // Photo edits hit the server immediately, so keep this page's copy in
        // step without waiting for a submit.
        onListingChange={setListing}
      />

      {/* Status actions are not form fields — they take effect at once and
          have their own endpoints, so they get their own section rather than
          being smuggled into Save. */}
      <FormSection title={t.listingForm.sectionStatus} description={t.listingForm.sectionStatusHint}>
        <div className="flex flex-wrap gap-2">
          {canMarkSold && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                act(
                  () => markSold(listing.id),
                  () => toast.success(t.listing.markSold)
                )
              }
            >
              <CheckCircle2 /> {t.listing.markSold}
            </Button>
          )}
          {canRenew && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                act(
                  () => renewListing(listing.id),
                  () => toast.success(t.dashboard.renew)
                )
              }
            >
              {t.dashboard.renew}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">{t.listing.deleteListing}</p>
          <p className="text-xs text-muted-foreground">{t.listingForm.deleteHint}</p>
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="destructive" size="sm" className="w-fit" />}
            >
              <Trash2 /> {t.common.delete}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.listing.deleteListing}</AlertDialogTitle>
                <AlertDialogDescription>{t.listingForm.deleteConfirm}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    act(
                      () => deleteListing(listing.id),
                      () => router.push("/dashboard/listings")
                    )
                  }
                >
                  {t.common.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </FormSection>
    </div>
  );
}
