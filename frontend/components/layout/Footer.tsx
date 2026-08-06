"use client";

// lucide-react dropped its brand icons (Facebook/Github/etc.) — these are
// the generic equivalents, which is fine since each link is labelled anyway.
import { Code2, Globe, Mail, MapPin, Send } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/context/LanguageContext";
import type { Translations } from "@/messages/en";

// Built from the active translations rather than a module-level constant,
// so the labels change with the language instead of being frozen at import.
function linkGroups(t: Translations) {
  return [
    {
      heading: t.footer.marketplace,
      links: [
        { label: t.footer.browseListings, href: "/listings" },
        { label: t.shops.browseTitle, href: "/shops" },
        { label: t.footer.sellAnItem, href: "/listings/new" },
        { label: t.footer.openShop, href: "/shops/dashboard" },
        { label: t.footer.myDashboard, href: "/dashboard" },
      ],
    },
    {
      heading: t.footer.account,
      links: [
        { label: t.footer.logIn, href: "/login" },
        { label: t.footer.signUp, href: "/signup" },
        { label: t.nav.inbox, href: "/inbox" },
        { label: t.footer.resetPassword, href: "/forgot-password" },
      ],
    },
    {
      heading: t.footer.campus,
      links: [
        { label: t.footer.university, href: "https://juniv.edu" },
        // Safety guidance and the community rules both live in the Terms;
        // these used to point at /listings, which was a dead end.
        { label: t.footer.safetyTips, href: "/terms#meeting-safely" },
        { label: t.footer.communityRules, href: "/terms" },
        { label: t.footer.terms, href: "/terms" },
        { label: t.footer.privacy, href: "/privacy" },
      ],
    },
  ];
}

const SOCIALS = [
  { label: "University website", href: "https://juniv.edu", icon: Globe },
  { label: "Source on GitHub", href: "https://github.com/salman1237/kenabecha-ju", icon: Code2 },
  { label: "Email support", href: "mailto:support@kenabecha.ju", icon: Mail },
];

export function Footer() {
  const { t, fmt } = useLanguage();
  const year = new Date().getFullYear();
  const groups = linkGroups(t);

  return (
    // Deliberately not scroll-revealed. The reveal helpers render their
    // content at opacity 0 and rely on Framer hydrating and an
    // IntersectionObserver firing to bring it back — which meant the whole
    // footer, every link in it, shipped invisible and stayed that way if
    // anything went wrong on the way. Site chrome at the very bottom of the
    // page gains nothing from an entrance animation and should never depend
    // on JavaScript to exist.
    <footer className="mt-24 border-t border-border/60 bg-muted/25">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
              <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-[var(--shadow-soft-primary)]">
                K
              </span>
              KenaBecha <span className="text-emerald-600 dark:text-emerald-400">JU</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t.footer.tagline}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              {t.footer.address}
            </p>
            <div className="flex items-center gap-2 pt-1">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:text-emerald-600 hover:shadow-[var(--shadow-soft-sm)] dark:hover:text-emerald-400"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {groups.map((group) => (
            <div key={group.heading} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                {group.heading}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row"
        >
          <p className="text-xs text-muted-foreground">
            © {fmt.plainNumber(year)} KenaBecha JU. {t.footer.rights}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Send className="size-3" />
            {t.footer.noPayments}
          </p>
        </div>
      </div>
    </footer>
  );
}
