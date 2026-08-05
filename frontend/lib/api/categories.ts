import { apiFetch } from "@/lib/api/client";
import type { Category, CategoryRef } from "@/types/api";

export function getCategories() {
  return apiFetch<Category[]>("/categories");
}

export function getCategoryBySlug(slug: string) {
  return apiFetch<CategoryRef>(`/categories/${slug}`);
}
