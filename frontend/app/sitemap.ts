import type { MetadataRoute } from "next";

import { SERVER_API_URL, absoluteUrl } from "@/lib/site";

/**
 * Generated per request, never at build time.
 *
 * This route calls the API. With the default static/ISR behaviour Next tries
 * to prerender it during `next build`, and inside a Docker build there is no
 * backend to reach — the fetch hangs until Next's 60s export timeout, retries
 * three times, and fails the whole image build. That is exactly what happened
 * on the first production deploy: the frontend image never got built, so
 * Traefik had no container to route to and served a 404.
 *
 * A sitemap should reflect current listings anyway, so per-request is also
 * the more correct behaviour.
 */
export const dynamic = "force-dynamic";

/** Long enough for a healthy API, short enough that a sick one degrades the
 *  sitemap instead of hanging the request. */
const FETCH_TIMEOUT_MS = 5000;

type SitemapListing = { id: string; updated_at?: string; created_at: string };
type SitemapShop = { slug: string; updated_at?: string; created_at: string };

/** Never let a sitemap failure take down the route — an empty-but-valid
 *  sitemap is far better than a 500, which crawlers treat as a site problem. */
async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/listings"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/shops"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/login"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/signup"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];

  // Only active listings are reachable, so only those belong here — listing
  // sold or expired items would send crawlers to soft-404s.
  const listings = await fetchJson<{ items: SitemapListing[] }>("/listings?limit=100&sort=newest");
  const shops = await fetchJson<SitemapShop[]>("/shops?limit=100");

  return [
    ...staticRoutes,
    ...(listings?.items ?? []).map((l) => ({
      url: absoluteUrl(`/listings/${l.id}`),
      lastModified: new Date(l.updated_at ?? l.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...(shops ?? []).map((s) => ({
      url: absoluteUrl(`/shops/${s.slug}`),
      lastModified: new Date(s.updated_at ?? s.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
