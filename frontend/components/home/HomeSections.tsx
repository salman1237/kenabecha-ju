"use client";

import { getSectionDefinition } from "./sections/registry";
import type { PageSection } from "@/types/api";

/**
 * Renders the landing page from data.
 *
 * Each component fetches its own content, so a section that is switched off
 * costs nothing — its request is never made, which is the main reason the
 * page was split up rather than kept as one component with nine `useEffect`s.
 */
export function HomeSections({ sections }: { sections: PageSection[] }) {
  return (
    <>
      {sections.map((section) => {
        const definition = getSectionDefinition(section.section_type);
        if (!definition) return null;
        const { Component } = definition;
        return <Component key={section.id} section={section} />;
      })}
    </>
  );
}
