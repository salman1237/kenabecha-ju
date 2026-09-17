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

  // One container stagger instead of a single fade: the badge, headline,
  // subtitle, search bar, buttons and tags arrive in sequence rather than
  // all at once, which is what actually reads as "animated" rather than
  // just "faded in".
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
  };

  return (
    <section className="gradient-bg-hero relative flex flex-col items-center justify-center overflow-hidden px-4 py-20 text-center sm:py-32">
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-400/10" />
      {/* Two smaller, slowly drifting orbs either side of the headline —
          decoration only (aria-hidden), and `prefers-reduced-motion` turns
          the drift off globally (see globals.css). */}
      <motion.div
        aria-hidden
        animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-[8%] top-24 -z-10 hidden h-40 w-40 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-400/10 sm:block"
      />
      <motion.div
        aria-hidden
        animate={{ y: [0, 16, 0], x: [0, -10, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute right-[10%] top-40 -z-10 hidden h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-400/10 sm:block"
      />

      <motion.div
        initial="hidden"
        animate="show"
        variants={container}
        className="flex flex-col items-center gap-6"
      >
        <motion.div variants={item}>
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold text-emerald-600 backdrop-blur-md dark:text-emerald-400"
          >
            <Sparkles className="size-3.5" />
            {copy("badge")}
          </Badge>
        </motion.div>

        <motion.h1 variants={item} className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          {words.slice(0, highlightFrom).join(" ")}{" "}
          <span className="gradient-text">{words.slice(highlightFrom).join(" ")}</span>
        </motion.h1>

        <motion.p variants={item} className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {copy("subtitle")}
        </motion.p>

        <motion.form
          variants={item}
          onSubmit={onSearch}
          className="mt-2 flex w-full max-w-lg items-center gap-2 rounded-2xl border border-emerald-500/20 bg-background/80 p-2 shadow-lg shadow-emerald-500/5 backdrop-blur-xl transition-shadow focus-within:shadow-xl focus-within:shadow-emerald-500/10 dark:border-emerald-400/20"
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
        </motion.form>

        <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
            <Link
              href="/listings"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-xl border-emerald-500/20 hover:bg-emerald-500/10"
              )}
            >
              {copy("browseAll")}
            </Link>
          </motion.span>
          {!isLoading && (
            <AnimatedButton className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white">
              <Link href={user ? "/listings/new" : "/signup"}>
                {user ? t.hero.sellSomething : t.hero.signUpFree}
              </Link>
            </AnimatedButton>
          )}
        </motion.div>

        {tags.length > 0 && (
          <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-2 pt-4">
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
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
