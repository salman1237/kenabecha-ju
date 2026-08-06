"use client";

import { GradientCard } from "@/components/ui/GradientCard";
import { useLanguage } from "@/context/LanguageContext";
import { sectionCopy, sectionDefaults } from "@/lib/sectionCopy";

import { SectionShell } from "./SectionShell";
import type { SectionProps } from "./types";

export function HowItWorksSection({ section }: SectionProps) {
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("how_it_works", t));

  // Numbered because these genuinely are a sequence — you cannot sell before
  // you have an account. The number is information, not decoration.
  const steps = [
    {
      title: copy("step1Title"),
      body: copy("step1Body"),
    },
    {
      title: copy("step2Title"),
      body: copy("step2Body"),
    },
    {
      title: copy("step3Title"),
      body: copy("step3Body"),
    },
  ];

  return (
    <SectionShell width="medium">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          {copy("title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy("subtitle")}</p>
      </div>

      <div className="grid gap-8 sm:grid-cols-3">
        {steps.map((step, index) => (
          <GradientCard
            key={step.title}
            className="flex flex-col items-center gap-3 p-6 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/20">
              {index + 1}
            </div>
            <h3 className="text-base font-semibold">{step.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
          </GradientCard>
        ))}
      </div>
    </SectionShell>
  );
}
