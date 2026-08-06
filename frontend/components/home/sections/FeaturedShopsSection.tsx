"use client";

import { useEffect, useState } from "react";

import { ShopCard } from "@/components/shops/ShopCard";
import { useLanguage } from "@/context/LanguageContext";
import { getShops } from "@/lib/api/shops";
import { sectionCopy, sectionDefaults, sectionNumber } from "@/lib/sectionCopy";
import type { Shop } from "@/types/api";

import { SectionHeader, SectionShell } from "./SectionShell";
import type { SectionProps } from "./types";

export function FeaturedShopsSection({ section }: SectionProps) {
  const { t, locale } = useLanguage();
  const copy = sectionCopy(section, locale, sectionDefaults("featured_shops", t));
  const limit = sectionNumber(section, "limit", 6);

  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    getShops(limit).then(setShops).catch(() => {});
  }, [limit]);

  if (shops.length === 0) return null;

  return (
    <SectionShell>
      <SectionHeader
        title={copy("title")}
        subtitle={copy("subtitle")}
        linkHref="/shops"
        linkLabel={t.sections.viewAll}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shops.map((shop) => (
          <ShopCard key={shop.id} shop={shop} />
        ))}
      </div>
    </SectionShell>
  );
}
