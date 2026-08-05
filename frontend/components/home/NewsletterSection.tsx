"use client";

import { CheckCircle2, Mail } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { subscribeNewsletter } from "@/lib/api/public";
import { revealOnScroll, scaleIn, staggerContainer, staggerItem } from "@/lib/motion";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("loading");
    setError(null);
    try {
      await subscribeNewsletter(trimmed);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof ApiError && err.status === 422
          ? "That doesn't look like a valid email address."
          : "Couldn't subscribe right now — please try again."
      );
    }
  };

  return (
    <motion.section
      variants={staggerContainer(0.07)}
      {...revealOnScroll}
      className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
    >
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-12 text-center sm:px-12">
        {/* Soft light bloom, purely decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-white/15 blur-3xl"
        />

        <motion.div
          variants={scaleIn}
          className="relative mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm"
        >
          <Mail className="size-6" strokeWidth={1.75} />
        </motion.div>

        <motion.h2
          variants={staggerItem}
          className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          Never miss a good deal
        </motion.h2>
        <motion.p
          variants={staggerItem}
          className="relative mx-auto mt-2 max-w-md text-sm text-white/80"
        >
          Get a short weekly digest of the best new listings on campus. No spam, unsubscribe anytime.
        </motion.p>

        <motion.div variants={staggerItem} className="relative mt-6">
          <AnimatePresence mode="wait" initial={false}>
            {status === "done" ? (
              <motion.p
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 text-sm font-medium text-white"
              >
                <CheckCircle2 className="size-4" />
                You&apos;re subscribed — watch your inbox.
              </motion.p>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={onSubmit}
                className="mx-auto flex w-full max-w-md flex-col gap-2"
              >
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@juniv.edu"
                    aria-label="Email address"
                    className="h-11 flex-1 border-white/25 bg-white/15 text-white placeholder:text-white/60 focus-visible:border-white/60 focus-visible:ring-white/30"
                  />
                  <Button
                    type="submit"
                    loading={status === "loading"}
                    loadingText="Joining…"
                    className="h-11 shrink-0 bg-white px-5 text-emerald-700 hover:bg-white/90"
                  >
                    Subscribe
                  </Button>
                </div>
                <div className="text-left">
                  <FieldError className="text-white/90">{error}</FieldError>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.section>
  );
}
