"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { FormField, inputClass } from "@/components/ui/FormField";
import { TagInput } from "@/components/listings/TagInput";
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
        <FormField label="Sell as" htmlFor="shop_id" hint="Leave as Personal for a used-item listing">
          <select id="shop_id" className={inputClass} {...register("shop_id")}>
            <option value="">Personal listing</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {mode === "edit" && (
        <p className="text-sm text-zinc-500">
          {listing?.shop ? `Shop listing under ${listing.shop.shop_name}` : "Personal listing"}
        </p>
      )}

      <FormField label="Title" htmlFor="title" error={errors.title?.message}>
        <input id="title" className={inputClass} {...register("title")} />
      </FormField>

      <FormField label="Description" htmlFor="description" error={errors.description?.message}>
        <textarea id="description" rows={5} className={inputClass} {...register("description")} />
      </FormField>

      <FormField label="Price type" htmlFor="price_type">
        <select id="price_type" className={inputClass} {...register("price_type")}>
          <option value="fixed">Fixed price</option>
          <option value="negotiable">Negotiable</option>
          <option value="free">Free</option>
        </select>
      </FormField>

      {priceType !== "free" && (
        <FormField label="Price (৳)" htmlFor="price" error={errors.price?.message}>
          <input id="price" type="number" min="0" step="0.01" className={inputClass} {...register("price")} />
        </FormField>
      )}

      {!isShopListing && (
        <FormField label="Condition" htmlFor="condition" error={errors.condition?.message}>
          <select id="condition" className={inputClass} {...register("condition")} defaultValue="">
            <option value="" disabled>
              Select condition
            </option>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {isShopListing && (
        <FormField label="Quantity" htmlFor="quantity" hint="Leave blank for 1">
          <input id="quantity" type="number" min="0" className={inputClass} {...register("quantity")} />
        </FormField>
      )}

      <FormField label="Fulfillment" htmlFor="fulfillment_type" hint="How will the buyer get this item?">
        <select id="fulfillment_type" className={inputClass} {...register("fulfillment_type")}>
          <option value="pickup">Pickup — buyer collects from you</option>
          <option value="delivery">Delivery — buyer provides an address at checkout</option>
        </select>
      </FormField>

      {fulfillmentType === "pickup" && (
        <FormField
          label="Pickup address"
          htmlFor="pickup_address"
          error={errors.pickup_address?.message}
          hint="e.g. Room 204, Al Beruni Hall"
        >
          <input id="pickup_address" className={inputClass} {...register("pickup_address")} />
        </FormField>
      )}

      <FormField label="Tags" htmlFor="tags">
        <TagInput value={tags} onChange={setTags} />
      </FormField>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {isSubmitting ? "Saving…" : mode === "create" ? "Create listing" : "Save changes"}
      </button>
    </form>
  );
}
