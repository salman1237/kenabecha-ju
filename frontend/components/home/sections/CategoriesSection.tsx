"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GradientCard } from "@/components/ui/GradientCard";
import { useLanguage } from "@/context/LanguageContext";
import { getCategories } from "@/lib/api/categories";
import { sectionCopy, sectionDefaults } from "@/lib/sectionCopy";
import type { Category } from "@/types/api";

import { SectionShell } from "./SectionShell";
import type { SectionProps } from "./types";

export function CategoriesSection({ section }: SectionProps) {
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("categories", t));

  // null means "not fetched yet", [] means "genuinely no categories". The
  // distinction matters: this renders on the server, where nothing has been
  // fetched, and collapsing the section there would drop its heading from the
  // HTML crawlers see.
  const [categories, setCategories] = useState<Category[] | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  if (categories?.length === 0) return null;

  return (
    <SectionShell>
      <h2 className="mb-8 text-2xl font-bold tracking-tight">
        {copy("title")}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {categories?.map((cat) => (
          <Link key={cat.id} href={`/listings?category=${cat.slug}`}>
            <GradientCard className="group flex h-full cursor-pointer flex-col items-center justify-center gap-3 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-2xl text-white shadow-md transition-transform group-hover:scale-110">
                {cat.icon || "\u{1F4E6}"}
              </div>
              <h3 className="text-sm font-semibold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {cat.name}
              </h3>
            </GradientCard>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}
