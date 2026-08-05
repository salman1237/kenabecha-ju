"use client";

import { RotateCcw } from "lucide-react";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { selectClass } from "@/components/ui/FormField";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn, CONDITION_LABELS } from "@/lib/utils";
import type { BrowseFilters } from "@/lib/api/listings";
import type { Tag } from "@/types/api";

/** Upper bound of the price slider. At exactly this value the max filter is
 *  dropped entirely, so the top of the range reads as "and above" rather
 *  than silently excluding anything pricier. */
export const PRICE_MAX = 50000;

export interface FilterState {
  tags: string[];
  price: [number, number];
  condition: string;
  sort: BrowseFilters["sort"];
}

export const DEFAULT_FILTERS: FilterState = {
  tags: [],
  price: [0, PRICE_MAX],
  condition: "",
  sort: "newest",
};

export function ListingFilters({
  filters,
  onChange,
  trending,
  className,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  trending: Tag[];
  className?: string;
}) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleTag = (name: string) =>
    set(
      "tags",
      filters.tags.includes(name) ? filters.tags.filter((t) => t !== name) : [...filters.tags, name]
    );

  const isDirty =
    filters.tags.length > 0 ||
    filters.condition !== "" ||
    filters.price[0] !== 0 ||
    filters.price[1] !== PRICE_MAX ||
    filters.sort !== "newest";

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className={cn("flex flex-col gap-6", className)}
    >
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {isDirty && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-muted-foreground"
          >
            <RotateCcw /> Reset
          </Button>
        )}
      </motion.div>

      {/* Price range */}
      <motion.div variants={staggerItem} className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs font-medium">Price range</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            ৳{filters.price[0].toLocaleString()} – ৳{filters.price[1].toLocaleString()}
            {filters.price[1] === PRICE_MAX && "+"}
          </span>
        </div>
        <Slider
          value={filters.price}
          min={0}
          max={PRICE_MAX}
          step={500}
          onValueChange={(v) => set("price", (Array.isArray(v) ? v : [0, v]) as [number, number])}
        />
      </motion.div>

      {/* Condition */}
      <motion.div variants={staggerItem} className="flex flex-col gap-2">
        <Label htmlFor="filter-condition" className="text-xs font-medium">
          Condition
        </Label>
        <select
          id="filter-condition"
          className={selectClass}
          value={filters.condition}
          onChange={(e) => set("condition", e.target.value)}
        >
          <option value="">Any condition</option>
          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Sort */}
      <motion.div variants={staggerItem} className="flex flex-col gap-2">
        <Label htmlFor="filter-sort" className="text-xs font-medium">
          Sort by
        </Label>
        <select
          id="filter-sort"
          className={selectClass}
          value={filters.sort}
          onChange={(e) => set("sort", e.target.value as BrowseFilters["sort"])}
        >
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </motion.div>

      {/* Tags */}
      {trending.length > 0 && (
        <motion.div variants={staggerItem} className="flex flex-col gap-2">
          <Label className="text-xs font-medium">Popular tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {trending.map((tag) => {
              const active = filters.tags.includes(tag.name.toLowerCase());
              return (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => toggleTag(tag.name.toLowerCase())}
                  aria-pressed={active}
                >
                  <Badge
                    variant={active ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                  >
                    {tag.name}
                  </Badge>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
