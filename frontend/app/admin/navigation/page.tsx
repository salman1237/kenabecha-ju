"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { NavLinkEditor } from "@/components/admin/NavLinkEditor";
import { NavIcon } from "@/components/layout/NavIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/context/LanguageContext";
import { ApiError } from "@/lib/api/client";
import {
  createMenu,
  deleteLink,
  deleteMenu,
  getAdminNavigation,
  reorderLinks,
  reorderMenus,
  setNavbarControls,
  updateLink,
  updateMenu,
} from "@/lib/api/navigation";
import { navLabel } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { NavLink, NavMenu, Navigation } from "@/types/api";

const VISIBILITY_LABELS: Record<string, string> = {
  always: "Everyone",
  signed_in: "Signed in",
  signed_out: "Signed out",
};

const CONTROL_LABELS: Record<string, { label: string; hint: string }> = {
  search: { label: "Search box", hint: "The search field in the middle of the navbar." },
  language: { label: "Language switcher", hint: "Turning this off leaves Bangla unreachable." },
  theme: { label: "Light/dark toggle", hint: "Visitors keep whatever theme they last chose." },
  notifications: { label: "Notification bell", hint: "Signed-in visitors only." },
};

export default function AdminNavigationPage() {
  const { t, locale } = useLanguage();
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingLink, setEditingLink] = useState<{ link?: NavLink; menu: NavMenu } | null>(null);
  const [deletingLink, setDeletingLink] = useState<NavLink | null>(null);
  const [deletingMenu, setDeletingMenu] = useState<NavMenu | null>(null);
  const [newColumn, setNewColumn] = useState("");

  const load = useCallback(() => {
    getAdminNavigation()
      .then(setNavigation)
      .catch(() => toast.error("Could not load the navigation"));
  }, []);

  useEffect(load, [load]);

  const menus = (navigation?.menus ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const navbarMenus = menus.filter((m) => m.location === "navbar");
  const footerMenus = menus.filter((m) => m.location === "footer");

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not work");
      load();
    } finally {
      setBusy(false);
    }
  };

  const moveLink = (menu: NavMenu, index: number, direction: -1 | 1) => {
    const ordered = [...menu.links].sort((a, b) => a.sort_order - b.sort_order);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return run(() => reorderLinks(menu.id, ordered.map((l) => l.id)));
  };

  const moveMenu = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= footerMenus.length) return;
    const ordered = [...footerMenus];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return run(() => reorderMenus("footer", ordered.map((m) => m.id)));
  };

  const linkRow = (menu: NavMenu, link: NavLink, index: number, total: number) => (
    <li
      key={link.id}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-2.5",
        !link.is_active && "opacity-60"
      )}
    >
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="size-5"
          aria-label="Move link up"
          disabled={busy || index === 0}
          onClick={() => moveLink(menu, index, -1)}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-5"
          aria-label="Move link down"
          disabled={busy || index === total - 1}
          onClick={() => moveLink(menu, index, 1)}
        >
          <ArrowDown className="size-3.5" />
        </Button>
      </div>

      {menu.location === "navbar" && (
        <NavIcon name={link.icon} className="size-4 text-muted-foreground" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{navLabel(link, locale, t)}</span>
          {!link.is_active && (
            <Badge variant="secondary" className="text-[11px]">
              Hidden
            </Badge>
          )}
          {link.visibility !== "always" && (
            <Badge variant="outline" className="text-[11px] font-normal">
              {VISIBILITY_LABELS[link.visibility]}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{link.href}</p>
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label={link.is_active ? "Hide link" : "Show link"}
          disabled={busy}
          onClick={() =>
            run(() => updateLink(link.id, { is_active: !link.is_active }))
          }
        >
          {link.is_active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit link"
          disabled={busy}
          onClick={() => setEditingLink({ link, menu })}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete link"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => setDeletingLink(link)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );

  const menuCard = (menu: NavMenu, index: number, reorderable: boolean) => {
    const links = [...menu.links].sort((a, b) => a.sort_order - b.sort_order);
    return (
      <section
        key={menu.id}
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-border p-4",
          !menu.is_active && "opacity-60"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {reorderable && (
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  aria-label="Move column up"
                  disabled={busy || index === 0}
                  onClick={() => moveMenu(index, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  aria-label="Move column down"
                  disabled={busy || index === footerMenus.length - 1}
                  onClick={() => moveMenu(index, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
            )}
            <h3 className="font-semibold">
              {menu.location === "navbar" ? "Navbar links" : navLabel(menu, locale, t)}
            </h3>
            {!menu.is_active && (
              <Badge variant="secondary" className="text-[11px]">
                Hidden
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={busy}
              onClick={() => setEditingLink({ menu })}
            >
              <Plus className="size-3.5" />
              Link
            </Button>
            {reorderable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={menu.is_active ? "Hide column" : "Show column"}
                  disabled={busy}
                  onClick={() =>
                    run(() => updateMenu(menu.id, { is_active: !menu.is_active }))
                  }
                >
                  {menu.is_active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete column"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setDeletingMenu(menu)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No links yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {links.map((link, i) => linkRow(menu, link, i, links.length))}
          </ul>
        )}
      </section>
    );
  };

  if (navigation === null) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Navigation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The links in the navbar and footer. Each one can be renamed in both languages,
          reordered, hidden, or shown only to signed-in or signed-out visitors.
        </p>
      </div>

      {/* Navbar */}
      <div className="flex flex-col gap-3">
        {navbarMenus.map((menu) => menuCard(menu, 0, false))}

        <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div>
            <h3 className="font-semibold">Navbar controls</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              These are controls rather than links, so they can only be switched on or off.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {Object.entries(CONTROL_LABELS).map(([name, meta]) => {
              const enabled = navigation.navbar_controls[name] !== false;
              return (
                <label
                  key={name}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={busy}
                    onChange={() =>
                      run(
                        () => setNavbarControls({ [name]: !enabled }),
                        enabled ? `${meta.label} hidden` : `${meta.label} shown`
                      )
                    }
                    className="mt-0.5 size-4 accent-emerald-600"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">{meta.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Footer columns
        </h3>
        {footerMenus.map((menu, index) => menuCard(menu, index, true))}

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="new-column">New footer column</Label>
            <Input
              id="new-column"
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
              placeholder="Heading, e.g. Support"
            />
          </div>
          <Button
            disabled={busy || !newColumn.trim()}
            onClick={() =>
              run(() => createMenu("footer", { en: newColumn.trim() }), "Column added — it starts hidden").then(
                () => setNewColumn("")
              )
            }
          >
            <Plus className="size-4" />
            Add column
          </Button>
        </div>
      </div>

      {editingLink && (
        <NavLinkEditor
          link={editingLink.link}
          menuId={editingLink.menu.id}
          showIcon={editingLink.menu.location === "navbar"}
          onClose={() => setEditingLink(null)}
          onSaved={() => {
            setEditingLink(null);
            load();
          }}
        />
      )}

      <AlertDialog
        open={deletingLink !== null}
        onOpenChange={(open) => !open && setDeletingLink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this link?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the menu along with any wording you have customised. To take it
              out of the menu without losing your edits, hide it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                deletingLink &&
                run(() => deleteLink(deletingLink.id), "Link deleted").then(() =>
                  setDeletingLink(null)
                )
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deletingMenu !== null}
        onOpenChange={(open) => !open && setDeletingMenu(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this column?</AlertDialogTitle>
            <AlertDialogDescription>
              The column and all {deletingMenu?.links.length ?? 0} link(s) in it are removed from
              the footer. Hiding the column takes it off the site without losing the links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                deletingMenu &&
                run(() => deleteMenu(deletingMenu.id), "Column deleted").then(() =>
                  setDeletingMenu(null)
                )
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
