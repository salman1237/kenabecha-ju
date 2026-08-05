import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mediaUrl(path: string) {
  // Already absolute (e.g. a Google avatar) — leave it alone.
  if (/^https?:\/\//.test(path)) return path;
  // Backend media paths stay relative: next.config rewrites /media/* to the
  // backend's internal address, which keeps them same-origin so next/image
  // can optimize them without an allow-list. See the comment in next.config.ts.
  return path;
}

export function formatPrice(
  price: string | null,
  priceType: "fixed" | "negotiable" | "free",
  unit?: string | null
) {
  if (priceType === "free") return "Free";
  if (price === null) return "";
  let amount = `৳${Number(price).toLocaleString()}`;
  if (unit) amount += `/${unit}`;
  return priceType === "negotiable" ? `${amount} (negotiable)` : amount;
}

function toBangladeshDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return digits;
}

export function toTelHref(phone: string) {
  const digits = toBangladeshDigits(phone);
  return `tel:+${digits}`;
}

export function toWhatsAppHref(phone: string, text?: string) {
  const digits = toBangladeshDigits(phone);
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

export const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  used_like_new: "Used - Like New",
  used_good: "Used - Good",
  used_fair: "Used - Fair",
};
