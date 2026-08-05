import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  /** Omit on the final crumb — the current page isn't a link. */
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="shrink-0 transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn("truncate", isLast && "text-foreground")}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="size-3 shrink-0 opacity-60" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
