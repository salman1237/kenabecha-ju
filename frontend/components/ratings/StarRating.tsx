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
    return <span className="text-xs text-zinc-400">No ratings yet</span>;
  }
  const rounded = Math.round(value);
  return (
    <span className="flex items-center gap-1">
      <span className={size === "md" ? "text-base text-amber-500" : "text-sm text-amber-500"}>
        {"★".repeat(rounded)}
        {"☆".repeat(5 - rounded)}
      </span>
      <span className="text-xs text-zinc-500">
        {value.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </span>
  );
}
