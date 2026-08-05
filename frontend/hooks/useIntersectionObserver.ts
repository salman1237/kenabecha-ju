"use client";

import { useEffect, useRef, useState } from "react";

interface Options {
  /** Fire before the element is actually visible, so loads feel instant. */
  rootMargin?: string;
  threshold?: number;
  /** Stop observing after the first intersection. */
  once?: boolean;
}

/**
 * Observes a single element and reports whether it's in view. Backs the
 * infinite-scroll sentinel and lazy image reveals.
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLDivElement>({
  rootMargin = "200px",
  threshold = 0,
  once = false,
}: Options = {}) {
  const ref = useRef<T | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, isIntersecting };
}
