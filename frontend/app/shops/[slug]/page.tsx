"use client";

import { Package, ShoppingBag, Star, Store, UserPlus, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useLanguage } from "@/context/LanguageContext";

import { ListingCard } from "@/components/listings/ListingCard";
import { StarRating } from "@/components/ratings/StarRating";
import { ReportButton } from "@/components/ReportButton";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShareButton } from "@/components/ui/ShareButton";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { browseListings } from "@/lib/api/listings";
import { getShopBySlug, getShopReviews, getShopStats, toggleFollowShop } from "@/lib/api/shops";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { Listing, Rating, Shop, ShopStats } from "@/types/api";

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Package;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 px-3 py-3 text-center">
      <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
      <span className="text-lg font-bold leading-none tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function ShopStorefrontPage() {
  const { t, fmt } = useLanguage();
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [reviews, setReviews] = useState<Rating[]>([]);
  const [error, setError] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    getShopBySlug(params.slug)
      .then((s) => {
        setShop(s);
        return browseListings({ shop_id: s.id, limit: 50 });
      })
      .then((page) => setListings(page.items))
      .catch(() => setError(true));

    getShopStats(params.slug).then(setStats).catch(() => {});
    getShopReviews(params.slug).then(setReviews).catch(() => {});
  }, [params.slug]);

  const onToggleFollow = async () => {
    if (!user) {
      router.push(`/login?next=/shops/${params.slug}`);
      return;
    }
    if (!shop) return;

    setFollowing(true);
    try {
      const res = await toggleFollowShop(shop.id);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              is_following: res.following,
              followers: prev.followers + (res.following ? 1 : -1),
            }
          : prev
      );
    } catch {
      toast.error(t.shops.followFailed);
    } finally {
      setFollowing(false);
    }
  };

  if (error) {
    return <p className="mx-auto max-w-3xl px-6 py-12 text-sm text-destructive">Shop not found.</p>;
  }
  if (!shop) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const isOwner = user?.id === shop.owner_id;

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <motion.div variants={staggerItem}>
        <Breadcrumbs
          items={[
            { label: t.common.home, href: "/" },
            { label: t.shops.listingsTab, href: "/listings" },
            { label: shop.shop_name },
          ]}
        />
      </motion.div>

      {/* Cover banner */}
      <motion.div
        variants={staggerItem}
        className="relative h-40 w-full overflow-hidden rounded-2xl sm:h-56"
      >
        {shop.cover_url ? (
          <SmartImage src={shop.cover_url} alt="" eager />
        ) : (
          // A shop without a cover still gets a branded band rather than a
          // grey void — the storefront should never look half-built.
          <div className="h-full w-full bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-emerald-600/25" />
        )}
      </motion.div>

      {/* Identity + actions, overlapping the banner */}
      <motion.div variants={staggerItem} className="-mt-14 flex flex-col gap-4 px-1 sm:px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-[var(--shadow-soft-md)] sm:size-24">
              <SmartImage
                src={shop.logo_url}
                alt=""
                fallback={
                  <span className="text-2xl font-bold">{shop.shop_name.charAt(0).toUpperCase()}</span>
                }
              />
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-bold tracking-tight">{shop.shop_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {shop.shop_type && (
                  <Badge variant="secondary" className="text-[11px]">
                    <Store className="size-3" /> {shop.shop_type}
                  </Badge>
                )}
                <StarRating value={stats?.average_rating ?? null} count={stats?.review_count} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pb-1">
            <ShareButton title={shop.shop_name} text={`Check out ${shop.shop_name} on KenaBecha JU`} />
            {!isOwner && (
              <Button
                variant={stats?.is_following ? "outline" : "default"}
                size="sm"
                loading={following}
                onClick={onToggleFollow}
              >
                {!following && <UserPlus />}
                {stats?.is_following ? t.shops.following : t.shops.follow}
              </Button>
            )}
          </div>
        </div>

        {shop.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/90">{shop.description}</p>
        )}
      </motion.div>

      {/* Stats row */}
      {stats && (
        <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Package} value={stats.active_listings} label={t.shops.activeListings} />
          <StatTile icon={ShoppingBag} value={stats.sold_count} label={t.shops.sold} />
          <StatTile icon={Users} value={stats.followers} label={t.shops.followers} />
          <StatTile
            icon={Star}
            value={stats.average_rating ? stats.average_rating.toFixed(1) : "—"}
            label={`${fmt.number(stats.review_count)} ${t.shops.reviewsCount}`}
          />
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        <Tabs defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">{t.shops.listingsTab} ({fmt.number(listings.length)})</TabsTrigger>
            <TabsTrigger value="reviews">{t.shops.reviewsTab} ({fmt.number(reviews.length)})</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="pt-5">
            {listings.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t.shops.noActiveListings}
                description={`${shop.shop_name} hasn't listed anything right now — follow to hear about new stock.`}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="pt-5">
            {reviews.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t.shops.noReviews}
                description={t.shops.noReviewsBody}
              />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {reviews.map((r) => (
                  <div key={r.id} className="flex gap-3 py-4">
                    <div className="size-9 shrink-0 overflow-hidden rounded-full">
                      <SmartImage
                        src={r.rater.avatar_url}
                        alt=""
                        fallback={
                          <span className="text-xs font-semibold">
                            {r.rater.full_name.charAt(0).toUpperCase()}
                          </span>
                        }
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{r.rater.full_name}</span>
                        <StarRating value={r.stars} />
                      </div>
                      {r.review_text && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {r.review_text}
                        </p>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground/70">
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {!isOwner && (
        <motion.div variants={staggerItem} className="border-t border-border pt-4">
          <ReportButton targetType="shop" targetId={shop.id} />
        </motion.div>
      )}
    </motion.div>
  );
}
