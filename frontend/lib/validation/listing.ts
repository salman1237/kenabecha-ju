import { z } from "zod";

const variantSchema = z.object({
  name: z.string().min(1, "Required").max(80),
  price: z.string().min(1, "Required"),
  is_available: z.boolean(),
});

export const MAX_VARIANTS = 20;

export const listingSchema = z
  .object({
    title: z.string().min(3, "At least 3 characters").max(200),
    description: z.string().min(1, "Required"),
    price_type: z.enum(["fixed", "negotiable", "free"]),
    price: z.string().optional(),
    unit: z.string().max(20).optional(),
    // Shop listings only — see ListingForm's isShopListing guard.
    hasVariants: z.boolean().optional(),
    variants: z.array(variantSchema).max(MAX_VARIANTS).optional(),
    // .or(z.literal("")) because the native <select> still carries its old
    // defaultValue="" in form state after the field unmounts (switching from
    // Personal to a shop hides it, but react-hook-form doesn't clear values
    // on unmount) — plain .optional() only accepts undefined, not "", and
    // rejected it silently since the Condition field's error text is inside
    // the same hidden block.
    condition: z.enum(["new", "used_like_new", "used_good", "used_fair"]).optional().or(z.literal("")),
    shop_id: z.string().optional(),
    // Required here, but still nullable on the API: existing listings predate
    // the taxonomy and legitimately have no category. Uncategorised new
    // listings would be unreachable from the category browse and would keep
    // every sidebar count at zero, so the form insists on one.
    category_id: z.string().min(1, "Pick a category"),
    // Only meaningful when category_id === "other" — see the refine below.
    custom_category: z.string().max(100).optional(),
    tagsInput: z.string().optional(),
    fulfillment_type: z.enum(["pickup", "delivery", "both"]),
    pickup_address: z.string().max(500).optional(),
  })
  .refine((data) => data.hasVariants || data.price_type !== "fixed" || !!data.price, {
    message: "Price is required for fixed-price listings",
    path: ["price"],
  })
  .refine((data) => !data.hasVariants || (data.variants && data.variants.length > 0), {
    message: "Add at least one option, or turn options off",
    path: ["variants"],
  })
  .refine((data) => !!data.shop_id || !!data.condition, {
    message: "Condition is required for personal listings",
    path: ["condition"],
  })
  .refine((data) => data.fulfillment_type === "delivery" || !!data.pickup_address, {
    message: "Pickup address is required when pickup is offered",
    path: ["pickup_address"],
  })
  .refine((data) => data.category_id !== "other" || !!data.custom_category?.trim(), {
    message: "Type your category name",
    path: ["custom_category"],
  });

export type ListingFormValues = z.infer<typeof listingSchema>;
