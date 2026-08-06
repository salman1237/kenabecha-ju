"use client";

import { MapPin, Package, Phone, Truck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
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
import { ImageGallery } from "@/components/listings/ImageGallery";
import { ListingCard } from "@/components/listings/ListingCard";
import { RatingForm } from "@/components/ratings/RatingForm";
import { RatingSummary } from "@/components/ratings/RatingSummary";
import { StarRating } from "@/components/ratings/StarRating";
import { ReportButton } from "@/components/ReportButton";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/ShareButton";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { contactSeller } from "@/lib/api/chat";
import {
  deleteListing,
  deleteListingImage,
  getListing,
  getRelatedListings,
  getSellerReviews,
  markSold,
  uploadListingImage,
} from "@/lib/api/listings";
import { ApiError } from "@/lib/api/client";
import { getRatingEligibility } from "@/lib/api/ratings";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import { cn, toTelHref, toWhatsAppHref } from "@/lib/utils";
import type { Listing, Rating, RatingEligibility, SellerReviews } from "@/types/api";

function DetailSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, fmt } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listing, setListing] = useState<Listing | null>(null);
  const [related, setRelated] = useState<Listing[]>([]);
  const [sellerReviews, setSellerReviews] = useState<SellerReviews | null>(null);
  const [eligibility, setEligibility] = useState<RatingEligibility | null>(null);
  const [submittedRating, setSubmittedRating] = useState<Rating | null>(null);

  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutate = () => {
    getListing(params.id).then(setListing).catch(() => setError(true));
  };

  useEffect(() => {
    setIsLoading(true);
    getListing(params.id)
      .then(setListing)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));

    getRelatedListings(params.id, 8).then(setRelated).catch(() => {});
    getSellerReviews(params.id).then(setSellerReviews).catch(() => {});
  }, [params.id]);

  useEffect(() => {
    if (!user) return;
    getRatingEligibility(params.id).then(setEligibility).catch(() => {});
  }, [params.id, user]);

  if (isLoading) return <DetailSkeleton />;
  if (error || !listing) {
    return <p className="mx-auto max-w-2xl px-6 py-12 text-sm text-destructive">{t.listing.notFound}</p>;
  }

  const isOwner = user?.id === listing.seller.id;
  const sellerName = listing.shop ? listing.shop.shop_name : listing.seller.full_name;
  const sellerHref = listing.shop ? `/shops/${listing.shop.slug}` : `/profile/${listing.seller.id}`;

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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        className="mb-5"
        items={[
          { label: t.common.home, href: "/" },
          { label: t.shops.listingsTab, href: "/listings" },
          ...(listing.category ? [{ label: listing.category.name, href: `/listings?category=${listing.category.slug}` }] : []),
          ...(listing.shop ? [{ label: listing.shop.shop_name, href: sellerHref }] : []),
          { label: listing.title },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: gallery + tabs */}
        <div className="flex min-w-0 flex-col gap-8">
          <ImageGallery images={listing.images} title={listing.title} />

          {isOwner && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-3">
              <span className="text-xs font-medium text-muted-foreground">{t.listing.managePhotos}</span>
              {listing.images.map((img) => (
                <button
                  key={img.id}
                  onClick={async () => {
                    await deleteListingImage(listing.id, img.id);
                    mutate();
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove #{img.sort_order + 1}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={uploading}
                loadingText="Uploading…"
                onClick={() => fileInputRef.current?.click()}
                disabled={listing.images.length >= 8}
              >
                Add photo
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

          <Tabs defaultValue="description">
            <TabsList>
              <TabsTrigger value="description">{t.listing.description}</TabsTrigger>
              <TabsTrigger value="details">{t.listing.details}</TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews{sellerReviews?.rating_count ? ` (${sellerReviews.rating_count})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="pt-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {listing.description}
              </p>
              {listing.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.tags.map((tag) => (
                    <Link key={tag.id} href={`/listings?tags=${encodeURIComponent(tag.name)}`}>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
                        {tag.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="details" className="pt-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {[
                  [
                    t.listing.condition,
                    listing.shop ? t.conditions.new : t.conditions[listing.condition],
                  ],
                  [t.listing.priceType, t.common[listing.price_type]],
                  ...(listing.unit ? [[t.listing.soldPer, listing.unit]] : []),
                  [t.listing.fulfillment, t.common[listing.fulfillment_type]],
                  ...(listing.fulfillment_type !== "delivery"
                    ? [[t.listing.pickupAddress, listing.pickup_address ?? t.listing.askSeller]]
                    : []),
                  [t.listing.listed, fmt.date(listing.created_at)],
                  [t.listing.views, fmt.number(listing.view_count)],
                  // Only the seller needs the renewal deadline; to a buyer it
                  // reads as pressure to hurry, which isn't what it means.
                  ...(isOwner && listing.expires_at
                    ? [[t.listing.expires, fmt.date(listing.expires_at)]]
                    : []),
                  [t.listing.status, t.statuses[listing.status]],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-border/60 pb-2">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-medium capitalize">{value}</dd>
                  </div>
                ))}
              </dl>
            </TabsContent>

            <TabsContent value="reviews" className="pt-4">
              {sellerReviews ? (
                <RatingSummary data={sellerReviews} />
              ) : (
                <Skeleton className="h-32 w-full" />
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: sticky purchase/contact panel */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-md)] backdrop-blur-xs">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold tracking-tight">{listing.title}</h1>
              <Badge
                variant={listing.status === "active" ? "default" : "secondary"}
                className="shrink-0"
              >
                {t.statuses[listing.status]}
              </Badge>
            </div>

            <div>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {fmt.price(listing.price, listing.price_type, listing.unit)}
              </p>
              {listing.price_type === "negotiable" && (
                <p className="text-xs text-muted-foreground">Price is negotiable</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Package className="size-4 shrink-0" />
                {listing.shop ? t.conditions.new : t.conditions[listing.condition]}
              </span>
              {/* `both` shows both lines rather than picking one, since the
                  whole point is that the buyer can choose. */}
              {listing.fulfillment_type !== "delivery" && (
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0" />
                  {listing.pickup_address ?? t.listing.askSeller}
                </span>
              )}
              {listing.fulfillment_type !== "pickup" && (
                <span className="flex items-center gap-2">
                  <Truck className="size-4 shrink-0" />
                  {t.listing.deliveryNote}
                </span>
              )}
            </div>

            {/* Seller row */}
            <Link
              href={sellerHref}
              className="flex items-center gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-emerald-500/40"
            >
              <div className="size-10 shrink-0 overflow-hidden rounded-full">
                <SmartImage
                  src={listing.shop?.logo_url ?? listing.seller.avatar_url}
                  alt=""
                  fallback={
                    <span className="text-sm font-semibold">
                      {sellerName.charAt(0).toUpperCase()}
                    </span>
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{sellerName}</p>
                {sellerReviews && sellerReviews.rating_count > 0 ? (
                  <StarRating
                    value={sellerReviews.average_rating}
                    count={sellerReviews.rating_count}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {listing.shop ? "Campus shop" : "Student seller"}
                  </p>
                )}
              </div>
            </Link>

            {/* Contact actions */}
            {isOwner ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/listings/${listing.id}/edit`}
                  className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
                >
                  Edit
                </Link>
                {listing.status === "active" && !listing.shop && (
                  <Button variant="outline" onClick={onMarkSold} className="flex-1">
                    Mark as sold
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" className="text-destructive" />}
                  >
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
              </div>
            ) : user ? (
              <div className="flex flex-col gap-2">
                <Button onClick={onContactSeller} className="h-10 w-full">
                  Chat with seller
                </Button>
                <div className="flex gap-2">
                  {listing.seller.phone && (
                    <a
                      href={toTelHref(listing.seller.phone)}
                      className={cn(buttonVariants({ variant: "outline" }), "h-10 flex-1")}
                    >
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
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "h-10 flex-1 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
                      )}
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <Link
                href={`/login?next=/listings/${listing.id}`}
                className={cn(buttonVariants(), "h-10 w-full")}
              >
                Log in to contact seller
              </Link>
            )}

            {actionError && <p className="text-sm text-destructive">{actionError}</p>}

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <ShareButton title={listing.title} text={`Check out "${listing.title}" on KenaBecha JU`} />
              {!isOwner && <ReportButton targetType="listing" targetId={listing.id} />}
            </div>
          </div>

          {/* Rating prompt for eligible buyers */}
          {!isOwner && submittedRating && (
            <p className="mt-4 text-sm text-success">Thanks for rating this transaction!</p>
          )}
          {!isOwner && !submittedRating && eligibility?.can_rate && (
            <div className="mt-4 rounded-2xl border border-border bg-card/60 p-5">
              <RatingForm listingId={listing.id} onSuccess={setSubmittedRating} />
            </div>
          )}
        </aside>
      </div>

      {/* Related listings */}
      {related.length > 0 && (
        <motion.section
          variants={staggerContainer(0.05)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="mt-16"
        >
          <motion.h2 variants={staggerItem} className="mb-4 text-lg font-bold tracking-tight">
            You might also like
          </motion.h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <motion.div key={item.id} variants={staggerItem}>
                <ListingCard listing={item} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
