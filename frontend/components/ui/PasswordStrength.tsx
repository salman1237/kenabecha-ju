"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

/**
 * Heuristic strength meter. Deliberately advisory only — the actual
 * requirement (8+ characters) is enforced by the Zod schema and the
 * backend. This exists to nudge toward better passwords, not to gate.
 */
function score(password: string): { value: number; label: string; tone: string } {
  if (!password) return { value: 0, label: "", tone: "" };

  let points = 0;
  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^\w\s]/.test(password)) points++;

  // Long passphrases shouldn't be punished for lacking symbol soup.
  if (password.length >= 16) points = Math.max(points, 4);

  const capped = Math.min(points, 4);
  return [
    { value: 1, label: "Very weak", tone: "bg-destructive" },
    { value: 1, label: "Weak", tone: "bg-destructive" },
    { value: 2, label: "Fair", tone: "bg-amber-500" },
    { value: 3, label: "Good", tone: "bg-emerald-500" },
    { value: 4, label: "Strong", tone: "bg-emerald-600" },
  ][capped];
}

export function PasswordStrength({ password }: { password: string }) {
  const { value, label, tone } = useMemo(() => score(password), [password]);

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="flex flex-col gap-1.5 pt-1"
    >
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={false}
              animate={{ scaleX: i <= value ? 1 : 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ transformOrigin: "left" }}
              className={cn("h-full w-full rounded-full", tone)}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Password strength: <span className="font-medium">{label}</span>
      </p>
    </motion.div>
  );
}
