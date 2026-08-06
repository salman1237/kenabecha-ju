"use client";

import {
  BookOpen,
  Heart,
  HelpCircle,
  Link2,
  LayoutDashboard,
  MessageSquare,
  Package,
  PlusCircle,
  Search,
  Shield,
  ShoppingBag,
  Star,
  Store,
  Users,
} from "lucide-react";

/**
 * The icons an admin can pick for a navigation link.
 *
 * An allow-list rather than a free-text field: lucide ships hundreds of
 * icons and importing them all would land the entire set in the client
 * bundle for the sake of a menu with five entries.
 */
export const NAV_ICONS = {
  Store,
  ShoppingBag,
  PlusCircle,
  MessageSquare,
  LayoutDashboard,
  Package,
  Search,
  Star,
  Heart,
  Users,
  BookOpen,
  Shield,
  HelpCircle,
  Link2,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;

export const NAV_ICON_NAMES = Object.keys(NAV_ICONS) as NavIconName[];

/** Falls back to a generic link icon: an unknown or removed icon name should
 *  never be the reason a menu fails to render. */
export function NavIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && NAV_ICONS[name as NavIconName]) || Link2;
  return <Icon className={className} />;
}
