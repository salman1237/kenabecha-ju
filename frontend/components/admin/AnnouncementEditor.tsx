"use client";

import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { getAnnouncement, setAnnouncement } from "@/lib/api/dashboard-admin";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import type { AdminAnnouncement, AnnouncementVariant } from "@/types/api";

const LOCALE_LABELS: Record<Locale, string> = { en: "English", bn: "বাংলা" };

const VARIANTS: { value: AnnouncementVariant; label: string }[] = [
  { value: "info", label: "Information" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" with no zone or seconds. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AnnouncementEditor() {
  const [announcement, setLocal] = useState<AdminAnnouncement | null>(null);
  const [messages, setMessages] = useState<Partial<Record<Locale, string>>>({});
  const [variant, setVariant] = useState<AnnouncementVariant>("info");
  const [isActive, setIsActive] = useState(false);
  const [dismissible, setDismissible] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAnnouncement()
      .then((data) => {
        setLocal(data);
        const next: Partial<Record<Locale, string>> = {};
        for (const locale of LOCALES) {
          const value = data.message?.[locale];
          if (typeof value === "string") next[locale] = value;
        }
        setMessages(next);
        setVariant(data.variant);
        setIsActive(data.is_active);
        setDismissible(data.dismissible);
        setStartsAt(toLocalInput(data.starts_at));
        setEndsAt(toLocalInput(data.ends_at));
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    const message = Object.fromEntries(
      LOCALES.map((locale) => [locale, messages[locale]?.trim() ?? ""]).filter(([, v]) => v)
    ) as Record<string, string>;

    if (isActive && Object.keys(message).length === 0) {
      toast.error("Write the announcement before switching it on");
      return;
    }

    setSaving(true);
    try {
      // Local wall-clock in, ISO out: the server decides whether the banner
      // is live, so it needs an unambiguous instant rather than "9pm".
      const updated = await setAnnouncement({
        message,
        variant,
        is_active: isActive,
        dismissible,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      });
      setLocal(updated);
      toast.success(updated.is_active ? "Announcement is live" : "Saved — not shown yet");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the announcement");
    } finally {
      setSaving(false);
    }
  };

  if (!announcement) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-sm font-semibold">Site-wide announcement</h2>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        A bar across the top of every page. Leave a language empty and it falls back to the other.
      </p>

      <Tabs defaultValue="en">
        <TabsList>
          {LOCALES.map((locale) => (
            <TabsTrigger key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </TabsTrigger>
          ))}
        </TabsList>
        {LOCALES.map((locale) => (
          <TabsContent key={locale} value={locale} className="pt-3">
            <Textarea
              rows={2}
              value={messages[locale] ?? ""}
              placeholder="The site will be down for maintenance on Friday evening."
              onChange={(e) => setMessages((prev) => ({ ...prev, [locale]: e.target.value }))}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-variant">Tone</Label>
          <select
            id="ann-variant"
            value={variant}
            onChange={(e) => setVariant(e.target.value as AnnouncementVariant)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
          >
            {VARIANTS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-starts">Show from</Label>
          <Input
            id="ann-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-ends">Show until</Label>
          <Input
            id="ann-ends"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            Show the banner
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dismissible}
              onChange={(e) => setDismissible(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            Readers can dismiss it
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Changing the wording shows the banner again to anyone who dismissed the last one.
        </p>
        <Button onClick={save} loading={saving} loadingText="Saving" size="sm">
          Save
        </Button>
      </div>
    </div>
  );
}
