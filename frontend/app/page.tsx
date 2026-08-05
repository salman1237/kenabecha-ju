"use client";

import { ArrowRight, BookOpen, Laptop, Search, ShieldCheck, Sparkles, Star, Store, Truck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NewsletterSection } from "@/components/home/NewsletterSection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { StatsSection } from "@/components/home/StatsSection";
import { ListingCard } from "@/components/listings/ListingCard";
import { ShopCard } from "@/components/shops/ShopCard";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { GradientCard } from "@/components/ui/GradientCard";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { browseListings } from "@/lib/api/listings";
import { getShops } from "@/lib/api/shops";
import { trendingTags } from "@/lib/api/tags";
import { getCategories } from "@/lib/api/categories";
import { cn } from "@/lib/utils";
import type { Listing, Shop, Tag, Category } from "@/types/api";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();

  const [topListings, setTopListings] = useState<Listing[]>([]);
  const [latestListings, setLatestListings] = useState<Listing[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Fetch top products (set by admin)
    browseListings({ is_top: true, limit: 4 })
      .then((page) => setTopListings(page.items))
      .catch(() => {});

    // Fetch latest listings
    browseListings({ sort: "newest", limit: 8 })
      .then((page) => setLatestListings(page.items))
      .catch(() => {});

    // Fetch featured shops
    getShops(6)
      .then(setShops)
      .catch(() => {});

    // Fetch trending tags
    trendingTags()
      .then(setTags)
      .catch(() => {});

    // Fetch categories
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/listings${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  };

  return (
    <div className="flex flex-col overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative flex flex-col items-center justify-center px-4 py-20 text-center sm:py-32 gradient-bg-hero">
        {/* Glow Spheres */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-400/10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          <Badge variant="outline" className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 backdrop-blur-md">
            <Sparkles className="size-3.5" />
            {t.hero.badge}
          </Badge>

          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl leading-tight">
            {t.hero.title.split(" ").slice(0, -3).join(" ")}{" "}
            <span className="gradient-text">{t.hero.title.split(" ").slice(-3).join(" ")}</span>
          </h1>

          <p className="max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
            {t.hero.subtitle}
          </p>

          {/* Search Box */}
          <form onSubmit={onSearch} className="mt-2 flex w-full max-w-lg items-center gap-2 rounded-2xl border border-emerald-500/20 bg-background/80 p-2 shadow-lg shadow-emerald-500/5 backdrop-blur-xl dark:border-emerald-400/20">
            <Search className="ml-3 size-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.hero.searchPlaceholder}
              className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button type="submit" className="h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 font-semibold text-white shadow-md hover:from-emerald-500 hover:to-teal-500">
              {t.hero.searchButton}
            </Button>
          </form>

          {/* Quick CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/listings" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-emerald-500/20 hover:bg-emerald-500/10")}>
              {t.hero.browseAll}
            </Link>
            {!isLoading &&
              (user ? (
                <AnimatedButton className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white">
                  <Link href="/listings/new">{t.hero.sellSomething}</Link>
                </AnimatedButton>
              ) : (
                <AnimatedButton className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white">
                  <Link href="/signup">{t.hero.signUpFree}</Link>
                </AnimatedButton>
              ))}
          </div>

          {/* Trending Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <span className="text-xs text-muted-foreground font-medium">Trending:</span>
              {tags.slice(0, 8).map((tag) => (
                <Link key={tag.id} href={`/listings?tags=${encodeURIComponent(tag.name)}`}>
                  <Badge variant="secondary" className="cursor-pointer rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors">
                    #{tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* 1b. PLATFORM STATISTICS */}
      <StatsSection />

      {/* 2. TOP PRODUCTS SECTION (Admin Set) */}
      {topListings.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Star className="size-5 fill-amber-400 text-amber-500" />
                <h2 className="text-2xl font-bold tracking-tight">{t.sections.topProducts}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t.sections.topProductsSub}</p>
            </div>
            <Link href="/listings?is_top=true" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              {t.sections.viewAll}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {topListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </motion.section>
      )}

      {/* 3. LATEST PICKS SECTION */}
      {latestListings.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t.sections.latestPicks}</h2>
              <p className="text-xs text-muted-foreground mt-1">{t.sections.latestPicksSub}</p>
            </div>
            <Link href="/listings" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              {t.sections.viewAll}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {latestListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </motion.section>
      )}

      {/* 4. FEATURED SHOPS SECTION */}
      {shops.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t.sections.featuredShops}</h2>
              <p className="text-xs text-muted-foreground mt-1">{t.sections.featuredShopsSub}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </motion.section>
      )}

      {/* 5. ALL PRODUCTS CATEGORIES QUICK BAR */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.4 }}
        className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"
      >
        <h2 className="text-2xl font-bold tracking-tight mb-6">{t.sections.allProducts}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/listings?category=${cat.slug}`}>
              <GradientCard className="flex flex-col items-center justify-center gap-3 cursor-pointer p-4 group text-center h-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md group-hover:scale-110 transition-transform text-2xl">
                  {cat.icon || "📦"}
                </div>
                <div>
                  <h3 className="font-semibold text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{cat.name}</h3>
                </div>
              </GradientCard>
            </Link>
          ))}
        </div>
      </motion.section>

      {/* 6. HOW IT WORKS SECTION */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.4 }}
        className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6"
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">{t.sections.howItWorks}</h2>
          <p className="text-sm text-muted-foreground mt-2">Simple, secure, and made for Jahangirnagar University</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <GradientCard className="flex flex-col items-center text-center p-6 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/20">
              1
            </div>
            <h3 className="font-semibold text-base">{t.howItWorks.step1Title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.howItWorks.step1Body}</p>
          </GradientCard>

          <GradientCard className="flex flex-col items-center text-center p-6 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/20">
              2
            </div>
            <h3 className="font-semibold text-base">{t.howItWorks.step2Title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.howItWorks.step2Body}</p>
          </GradientCard>

          <GradientCard className="flex flex-col items-center text-center p-6 gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/20">
              3
            </div>
            <h3 className="font-semibold text-base">{t.howItWorks.step3Title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.howItWorks.step3Body}</p>
          </GradientCard>
        </div>
      </motion.section>

      {/* 7. LATEST REVIEWS SECTION */}
      <ReviewsSection />

      {/* 8. CTA BANNER SECTION */}
      {!isLoading && !user && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-8 text-center text-white shadow-2xl">
            <div className="relative z-10 flex flex-col items-center gap-4">
              <ShieldCheck className="size-12 text-emerald-400" />
              <h2 className="text-3xl font-bold tracking-tight">{t.cta.title}</h2>
              <p className="max-w-md text-sm text-emerald-100/80 leading-relaxed">
                {t.cta.subtitle}
              </p>
              <AnimatedButton className="mt-2 rounded-xl bg-emerald-500 px-6 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 shadow-lg">
                <Link href="/signup">{t.cta.button}</Link>
              </AnimatedButton>
            </div>
          </div>
        </motion.section>
      )}

      {/* 9. NEWSLETTER SECTION */}
      <NewsletterSection />
    </div>
  );
}
