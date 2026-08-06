"use client";

import { AlertTriangle, Info, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useLanguage } from "@/context/LanguageContext";
import { useNavigation } from "@/context/NavigationContext";
import { cn } from "@/lib/utils";
import type { AnnouncementVariant } from "@/types/api";

/** Remembers which announcement was dismissed, by version.
 *
 *  Keyed by version rather than a single boolean so that dismissing one
 *  notice does not silence every future one — which, for the maintenance
 *  notice that actually matters, would be the worst possible outcome. */
const DISMISSED_KEY = "announcement-dismissed";

/**
 * localStorage as an external store.
 *
 * `useSyncExternalStore` rather than an effect that calls setState: reading a
 * browser-only value after mount is exactly what it exists for, and the
 * server snapshot below makes the SSR behaviour explicit — the banner is in
 * the HTML, so it is there for a reader with no JavaScript too.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Also follow storage events, so dismissing in one tab clears it in the
  // others rather than leaving the same banner on screen next door.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    // Private mode, or storage disabled. Showing the banner is the safer
    // failure: a repeated notice beats a missed one.
    return null;
  }
}

/** Server render: nothing has been dismissed, so the banner is included. */
function serverDismissed(): string | null {
  return null;
}

const STYLES: Record<AnnouncementVariant, string> = {
  info: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 border-emerald-500/25",
  warning: "bg-amber-500/12 text-amber-900 dark:text-amber-100 border-amber-500/30",
  critical: "bg-destructive/12 text-destructive border-destructive/35",
};

export function AnnouncementBanner() {
  const { locale } = useLanguage();
  const { announcement } = useNavigation();
  const dismissed = useSyncExternalStore(subscribe, readDismissed, serverDismissed);

  if (!announcement) return null;
  if (dismissed === String(announcement.version)) return null;

  const message = announcement.message?.[locale] ?? announcement.message?.en;
  if (typeof message !== "string" || !message.trim()) return null;

  const variant = announcement.variant ?? "info";
  const Icon = variant === "info" ? Info : AlertTriangle;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(announcement.version));
    } catch {
      // Nothing to persist. The banner still closes for this page view.
    }
    listeners.forEach((listener) => listener());
  };

  return (
    <div
      // polite, not assertive: this is context, not an interruption of
      // whatever a screen reader user is doing.
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-3 border-b px-4 py-2.5 text-sm",
        STYLES[variant] ?? STYLES.info
      )}
    >
      <Icon className="size-4 shrink-0" />
      <p className="text-center font-medium">{message}</p>
      {announcement.dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="ml-1 shrink-0 rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
