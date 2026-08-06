"use client";

import { useState } from "react";
import { toast } from "sonner";

import { NAV_ICON_NAMES, NavIcon } from "@/components/layout/NavIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { createLink, updateLink } from "@/lib/api/navigation";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { navLabel } from "@/lib/navigation";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import type { NavLink, NavVisibility } from "@/types/api";

const LOCALE_LABELS: Record<Locale, string> = { en: "English", bn: "বাংলা" };
const MESSAGES = { en, bn };

const VISIBILITY_OPTIONS: { value: NavVisibility; label: string; hint: string }[] = [
  { value: "always", label: "Everyone", hint: "Shown to every visitor" },
  { value: "signed_in", label: "Signed in only", hint: "Hidden until someone logs in" },
  { value: "signed_out", label: "Signed out only", hint: "Hidden once someone logs in" },
];

export function NavLinkEditor({
  link,
  menuId,
  showIcon,
  onClose,
  onSaved,
}: {
  /** Absent when creating. */
  link?: NavLink;
  menuId: string;
  /** Only the navbar renders icons, in its mobile menu. */
  showIcon: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = link !== undefined;

  const [labels, setLabels] = useState<Partial<Record<Locale, string>>>(() => {
    const initial: Partial<Record<Locale, string>> = {};
    for (const locale of LOCALES) {
      const value = link?.label?.[locale];
      if (typeof value === "string") initial[locale] = value;
    }
    return initial;
  });
  const [href, setHref] = useState(link?.href ?? "");
  const [icon, setIcon] = useState(link?.icon ?? "");
  const [visibility, setVisibility] = useState<NavVisibility>(link?.visibility ?? "always");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!href.trim()) {
      toast.error("Give the link a destination");
      return;
    }
    const label = Object.fromEntries(
      LOCALES.map((locale) => [locale, labels[locale]?.trim() ?? ""]).filter(([, v]) => v)
    ) as Record<string, string>;

    // A new link has no bundled translation to fall back on, so it would
    // render as its own URL if saved with no text at all.
    if (!editing && Object.keys(label).length === 0) {
      toast.error("Give the link a label in at least one language");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label,
        href: href.trim(),
        visibility,
        ...(showIcon ? { icon: icon || null } : {}),
      };
      if (editing) await updateLink(link.id, payload);
      else await createLink(menuId, payload);
      toast.success(editing ? "Saved" : "Link added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit link" : "New link"}</DialogTitle>
          <DialogDescription>
            {link?.translation_key
              ? "Leave a language empty to keep the wording the site ships with, shown as the placeholder."
              : "Enter the text for each language. A link with no text falls back to showing its address."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Tabs defaultValue="en">
            <TabsList>
              {LOCALES.map((locale) => (
                <TabsTrigger key={locale} value={locale}>
                  {LOCALE_LABELS[locale]}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOCALES.map((locale) => (
              <TabsContent key={locale} value={locale} className="pt-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`label-${locale}`}>Text</Label>
                  <Input
                    id={`label-${locale}`}
                    value={labels[locale] ?? ""}
                    placeholder={
                      link
                        ? navLabel({ ...link, label: {} }, locale, MESSAGES[locale])
                        : "Browse listings"
                    }
                    onChange={(e) =>
                      setLabels((prev) => ({ ...prev, [locale]: e.target.value }))
                    }
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-href">Address</Label>
            <Input
              id="link-href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/listings"
            />
            <p className="text-xs text-muted-foreground">
              A path like <code>/listings</code> stays on the site. Anything else — a full{" "}
              <code>https://</code> address — opens in a new tab.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-visibility">Who sees it</Label>
            <select
              id="link-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as NavVisibility)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.hint}
                </option>
              ))}
            </select>
          </div>

          {showIcon && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-icon">Icon</Label>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-md border border-input">
                  <NavIcon name={icon || null} className="size-4" />
                </span>
                <select
                  id="link-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">None</option>
                  {NAV_ICON_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Shown in the mobile menu only.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} loadingText="Saving">
            {editing ? "Save" : "Add link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
