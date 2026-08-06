"use client";

import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/utils";

/**
 * A user's photo, falling back to their initial.
 *
 * The navbar previously hardcoded the initial and never looked at
 * `avatar_url`, so anyone who uploaded a photo still saw a letter. Keeping
 * the fallback logic in one component means the two can't drift apart again.
 */
export function UserAvatar({
  name,
  avatarUrl,
  className,
  sizes = "40px",
}: {
  name: string;
  avatarUrl: string | null | undefined;
  className?: string;
  /** Passed to next/image so it fetches an appropriately sized file. */
  sizes?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
        // The gradient is the fallback surface; an image covers it entirely.
        "bg-gradient-to-tr from-emerald-600 to-teal-500 text-xs font-bold text-white",
        className
      )}
    >
      <SmartImage
        src={avatarUrl}
        alt=""
        sizes={sizes}
        fallback={<span>{name.charAt(0).toUpperCase()}</span>}
      />
    </span>
  );
}
