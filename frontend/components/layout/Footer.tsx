"use client";

// lucide-react dropped its brand icons (Facebook/Github/etc.) — these are
// the generic equivalents, which is fine since each link is labelled anyway.
import { Code2, Globe, Mail, MapPin, Send } from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNavigation } from "@/context/NavigationContext";
import { menusAt, navLabel, visibleLinks } from "@/lib/navigation";

const SOCIALS = [
  { label: "University website", href: "https://juniv.edu", icon: Globe },
  { label: "Source on GitHub", href: "https://github.com/salman1237/kenabecha-ju", icon: Code2 },
  { label: "Email support", href: "mailto:support@kenabecha.ju", icon: Mail },
];

export function Footer() {
  const { t, fmt, locale } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const year = new Date().getFullYear();

  const columns = menusAt(navigation, "footer");

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

          {/* Link columns — managed from the admin panel. */}
          {columns.map((column) => {
            const links = visibleLinks(column, Boolean(user));
            // A column with nothing to show for this visitor would leave a
            // gap in the grid and a heading with no links under it.
            if (links.length === 0) return null;
            return (
              <div key={column.id} className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                  {navLabel(column, locale, t)}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {links.map((link) => {
                    const external = !link.href.startsWith("/");
                    const className =
                      "text-sm text-muted-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400";
                    return (
                      <li key={link.id}>
                        {external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={className}
                          >
                            {navLabel(link, locale, t)}
                          </a>
                        ) : (
                          <Link href={link.href} className={className}>
                            {navLabel(link, locale, t)}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
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
