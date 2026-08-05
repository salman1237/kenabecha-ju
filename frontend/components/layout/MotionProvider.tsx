"use client";

import { MotionConfig } from "motion/react";

/**
 * `reducedMotion="user"` makes Framer respect the OS-level
 * prefers-reduced-motion setting globally: transform and layout animations
 * are skipped, opacity still crossfades. Without this every `motion.*` in
 * the app would animate regardless of the user's accessibility preference.
 *
 * The CSS side of the same concern lives in globals.css — that one covers
 * Tailwind transitions and smooth scrolling, which Framer never sees.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
