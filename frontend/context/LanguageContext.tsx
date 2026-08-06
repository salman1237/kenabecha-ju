"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/lib/i18n/config";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPriceLocalized,
  formatRelativeTime,
} from "@/lib/i18n/format";
import { bn } from "@/messages/bn";
import { en, type Translations } from "@/messages/en";

const MESSAGES: Record<Locale, Translations> = { en, bn };

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  /** Formatters already bound to the active locale, so callers never have to
   *  thread `locale` through by hand — the commonest source of a stray
   *  English numeral on an otherwise Bangla page. */
  fmt: {
    number: (value: number) => string;
    currency: (value: number | string) => string;
    date: (iso: string) => string;
    dateTime: (iso: string) => string;
    relativeTime: (iso: string) => string;
    price: (
      price: string | null,
      priceType: "fixed" | "negotiable" | "free",
      unit?: string | null
    ) => string;
  };
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  /** Read from the cookie by the root layout on the server. Passing it in —
   *  rather than reading localStorage in a state initializer — is what keeps
   *  the server and client first renders identical. The previous version did
   *  the latter and failed hydration outright whenever Bangla was selected. */
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};samesite=lax`;
    // Keep the document language honest for screen readers, and for the
    // browser's own hyphenation and font fallback.
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t: MESSAGES[locale],
      fmt: {
        number: (v) => formatNumber(v, locale),
        currency: (v) => formatCurrency(v, locale),
        date: (iso) => formatDate(iso, locale),
        dateTime: (iso) => formatDateTime(iso, locale),
        relativeTime: (iso) => formatRelativeTime(iso, locale),
        price: (price, priceType, unit) =>
          formatPriceLocalized(price, priceType, locale, MESSAGES[locale].common, unit),
      },
    }),
    [locale, setLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
