import type { Category } from "@/types/api";

/** Top-level categories and their children as one flat list — the shape a
 *  shop's single `shop_type` string needs, since a shop (unlike a listing)
 *  has no separate parent/child fields to hold an id in. */
function flattenCategories(categories: Category[]): { id: string; name: string }[] {
  return categories.flatMap((cat) => [
    { id: cat.id, name: cat.name },
    ...cat.children.map((child) => ({ id: child.id, name: child.name })),
  ]);
}

export function categoryNameById(categories: Category[], id: string): string | undefined {
  return flattenCategories(categories).find((c) => c.id === id)?.name;
}

/** Best-effort reverse lookup, for showing an existing free-text shop_type
 *  (from before this picker existed, or a name that happens to match a real
 *  category) pre-selected rather than always falling back to "Other". */
export function categoryIdByName(categories: Category[], name: string): string | undefined {
  const target = name.trim().toLowerCase();
  return flattenCategories(categories).find((c) => c.name.toLowerCase() === target)?.id;
}
