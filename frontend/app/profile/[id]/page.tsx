"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ListingCard } from "@/components/listings/ListingCard";
import { StarRating } from "@/components/ratings/StarRating";
import { ReportButton } from "@/components/ReportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { updateWhatsAppNumber } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { browseListings } from "@/lib/api/listings";
import { getUserProfile } from "@/lib/api/users";
import type { Listing, UserProfile } from "@/types/api";

function ContactSettings() {
  const { user, setUser } = useAuth();
  const [value, setValue] = useState(user?.whatsapp_number ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!user) return null;

  const onSave = async () => {
    setSaving(true);
    setFieldError(null);
    try {
      const updated = await updateWhatsAppNumber(value.trim() || null);
      setUser(updated);
      toast.success("WhatsApp number updated");
    } catch (err) {
      setFieldError(err instanceof ApiError ? err.message : "Could not update WhatsApp number.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">Contact options for your listings</p>
        <p className="text-xs text-muted-foreground">
          Buyers will see a Call button using your verified phone ({user.phone ?? "not set"}), plus a
          WhatsApp button if you add a number below.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="whatsapp_number">WhatsApp number</Label>
        <Input
          id="whatsapp_number"
          placeholder="01XXXXXXXXX"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
      </div>
      <Button size="sm" className="self-start" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    getUserProfile(params.id)
      .then(setProfile)
      .catch(() => setError(true));
    browseListings({ seller_id: params.id, personal_only: true, limit: 50 })
      .then((page) => setListings(page.items))
      .catch(() => {});
  }, [params.id]);

  if (error) return <p className="mx-auto max-w-3xl px-6 py-12 text-sm text-destructive">User not found.</p>;
  if (!profile) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{profile.full_name}</h1>
            {profile.department && (
              <p className="text-sm text-muted-foreground">
                {profile.department.name} · Batch {profile.batch}
              </p>
            )}
          </div>
        </div>
        {profile.bio && <p className="text-sm text-foreground/90">{profile.bio}</p>}
        <StarRating value={profile.average_rating} count={profile.rating_count} size="md" />
        <p className="text-xs text-muted-foreground">
          Member since {new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
        </p>
        <div className="mt-1">
          <ReportButton targetType="user" targetId={profile.id} />
        </div>
      </div>

      {user?.id === profile.id && <ContactSettings />}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Personal listings</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No personal listings.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      {profile.shops.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Shops</h2>
          <div className="flex flex-col gap-3">
            {profile.shops.map((shop) => (
              <Link key={shop.id} href={`/shops/${shop.slug}`}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{shop.shop_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {shop.shop_type ?? "Uncategorized"} · {shop.listing_count} active listing
                        {shop.listing_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StarRating value={shop.average_rating} count={shop.rating_count} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profile.recent_ratings.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Reviews</h2>
          <div className="flex flex-col divide-y divide-border">
            {profile.recent_ratings.map((rating) => (
              <div key={rating.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{rating.rater.full_name}</span>
                  <StarRating value={rating.stars} />
                </div>
                {rating.review_text && <p className="text-sm text-muted-foreground">{rating.review_text}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
