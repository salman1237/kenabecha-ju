"use client";

import type { SectionType } from "@/types/api";

import { NewsletterSection } from "../NewsletterSection";
import { ReviewsSection } from "../ReviewsSection";
import { StatsSection } from "../StatsSection";
import { CategoriesSection } from "./CategoriesSection";
import { CtaSection } from "./CtaSection";
import { FeaturedShopsSection } from "./FeaturedShopsSection";
import { HeroSection } from "./HeroSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { LatestListingsSection } from "./LatestListingsSection";
import { TopProductsSection } from "./TopProductsSection";
import type { SectionProps } from "./types";

/** Which fields the admin editor should offer for each type, and what each
 *  one is called. Kept beside the components so adding a section type means
 *  touching one file, not three. */
export interface SectionFieldSpec {
  key: string;
  label: string;
  /** Long copy gets a textarea; a headline gets a single line. */
  multiline?: boolean;
}

interface SectionDefinition {
  Component: React.ComponentType<SectionProps>;
  /** What the admin sees in the section list and the "add" menu. */
  label: string;
  /** One line explaining what the section actually shows. */
  description: string;
  fields: SectionFieldSpec[];
  /** Whether a count of items can be set. */
  hasLimit?: boolean;
}

const HEADING_FIELDS: SectionFieldSpec[] = [
  { key: "title", label: "Heading" },
  { key: "subtitle", label: "Sub-heading", multiline: true },
];

export const SECTION_REGISTRY: Record<SectionType, SectionDefinition> = {
  hero: {
    Component: HeroSection,
    label: "Hero",
    description: "Headline, search box and trending tags at the top of the page.",
    fields: [
      { key: "badge", label: "Badge" },
      { key: "title", label: "Headline" },
      { key: "subtitle", label: "Sub-heading", multiline: true },
      { key: "searchPlaceholder", label: "Search placeholder" },
      { key: "searchButton", label: "Search button" },
      { key: "browseAll", label: "Browse button" },
    ],
  },
  stats: {
    Component: StatsSection,
    label: "Platform statistics",
    description: "Live counts of students, listings, shops and ratings.",
    fields: [],
  },
  top_products: {
    Component: TopProductsSection,
    label: "Top products",
    description: "Listings you have marked as top picks.",
    fields: HEADING_FIELDS,
    hasLimit: true,
  },
  latest_listings: {
    Component: LatestListingsSection,
    label: "Latest listings",
    description: "The newest listings on the marketplace.",
    fields: HEADING_FIELDS,
    hasLimit: true,
  },
  featured_shops: {
    Component: FeaturedShopsSection,
    label: "Featured shops",
    description: "Campus shops, newest first.",
    fields: HEADING_FIELDS,
    hasLimit: true,
  },
  categories: {
    Component: CategoriesSection,
    label: "Categories",
    description: "A grid linking to each category.",
    fields: [{ key: "title", label: "Heading" }],
  },
  how_it_works: {
    Component: HowItWorksSection,
    label: "How it works",
    description: "The three steps from signing up to selling.",
    fields: [
      { key: "title", label: "Heading" },
      { key: "subtitle", label: "Sub-heading", multiline: true },
      { key: "step1Title", label: "Step 1 title" },
      { key: "step1Body", label: "Step 1 text", multiline: true },
      { key: "step2Title", label: "Step 2 title" },
      { key: "step2Body", label: "Step 2 text", multiline: true },
      { key: "step3Title", label: "Step 3 title" },
      { key: "step3Body", label: "Step 3 text", multiline: true },
    ],
  },
  reviews: {
    Component: ReviewsSection,
    label: "Recent reviews",
    description: "Real reviews students have left. Hidden until there are some.",
    fields: HEADING_FIELDS,
  },
  cta: {
    Component: CtaSection,
    label: "Sign-up banner",
    description: "Prompt to join. Only shown to signed-out visitors.",
    fields: [
      { key: "title", label: "Heading" },
      { key: "subtitle", label: "Sub-heading", multiline: true },
      { key: "button", label: "Button label" },
    ],
  },
  newsletter: {
    Component: NewsletterSection,
    label: "Newsletter",
    description: "Email sign-up band.",
    fields: [
      { key: "title", label: "Heading" },
      { key: "body", label: "Body text", multiline: true },
    ],
  },
};

/** A section type the API knows about but this build does not — possible
 *  during a rollout where the backend is ahead of the frontend. Skipping it
 *  is the only safe answer; crashing the homepage is not. */
export function getSectionDefinition(type: SectionType): SectionDefinition | undefined {
  return SECTION_REGISTRY[type];
}
