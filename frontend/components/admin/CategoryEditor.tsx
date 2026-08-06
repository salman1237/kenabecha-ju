"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { ApiError } from "@/lib/api/client";
import { createCategory, updateCategory } from "@/lib/api/adminCategories";
import type { AdminCategory } from "@/types/api";

/**
 * Create or rename a category.
 *
 * The slug is shown but only sent when the admin actually edits it — the API
 * deliberately leaves it alone on rename, and the warning below explains why
 * changing it is not free.
 */
export function CategoryEditor({
  category,
  parents,
  defaultParentId,
  onClose,
  onSaved,
}: {
  /** Absent when creating. */
  category?: AdminCategory;
  /** Top-level categories, for the parent picker. */
  parents: AdminCategory[];
  defaultParentId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = category !== undefined;
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [parentId, setParentId] = useState<string>(
    category?.parent_id ?? defaultParentId ?? ""
  );
  const [saving, setSaving] = useState(false);

  // Nesting is one level deep, so a category that has children of its own
  // cannot become someone else's child. The API enforces it; the picker just
  // does not offer the impossible option.
  const hasChildren = editing && parents.some((p) => p.id === category.id);
  const parentOptions = parents.filter((p) => p.id !== category?.id);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the category a name");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(category.id, {
          name: name.trim(),
          icon: icon.trim() || null,
          parent_id: parentId || null,
          ...(slug.trim() && slug.trim() !== category.slug ? { slug: slug.trim() } : {}),
        });
      } else {
        await createCategory({
          name: name.trim(),
          icon: icon.trim() || null,
          parent_id: parentId || null,
        });
      }
      toast.success(editing ? "Saved" : "Category added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Categories nest one level deep. Sellers pick one when they list something.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex w-20 flex-col gap-1.5">
              <Label htmlFor="category-icon">Icon</Label>
              <Input
                id="category-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📚"
                maxLength={16}
                className="text-center text-lg"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Electronics"
                maxLength={100}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-parent">Sits under</Label>
            <select
              id="category-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={hasChildren}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs disabled:opacity-50"
            >
              <option value="">Nothing — this is a top-level category</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon ? `${p.icon} ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
            {hasChildren && (
              <p className="text-xs text-muted-foreground">
                This category has subcategories of its own, so it has to stay at the top level.
              </p>
            )}
          </div>

          {editing && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category-slug">Web address</Label>
              <Input
                id="category-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground">
                Renaming a category leaves this alone on purpose. Changing it breaks any existing
                link or bookmark to <code>/listings?category={category.slug}</code>.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} loadingText="Saving">
            {editing ? "Save" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
