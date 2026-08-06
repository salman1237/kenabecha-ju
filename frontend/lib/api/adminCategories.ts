import { apiFetch } from "@/lib/api/client";
import type { AdminCategory } from "@/types/api";

/** Every category, hidden ones included, with the listing count that decides
 *  whether each can safely be deleted. */
export function listAdminCategories() {
  return apiFetch<AdminCategory[]>("/admin/categories");
}

export function createCategory(payload: {
  name: string;
  icon?: string | null;
  parent_id?: string | null;
}) {
  return apiFetch<AdminCategory>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Only the keys present are changed. `icon: null` clears the icon, whereas
 * omitting `icon` leaves it — the API distinguishes the two, so callers must
 * not send `undefined` values expecting them to be ignored (JSON.stringify
 * drops them, which happens to be the behaviour we want).
 */
export function updateCategory(
  id: string,
  payload: {
    name?: string;
    slug?: string;
    icon?: string | null;
    parent_id?: string | null;
    is_active?: boolean;
  }
) {
  return apiFetch<AdminCategory>(`/admin/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Must list every category at that level exactly once. `parentId` is null
 *  for the top level. */
export function reorderCategories(parentId: string | null, categoryIds: string[]) {
  return apiFetch<AdminCategory[]>("/admin/categories/reorder", {
    method: "POST",
    body: JSON.stringify({ parent_id: parentId, category_ids: categoryIds }),
  });
}

/** `moveTo` is required when the category holds listings — the API refuses
 *  with 409 otherwise rather than silently uncategorising them. */
export function deleteCategory(id: string, moveTo?: string) {
  const query = moveTo ? `?move_to=${moveTo}` : "";
  return apiFetch<void>(`/admin/categories/${id}${query}`, { method: "DELETE" });
}
