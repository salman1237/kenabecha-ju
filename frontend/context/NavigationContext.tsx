"use client";

import { createContext, useContext } from "react";

import { FALLBACK_NAVIGATION } from "@/lib/navigation";
import type { Navigation } from "@/types/api";

/**
 * The navbar and footer menus, fetched once on the server in the root layout.
 *
 * A context rather than a fetch in each component: navigation renders on
 * every page, and two components each requesting it would double the work
 * and could disagree with one another mid-update.
 *
 * The default is the hard-coded fallback, so a component rendered outside the
 * provider still shows a working menu instead of nothing.
 */
const NavigationContext = createContext<Navigation>(FALLBACK_NAVIGATION);

export function NavigationProvider({
  navigation,
  children,
}: {
  navigation: Navigation;
  children: React.ReactNode;
}) {
  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): Navigation {
  return useContext(NavigationContext);
}
