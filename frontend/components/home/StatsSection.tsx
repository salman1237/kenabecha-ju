"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { Package, ShoppingBag, Star, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getPublicStats } from "@/lib/api/public";
import { revealOnScroll, staggerContainer, staggerItem } from "@/lib/motion";
import type { PublicStats } from "@/types/api";

/** Counts up to `value` once scrolled into view. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // Respect reduced motion by jumping straight to the final number
    // rather than animating — a ticking counter is exactly the kind of
    // motion the preference is asking us to skip.
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.floor(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduceMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
    </span>
  );
}

const ITEMS = [
  { key: "total_users", label: "Students", icon: Users },
  { key: "total_active_listings", label: "Active listings", icon: Package },
  { key: "total_shops", label: "Campus shops", icon: ShoppingBag },
  { key: "total_ratings", label: "Ratings given", icon: Star },
] as const;

export function StatsSection() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    getPublicStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  // Nothing to brag about yet / endpoint failed — drop the band entirely
  // rather than rendering a row of zeroes.
  if (!stats) return null;

  return (
    <motion.section
      variants={staggerContainer(0.08)}
      {...revealOnScroll}
      className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
    >
      <div className="grid grid-cols-2 gap-3 rounded-3xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.06] to-teal-500/[0.04] p-5 sm:gap-4 sm:p-8 md:grid-cols-4 dark:border-emerald-400/15">
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <motion.div
            key={key}
            variants={staggerItem}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <span className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              <CountUp value={stats[key]} />
            </span>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
