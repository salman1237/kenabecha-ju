"use client";

import { MessagesSquare, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { staggerContainer, staggerItem } from "@/lib/motion";

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: "Verified students only", body: "Every seller is a real, ID-verified JU student." },
  { icon: MessagesSquare, title: "Talk however you like", body: "In-app chat, a phone call, or WhatsApp." },
  { icon: Store, title: "Run your own shop", body: "Turn a side hustle into a proper campus storefront." },
];

/**
 * Split-screen wrapper for the auth pages: form on the left, brand panel
 * on the right. The panel is decorative context, so it's hidden below lg
 * rather than stacked — on a phone it would just push the form off-screen.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
      {/* Form side */}
      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
        className="mx-auto flex w-full max-w-md flex-col justify-center"
      >
        <motion.div variants={staggerItem} className="mb-6">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-base font-bold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-[var(--shadow-soft-primary)]">
              K
            </span>
            KenaBecha <span className="text-emerald-600 dark:text-emerald-400">JU</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </motion.div>

        <motion.div variants={staggerItem}>{children}</motion.div>

        {footer && (
          <motion.div variants={staggerItem} className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </motion.div>
        )}
      </motion.div>

      {/* Brand side */}
      <motion.aside
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 p-10 lg:flex lg:flex-col lg:justify-center"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full bg-emerald-300/15 blur-3xl"
        />

        <div className="relative">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            The marketplace built for Jahangirnagar University.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
            Buy and sell with people you actually share a campus with — no strangers, no payment
            middlemen, no fees.
          </p>

          <div className="mt-10 flex flex-col gap-6">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, body }) => (
              <div key={t} className="flex gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/70">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
