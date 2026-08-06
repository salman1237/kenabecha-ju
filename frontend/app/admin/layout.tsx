"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

/** `adminOnly` mirrors the backend: moderators can act on content and
 *  reports, but user roles, the audit log, and the shape of the landing page
 *  are an admin's to change. Showing a moderator a tab that 403s on click
 *  would be worse than not showing it. */
const TABS = [
  { href: "/admin", label: "Stats", adminOnly: true },
  { href: "/admin/users", label: "Users", adminOnly: true },
  { href: "/admin/listings", label: "Listings", adminOnly: false },
  { href: "/admin/shops", label: "Shops", adminOnly: false },
  { href: "/admin/reports", label: "Reports", adminOnly: false },
  { href: "/admin/sections", label: "Landing page", adminOnly: true },
  { href: "/admin/categories", label: "Categories", adminOnly: true },
  { href: "/admin/audit", label: "Audit log", adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) return null;

  const isAdmin = user?.role === "admin";
  const isStaff = isAdmin || user?.role === "moderator";

  const visibleTabs = TABS.filter((tab) => isAdmin || !tab.adminOnly);
  // Longest match wins, so a future /admin/users/[id] resolves to the Users
  // tab rather than to /admin.
  const section = [...TABS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  // Typing an admin-only URL directly has to be refused here too, or a
  // moderator gets a page that renders and then 403s on every request.
  const allowed = isStaff && section !== undefined && (isAdmin || !section.adminOnly);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-muted-foreground">
        You don&apos;t have access to this page.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isAdmin ? "Admin" : "Moderation"}
      </h1>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              pathname === tab.href
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
