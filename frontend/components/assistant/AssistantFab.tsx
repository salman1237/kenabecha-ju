"use client";

import { Sparkles, X } from "lucide-react";
import { motion } from "motion/react";

import { useLanguage } from "@/context/LanguageContext";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function AssistantFab({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useLanguage();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={t.assistant.fabLabel}
      aria-expanded={open}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={springSnappy}
      className={cn(
        "fixed right-4 bottom-20 z-[60] flex size-14 items-center justify-center rounded-full",
        "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white",
        "shadow-lg shadow-emerald-600/30",
        "md:right-6 md:bottom-6"
      )}
    >
      {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
    </motion.button>
  );
}
