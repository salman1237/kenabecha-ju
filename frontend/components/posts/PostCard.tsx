"use client";

import DOMPurify from "dompurify";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { hoverLift } from "@/lib/motion";
import type { Post } from "@/types/api";

/**
 * Second sanitization pass, client-side, right before render — the server
 * already stripped everything dangerous before storing this HTML, but this
 * is the app's first rendered-HTML surface and the server's CSS filter is
 * hand-rolled, not a battle-tested library. Cheap insurance for something
 * genuinely novel, not a general "sanitize everywhere" policy.
 */
function useSanitizedHtml(html: string): string {
  return useMemo(
    () =>
      typeof window === "undefined"
        ? html
        : DOMPurify.sanitize(html, { ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "u", "span"] }),
    [html]
  );
}

export function PostCard({ post }: { post: Post }) {
  const safeHtml = useSanitizedHtml(post.description_html);
  const cover = post.images[0];

  return (
    <motion.div {...hoverLift}>
      <Link
        href={`/posts/${post.slug}`}
        className="group flex flex-col overflow-hidden rounded-2xl border border-emerald-500/15 bg-card/60 shadow-[var(--shadow-soft-xs)] backdrop-blur-xs transition-all duration-300 hover:border-emerald-500/40 hover:shadow-[var(--shadow-soft-lg)] dark:border-emerald-400/15 dark:hover:border-emerald-400/40"
      >
        {cover && (
          <div className="relative aspect-[16/10] w-full overflow-hidden">
            <SmartImage
              src={cover.image_url}
              alt={post.title}
              className="transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="size-5 shrink-0 overflow-hidden rounded-full">
              <SmartImage
                src={post.shop.logo_url}
                alt=""
                sizes="20px"
                fallback={<span className="text-[9px] font-semibold">{post.shop.shop_name.charAt(0)}</span>}
              />
            </div>
            <span className="truncate text-xs font-medium text-muted-foreground">{post.shop.shop_name}</span>
          </div>

          <p className="line-clamp-1 font-semibold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
            {post.title}
          </p>

          <div
            className="line-clamp-2 text-xs leading-relaxed text-muted-foreground [&_b]:font-semibold [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          {post.listings.length > 0 && (
            <Badge variant="secondary" className="mt-auto w-fit text-[10px]">
              {post.listings.length} product{post.listings.length === 1 ? "" : "s"} linked
            </Badge>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
