"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RatingForm } from "@/components/ratings/RatingForm";
import { ReportButton } from "@/components/ReportButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addToCart } from "@/lib/api/cart";
import { contactSeller } from "@/lib/api/chat";
import { emitCartChanged } from "@/lib/cartEvents";
import {
  deleteListing,
  deleteListingImage,
  getListing,
  markSold,
  uploadListingImage,
} from "@/lib/api/listings";
import { ApiError } from "@/lib/api/client";
import { getRatingEligibility } from "@/lib/api/ratings";
import { CONDITION_LABELS, cn, formatPrice, mediaUrl } from "@/lib/utils";
import type { Listing, Rating, RatingEligibility } from "@/types/api";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  sold: "Sold",
  out_of_stock: "Out of stock",
  removed: "Removed",
};

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
  const [addingToCart, setAddingToCart] = useState(false);

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

  if (isLoading) return null;
  if (error || !listing) {
    return <p className="mx-auto max-w-2xl px-6 py-12 text-sm text-red-600">Listing not found.</p>;
  }

  const isOwner = user?.id === listing.seller.id;

  const onDelete = async () => {
    if (!confirm("Delete this listing? This can't be undone.")) return;
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

  const onAddToCart = async () => {
    setActionError(null);
    setAddingToCart(true);
    try {
      await addToCart(listing.id, 1);
      emitCartChanged();
      toast.success(`Added "${listing.title}" to your cart`, {
        action: { label: "View cart", onClick: () => router.push("/cart") },
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-3">
        {listing.images.length > 0 ? (
          <>
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
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
                    className={`h-16 w-16 overflow-hidden rounded-md border-2 ${
                      i === activeImage ? "border-zinc-900 dark:border-zinc-100" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(img.image_url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-900">
            No photos yet
          </div>
        )}

        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            {listing.images.map((img) => (
              <button
                key={img.id}
                onClick={() => onDeleteImage(img.id)}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Remove photo {img.sort_order + 1}
              </button>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || listing.images.length >= 8}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {uploading ? "Uploading…" : "Add photo"}
            </button>
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
            <span className="shrink-0 rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {STATUS_LABELS[listing.status]}
            </span>
          )}
        </div>
        <p className="text-xl font-medium">{formatPrice(listing.price, listing.price_type)}</p>
        <p className="text-sm text-zinc-500">
          {listing.shop ? "New" : CONDITION_LABELS[listing.condition]}
          {listing.shop && listing.quantity > 0 && ` · ${listing.quantity} in stock`}
        </p>
        <p className="text-sm text-zinc-500">
          {listing.fulfillment_type === "pickup"
            ? `Pickup from: ${listing.pickup_address ?? "contact seller for details"}`
            : "Delivery — you'll provide your address at checkout"}
        </p>
      </div>

      <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{listing.description}</p>

      {listing.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {listing.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
          <button
            disabled
            title="This is your own listing"
            className="cursor-not-allowed rounded-md bg-zinc-300 px-4 py-2 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
          >
            Contact Seller
          </button>
        ) : user ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onContactSeller}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Contact Seller
            </button>
            {listing.status === "active" && (
              <Button onClick={onAddToCart} disabled={addingToCart}>
                {addingToCart ? "Adding…" : "Add to Cart"}
              </Button>
            )}
          </div>
        ) : (
          <Link href={`/login?next=/listings/${listing.id}`} className={cn(buttonVariants())}>
            Log in to buy or contact seller
          </Link>
        )}
      </div>
      {actionError && !isOwner && <p className="text-sm text-red-600">{actionError}</p>}

      {!isOwner && <ReportButton targetType="listing" targetId={listing.id} />}

      {!isOwner && submittedRating && (
        <p className="text-sm text-green-600">Thanks for rating this transaction!</p>
      )}
      {!isOwner && !submittedRating && eligibility?.can_rate && (
        <RatingForm listingId={listing.id} onSuccess={setSubmittedRating} />
      )}

      {isOwner && (
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Link
            href={`/listings/${listing.id}/edit`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Edit
          </Link>
          {listing.status === "active" && !listing.shop && (
            <button
              onClick={onMarkSold}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Mark as sold
            </button>
          )}
          <button onClick={onDelete} className="text-sm font-medium text-red-600 hover:text-red-700">
            Delete
          </button>
          {actionError && <p className="w-full text-sm text-red-600">{actionError}</p>}
        </div>
      )}
    </div>
  );
}
