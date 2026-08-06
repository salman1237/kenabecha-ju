"use client";

import { Search, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { trendingTags } from "@/lib/api/tags";
import { sectionCopy, sectionDefaults } from "@/lib/sectionCopy";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types/api";

import type { SectionProps } from "./types";

export function HeroSection({ section }: SectionProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("hero", t));

  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    trendingTags().then(setTags).catch(() => {});
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/listings${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  };

  const title = copy("title");
  const words = title.split(" ");
  // The last three words carry the gradient. Guard the split so a short
  // custom headline does not end up entirely coloured with nothing before it.
  const highlightFrom = words.length > 3 ? words.length - 3 : words.length;

  return (
    <section className="gradient-bg-hero relative flex flex-col items-center justify-center px-4 py-20 text-center sm:py-32">
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-400/10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <Badge
          variant="outline"
          className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold text-emerald-600 backdrop-blur-md dark:text-emerald-400"
        >
          <Sparkles className="size-3.5" />
          {copy("badge")}
        </Badge>

        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          {words.slice(0, highlightFrom).join(" ")}{" "}
          <span className="gradient-text">{words.slice(highlightFrom).join(" ")}</span>
        </h1>

        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {copy("subtitle")}
        </p>

        <form
          onSubmit={onSearch}
          className="mt-2 flex w-full max-w-lg items-center gap-2 rounded-2xl border border-emerald-500/20 bg-background/80 p-2 shadow-lg shadow-emerald-500/5 backdrop-blur-xl dark:border-emerald-400/20"
        >
          <Search className="ml-3 size-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy("searchPlaceholder")}
            className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            className="h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 font-semibold text-white shadow-md hover:from-emerald-500 hover:to-teal-500"
          >
            {copy("searchButton")}
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/listings"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-xl border-emerald-500/20 hover:bg-emerald-500/10"
            )}
          >
            {copy("browseAll")}
          </Link>
          {!isLoading && (
            <AnimatedButton className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white">
              <Link href={user ? "/listings/new" : "/signup"}>
                {user ? t.hero.sellSomething : t.hero.signUpFree}
              </Link>
            </AnimatedButton>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            <span className="text-xs font-medium text-muted-foreground">{t.sections.trending}</span>
            {tags.slice(0, 8).map((tag) => (
              <Link key={tag.id} href={`/listings?tags=${encodeURIComponent(tag.name)}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer rounded-lg bg-emerald-500/10 text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  #{tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </section>
  );
}
