"use client";

import { useState } from "react";
import { toast } from "sonner";

import { getSectionDefinition } from "@/components/home/sections/registry";
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
import { Textarea } from "@/components/ui/textarea";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { sectionDefaults, sectionNumber } from "@/lib/sectionCopy";
import { updateSection } from "@/lib/api/sections";
import { bn } from "@/messages/bn";
import { en } from "@/messages/en";
import type { PageSection } from "@/types/api";

const LOCALE_LABELS: Record<Locale, string> = { en: "English", bn: "বাংলা" };
const MESSAGES = { en, bn };

/** `{field: {locale: text}}` — the shape stored in `settings`, flattened into
 *  form state so each input can address one cell of it. */
type CopyState = Record<string, Partial<Record<Locale, string>>>;

function initialCopy(section: PageSection, keys: string[]): CopyState {
  const state: CopyState = {};
  for (const key of keys) {
    const value = section.settings?.[key];
    state[key] = {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const locale of LOCALES) {
        const text = (value as Record<string, unknown>)[locale];
        if (typeof text === "string") state[key][locale] = text;
      }
    }
  }
  return state;
}

export function SectionEditor({
  section,
  onClose,
  onSaved,
}: {
  section: PageSection;
  onClose: () => void;
  onSaved: (section: PageSection) => void;
}) {
  const definition = getSectionDefinition(section.section_type);
  const fields = definition?.fields ?? [];

  const [copy, setCopy] = useState<CopyState>(() =>
    initialCopy(section, fields.map((f) => f.key))
  );
  const [limit, setLimit] = useState(String(sectionNumber(section, "limit", 0) || ""));
  const [saving, setSaving] = useState(false);

  const set = (key: string, locale: Locale, value: string) =>
    setCopy((prev) => ({ ...prev, [key]: { ...prev[key], [locale]: value } }));

  const save = async () => {
    // Start from whatever else was stored so an unknown setting is not lost
    // just because this editor did not know how to show it.
    const settings: Record<string, unknown> = { ...section.settings };

    for (const field of fields) {
      const entered = Object.fromEntries(
        LOCALES.map((locale) => [locale, copy[field.key]?.[locale]?.trim() ?? ""]).filter(
          ([, text]) => text
        )
      );
      // An empty field means "use the default", which is expressed by the key
      // being absent — not by an empty string, which would render as a blank
      // heading.
      if (Object.keys(entered).length > 0) settings[field.key] = entered;
      else delete settings[field.key];
    }

    if (definition?.hasLimit) {
      const parsed = Number(limit);
      if (limit.trim() && (!Number.isInteger(parsed) || parsed < 1 || parsed > 24)) {
        toast.error("Show a number between 1 and 24");
        return;
      }
      if (limit.trim()) settings.limit = parsed;
      else delete settings.limit;
    }

    setSaving(true);
    try {
      onSaved(await updateSection(section.id, { settings }));
      toast.success("Saved");
    } catch {
      toast.error("Could not save the changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{definition?.label ?? section.key}</DialogTitle>
          <DialogDescription>
            Leave a field empty to use the wording the site ships with, shown as the placeholder.
            Each language is stored separately.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="en">
          <TabsList>
            {LOCALES.map((locale) => (
              <TabsTrigger key={locale} value={locale}>
                {LOCALE_LABELS[locale]}
              </TabsTrigger>
            ))}
          </TabsList>

          {LOCALES.map((locale) => {
            const defaults = sectionDefaults(section.section_type, MESSAGES[locale]);
            return (
              <TabsContent key={locale} value={locale} className="flex flex-col gap-4 pt-4">
                {fields.map((field) => {
                  const id = `${section.id}-${field.key}-${locale}`;
                  return (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <Label htmlFor={id}>{field.label}</Label>
                      {field.multiline ? (
                        <Textarea
                          id={id}
                          rows={2}
                          value={copy[field.key]?.[locale] ?? ""}
                          placeholder={defaults[field.key]}
                          onChange={(e) => set(field.key, locale, e.target.value)}
                        />
                      ) : (
                        <Input
                          id={id}
                          value={copy[field.key]?.[locale] ?? ""}
                          placeholder={defaults[field.key]}
                          onChange={(e) => set(field.key, locale, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </TabsContent>
            );
          })}
        </Tabs>

        {definition?.hasLimit && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <Label htmlFor={`${section.id}-limit`}>How many to show</Label>
            <Input
              id={`${section.id}-limit`}
              type="number"
              min={1}
              max={24}
              value={limit}
              placeholder="Default"
              onChange={(e) => setLimit(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Applies to both languages. Leave empty for the default.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} loadingText="Saving">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
