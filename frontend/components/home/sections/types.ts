import type { PageSection } from "@/types/api";

/** Every section component takes exactly this, so the registry can render any
 *  of them without knowing which one it has. */
export interface SectionProps {
  section: PageSection;
}
