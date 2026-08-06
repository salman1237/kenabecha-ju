"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The scroll-reveal wrapper and page gutter every content section shares.
 *
 * Extracted because the same six animation props were repeated verbatim in
 * nine places; with sections now reorderable, a divergence between two of
 * them would show up as one block sliding in differently from its neighbour.
 */
export function SectionShell({
  children,
  className,
  width = "wide",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "wide" | "medium" | "narrow";
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className={cn(
        "mx-auto w-full px-4 py-14 sm:px-6 sm:py-16",
        width === "wide" && "max-w-6xl",
        width === "medium" && "max-w-5xl",
        width === "narrow" && "max-w-4xl",
        className
      )}
    >
      {children}
    </motion.section>
  );
}

/** Title, optional subtitle, optional "view all" link — the header shape the
 *  three listing/shop rails have in common. */
export function SectionHeader({
  icon,
  title,
  subtitle,
  linkHref,
  linkLabel,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        </div>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {linkHref && linkLabel ? (
        <Link
          href={linkHref}
          className="shrink-0 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
