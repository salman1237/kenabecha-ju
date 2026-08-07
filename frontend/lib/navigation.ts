import type { Locale } from "@/lib/i18n/config";
import type { Translations } from "@/messages/en";
import type { NavLink, NavMenu, Navigation, NavVisibility } from "@/types/api";

/**
 * Resolve a menu or link's text.
 *
 * Order: the admin's per-locale override, then the bundled translation named
 * by `translation_key`, then the href as a last resort. The override is
 * per-locale so that editing English cannot silently leave Bangla stale, and
 * an empty override falls through — which is why a seeded link, untouched,
 * reads exactly as it always did in both languages.
 */
export function navLabel(
  item: { translation_key: string | null; label: Record<string, unknown>; href?: string },
  locale: Locale,
  t: Translations
): string {
  const override = item.label?.[locale];
  if (typeof override === "string" && override.trim()) return override;

  if (item.translation_key) {
    const resolved = item.translation_key
      .split(".")
      .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], t);
    if (typeof resolved === "string" && resolved) return resolved;
  }
  return item.href ?? "";
}

/** Whether a link should be shown to the current visitor. */
export function isVisible(visibility: NavVisibility, signedIn: boolean): boolean {
  if (visibility === "signed_in") return signedIn;
  if (visibility === "signed_out") return !signedIn;
  return true;
}

export function menusAt(navigation: Navigation, location: "navbar" | "footer"): NavMenu[] {
  return navigation.menus
    .filter((menu) => menu.location === location)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function visibleLinks(menu: NavMenu, signedIn: boolean): NavLink[] {
  return [...menu.links]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((link) => isVisible(link.visibility, signedIn));
}

/**
 * What the navbar and footer show if the API cannot be reached.
 *
 * Not a nicety. Navigation renders on every page, and without this one API
 * blip would leave the whole site with no way to get anywhere — a far worse
 * failure than slightly stale menus. These are the same menus and links the
 * migration seeds, so the fallback and the database agree on day one.
 */
export const FALLBACK_NAVIGATION: Navigation = {
  navbar_controls: { search: true, language: true, theme: true, notifications: true },
  site_info: { logo_url: null, contact_email: null, whatsapp_number: null, social_links: {} },
  menus: [
    {
      id: "navbar",
      key: "navbar",
      location: "navbar",
      translation_key: null,
      label: {},
      sort_order: 0,
      is_active: true,
      links: [
        fallbackLink("nav.browse", "/listings", "Store", "always", 0),
        fallbackLink("nav.browseShops", "/shops", "ShoppingBag", "always", 1),
        fallbackLink("nav.sell", "/listings/new", "PlusCircle", "signed_in", 2),
        fallbackLink("nav.inbox", "/inbox", "MessageSquare", "signed_in", 3),
        fallbackLink("nav.myShops", "/shops/dashboard", "ShoppingBag", "signed_in", 4),
      ],
    },
    fallbackMenu("footer-marketplace", "footer.marketplace", 0, [
      ["footer.browseListings", "/listings"],
      ["shops.browseTitle", "/shops"],
      ["footer.sellAnItem", "/listings/new"],
      ["footer.openShop", "/shops/dashboard"],
      ["footer.myDashboard", "/dashboard"],
    ]),
    fallbackMenu("footer-account", "footer.account", 1, [
      ["footer.logIn", "/login"],
      ["footer.signUp", "/signup"],
      ["nav.inbox", "/inbox"],
      ["footer.resetPassword", "/forgot-password"],
    ]),
    fallbackMenu("footer-campus", "footer.campus", 2, [
      ["footer.university", "https://juniv.edu"],
      ["footer.safetyTips", "/terms#meeting-safely"],
      ["footer.communityRules", "/terms"],
      ["footer.terms", "/terms"],
      ["footer.privacy", "/privacy"],
    ]),
  ],
};

function fallbackLink(
  translationKey: string,
  href: string,
  icon: string | null,
  visibility: NavVisibility,
  sortOrder: number
): NavLink {
  return {
    id: `${translationKey}-${href}`,
    translation_key: translationKey,
    label: {},
    href,
    icon,
    sort_order: sortOrder,
    is_active: true,
    visibility,
  };
}

function fallbackMenu(
  key: string,
  translationKey: string,
  sortOrder: number,
  links: [string, string][]
): NavMenu {
  return {
    id: key,
    key,
    location: "footer",
    translation_key: translationKey,
    label: {},
    sort_order: sortOrder,
    is_active: true,
    links: links.map(([tk, href], index) => fallbackLink(tk, href, null, "always", index)),
  };
}
