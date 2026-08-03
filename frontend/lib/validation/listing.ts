import { z } from "zod";

export const listingSchema = z
  .object({
    title: z.string().min(3, "At least 3 characters").max(200),
    description: z.string().min(1, "Required"),
    price_type: z.enum(["fixed", "negotiable", "free"]),
    price: z.string().optional(),
    unit: z.string().max(20).optional(),
    // .or(z.literal("")) because the native <select> still carries its old
    // defaultValue="" in form state after the field unmounts (switching from
    // Personal to a shop hides it, but react-hook-form doesn't clear values
    // on unmount) — plain .optional() only accepts undefined, not "", and
    // rejected it silently since the Condition field's error text is inside
    // the same hidden block.
    condition: z.enum(["new", "used_like_new", "used_good", "used_fair"]).optional().or(z.literal("")),
    shop_id: z.string().optional(),
    tagsInput: z.string().optional(),
    fulfillment_type: z.enum(["pickup", "delivery"]),
    pickup_address: z.string().max(500).optional(),
  })
  .refine((data) => data.price_type !== "fixed" || !!data.price, {
    message: "Price is required for fixed-price listings",
    path: ["price"],
  })
  .refine((data) => !!data.shop_id || !!data.condition, {
    message: "Condition is required for personal listings",
    path: ["condition"],
  })
  .refine((data) => data.fulfillment_type !== "pickup" || !!data.pickup_address, {
    message: "Pickup address is required when pickup is selected",
    path: ["pickup_address"],
  });

export type ListingFormValues = z.infer<typeof listingSchema>;
