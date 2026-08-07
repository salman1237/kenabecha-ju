import { z } from "zod";

export const shopSchema = z.object({
  shop_name: z.string().min(2, "At least 2 characters").max(150),
  description: z.string().max(2000).optional().or(z.literal("")),
  // Holds a category id (or "other") while the form is open — resolved to
  // the display name actually stored on the shop at submit time.
  shop_type: z.string().max(100).optional().or(z.literal("")),
  // Only meaningful when shop_type === "other".
  custom_shop_type: z.string().max(100).optional(),
});

export type ShopFormValues = z.infer<typeof shopSchema>;
