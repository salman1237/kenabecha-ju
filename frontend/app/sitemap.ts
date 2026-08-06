import type { MetadataRoute } from "next";

import { SERVER_API_URL, absoluteUrl } from "@/lib/site";

/** Re-fetched at most hourly; a student marketplace does not need the
 *  sitemap regenerated on every crawler hit. */
export const revalidate = 3600;

type SitemapListing = { id: string; updated_at?: string; created_at: string };
type SitemapShop = { slug: string; updated_at?: string; created_at: string };

/** Never let a sitemap failure take down the route — an empty-but-valid
 *  sitemap is far better than a 500, which crawlers treat as a site problem. */
async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}${path}`, { next: { revalidate } });
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
