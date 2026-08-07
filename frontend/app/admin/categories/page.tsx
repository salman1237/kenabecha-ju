"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CategoryDeleteDialog } from "@/components/admin/CategoryDeleteDialog";
import { CategoryEditor } from "@/components/admin/CategoryEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/sortable-list";
import {
  listAdminCategories,
  reorderCategories,
  updateCategory,
} from "@/lib/api/adminCategories";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { AdminCategory } from "@/types/api";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);

  const load = useCallback(() => {
    listAdminCategories()
      .then(setCategories)
      .catch(() => toast.error("Could not load categories"));
  }, []);

  useEffect(load, [load]);

  const parents = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => c.parent_id === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  /** Siblings of a category, in display order — the unit the API reorders. */
  const siblingsOf = useCallback(
    (parentId: string | null) =>
      (categories ?? [])
        .filter((c) => c.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const move = async (category: AdminCategory, direction: -1 | 1) => {
    const siblings = siblingsOf(category.parent_id);
    const index = siblings.findIndex((c) => c.id === category.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await applyOrder(category.parent_id, reordered.map((c) => c.id));
  };

  /** Scoped to one sibling group — the top level, or one parent's children —
   *  matching what `reorderCategories` itself demands. Shared by the arrow
   *  buttons and drag-and-drop. */
  const applyOrder = async (parentId: string | null, nextIds: string[]) => {
    setBusy(true);
    try {
      await reorderCategories(parentId, nextIds);
      load();
    } catch {
      toast.error("Could not save the new order");
      load();
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (category: AdminCategory) => {
    setBusy(true);
    try {
      const updated = await updateCategory(category.id, { is_active: !category.is_active });
      setCategories((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)) ?? null);
      toast.success(
        updated.is_active
          ? "Category is browsable again"
          : category.parent_id === null
            ? "Hidden — its subcategories are hidden with it"
            : "Category hidden"
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not change visibility");
    } finally {
      setBusy(false);
    }
  };

  const row = (category: AdminCategory, parent: AdminCategory | null) => {
    const isChild = parent !== null;
    const siblings = siblingsOf(category.parent_id);
    const index = siblings.findIndex((c) => c.id === category.id);
    // A child of a hidden parent is not browsable either, and saying so is
    // the difference between the admin understanding the page and thinking
    // the toggle is broken.
    const hiddenByParent = parent !== null && !parent.is_active && category.is_active;

    return (
      <SortableItem
        key={category.id}
        id={category.id}
        disabled={busy}
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 transition-opacity",
          isChild && "ml-6 border-dashed",
          (!category.is_active || hiddenByParent) && "opacity-60"
        )}
      >
        <DragHandle />
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            aria-label={`Move ${category.name} up`}
            disabled={busy || index === 0}
            onClick={() => move(category, -1)}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            aria-label={`Move ${category.name} down`}
            disabled={busy || index === siblings.length - 1}
            onClick={() => move(category, 1)}
          >
            <ArrowDown className="size-3.5" />
          </Button>
        </div>

        <span className="w-6 text-center text-lg" aria-hidden="true">
          {category.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-medium", isChild && "text-sm")}>{category.name}</span>
            {!category.is_active && (
              <Badge variant="secondary" className="text-[11px]">
                Hidden
              </Badge>
            )}
            {hiddenByParent && (
              <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                Hidden with its parent
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            /{category.slug} · {category.listing_count} listing
            {category.listing_count === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {!isChild && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={busy}
              onClick={() => setAdding({ parentId: category.id })}
            >
              <Plus className="size-3.5" />
              Subcategory
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={category.is_active ? "Hide category" : "Show category"}
            disabled={busy}
            onClick={() => toggle(category)}
          >
            {category.is_active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${category.name}`}
            disabled={busy}
            onClick={() => setEditing(category)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${category.name}`}
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => setDeleting(category)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </SortableItem>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What sellers can file a listing under. Hiding a category takes it out of browsing
            without touching any listing; deleting one asks where its listings should go.
          </p>
        </div>
        <Button size="sm" disabled={busy} onClick={() => setAdding({ parentId: null })}>
          <Plus className="size-4" />
          Add category
        </Button>
      </div>

      {categories === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          There are no categories yet. Add one to get started.
        </p>
      ) : (
        <SortableList
          ids={parents.map((p) => p.id)}
          onReorder={(nextIds) => applyOrder(null, nextIds)}
          disabled={busy}
          className="flex flex-col gap-2"
        >
          {parents.map((parent) => {
            const children = siblingsOf(parent.id);
            return (
              // display:contents so this grouping wrapper doesn't add a box
              // to the <ul>'s flex layout — the parent row and its children
              // still lay out as if they were direct siblings.
              <div key={parent.id} className="contents">
                {row(parent, null)}
                {children.length > 0 && (
                  <SortableList
                    ids={children.map((c) => c.id)}
                    onReorder={(nextIds) => applyOrder(parent.id, nextIds)}
                    disabled={busy}
                    as="div"
                    className="contents"
                  >
                    {children.map((child) => row(child, parent))}
                  </SortableList>
                )}
              </div>
            );
          })}
        </SortableList>
      )}

      {(editing || adding) && (
        <CategoryEditor
          category={editing ?? undefined}
          parents={parents}
          defaultParentId={adding?.parentId ?? null}
          onClose={() => {
            setEditing(null);
            setAdding(null);
          }}
          onSaved={() => {
            setEditing(null);
            setAdding(null);
            load();
          }}
        />
      )}

      {deleting && (
        <CategoryDeleteDialog
          category={deleting}
          destinations={(categories ?? []).filter((c) => c.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            load();
          }}
          onHide={() => {
            const target = deleting;
            setDeleting(null);
            if (target.is_active) toggle(target);
          }}
        />
      )}
    </div>
  );
}
