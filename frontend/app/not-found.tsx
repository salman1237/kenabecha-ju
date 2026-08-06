"use client";

import { FullPageError } from "@/components/layout/FullPageError";
import { useLanguage } from "@/context/LanguageContext";

/** Replaces Next's bare default 404 with something that keeps the user in
 *  the app — every dead link now offers a route back to browsing. */
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <FullPageError title={t.errorPages.notFoundTitle} description={t.errorPages.notFoundBody} />
  );
}
