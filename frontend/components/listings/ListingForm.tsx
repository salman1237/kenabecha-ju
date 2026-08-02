"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { TagInput } from "@/components/listings/TagInput";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { createListing, updateListing, type ListingPayload } from "@/lib/api/listings";
import { getMyShops } from "@/lib/api/shops";
import { CONDITION_LABELS } from "@/lib/utils";
import { type ListingFormValues, listingSchema } from "@/lib/validation/listing";
import type { Listing, Shop } from "@/types/api";

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
  const [tags, setTags] = useState<string[]>(listing?.tags.map((t) => t.name) ?? []);
  const [serverError, setServerError] = useState<string | null>(null);

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
      condition: listing?.condition,
      quantity: listing?.quantity ? String(listing.quantity) : "",
      shop_id: listing?.shop?.id ?? defaultShopId ?? "",
      fulfillment_type: listing?.fulfillment_type ?? "pickup",
      pickup_address: listing?.pickup_address ?? "",
    },
  });

  useEffect(() => {
    getMyShops().then(setShops).catch(() => {});
  }, []);

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
      condition: isShopListing ? undefined : values.condition,
      quantity: isShopListing && values.quantity ? Number(values.quantity) : undefined,
      shop_id: mode === "create" ? values.shop_id || null : undefined,
      tags,
      fulfillment_type: values.fulfillment_type,
      pickup_address: values.fulfillment_type === "pickup" ? values.pickup_address : null,
    };

    try {
      const result =
        mode === "create"
          ? await createListing(payload)
          : await updateListing(listing!.id, payload);
      onSuccess(result);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not save listing.");
    }
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
          <Input id="price" type="number" min="0" step="0.01" {...register("price")} />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
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

      {isShopListing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" type="number" min="0" {...register("quantity")} />
          <p className="text-xs text-muted-foreground">Leave blank for 1</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fulfillment_type">Fulfillment</Label>
        <select id="fulfillment_type" className={selectClass} {...register("fulfillment_type")}>
          <option value="pickup">Pickup — buyer collects from you</option>
          <option value="delivery">Delivery — buyer provides an address at checkout</option>
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
        {isSubmitting ? "Saving…" : mode === "create" ? "Create listing" : "Save changes"}
      </Button>
    </form>
  );
}
