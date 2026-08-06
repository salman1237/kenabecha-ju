import type { Locale } from "@/lib/i18n/config";
import type { Translations } from "@/messages/en";
import type { PageSection, SectionType } from "@/types/api";

/**
 * The text each section shows when the admin has not overridden it.
 *
 * Lives here rather than inline in the components so that the admin editor
 * can show the same strings as placeholders — an admin needs to see what they
 * are about to replace, and two copies of that answer would drift.
 */
export function sectionDefaults(type: SectionType, t: Translations): Record<string, string> {
  switch (type) {
    case "hero":
      return {
        badge: t.hero.badge,
        title: t.hero.title,
        subtitle: t.hero.subtitle,
        searchPlaceholder: t.hero.searchPlaceholder,
        searchButton: t.hero.searchButton,
        browseAll: t.hero.browseAll,
      };
    case "stats":
      return {};
    case "top_products":
      return { title: t.sections.topProducts, subtitle: t.sections.topProductsSub };
    case "latest_listings":
      return { title: t.sections.latestPicks, subtitle: t.sections.latestPicksSub };
    case "featured_shops":
      return { title: t.sections.featuredShops, subtitle: t.sections.featuredShopsSub };
    case "categories":
      return { title: t.sections.allProducts };
    case "how_it_works":
      return {
        title: t.sections.howItWorks,
        subtitle: t.cta.tagline,
        step1Title: t.howItWorks.step1Title,
        step1Body: t.howItWorks.step1Body,
        step2Title: t.howItWorks.step2Title,
        step2Body: t.howItWorks.step2Body,
        step3Title: t.howItWorks.step3Title,
        step3Body: t.howItWorks.step3Body,
      };
    case "reviews":
      return { title: t.sections.whatStudentsSay, subtitle: t.sections.recentReviews };
    case "cta":
      return { title: t.cta.title, subtitle: t.cta.subtitle, button: t.cta.button };
    case "newsletter":
      return { title: t.newsletter.title, body: t.newsletter.body };
  }
}

/**
 * Resolve a section's copy: admin override first, bundled translation second.
 *
 * Overrides are stored per locale — `{"title": {"en": "…", "bn": "…"}}` — so
 * editing English cannot silently leave Bangla stale. A missing key, a missing
 * locale, or an empty string all fall through to the shipped translation,
 * which is why an untouched section renders exactly as it always did.
 */
export function sectionCopy(
  section: PageSection | undefined,
  locale: Locale,
  defaults: Record<string, string>
) {
  return (key: string): string => {
    const value = section?.settings?.[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const localised = (value as Record<string, unknown>)[locale];
      if (typeof localised === "string" && localised.trim()) return localised;
    }
    // A plain string is accepted too, for settings that are not translatable.
    if (typeof value === "string" && value.trim()) return value;
    return defaults[key] ?? "";
  };
}

/** Numeric setting with a default, e.g. how many cards a rail shows. */
export function sectionNumber(
  section: PageSection | undefined,
  key: string,
  fallback: number
): number {
  const value = section?.settings?.[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
