import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({
  value,
  count,
  size = "sm",
}: {
  value: number | null;
  count?: number;
  size?: "sm" | "md";
}) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">No ratings yet</span>;
  }
  const rounded = Math.round(value);
  const starSize = size === "md" ? "size-4" : "size-3.5";
  return (
    <span className="flex items-center gap-1">
      <span className="flex items-center">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(starSize, i < rounded ? "fill-amber-500 text-amber-500" : "fill-none text-muted-foreground/40")}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {value.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </span>
  );
}
