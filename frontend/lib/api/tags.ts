import { apiFetch } from "@/lib/api/client";
import type { Tag } from "@/types/api";

export function autocompleteTags(query: string) {
  return apiFetch<Tag[]>(`/tags/autocomplete?q=${encodeURIComponent(query)}`);
}

export function trendingTags() {
  return apiFetch<Tag[]>("/tags/trending");
}
