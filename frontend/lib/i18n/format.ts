import type { Locale } from "@/lib/i18n/config";

/** `bn-BD` renders Bengali numerals (০১২৩৪৫৬৭৮৯) and the Bangla month and
 *  weekday names; plain `bn` does not reliably do the former across engines. */
const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  bn: "bn-BD",
};

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** Years, IDs and similar bare numbers: localised digits but no thousands
 *  separator. Plain formatNumber turns 2026 into "2,026" / "২,০২৬", which
 *  reads as a quantity rather than a year. */
export function formatPlainNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { useGrouping: false }).format(value);
}

/** Money, with the Taka sign kept on the left in both languages — that's how
 *  prices are written on campus regardless of which language is being spoken. */
export function formatCurrency(value: number | string, locale: Locale): string {
  return `৳${formatNumber(Number(value), locale)}`;
}

export function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago" / "৩ দিন আগে". Intl.RelativeTimeFormat handles the grammar
 *  and the numerals, which is why this isn't hand-rolled per language. */
export function formatRelativeTime(iso: string, locale: Locale): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });

  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return rtf.format(-Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return rtf.format(-Math.round(seconds), "second");
}

/**
 * Price as shown on a listing. Mirrors the pure `formatPrice` in lib/utils,
 * but localises the numerals and the "free"/"negotiable" wording — those are
 * label text, so they have to come from the caller's translations rather than
 * being baked in here.
 */
export function formatPriceLocalized(
  price: string | null,
  priceType: "fixed" | "negotiable" | "free",
  locale: Locale,
  labels: { free: string; negotiable: string },
  unit?: string | null
): string {
  if (priceType === "free") return labels.free;
  if (price === null) return "";
  let amount = formatCurrency(price, locale);
  if (unit) amount += `/${unit}`;
  return priceType === "negotiable" ? `${amount} (${labels.negotiable})` : amount;
}
