"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { ShopCard } from "@/components/shops/ShopCard";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { browseListings } from "@/lib/api/listings";
import { getShops } from "@/lib/api/shops";
import { trendingTags } from "@/lib/api/tags";
import { cn } from "@/lib/utils";
import type { Listing, Shop, Tag } from "@/types/api";

const HOW_IT_WORKS = [
  {
    title: "Browse or list",
    body: "Find what you need from students across campus, or list something you're done with in minutes.",
  },
  {
    title: "Chat, call, or WhatsApp",
    body: "Reach the seller however's easiest — in-app chat, a phone call, or WhatsApp.",
  },
  {
    title: "Meet up or arrange delivery",
    body: "Coordinate pickup on campus or delivery directly with the seller, then rate the transaction.",
  },
];

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    browseListings({ sort: "newest", limit: 8 })
      .then((page) => setListings(page.items))
      .catch(() => {});
    getShops(6)
      .then(setShops)
      .catch(() => {});
    trendingTags()
      .then(setTags)
      .catch(() => {});
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/listings${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  };

  return (
    <div className="flex flex-col">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center gap-6 px-4 py-20 text-center sm:py-28"
      >
        <Badge variant="outline">Jahangirnagar University</Badge>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Buy, sell, and run shops — right here at JU.
        </h1>
        <p className="max-w-lg text-muted-foreground">
          Browse everything for free. Sign up with one click to chat, call, or WhatsApp a seller, or
          list something yourself.
        </p>

        <form onSubmit={onSearch} className="flex w-full max-w-md gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search textbooks, gadgets, furniture…"
            className="h-10"
          />
          <Button type="submit" className="h-10 shrink-0">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/listings" className={cn(buttonVariants({ variant: "outline" }))}>
            Browse all listings
          </Link>
          {!isLoading &&
            (user ? (
              <Link href="/listings/new" className={cn(buttonVariants())}>
                Sell something
              </Link>
            ) : (
              <Link href="/signup" className={cn(buttonVariants())}>
                Sign up free
              </Link>
            ))}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {tags.slice(0, 10).map((tag) => (
              <Link key={tag.id} href={`/listings?tags=${encodeURIComponent(tag.name)}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/70">
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </motion.section>

      {listings.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Fresh on campus</h2>
            <Link href="/listings" className="text-sm text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </motion.section>
      )}

      {shops.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6"
        >
          <h2 className="text-lg font-semibold tracking-tight">Shops to check out</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.4 }}
        className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-14 sm:px-6"
      >
        <h2 className="text-center text-lg font-semibold tracking-tight">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {!isLoading && !user && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6"
        >
          <h2 className="text-xl font-semibold tracking-tight">Have something to sell?</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Sellers verify with their JU student details so buyers know exactly who they&apos;re dealing
            with.
          </p>
          <Link href="/signup" className={cn(buttonVariants())}>
            Get started
          </Link>
        </motion.section>
      )}
    </div>
  );
}
