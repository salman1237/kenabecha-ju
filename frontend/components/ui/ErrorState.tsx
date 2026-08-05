"use client";

import { motion } from "motion/react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scaleIn, slideUp, staggerContainer } from "@/lib/motion";

/**
 * Full-block error surface (page/section failed to load). Errors explain
 * what went wrong and offer a way forward — no bare red text, no apologies.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.07)}
      initial="hidden"
      animate="visible"
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-14 text-center",
        className
      )}
    >
      <motion.div
        variants={scaleIn}
        className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
      >
        <AlertTriangle className="size-6" strokeWidth={1.75} />
      </motion.div>
      <motion.p variants={slideUp} className="text-base font-semibold">
        {title}
      </motion.p>
      {description && (
        <motion.p variants={slideUp} className="max-w-sm text-sm text-muted-foreground">
          {description}
        </motion.p>
      )}
      {onRetry && (
        <motion.div variants={slideUp} className="mt-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Inline form/field-level error. Animates in rather than snapping, which is
 * the "validation animations" gap — errors appearing instantly reads as a
 * layout jump.
 */
export function FieldError({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("text-xs text-destructive", className)}
    >
      {children}
    </motion.p>
  );
}
