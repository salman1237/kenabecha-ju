import type { Transition, Variants } from "motion/react";

/**
 * Shared motion vocabulary. Before this, every section re-declared its own
 * `initial`/`whileInView` inline, so timings drifted and nothing staggered.
 * Import from here instead of hand-writing variants.
 *
 * Reduced-motion is handled globally by <MotionConfig reducedMotion="user">
 * in the root layout — Framer zeroes out transform/opacity animations for
 * users who ask for it, so these variants don't each need to check.
 */

/** Snappy but soft — the default for most UI. */
export const easeOutSoft: Transition = {
  duration: 0.4,
  ease: [0.22, 1, 0.36, 1], // easeOutQuint-ish
};

/** For things that should feel physical (drawers, cards, buttons). */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: easeOutSoft },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: easeOutSoft },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: easeOutSoft },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: easeOutSoft },
};

/**
 * Parent container that reveals children one after another. Pair with
 * `staggerItem` on each child — the parent animates nothing itself, it
 * only schedules its children.
 */
export function staggerContainer(stagger = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

export const staggerItem: Variants = slideUp;

/** Standard "reveal as it scrolls into view" props for a section. */
export const revealOnScroll = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, amount: 0.15 },
} as const;

/** Page-level enter/exit, used by the route transition wrapper. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: "easeIn" } },
};

/** Interactive lift for cards — use with `whileHover`/`whileTap`. */
export const hoverLift = {
  whileHover: { y: -4, transition: springSnappy },
  whileTap: { scale: 0.985 },
} as const;

export const pressable = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: springSnappy,
} as const;
