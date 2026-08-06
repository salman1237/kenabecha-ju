export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Readable by the server, unlike localStorage — which is the whole point.
 *  The root layout reads this to render the first paint in the right
 *  language and to stamp the correct `lang` on <html>, so there is neither
 *  a hydration mismatch nor a flash of English. */
export const LOCALE_COOKIE = "locale";

/** One year: a language preference should outlive a browsing session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
