"use client";

import { Bookmark, LayoutDashboard, MessageSquare, Package, Settings, ShoppingBag } from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";
import type { Translations } from "@/messages/en";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

// Labels are resolved per render from the active translations rather than
// frozen into a module constant at import time.
const NAV = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/listings", key: "myListings", icon: Package, exact: false },
  { href: "/dashboard/saved", key: "saved", icon: Bookmark, exact: false },
  { href: "/dashboard/settings", key: "settings", icon: Settings, exact: false },
  { href: "/shops/dashboard", key: "myShops", icon: ShoppingBag, exact: false },
  { href: "/inbox", key: "inbox", icon: MessageSquare, exact: false },
] as const;

const NAV_LABELS = {
  overview: (t: Translations) => t.dashboard.overview,
  myListings: (t: Translations) => t.dashboard.myListings,
  saved: (t: Translations) => t.nav.saved,
  settings: (t: Translations) => t.nav.settings,
  myShops: (t: Translations) => t.nav.myShops,
  inbox: (t: Translations) => t.nav.inbox,
} as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  if (!isLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Log in to view your dashboard.</p>
        <Link href="/login?next=/dashboard" className={cn(buttonVariants())}>
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          {/* Horizontal scroller on mobile, vertical rail on desktop */}
          <nav className="flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map(({ href, key, icon: Icon, exact }) => {
              const label = NAV_LABELS[key](t);
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
