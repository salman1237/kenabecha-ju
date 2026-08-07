"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable-list";
import { SmartImage } from "@/components/ui/SmartImage";
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
  updateSiteInfo,
  uploadSiteLogo,
} from "@/lib/api/navigation";
import { navLabel } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { NavLink, NavMenu, Navigation, SiteInfo } from "@/types/api";

/** Logo upload, contact email/WhatsApp, and social links — the branding an
 *  admin can change without a deploy. Its own component since it manages a
 *  form draft the parent's navigation state doesn't need to know about. */
function SiteInfoSection({
  siteInfo,
  onSaved,
}: {
  siteInfo: SiteInfo;
  onSaved: (updated: SiteInfo) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [contactEmail, setContactEmail] = useState(siteInfo.contact_email ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(siteInfo.whatsapp_number ?? "");
  const [socialLinks, setSocialLinks] = useState<[string, string][]>(
    Object.entries(siteInfo.social_links)
  );
  const [saving, setSaving] = useState(false);

  const onLogoSelected = async (file: File) => {
    setLogoUploading(true);
    try {
      onSaved(await uploadSiteLogo(file));
      toast.success("Logo updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload the logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSiteInfo({
        contact_email: contactEmail.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        social_links: Object.fromEntries(
          socialLinks
            .map(([platform, url]) => [platform.trim(), url.trim()] as [string, string])
            .filter(([platform, url]) => platform && url)
        ),
      });
      onSaved(updated);
      toast.success("Site info saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save site info");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold">Site branding &amp; contact</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The logo, contact email, WhatsApp number and social links shown across the site — no
          deploy needed to change any of these.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          disabled={logoUploading}
          className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted text-xs font-medium text-muted-foreground"
        >
          {siteInfo.logo_url ? (
            <SmartImage src={siteInfo.logo_url} alt="" sizes="56px" />
          ) : (
            <span>{logoUploading ? "…" : "K"}</span>
          )}
        </button>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={logoUploading}
            onClick={() => logoInputRef.current?.click()}
          >
            {logoUploading ? "Uploading…" : siteInfo.logo_url ? "Change logo" : "Upload logo"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Replaces the &ldquo;K&rdquo; badge in the navbar and footer.
          </p>
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onLogoSelected(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-email">Contact email</Label>
          <Input
            id="contact-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="support@kenabecha.ju"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsapp-number">WhatsApp number</Label>
          <Input
            id="whatsapp-number"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="8801XXXXXXXXX"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Social links</Label>
        {socialLinks.map(([platform, url], i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={platform}
              onChange={(e) =>
                setSocialLinks((prev) =>
                  prev.map((row, idx) => (idx === i ? [e.target.value, row[1]] : row))
                )
              }
              placeholder="facebook"
              className="w-36 shrink-0"
            />
            <Input
              value={url}
              onChange={(e) =>
                setSocialLinks((prev) =>
                  prev.map((row, idx) => (idx === i ? [row[0], e.target.value] : row))
                )
              }
              placeholder="https://facebook.com/kenabechaju"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove social link"
              onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-xs"
          onClick={() => setSocialLinks((prev) => [...prev, ["", ""]])}
        >
          <Plus className="size-3.5" />
          Add social link
        </Button>
      </div>

      <Button className="w-fit" disabled={saving} onClick={onSave}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </section>
  );
}

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

  const applyLinkOrder = (menu: NavMenu, nextIds: string[]) =>
    run(() => reorderLinks(menu.id, nextIds));

  const moveLink = (menu: NavMenu, index: number, direction: -1 | 1) => {
    const ordered = [...menu.links].sort((a, b) => a.sort_order - b.sort_order);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return applyLinkOrder(menu, ordered.map((l) => l.id));
  };

  const applyMenuOrder = (nextIds: string[]) => run(() => reorderMenus("footer", nextIds));

  const moveMenu = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= footerMenus.length) return;
    const ordered = [...footerMenus];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return applyMenuOrder(ordered.map((m) => m.id));
  };

  const linkRow = (menu: NavMenu, link: NavLink, index: number, total: number) => (
    <SortableItem
      key={link.id}
      id={link.id}
      disabled={busy}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-2.5",
        !link.is_active && "opacity-60"
      )}
    >
      <DragHandle />
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
    </SortableItem>
  );

  const menuCard = (menu: NavMenu, index: number, reorderable: boolean) => {
    const links = [...menu.links].sort((a, b) => a.sort_order - b.sort_order);
    const content = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {reorderable && (
              <>
                <DragHandle />
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
              </>
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
          <SortableList
            ids={links.map((l) => l.id)}
            onReorder={(nextIds) => applyLinkOrder(menu, nextIds)}
            disabled={busy}
            className="flex flex-col gap-1.5"
          >
            {links.map((link, i) => linkRow(menu, link, i, links.length))}
          </SortableList>
        )}
      </>
    );

    const sectionClassName = cn(
      "flex flex-col gap-3 rounded-xl border border-border p-4",
      !menu.is_active && "opacity-60"
    );

    return reorderable ? (
      <SortableItem key={menu.id} id={menu.id} as="section" disabled={busy} className={sectionClassName}>
        {content}
      </SortableItem>
    ) : (
      <section key={menu.id} className={sectionClassName}>
        {content}
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

      <SiteInfoSection
        siteInfo={navigation.site_info}
        onSaved={(updated) =>
          setNavigation((prev) => (prev ? { ...prev, site_info: updated } : prev))
        }
      />

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
        <SortableList
          ids={footerMenus.map((m) => m.id)}
          onReorder={applyMenuOrder}
          disabled={busy}
          as="div"
          className="flex flex-col gap-3"
        >
          {footerMenus.map((menu, index) => menuCard(menu, index, true))}
        </SortableList>

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
