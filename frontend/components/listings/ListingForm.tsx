"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { TagInput } from "@/components/listings/TagInput";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCategories } from "@/lib/api/categories";
import { useLanguage } from "@/context/LanguageContext";
import { translateApiError } from "@/lib/i18n/errors";
import { createListing, updateListing, uploadListingImage, type ListingPayload } from "@/lib/api/listings";
import { getMyShops } from "@/lib/api/shops";
import { CONDITION_LABELS } from "@/lib/utils";
import { type ListingFormValues, listingSchema } from "@/lib/validation/listing";
import type { Category, Condition, Listing, Shop } from "@/types/api";

const MAX_PHOTOS = 8;

export function ListingForm({
  mode,
  listing,
  defaultShopId,
  onSuccess,
}: {
  mode: "create" | "edit";
  listing?: Listing;
  defaultShopId?: string;
  onSuccess: (listing: Listing) => void;
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<string[]>(listing?.tags.map((t) => t.name) ?? []);
  const [photos, setPhotos] = useState<File[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const { t, fmt } = useLanguage();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: listing?.title ?? "",
      description: listing?.description ?? "",
      price_type: listing?.price_type ?? "fixed",
      price: listing?.price ?? "",
      unit: listing?.unit ?? "",
      condition: listing?.condition,
      shop_id: listing?.shop?.id ?? defaultShopId ?? "",
      category_id: listing?.category?.id ?? "",
      fulfillment_type: listing?.fulfillment_type ?? "pickup",
      pickup_address: listing?.pickup_address ?? "",
    },
  });

  useEffect(() => {
    Promise.all([getMyShops(), getCategories()])
      .then(([shopsRes, catsRes]) => {
        setShops(shopsRes);
        setCategories(catsRes);
      })
      .catch(() => {});
  }, []);

  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const priceType = watch("price_type");
  const shopId = watch("shop_id");
  const fulfillmentType = watch("fulfillment_type");
  const isShopListing = mode === "edit" ? Boolean(listing?.shop) : Boolean(shopId);

  const onSubmit = async (values: ListingFormValues) => {
    setServerError(null);
    const payload: ListingPayload = {
      title: values.title,
      description: values.description,
      price_type: values.price_type,
      price: values.price_type === "free" ? null : values.price ? Number(values.price) : null,
      unit: values.price_type === "free" ? null : values.unit || null,
      condition: isShopListing || !values.condition ? undefined : (values.condition as Condition),
      shop_id: mode === "create" ? values.shop_id || null : undefined,
      category_id: values.category_id || null,
      tags,
      fulfillment_type: values.fulfillment_type,
      pickup_address: values.fulfillment_type === "pickup" ? values.pickup_address : null,
    };

    try {
      const result =
        mode === "create"
          ? await createListing(payload)
          : await updateListing(listing!.id, payload);

      if (mode === "create" && photos.length > 0) {
        setUploadingPhotos(true);
        for (const photo of photos) {
          await uploadListingImage(result.id, photo).catch(() => {
            setServerError((prev) => prev ?? "Listing created, but one or more photos failed to upload — you can add them from the listing page.");
          });
        }
        setUploadingPhotos(false);
      }

      onSuccess(result);
    } catch (err) {
      setServerError(translateApiError(err, t));
    }
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    // Convert synchronously, right here — FileList is live and tied to the input
    // element, so if this conversion happened inside the setPhotos updater (which
    // React defers), the caller's subsequent `input.value = ""` would already have
    // emptied it by the time the updater actually ran.
    const newFiles = Array.from(files);
    setPhotos((prev) => [...prev, ...newFiles].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {mode === "create" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop_id">{t.listingForm.sellAs}</Label>
          <select id="shop_id" className={selectClass} {...register("shop_id")}>
            <option value="">{t.listingForm.personalListing}</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t.listingForm.sellAsHint}</p>
        </div>
      )}
      {mode === "edit" && (
        <p className="text-sm text-muted-foreground">
          {listing?.shop ? listing.shop.shop_name : t.listingForm.personalListing}
        </p>
      )}

      {mode === "create" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photos">{t.listingForm.photos}</Label>
          {photoPreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((url, i) => (
                <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={t.listingForm.removePhoto}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Input
            id="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={photos.length >= MAX_PHOTOS}
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t.listingForm.photosHint} — {fmt.number(MAX_PHOTOS)}.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{t.listingForm.itemTitle}</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">{t.listingForm.description}</Label>
        <Textarea id="description" rows={5} {...register("description")} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category_id">{t.listingForm.category}</Label>
        <select id="category_id" className={selectClass} {...register("category_id")} defaultValue="">
          <option value="" disabled>{t.listingForm.selectCategory}</option>
          {categories.map((cat) => (
            <optgroup key={cat.id} label={`${cat.icon || ""} ${cat.name}`.trim()}>
              {cat.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {errors.category_id && <p className="text-xs text-destructive">{errors.category_id.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="price_type">{t.listingForm.priceType}</Label>
        <select id="price_type" className={selectClass} {...register("price_type")}>
          <option value="fixed">{t.common.fixed}</option>
          <option value="negotiable">{t.common.negotiable}</option>
          <option value="free">{t.common.free}</option>
        </select>
      </div>

      {priceType !== "free" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price">{t.listingForm.price} (৳)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            {...register("price")}
          />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>
      )}

      {priceType !== "free" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unit">{t.listingForm.unit} ({t.common.optional})</Label>
          <Input id="unit" placeholder={t.listingForm.unitPlaceholder} {...register("unit")} />
          <p className="text-xs text-muted-foreground">
            {t.listingForm.unitHint}
          </p>
          {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
        </div>
      )}

      {!isShopListing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="condition">{t.listingForm.conditionLabel}</Label>
          <select id="condition" className={selectClass} {...register("condition")} defaultValue="">
            <option value="" disabled>
              {t.listingForm.selectCondition}
            </option>
            {Object.keys(CONDITION_LABELS).map((value) => (
              <option key={value} value={value}>
                {t.conditions[value as keyof typeof t.conditions]}
              </option>
            ))}
          </select>
          {errors.condition && <p className="text-xs text-destructive">{errors.condition.message}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fulfillment_type">{t.listingForm.fulfillment}</Label>
        <select id="fulfillment_type" className={selectClass} {...register("fulfillment_type")}>
          <option value="pickup">{t.listingForm.fulfillmentPickup}</option>
          <option value="delivery">{t.listingForm.fulfillmentDelivery}</option>
        </select>
        <p className="text-xs text-muted-foreground">{t.listingForm.fulfillmentHint}</p>
      </div>

      {fulfillmentType === "pickup" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pickup_address">{t.listingForm.pickupAddress}</Label>
          <Input id="pickup_address" {...register("pickup_address")} />
          {errors.pickup_address ? (
            <p className="text-xs text-destructive">{errors.pickup_address.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t.listingForm.pickupAddressHint}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">{t.listingForm.tags}</Label>
        <TagInput value={tags} onChange={setTags} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {uploadingPhotos
          ? t.listingForm.uploadingPhotos
          : isSubmitting
            ? t.common.saving
            : mode === "create"
              ? t.listingForm.submitCreate
              : t.listingForm.submitEdit}
      </Button>
    </form>
  );
}
