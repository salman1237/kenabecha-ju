"use client";

import { useState } from "react";

import { cn, mediaUrl } from "@/lib/utils";

/**
 * Images previously popped in instantly and, when a remote avatar 404'd,
 * left a broken-image glyph. This fades in on load, lazy-loads by default,
 * and falls back to a caller-supplied node on error.
 *
 * Deliberately still a plain <img>: sources are user uploads served off the
 * FastAPI /media mount plus arbitrary Google avatar hosts, so next/image
 * would need every one of them whitelisted in remotePatterns. Phase 24
 * revisits this with the loader configured properly.
 */
export function SmartImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallback,
  eager = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  fallback?: React.ReactNode;
  /** Set for above-the-fold images so they aren't lazy-loaded. */
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground",
          wrapperClassName
        )}
      >
        {fallback ?? "No photo"}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-muted", wrapperClassName)}>
      {/* Shimmer placeholder sits behind the image until it decodes. */}
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(src)}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </div>
  );
}
