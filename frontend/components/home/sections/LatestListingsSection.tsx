"use client";

import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { useLanguage } from "@/context/LanguageContext";
import { browseListings } from "@/lib/api/listings";
import { sectionCopy, sectionDefaults, sectionNumber } from "@/lib/sectionCopy";
import type { Listing } from "@/types/api";

import { SectionHeader, SectionShell } from "./SectionShell";
import type { SectionProps } from "./types";

export function LatestListingsSection({ section }: SectionProps) {
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("latest_listings", t));
  const limit = sectionNumber(section, "limit", 8);

  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    browseListings({ sort: "newest", limit })
      .then((page) => setListings(page.items))
      .catch(() => {});
  }, [limit]);

  if (listings.length === 0) return null;

  return (
    <SectionShell>
      <SectionHeader
        title={copy("title")}
        subtitle={copy("subtitle")}
        linkHref="/listings"
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
