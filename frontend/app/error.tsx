"use client";

import { useEffect } from "react";

import { FullPageError } from "@/components/layout/FullPageError";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Route-level error boundary. Without this, a throw anywhere in a page's
 * render tree takes the whole tab to a blank white screen — the nav, footer
 * and any way back all disappear with it.
 *
 * Scoped under the root layout, so the shell survives and only the page
 * content is replaced.
 */
export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    // Client-side throws never reach the server log otherwise.
    console.error("Route error:", error);
  }, [error]);

  return (
    <FullPageError
      title={t.errorPages.crashTitle}
      description={t.errorPages.crashBody}
      digest={error.digest}
      // unstable_retry re-fetches and re-renders the children, which is what
      // a transient API failure actually needs. reset() only clears the error
      // state, so a failed fetch would just fail again on the same stale data.
      onRetry={() => unstable_retry()}
    />
  );
}
