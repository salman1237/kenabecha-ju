"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { scaleIn, slideUp, staggerContainer } from "@/lib/motion";

/**
 * Replaces the bare `<p className="text-muted-foreground">No X yet.</p>`
 * pattern that was scattered across the app. An empty state is a real
 * moment in the UI — it should say what's missing and offer the next action.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.07)}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center",
        className
      )}
    >
      <motion.div
        variants={scaleIn}
        className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <Icon className="size-6" strokeWidth={1.75} />
      </motion.div>
      <motion.p variants={slideUp} className="text-base font-semibold">
        {title}
      </motion.p>
      {description && (
        <motion.p variants={slideUp} className="max-w-sm text-sm text-muted-foreground">
          {description}
        </motion.p>
      )}
      {action && (
        <motion.div variants={slideUp} className="mt-2">
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
