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
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { deleteCategory } from "@/lib/api/adminCategories";
import type { AdminCategory } from "@/types/api";

/**
 * Deleting a category that holds listings would uncategorise them — the
 * listing foreign key is ON DELETE SET NULL — so the API refuses unless it is
 * told where they go. This dialog is that conversation: it states the count
 * plainly, insists on a destination, and points at hiding as the option that
 * costs nothing.
 */
export function CategoryDeleteDialog({
  category,
  destinations,
  onClose,
  onDeleted,
  onHide,
}: {
  category: AdminCategory;
  /** Every other category the listings could move to. */
  destinations: AdminCategory[];
  onClose: () => void;
  onDeleted: () => void;
  onHide: () => void;
}) {
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const holdsListings = category.listing_count > 0;

  const confirm = async () => {
    if (holdsListings && !moveTo) {
      toast.error("Choose where the listings should go");
      return;
    }
    setBusy(true);
    try {
      await deleteCategory(category.id, moveTo || undefined);
      toast.success(
        holdsListings
          ? `Deleted — ${category.listing_count} listing(s) moved`
          : "Category deleted"
      );
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete the category");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{category.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            {holdsListings
              ? `${category.listing_count} listing(s) are filed under this category. They have to go somewhere, or they would end up with no category at all.`
              : "Nothing is filed under this category, so nothing else changes."}
          </DialogDescription>
        </DialogHeader>

        {holdsListings && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="move-to">Move those listings to</Label>
            <select
              id="move-to"
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">Choose a category…</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.parent_id ? "— " : ""}
                  {d.icon ? `${d.icon} ` : ""}
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          To take this category out of browsing without touching any listings, hide it instead —
          that is reversible, and this is not.
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onHide} disabled={busy}>
            Hide it instead
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} loading={busy} loadingText="Deleting">
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
