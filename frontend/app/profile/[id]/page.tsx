"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useLanguage } from "@/context/LanguageContext";
import { translateApiError } from "@/lib/i18n/errors";

import { ListingCard } from "@/components/listings/ListingCard";
import { StarRating } from "@/components/ratings/StarRating";
import { ReportButton } from "@/components/ReportButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { updateProfile, updateWhatsAppNumber, uploadAvatar } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { browseListings } from "@/lib/api/listings";
import { getUserProfile } from "@/lib/api/users";
import { SmartImage } from "@/components/ui/SmartImage";
import type { Listing, UserProfile } from "@/types/api";

function AvatarPicker() {
  const { t } = useLanguage();
  const { user, setUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const onSelect = async (file: File) => {
    setUploading(true);
    try {
      setUser(await uploadAvatar(file));
    } catch (err) {
      toast.error(translateApiError(err, t));
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-muted-foreground"
      title={t.profile.changePhoto}
    >
      <SmartImage
        src={user.avatar_url}
        alt=""
        sizes="56px"
        fallback={<span className="text-lg font-semibold">{user.full_name.charAt(0).toUpperCase()}</span>}
      />
      <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        {uploading ? "…" : t.shops.change}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function ProfileEditForm({ onDone }: { onDone: () => void }) {
  const { t } = useLanguage();
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp_number ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!user) return null;

  const onSave = async () => {
    setSaving(true);
    setFieldError(null);
    try {
      await updateProfile({ full_name: fullName.trim(), bio: bio.trim() || null });
      const updated = await updateWhatsAppNumber(whatsapp.trim() || null);
      setUser(updated);
      toast.success(t.profile.updated);
      onDone();
    } catch (err) {
      setFieldError(translateApiError(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-4">
        <AvatarPicker />
        <p className="text-xs text-muted-foreground">{t.profile.clickPhoto}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">{t.profile.name}</Label>
        <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">{t.profile.bio}</Label>
        <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="whatsapp_number">{t.profile.whatsappNumber}</Label>
        <Input
          id="whatsapp_number"
          placeholder="01XXXXXXXXX"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t.profile.callHint} ({user.phone ?? t.profile.notSet}).
        </p>
      </div>
      {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? t.common.saving : t.common.save}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone} disabled={saving}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}

function AccountDetails({ profile, isOwnProfile }: { profile: UserProfile; isOwnProfile: boolean }) {
  const { t } = useLanguage();
  const unset = t.profile.notSet;
  const rows: [string, string][] = [
    [t.profile.email, profile.email],
    [t.profile.phone, profile.phone ?? unset],
    [t.profile.whatsapp, profile.whatsapp_number ?? unset],
    [t.profile.studentId, profile.student_id ?? unset],
    [t.profile.registrationNo, profile.registration_no ?? unset],
    [t.profile.hall, profile.hall?.name ?? unset],
    [t.profile.session, profile.session ?? unset],
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">{t.profile.accountDetails}</p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm sm:justify-start">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {!profile.profile_complete && isOwnProfile && (
        <p className="text-xs text-muted-foreground">
          {t.profile.verifyIncomplete}
        </p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { t, fmt } = useLanguage();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);

  const reloadProfile = () => {
    getUserProfile(params.id)
      .then(setProfile)
      .catch(() => setError(true));
  };

  useEffect(() => {
    reloadProfile();
    browseListings({ seller_id: params.id, personal_only: true, limit: 50 })
      .then((page) => setListings(page.items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const isOwnProfile = user?.id === params.id;

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
          <div className="size-14 shrink-0 overflow-hidden rounded-full">
            <SmartImage
              src={profile.avatar_url}
              alt=""
              sizes="56px"
              eager
              fallback={
                <span className="text-lg font-semibold">
                  {profile.full_name.charAt(0).toUpperCase()}
                </span>
              }
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.full_name}</h1>
              {profile.profile_complete && (
                <Badge variant="secondary" className="text-primary">
                  {t.profile.juVerified}
                </Badge>
              )}
            </div>
            {profile.department && (
              <p className="text-sm text-muted-foreground">
                {profile.department.name}
                {profile.batch !== null && ` · ${t.profile.batch} ${fmt.plainNumber(profile.batch)}`}
              </p>
            )}
          </div>
        </div>
        {profile.bio && <p className="text-sm text-foreground/90">{profile.bio}</p>}
        <StarRating value={profile.average_rating} count={profile.rating_count} size="md" />
        <p className="text-xs text-muted-foreground">
          {t.profile.memberSince} {fmt.date(profile.created_at)}
        </p>
        <div className="mt-1 flex items-center gap-3">
          {isOwnProfile ? (
            !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {t.profile.editProfile}
              </Button>
            )
          ) : (
            <ReportButton targetType="user" targetId={profile.id} />
          )}
        </div>
      </div>

      {isOwnProfile && editing && (
        <ProfileEditForm
          onDone={() => {
            setEditing(false);
            reloadProfile();
          }}
        />
      )}

      {!(isOwnProfile && editing) && <AccountDetails profile={profile} isOwnProfile={isOwnProfile} />}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t.profile.personalListings}</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.profile.noPersonalListings}</p>
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
          <h2 className="text-lg font-medium">{t.profile.reviews}</h2>
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
