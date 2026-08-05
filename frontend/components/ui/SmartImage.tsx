"use client";

import Image from "next/image";
import { useState } from "react";

import { cn, mediaUrl } from "@/lib/utils";

/**
 * The single image primitive for the app. Uses next/image for automatic
 * format negotiation (AVIF/WebP), resizing and lazy loading, and adds the
 * things it doesn't give you: a shimmer while loading, a fade-in on
 * decode, and a graceful fallback when the source 404s (which real user
 * uploads and expired Google avatar URLs both do).
 *
 * Every call site renders into a sized container, so `fill` is the right
 * mode here — there's no intrinsic width/height to declare up front.
 */
export function SmartImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallback,
  eager = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  fallback?: React.ReactNode;
  /** Set for above-the-fold images so they aren't lazy-loaded. */
  eager?: boolean;
  /** Helps the optimizer pick a width; override for large hero images. */
  sizes?: string;
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
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />}
      <Image
        src={mediaUrl(src)}
        alt={alt}
        fill
        sizes={sizes}
        priority={eager}
        loading={eager ? undefined : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </div>
  );
}
