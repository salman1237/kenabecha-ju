"use client";

import { motion } from "motion/react";
import React from "react";

import { cn } from "@/lib/utils";

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function GradientCard({ children, className, glow = true, ...props }: GradientCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-background/80 p-5 shadow-sm backdrop-blur-md transition-all hover:border-emerald-500/40 hover:shadow-lg dark:border-emerald-400/20 dark:hover:border-emerald-400/40",
        glow && "before:absolute before:-left-12 before:-top-12 before:h-24 before:w-24 before:rounded-full before:bg-emerald-500/10 before:blur-xl dark:before:bg-emerald-400/10",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
