import { apiFetch } from "@/lib/api/client";
import type { NavLink, NavMenu, Navigation, NavVisibility, SiteInfo } from "@/types/api";

/** Active menus and links only — what the navbar and footer render. */
export function getNavigation() {
  return apiFetch<Navigation>("/navigation");
}

/** Includes hidden menus and links, so the admin can see what to turn on. */
export function getAdminNavigation() {
  return apiFetch<Navigation>("/admin/navigation");
}

export function createMenu(location: "navbar" | "footer", label: Record<string, string>) {
  return apiFetch<NavMenu>("/admin/navigation/menus", {
    method: "POST",
    body: JSON.stringify({ location, label }),
  });
}

export function updateMenu(
  id: string,
  payload: { label?: Record<string, string>; is_active?: boolean }
) {
  return apiFetch<NavMenu>(`/admin/navigation/menus/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteMenu(id: string) {
  return apiFetch<void>(`/admin/navigation/menus/${id}`, { method: "DELETE" });
}

/** Must list every menu in that location exactly once. */
export function reorderMenus(location: "navbar" | "footer", menuIds: string[]) {
  return apiFetch<NavMenu[]>("/admin/navigation/menus/reorder", {
    method: "POST",
    body: JSON.stringify({ location, menu_ids: menuIds }),
  });
}

export function createLink(
  menuId: string,
  payload: {
    label: Record<string, string>;
    href: string;
    icon?: string | null;
    visibility?: NavVisibility;
  }
) {
  return apiFetch<NavLink>(`/admin/navigation/menus/${menuId}/links`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLink(
  id: string,
  payload: {
    label?: Record<string, string>;
    href?: string;
    icon?: string | null;
    visibility?: NavVisibility;
    is_active?: boolean;
  }
) {
  return apiFetch<NavLink>(`/admin/navigation/links/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteLink(id: string) {
  return apiFetch<void>(`/admin/navigation/links/${id}`, { method: "DELETE" });
}

/** Must list every link in that menu exactly once. */
export function reorderLinks(menuId: string, linkIds: string[]) {
  return apiFetch<NavLink[]>(`/admin/navigation/menus/${menuId}/links/reorder`, {
    method: "POST",
    body: JSON.stringify({ link_ids: linkIds }),
  });
}

/** Only the named controls change; anything omitted keeps its value. */
export function setNavbarControls(controls: Record<string, boolean>) {
  return apiFetch<Record<string, boolean>>("/admin/navigation/controls", {
    method: "PUT",
    body: JSON.stringify({ controls }),
  });
}

/** Only the named fields change; anything omitted keeps its value. */
export function updateSiteInfo(payload: {
  contact_email?: string | null;
  whatsapp_number?: string | null;
  social_links?: Record<string, string>;
}) {
  return apiFetch<SiteInfo>("/admin/navigation/site-info", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function uploadSiteLogo(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<SiteInfo>("/admin/navigation/site-info/logo", { method: "POST", body: formData });
}
