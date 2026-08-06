import { apiFetch } from "@/lib/api/client";
import type { PageSection, SectionType } from "@/types/api";

/** Active sections only — what the public landing page renders. */
export function getPageSections() {
  return apiFetch<PageSection[]>("/page-sections");
}

/** Includes hidden sections, so the admin can see what it can turn on. */
export function listAdminSections() {
  return apiFetch<PageSection[]>("/admin/sections");
}

export function createSection(sectionType: SectionType) {
  return apiFetch<PageSection>("/admin/sections", {
    method: "POST",
    body: JSON.stringify({ section_type: sectionType }),
  });
}

export function updateSection(
  id: string,
  payload: { is_active?: boolean; settings?: Record<string, unknown> }
) {
  return apiFetch<PageSection>(`/admin/sections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Must list every section exactly once — the API rejects a partial order. */
export function reorderSections(sectionIds: string[]) {
  return apiFetch<PageSection[]>("/admin/sections/reorder", {
    method: "POST",
    body: JSON.stringify({ section_ids: sectionIds }),
  });
}

export function deleteSection(id: string) {
  return apiFetch<void>(`/admin/sections/${id}`, { method: "DELETE" });
}
