"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { sectionCopy, sectionDefaults } from "@/lib/sectionCopy";

import { SectionShell } from "./SectionShell";
import type { SectionProps } from "./types";

export function CtaSection({ section }: SectionProps) {
  const { user, isLoading } = useAuth();
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("cta", t));

  // Asking a signed-in member to sign up is noise, so this hides itself for
  // them regardless of whether the admin has the section switched on.
  if (isLoading || user) return null;

  return (
    <SectionShell width="narrow">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-8 text-center text-white shadow-2xl">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <ShieldCheck className="size-12 text-emerald-400" />
          <h2 className="text-3xl font-bold tracking-tight">{copy("title")}</h2>
          <p className="max-w-md text-sm leading-relaxed text-emerald-100/80">
            {copy("subtitle")}
          </p>
          <AnimatedButton className="mt-2 rounded-xl bg-emerald-500 px-6 py-2.5 font-bold text-slate-950 shadow-lg hover:bg-emerald-400">
            <Link href="/signup">{copy("button")}</Link>
          </AnimatedButton>
        </div>
      </div>
    </SectionShell>
  );
}
