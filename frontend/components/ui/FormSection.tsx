import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One labelled group of fields.
 *
 * The listing form was a single ungrouped column of twelve inputs, so
 * pricing, photos, fulfilment and tags all read at the same weight and the
 * form gave no sense of progress. Grouping them gives each part a heading
 * and a one-line explanation of what it is for.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-5 sm:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
