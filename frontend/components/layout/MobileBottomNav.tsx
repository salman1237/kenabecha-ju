"use client";

import { Home, MessageSquare, PlusCircle, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import type { Translations } from "@/messages/en";

const ITEMS = [
  { href: "/", icon: Home, label: (t: Translations) => t.nav.home, exact: true },
  { href: "/listings", icon: Search, label: (t: Translations) => t.common.search, exact: false },
  { href: "/listings/new", icon: PlusCircle, label: (t: Translations) => t.nav.sell, exact: true },
  { href: "/inbox", icon: MessageSquare, label: (t: Translations) => t.nav.inbox, exact: false },
] as const;

/**
 * Thumb-reachable navigation for phones, where the top navbar's links are
 * buried behind a hamburger. Hidden from `md` up, where the navbar already
 * shows everything.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user } = useAuth();

  // The bar is chrome for browsing, not for the chat thread or admin — both
  // want the full height, and the thread has its own composer pinned to the
  // bottom that this would sit on top of.
  if (pathname.startsWith("/admin") || /^\/inbox\/[^/]+$/.test(pathname)) return null;

  const profileHref = user ? `/profile/${user.id}` : "/login";
  const isProfileActive = pathname.startsWith("/profile") || pathname.startsWith("/dashboard");

  return (
    <nav
      aria-label={t.nav.menu}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        "border-t border-border/70 bg-background/95 backdrop-blur-md",
        // Keeps the row clear of the iOS home indicator.
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <ul className="flex items-stretch">
        {ITEMS.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">{label(t)}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            href={profileHref}
            aria-current={isProfileActive ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              isProfileActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}
          >
            <User className="size-5" />
            <span className="max-w-full truncate px-1">
              {user ? t.nav.profile : t.nav.login}
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
