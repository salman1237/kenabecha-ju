"use client";

import { Phone } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
import { RatingForm } from "@/components/ratings/RatingForm";
import { ReportButton } from "@/components/ReportButton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { contactSeller } from "@/lib/api/chat";
import {
  deleteListing,
  deleteListingImage,
  getListing,
  markSold,
  uploadListingImage,
} from "@/lib/api/listings";
import { ApiError } from "@/lib/api/client";
import { getRatingEligibility } from "@/lib/api/ratings";
import { CONDITION_LABELS, cn, formatPrice, mediaUrl, toTelHref, toWhatsAppHref } from "@/lib/utils";
import type { Listing, Rating, RatingEligibility } from "@/types/api";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  sold: "Sold",
  out_of_stock: "Out of stock",
  removed: "Removed",
};

function DetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export default function ListingDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [eligibility, setEligibility] = useState<RatingEligibility | null>(null);
  const [submittedRating, setSubmittedRating] = useState<Rating | null>(null);

  const mutate = () => {
    getListing(params.id)
      .then(setListing)
      .catch(() => setError(true));
  };

  useEffect(() => {
    setIsLoading(true);
    getListing(params.id)
      .then(setListing)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!user) return;
    getRatingEligibility(params.id)
      .then(setEligibility)
      .catch(() => {});
  }, [params.id, user]);

  if (isLoading) return <DetailSkeleton />;
  if (error || !listing) {
    return <p className="mx-auto max-w-2xl px-6 py-12 text-sm text-destructive">Listing not found.</p>;
  }

  const isOwner = user?.id === listing.seller.id;

  const onDelete = async () => {
    await deleteListing(listing.id);
    router.push("/listings");
  };

  const onMarkSold = async () => {
    try {
      await markSold(listing.id);
      mutate();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not mark as sold.");
    }
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    setActionError(null);
    try {
      await uploadListingImage(listing.id, file);
      mutate();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not upload image.");
    } finally {
      setUploading(false);
    }
  };

  const onDeleteImage = async (imageId: string) => {
    await deleteListingImage(listing.id, imageId);
    setActiveImage(0);
    mutate();
  };

  const onContactSeller = async () => {
    setActionError(null);
    try {
      const conversation = await contactSeller(listing.id);
      router.push(`/inbox/${conversation.id}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not start conversation.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        {listing.images.length > 0 ? (
          <>
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(listing.images[activeImage].image_url)}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            </div>
            {listing.images.length > 1 && (
              <div className="flex gap-2">
                {listing.images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      "h-16 w-16 overflow-hidden rounded-md border-2",
                      i === activeImage ? "border-primary" : "border-transparent"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(img.image_url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
            No photos yet
          </div>
        )}

        {isOwner && (
          <div className="flex flex-wrap items-center gap-3">
            {listing.images.map((img) => (
              <button
                key={img.id}
                onClick={() => onDeleteImage(img.id)}
                className="text-xs text-destructive hover:underline"
              >
                Remove photo {img.sort_order + 1}
              </button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || listing.images.length >= 8}
            >
              {uploading ? "Uploading…" : "Add photo"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
          {listing.status !== "active" && (
            <Badge variant="secondary" className="shrink-0">
              {STATUS_LABELS[listing.status]}
            </Badge>
          )}
        </div>
        <p className="text-xl font-medium">{formatPrice(listing.price, listing.price_type)}</p>
        <p className="text-sm text-muted-foreground">
          {listing.shop ? "New" : CONDITION_LABELS[listing.condition]}
          {listing.shop && listing.quantity > 0 && ` · ${listing.quantity} in stock`}
        </p>
        <p className="text-sm text-muted-foreground">
          {listing.fulfillment_type === "pickup"
            ? `Pickup from: ${listing.pickup_address ?? "contact seller for details"}`
            : "Delivery — you'll provide your address at checkout"}
        </p>
      </div>

      <p className="whitespace-pre-wrap text-sm text-foreground/90">{listing.description}</p>

      {listing.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {listing.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        {listing.shop ? (
          <Link href={`/shops/${listing.shop.slug}`} className="font-medium hover:underline">
            {listing.shop.shop_name}
          </Link>
        ) : (
          <Link href={`/profile/${listing.seller.id}`} className="font-medium hover:underline">
            {listing.seller.full_name}
          </Link>
        )}
        {isOwner ? (
          <Button variant="secondary" disabled title="This is your own listing">
            Chat
          </Button>
        ) : user ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onContactSeller}>
              Chat
            </Button>
            {listing.seller.phone && (
              <a href={toTelHref(listing.seller.phone)} className={cn(buttonVariants())}>
                <Phone /> Call
              </a>
            )}
            {listing.seller.whatsapp_number && (
              <a
                href={toWhatsAppHref(
                  listing.seller.whatsapp_number,
                  `Hi, I'm interested in "${listing.title}" on KenaBecha JU.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10")}
              >
                WhatsApp
              </a>
            )}
          </div>
        ) : (
          <Link href={`/login?next=/listings/${listing.id}`} className={cn(buttonVariants())}>
            Log in to buy or contact seller
          </Link>
        )}
      </div>
      {actionError && !isOwner && <p className="text-sm text-destructive">{actionError}</p>}

      {!isOwner && <ReportButton targetType="listing" targetId={listing.id} />}

      {!isOwner && submittedRating && <p className="text-sm text-success">Thanks for rating this transaction!</p>}
      {!isOwner && !submittedRating && eligibility?.can_rate && (
        <RatingForm listingId={listing.id} onSuccess={setSubmittedRating} />
      )}

      {isOwner && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Link href={`/listings/${listing.id}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
            Edit
          </Link>
          {listing.status === "active" && !listing.shop && (
            <Button variant="outline" onClick={onMarkSold}>
              Mark as sold
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" className="text-destructive" />}>
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} variant="destructive">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {actionError && <p className="w-full text-sm text-destructive">{actionError}</p>}
        </div>
      )}
    </div>
  );
}
