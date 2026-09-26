"use client";

import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SmartImage } from "@/components/ui/SmartImage";
import { cn, mediaUrl } from "@/lib/utils";
import type { ListingImage } from "@/types/api";

export function ImageGallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const count = images.length;
  const trackRef = useRef<HTMLDivElement>(null);
  // Set while we are smooth-scrolling to a chosen slide, so the scroll events
  // that fire on the way past intermediate slides don't fight the target.
  const targetRef = useRef<number | null>(null);
  const targetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const draggedRef = useRef(false);

  const scrollToIndex = useCallback((i: number) => {
    setActive(i);
    const el = trackRef.current;
    if (!el) return;
    targetRef.current = i;
    if (targetTimer.current) clearTimeout(targetTimer.current);
    targetTimer.current = setTimeout(() => (targetRef.current = null), 600);
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  const go = useCallback(
    (delta: number) => scrollToIndex((active + delta + count) % count),
    [active, count, scrollToIndex]
  );

  // Swiping (touch, trackpad, or drag) moves the track natively with
  // scroll-snap; this just keeps `active` (counter, thumbnails, lightbox) in
  // step with whichever slide it settled on.
  const onScroll = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = trackRef.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (targetRef.current !== null) {
        if (Math.abs(el.scrollLeft - targetRef.current * el.clientWidth) < 2) targetRef.current = null;
        return;
      }
      setActive(i);
    });
  };

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
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((img, i) => (
              <div key={img.id} className="h-full w-full shrink-0 snap-center snap-always">
                <SmartImage src={img.image_url} alt={title} eager={i === 0} />
              </div>
            ))}
          </div>

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
                onClick={() => scrollToIndex(i)}
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
            onClick={() => {
              // Releasing a swipe outside the image lands a click on the
              // backdrop; that must not dismiss the viewer.
              if (!draggedRef.current) setLightbox(false);
            }}
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
              drag={zoomed || count < 2 ? false : "x"}
              dragSnapToOrigin
              dragElastic={0.4}
              onDragStart={() => (draggedRef.current = true)}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 60) go(info.offset.x < 0 ? 1 : -1);
                setTimeout(() => (draggedRef.current = false), 80);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (draggedRef.current) return;
                setZoomed((z) => !z);
              }}
              className={cn(
                "max-h-[88vh] max-w-[92vw] touch-pan-y select-none rounded-lg object-contain transition-transform duration-300",
                zoomed ? "scale-[1.85] cursor-zoom-out" : "cursor-zoom-in"
              )}
            />

            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/60">
              {zoomed ? "Tap image to zoom out" : count > 1 ? "Swipe or use arrows · tap to zoom" : "Tap to zoom"} · Esc to close
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
