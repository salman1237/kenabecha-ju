import { z } from "zod";

export const listingSchema = z
  .object({
    title: z.string().min(3, "At least 3 characters").max(200),
    description: z.string().min(1, "Required"),
    price_type: z.enum(["fixed", "negotiable", "free"]),
    price: z.string().optional(),
    unit: z.string().max(20).optional(),
    condition: z.enum(["new", "used_like_new", "used_good", "used_fair"]).optional(),
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
