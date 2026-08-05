"use client";

import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { SmartImage } from "@/components/ui/SmartImage";
import { cn, mediaUrl } from "@/lib/utils";
import type { ListingImage } from "@/types/api";

export function ImageGallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const count = images.length;
  const go = useCallback(
    (delta: number) => setActive((i) => (i + delta + count) % count),
    [count]
  );

  // Arrow keys / Escape while the lightbox is open. Bound on document
  // because focus may be on the backdrop rather than any one control.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the overlay from scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, go]);

  // Reset zoom whenever the lightbox closes or the photo changes, so it
  // never reopens mid-zoom on a different image.
  useEffect(() => setZoomed(false), [lightbox, active]);

  if (count === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center gap-2 rounded-2xl bg-muted text-sm text-muted-foreground">
        <ImageOff className="size-4" /> No photos yet
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-muted shadow-[var(--shadow-soft-sm)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={images[active].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <SmartImage src={images[active].image_url} alt={title} eager />
            </motion.div>
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="Expand image"
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-xl bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Expand className="size-4" />
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <ChevronRight className="size-5" />
              </button>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                {active + 1} / {count}
              </span>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                  i === active
                    ? "border-primary shadow-[var(--shadow-soft-primary)]"
                    : "border-transparent opacity-65 hover:opacity-100"
                )}
              >
                <SmartImage src={img.image_url} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`${title} — image ${active + 1} of ${count}`}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4"
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-5" />
            </button>

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(-1);
                  }}
                  aria-label="Previous image"
                  className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(1);
                  }}
                  aria-label="Next image"
                  className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            <motion.img
              key={images[active].id}
              src={mediaUrl(images[active].image_url)}
              alt={title}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                e.stopPropagation();
                setZoomed((z) => !z);
              }}
              className={cn(
                "max-h-[88vh] max-w-[92vw] rounded-lg object-contain transition-transform duration-300",
                zoomed ? "scale-[1.85] cursor-zoom-out" : "cursor-zoom-in"
              )}
            />

            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/60">
              {zoomed ? "Click image to zoom out" : "Click image to zoom"} · Esc to close
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
