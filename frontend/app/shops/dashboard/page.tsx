"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Camera, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/context/LanguageContext";
import { CategorySelectOptions, OTHER_CATEGORY_VALUE } from "@/components/categories/CategorySelectOptions";
import { FormSection } from "@/components/ui/FormSection";
import { getCategories } from "@/lib/api/categories";
import { categoryIdByName, categoryNameById } from "@/lib/categoryTree";
import { cn } from "@/lib/utils";
import { translateApiError } from "@/lib/i18n/errors";

import { CompleteProfilePrompt } from "@/components/auth/CompleteProfilePrompt";
import { selectClass } from "@/components/ui/FormField";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { createShop, deleteShop, getMyShops, updateShop, uploadShopCover, uploadShopLogo } from "@/lib/api/shops";
import { ApiError } from "@/lib/api/client";
import { SmartImage } from "@/components/ui/SmartImage";
import { type ShopFormValues, shopSchema } from "@/lib/validation/shop";
import type { Category, Shop } from "@/types/api";

function ShopLogoPicker({ shop, onUpdated }: { shop: Shop; onUpdated: (shop: Shop) => void }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onSelect = async (file: File) => {
    setUploading(true);
    try {
      const updated = await uploadShopLogo(shop.id, file);
      onUpdated(updated);
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
      className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground"
      title={t.shops.changeLogo}
      aria-label={t.shops.changeLogo}
    >
      <SmartImage
        src={shop.logo_url}
        alt=""
        sizes="48px"
        fallback={<span className="text-sm font-semibold">{shop.shop_name.charAt(0).toUpperCase()}</span>}
      />
      {/* Always visible, not a hover reveal — hover has no equivalent on
          touch, and even with a mouse a text label that appears only when
          the cursor happens to land here reads as a glitch rather than a
          control. */}
      <span className="absolute -bottom-0.5 -right-0.5 z-10 flex size-5 items-center justify-center rounded-full border-2 border-background bg-foreground text-background">
        {uploading ? (
          <span className="size-1.5 animate-pulse rounded-full bg-background" />
        ) : (
          <Camera className="size-2.5" />
        )}
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

function ShopCoverPicker({ shop, onUpdated }: { shop: Shop; onUpdated: (shop: Shop) => void }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onSelect = async (file: File) => {
    setUploading(true);
    try {
      const updated = await uploadShopCover(shop.id, file);
      onUpdated(updated);
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
      className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md bg-muted text-xs font-medium text-muted-foreground"
      aria-label={t.shops.changeCover}
    >
      <SmartImage src={shop.cover_url} alt="" sizes="100vw" fallback={t.shops.noCoverImage} />
      {/* Always visible, not a hover reveal — see ShopLogoPicker above. */}
      <span className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-foreground/90 px-2 py-1 text-[11px] font-medium text-background">
        {uploading ? (
          t.shops.uploading
        ) : (
          <>
            <Camera className="size-3" />
            {t.shops.changeCover}
          </>
        )}
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

function ShopEditForm({
  shop,
  categories,
  onUpdated,
  onSaved,
  onCancel,
}: {
  shop: Shop;
  categories: Category[];
  onUpdated: (shop: Shop) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  // The stored shop_type is a plain name string (not an id) — match it back
  // to a real category for the select, or fall back to "Other" with the
  // existing text preserved, rather than always resetting to blank.
  const matchedCategoryId = shop.shop_type ? categoryIdByName(categories, shop.shop_type) : undefined;
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      shop_name: shop.shop_name,
      shop_type: matchedCategoryId ?? (shop.shop_type ? OTHER_CATEGORY_VALUE : ""),
      custom_shop_type: matchedCategoryId ? "" : shop.shop_type ?? "",
      description: shop.description ?? "",
    },
  });
  const shopType = watch("shop_type");

  const onSubmit = async (values: ShopFormValues) => {
    setServerError(null);
    const resolvedType =
      values.shop_type === OTHER_CATEGORY_VALUE
        ? values.custom_shop_type?.trim()
        : categoryNameById(categories, values.shop_type ?? "");
    try {
      const updated = await updateShop(shop.id, {
        shop_name: values.shop_name,
        description: values.description || undefined,
        shop_type: resolvedType || undefined,
      });
      onUpdated(updated);
      onSaved();
    } catch (err) {
      setServerError(translateApiError(err, t));
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/25 bg-card/60 p-4 sm:p-5">
      {/* Branding lives in the edit view, where a seller looks for it. The
          logo picker used to appear only on the *collapsed* row, so opening
          Edit removed the one control that could change it. */}
      <FormSection title={t.shops.brandingTitle} description={t.shops.brandingHint}>
        <ShopCoverPicker shop={shop} onUpdated={onUpdated} />
        <div className="flex items-center gap-3">
          <ShopLogoPicker shop={shop} onUpdated={onUpdated} />
          <p className="text-xs text-muted-foreground">{t.shops.logo}</p>
        </div>
      </FormSection>

      <FormSection title={t.shops.detailsTitle} description={t.shops.detailsHint}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`shop_name_${shop.id}`}>{t.shops.shopName}</Label>
            <Input id={`shop_name_${shop.id}`} {...register("shop_name")} />
            {errors.shop_name && (
              <p className="text-xs text-destructive">{errors.shop_name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`shop_type_${shop.id}`}>{t.shops.shopType}</Label>
            <select
              id={`shop_type_${shop.id}`}
              className={selectClass}
              {...register("shop_type")}
              defaultValue={matchedCategoryId ?? (shop.shop_type ? OTHER_CATEGORY_VALUE : "")}
            >
              <option value="">{t.listingForm.selectCategory}</option>
              <CategorySelectOptions categories={categories} otherLabel={t.listingForm.otherCategory} />
            </select>
            <p className="text-xs text-muted-foreground">{t.shops.shopTypeHint}</p>
            {shopType === OTHER_CATEGORY_VALUE && (
              <Input
                id={`custom_shop_type_${shop.id}`}
                placeholder={t.listingForm.customCategoryPlaceholder}
                {...register("custom_shop_type")}
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`description_${shop.id}`}>{t.shops.description}</Label>
            <Textarea id={`description_${shop.id}`} rows={3} {...register("description")} />
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? t.common.saving : t.common.save}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </FormSection>
    </div>
  );
}

export default function MyShopsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { t, fmt } = useLanguage();
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ShopFormValues>({ resolver: zodResolver(shopSchema) });
  const shopType = watch("shop_type");

  const load = () => {
    setLoading(true);
    getMyShops()
      .then(setShops)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    getMyShops()
      .then(setShops)
      .finally(() => setLoading(false));
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, [user]);

  const onSubmit = async (values: ShopFormValues) => {
    setServerError(null);
    const resolvedType =
      values.shop_type === OTHER_CATEGORY_VALUE
        ? values.custom_shop_type?.trim()
        : categoryNameById(categories, values.shop_type ?? "");
    try {
      const shop = await createShop({
        shop_name: values.shop_name,
        description: values.description || undefined,
        shop_type: resolvedType || undefined,
      });
      if (logoFile) {
        await uploadShopLogo(shop.id, logoFile).catch(() => {
          toast.error("Shop created, but the logo failed to upload — you can add it below.");
        });
      }
      if (coverFile) {
        await uploadShopCover(shop.id, coverFile).catch(() => {
          toast.error("Shop created, but the cover photo failed to upload — you can add it below.");
        });
      }
      reset();
      setLogoFile(null);
      setCoverFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not create shop.");
    }
  };

  const onDelete = async (shopId: string) => {
    await deleteShop(shopId);
    load();
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        <a href="/login?next=/shops/dashboard" className="font-medium text-foreground">
          Log in
        </a>{" "}
        to manage your shops.
      </div>
    );
  }

  if (!authLoading && user && !user.profile_complete) {
    return <CompleteProfilePrompt next="/shops/dashboard" action="open a shop" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{t.shops.myShops}</h1>
          <p className="text-sm text-muted-foreground">{t.shops.dashboardSubtitle}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "outline" : "default"}>
          {showForm ? t.common.cancel : t.shops.newShop2}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shop_name">{t.shops.shopName}</Label>
                <Input id="shop_name" {...register("shop_name")} />
                {errors.shop_name && <p className="text-xs text-destructive">{errors.shop_name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shop_type">{t.shops.shopType}</Label>
                <select id="shop_type" className={selectClass} {...register("shop_type")} defaultValue="">
                  <option value="">{t.listingForm.selectCategory}</option>
                  <CategorySelectOptions categories={categories} otherLabel={t.listingForm.otherCategory} />
                </select>
                <p className="text-xs text-muted-foreground">{t.shops.shopTypeHint}</p>
                {shopType === OTHER_CATEGORY_VALUE && (
                  <Input
                    id="custom_shop_type"
                    placeholder={t.listingForm.customCategoryPlaceholder}
                    {...register("custom_shop_type")}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} {...register("description")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="logo">
                  {t.shops.logo} ({t.common.optional})
                </Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cover">
                  {t.shops.cover} ({t.common.optional})
                </Label>
                <Input
                  id="cover"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" disabled={isSubmitting} className="self-start">
                {isSubmitting ? "Creating…" : "Create shop"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border p-6">
          <p className="text-sm font-medium">{t.shops.noShops}</p>
          <p className="text-sm text-muted-foreground">{t.shops.noShopsCta}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shops.map((shop) =>
            editingShopId === shop.id ? (
              <ShopEditForm
                key={shop.id}
                shop={shop}
                categories={categories}
                onUpdated={(updated) =>
                  setShops((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
                }
                onSaved={() => setEditingShopId(null)}
                onCancel={() => setEditingShopId(null)}
              />
            ) : (
              <Card key={shop.id} className="overflow-hidden">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    <SmartImage
                      src={shop.logo_url}
                      alt=""
                      sizes="48px"
                      fallback={<span className="text-sm font-semibold">{shop.shop_name.charAt(0).toUpperCase()}</span>}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/shops/${shop.slug}`} className="font-semibold hover:underline">
                        {shop.shop_name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {shop.shop_type || t.shops.uncategorized} ·{" "}
                        {fmt.number(shop.listing_count)} {t.shops.activeListings2} ·{" "}
                        {fmt.number(shop.follower_count)} {t.shops.followers}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/listings/new?shop_id=${shop.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        <PlusCircle /> {t.shops.addListing}
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setEditingShopId(shop.id)}>
                        <Pencil /> {t.common.edit}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
                          <Trash2 /> {t.common.delete}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.shops.deleteShop}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Its listings will remain but lose their shop association.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(shop.id)} variant="destructive">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
