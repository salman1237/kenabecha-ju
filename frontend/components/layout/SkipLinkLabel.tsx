"use client";

import { useLanguage } from "@/context/LanguageContext";

/** Tiny client component so the skip link's text can be translated without
 *  turning the whole root layout into a client component — the layout has to
 *  stay a server component to read the locale cookie in the first place. */
export function SkipLinkLabel() {
  const { t } = useLanguage();
  return <>{t.nav.skipToContent}</>;
}
