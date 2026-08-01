import { z } from "zod";

export const listingSchema = z
  .object({
    title: z.string().min(3, "At least 3 characters").max(200),
    description: z.string().min(1, "Required"),
    price_type: z.enum(["fixed", "negotiable", "free"]),
    price: z.string().optional(),
    condition: z.enum(["new", "used_like_new", "used_good", "used_fair"]).optional(),
    quantity: z.string().optional(),
    shop_id: z.string().optional(),
    tagsInput: z.string().optional(),
  })
  .refine((data) => data.price_type !== "fixed" || !!data.price, {
    message: "Price is required for fixed-price listings",
    path: ["price"],
  })
  .refine((data) => !!data.shop_id || !!data.condition, {
    message: "Condition is required for personal listings",
    path: ["condition"],
  });

export type ListingFormValues = z.infer<typeof listingSchema>;
