import { HomeSections } from "@/components/home/HomeSections";
import { SiteJsonLd } from "@/components/seo/ListingJsonLd";
import { SERVER_API_URL } from "@/lib/site";
import type { PageSection, SectionType } from "@/types/api";

/**
 * The landing page is composed from the `page_sections` table, so an admin can
 * reorder, retitle, hide or remove any part of it without a deploy.
 *
 * Rendered per request rather than statically: the layout is now data, and a
 * homepage that keeps showing yesterday's arrangement until the next build
 * would make the admin screen feel broken. It also keeps this route out of
 * `next build`, where — as the sitemap route learned the hard way — there is
 * no API to reach inside the Docker build.
 */
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 5000;

/** What the page falls back to if the API cannot be reached.
 *
 *  Not a nicety: without it an API blip turns the homepage into a blank
 *  screen, which is a far worse failure than a slightly stale arrangement.
 *  These are the same ten sections the initial migration seeds, in order. */
const FALLBACK_TYPES: SectionType[] = [
  "hero",
  "stats",
  "top_products",
  "latest_listings",
  "featured_shops",
  "categories",
  "how_it_works",
  "reviews",
  "cta",
  "newsletter",
];

function fallbackSections(): PageSection[] {
  return FALLBACK_TYPES.map((type, index) => ({
    id: type,
    key: type,
    section_type: type,
    sort_order: index,
    is_active: true,
    settings: {},
    updated_at: "",
  }));
}

async function loadSections(): Promise<PageSection[]> {
  try {
    const res = await fetch(`${SERVER_API_URL}/page-sections`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return fallbackSections();
    const sections = (await res.json()) as PageSection[];
    // An empty table means every section was deleted, which is a legitimate
    // choice; an unreachable API is not. Only the latter gets the fallback.
    return sections;
  } catch {
    return fallbackSections();
  }
}

export default async function Home() {
  const sections = await loadSections();

  return (
    <div className="flex flex-col overflow-hidden">
      <SiteJsonLd />
      <HomeSections sections={sections} />
    </div>
  );
}
