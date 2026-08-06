/**
 * Canonical public origin, used for metadataBase, sitemap entries and
 * absolute Open Graph URLs.
 *
 * Social crawlers and search engines will not resolve relative URLs, so this
 * has to be absolute and has to match what the site is actually served on —
 * hence an env var rather than a hardcoded constant.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "KenaBecha JU";

export const SITE_DESCRIPTION =
  "The trusted marketplace for Jahangirnagar University students — buy and sell textbooks, electronics and dorm essentials, or run your own campus shop.";

/**
 * Server-side base for API calls made during rendering (sitemap,
 * generateMetadata). Inside Docker the browser-facing URL points at the
 * frontend container itself, so the internal address has to win here — the
 * same trap documented for the image optimizer in next.config.ts.
 */
export const SERVER_API_URL = (
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

/** Absolute URL for a path, for canonical links and OG tags. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
