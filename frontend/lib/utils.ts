export function mediaUrl(path: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${apiUrl}${path}`;
}

export function formatPrice(price: string | null, priceType: "fixed" | "negotiable" | "free") {
  if (priceType === "free") return "Free";
  if (price === null) return "";
  const amount = `৳${Number(price).toLocaleString()}`;
  return priceType === "negotiable" ? `${amount} (negotiable)` : amount;
}

export const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  used_like_new: "Used - Like New",
  used_good: "Used - Good",
  used_fair: "Used - Fair",
};
