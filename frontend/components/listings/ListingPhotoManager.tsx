"use client";

import { ArrowLeft, ArrowRight, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartImage } from "@/components/ui/SmartImage";
import { useLanguage } from "@/context/LanguageContext";
import { translateApiError } from "@/lib/i18n/errors";
import {
  deleteListingImage,
  getListing,
  reorderListingImages,
  uploadListingImage,
} from "@/lib/api/listings";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/api";

const MAX_PHOTOS = 8;

/**
 * Photo management for an existing listing.
 *
 * Editing previously offered no photo control at all — the only way to
 * remove one was a bare "Manage photos: Remove #1" row on the public
 * listing page, which is an editing control sitting on a viewing surface.
 * Uploads and deletions here take effect immediately rather than on form
 * submit, because they already do server-side; pretending otherwise would
 * mean a Cancel button that cannot actually cancel them.
 */
export function ListingPhotoManager({
  listing,
  onChange,
}: {
  listing: Listing;
  onChange: (listing: Listing) => void;
}) {
  const { t, fmt } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const images = listing.images;
  const full = images.length >= MAX_PHOTOS;

  const run = async (action: () => Promise<Listing | void>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      if (updated) onChange(updated);
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - images.length;
    const chosen = Array.from(files).slice(0, room);
    void run(async () => {
      for (const file of chosen) {
        await uploadListingImage(listing.id, file);
      }
      // The upload endpoint returns the created image, not the listing, so
      // re-read the listing to pick up the new set in server order.
      return getListing(listing.id);
    });
  };

  const remove = (imageId: string) =>
    void run(async () => {
      await deleteListingImage(listing.id, imageId);
      const remaining = images.filter((i) => i.id !== imageId).map((i) => i.id);
      if (remaining.length === 0) return { ...listing, images: [] };
      return reorderListingImages(listing.id, remaining);
    });

  const move = (index: number, delta: number) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run(() => reorderListingImages(listing.id, next.map((i) => i.id)));
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    const next = [images[index], ...images.filter((_, i) => i !== index)];
    void run(() => reorderListingImages(listing.id, next.map((i) => i.id)));
  };

  return (
    <div className="flex flex-col gap-3">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-muted",
                index === 0 ? "border-emerald-500/60" : "border-border/70"
              )}
            >
              <div className="aspect-square w-full">
                <SmartImage src={image.image_url} alt="" sizes="200px" />
              </div>

              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {t.listingForm.coverPhoto}
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/55 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t.listingForm.moveLeft}
                  className="size-7 text-white hover:bg-white/20 hover:text-white"
                >
                  <ArrowLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={busy || index === 0}
                  onClick={() => makeCover(index)}
                  aria-label={t.listingForm.makeCover}
                  className="size-7 text-white hover:bg-white/20 hover:text-white"
                >
                  <Star className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={busy || index === images.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t.listingForm.moveRight}
                  className="size-7 text-white hover:bg-white/20 hover:text-white"
                >
                  <ArrowRight className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => remove(image.id)}
                  aria-label={t.listingForm.removePhoto}
                  className="size-7 text-destructive-foreground hover:bg-destructive/80"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy || full}
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        {fmt.number(images.length)}/{fmt.number(MAX_PHOTOS)} · {t.listingForm.coverHint}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
