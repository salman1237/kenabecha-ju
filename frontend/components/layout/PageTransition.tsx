"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

import { pageTransition } from "@/lib/motion";

/**
 * Route-level enter/exit animation. Keyed on pathname so AnimatePresence
 * sees a new child per navigation.
 *
 * `mode="wait"` is deliberately NOT used — it would hold the outgoing page
 * on screen for the full exit duration before the new one mounts, which
 * makes every navigation feel slower than it is. Overlapping is fine here
 * because both pages are absolutely in normal flow only briefly.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        variants={pageTransition}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
