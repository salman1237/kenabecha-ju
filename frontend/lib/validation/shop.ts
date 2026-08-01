import { z } from "zod";

export const shopSchema = z.object({
  shop_name: z.string().min(2, "At least 2 characters").max(150),
  description: z.string().max(2000).optional().or(z.literal("")),
  shop_type: z.string().max(100).optional().or(z.literal("")),
});

export type ShopFormValues = z.infer<typeof shopSchema>;
