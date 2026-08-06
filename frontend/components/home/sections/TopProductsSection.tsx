"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { useLanguage } from "@/context/LanguageContext";
import { browseListings } from "@/lib/api/listings";
import { sectionCopy, sectionDefaults, sectionNumber } from "@/lib/sectionCopy";
import type { Listing } from "@/types/api";

import { SectionHeader, SectionShell } from "./SectionShell";
import type { SectionProps } from "./types";

export function TopProductsSection({ section }: SectionProps) {
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("top_products", t));
  const limit = sectionNumber(section, "limit", 4);

  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    browseListings({ is_top: true, limit })
      .then((page) => setListings(page.items))
      .catch(() => {});
  }, [limit]);

  // An empty rail is worse than no rail: it reads as broken rather than as
  // nothing having been featured yet.
  if (listings.length === 0) return null;

  return (
    <SectionShell>
      <SectionHeader
        icon={<Star className="size-5 fill-amber-400 text-amber-500" />}
        title={copy("title")}
        subtitle={copy("subtitle")}
        linkHref="/listings?is_top=true"
        linkLabel={t.sections.viewAll}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </SectionShell>
  );
}
