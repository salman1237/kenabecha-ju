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
import { ApiError } from "@/lib/api/client";
import { createListing, updateListing, uploadListingImage, type ListingPayload } from "@/lib/api/listings";
import { getMyShops } from "@/lib/api/shops";
import { CONDITION_LABELS } from "@/lib/utils";
import { type ListingFormValues, listingSchema } from "@/lib/validation/listing";
import type { Category, Listing, Shop } from "@/types/api";

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
      setServerError(err instanceof ApiError ? err.message : "Could not save listing.");
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
          <Label htmlFor="shop_id">Sell as</Label>
          <select id="shop_id" className={selectClass} {...register("shop_id")}>
            <option value="">Personal listing</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Leave as Personal for a used-item listing</p>
        </div>
      )}
      {mode === "edit" && (
        <p className="text-sm text-muted-foreground">
          {listing?.shop ? `Shop listing under ${listing.shop.shop_name}` : "Personal listing"}
        </p>
      )}

      {mode === "create" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photos">Photos</Label>
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
                    aria-label="Remove photo"
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
            Optional, but listings with photos get far more attention — up to {MAX_PHOTOS}.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={5} {...register("description")} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category_id">Category</Label>
        <select id="category_id" className={selectClass} {...register("category_id")} defaultValue="">
          <option value="" disabled>Select category</option>
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
        <Label htmlFor="price_type">Price type</Label>
        <select id="price_type" className={selectClass} {...register("price_type")}>
          <option value="fixed">Fixed price</option>
          <option value="negotiable">Negotiable</option>
          <option value="free">Free</option>
        </select>
      </div>

      {priceType !== "free" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price">Price (৳)</Label>
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
          <Label htmlFor="unit">Unit (optional)</Label>
          <Input id="unit" placeholder="e.g. kg, piece, dozen" {...register("unit")} />
          <p className="text-xs text-muted-foreground">
            Shown as price/unit, e.g. ৳{"{price}"}/{watch("unit") || "kg"} — leave blank to just show the price.
          </p>
          {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
        </div>
      )}

      {!isShopListing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="condition">Condition</Label>
          <select id="condition" className={selectClass} {...register("condition")} defaultValue="">
            <option value="" disabled>
              Select condition
            </option>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.condition && <p className="text-xs text-destructive">{errors.condition.message}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fulfillment_type">Fulfillment</Label>
        <select id="fulfillment_type" className={selectClass} {...register("fulfillment_type")}>
          <option value="pickup">Pickup — buyer collects from you</option>
          <option value="delivery">Delivery — buyer shares their address when they contact you</option>
        </select>
        <p className="text-xs text-muted-foreground">How will the buyer get this item?</p>
      </div>

      {fulfillmentType === "pickup" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pickup_address">Pickup address</Label>
          <Input id="pickup_address" {...register("pickup_address")} />
          {errors.pickup_address ? (
            <p className="text-xs text-destructive">{errors.pickup_address.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">e.g. Room 204, Al Beruni Hall</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">Tags</Label>
        <TagInput value={tags} onChange={setTags} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {uploadingPhotos ? "Uploading photos…" : isSubmitting ? "Saving…" : mode === "create" ? "Create listing" : "Save changes"}
      </Button>
    </form>
  );
}
