"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { SectionEditor } from "@/components/admin/SectionEditor";
import { SECTION_REGISTRY, getSectionDefinition } from "@/components/home/sections/registry";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createSection,
  deleteSection,
  listAdminSections,
  reorderSections,
  updateSection,
} from "@/lib/api/sections";
import { cn } from "@/lib/utils";
import type { PageSection, SectionType } from "@/types/api";

export default function AdminSectionsPage() {
  const [sections, setSections] = useState<PageSection[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PageSection | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PageSection | null>(null);

  const load = useCallback(() => {
    listAdminSections()
      .then(setSections)
      .catch(() => toast.error("Could not load sections"));
  }, []);

  useEffect(load, [load]);

  /** Optimistic on the list, authoritative on the response: the reorder
   *  endpoint returns the saved order, so a rejected move snaps back rather
   *  than leaving the screen disagreeing with the database. */
  const move = async (index: number, direction: -1 | 1) => {
    if (!sections) return;
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;

    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    setBusy(true);
    try {
      setSections(await reorderSections(next.map((s) => s.id)));
    } catch {
      toast.error("Could not save the new order");
      load();
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (section: PageSection) => {
    setBusy(true);
    try {
      const updated = await updateSection(section.id, { is_active: !section.is_active });
      setSections((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
      toast.success(updated.is_active ? "Section shown" : "Section hidden");
    } catch {
      toast.error("Could not change visibility");
    } finally {
      setBusy(false);
    }
  };

  const add = async (type: SectionType) => {
    setBusy(true);
    try {
      await createSection(type);
      load();
      toast.success("Section added — it starts hidden, switch it on when ready");
    } catch {
      toast.error("Could not add the section");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (section: PageSection) => {
    setBusy(true);
    try {
      await deleteSection(section.id);
      setSections((prev) => prev?.filter((s) => s.id !== section.id) ?? null);
      toast.success("Section removed");
    } catch {
      toast.error("Could not remove the section");
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Landing page</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reorder, retitle, hide or remove any part of the homepage. Changes are live
            immediately.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" disabled={busy} />}>
            <Plus className="size-4" />
            Add section
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-xs">
            {(Object.keys(SECTION_REGISTRY) as SectionType[]).map((type) => (
              <DropdownMenuItem key={type} onClick={() => add(type)}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{SECTION_REGISTRY[type].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {SECTION_REGISTRY[type].description}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sections === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          The homepage has no sections. Add one to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sections.map((section, index) => {
            const definition = getSectionDefinition(section.section_type);
            return (
              <li
                key={section.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 transition-opacity",
                  !section.is_active && "opacity-60"
                )}
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={`Move ${definition?.label ?? section.key} up`}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={`Move ${definition?.label ?? section.key} down`}
                    disabled={busy || index === sections.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{definition?.label ?? section.key}</span>
                    {!section.is_active && (
                      <Badge variant="secondary" className="text-[11px]">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {definition?.description ?? "This section type is not available in this build."}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={section.is_active ? "Hide section" : "Show section"}
                    disabled={busy}
                    onClick={() => toggle(section)}
                  >
                    {section.is_active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit text"
                    disabled={busy || !definition || definition.fields.length === 0}
                    onClick={() => setEditing(section)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove section"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => setConfirmDelete(section)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <SectionEditor
          section={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setSections((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this section?</AlertDialogTitle>
            <AlertDialogDescription>
              {getSectionDefinition(confirmDelete?.section_type as SectionType)?.label ?? "This section"}{" "}
              will disappear from the homepage along with any text you have customised. You can add
              it back later, but the text will start from the defaults again. To take it off the page
              without losing your edits, hide it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove(confirmDelete)}
              variant="destructive"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
