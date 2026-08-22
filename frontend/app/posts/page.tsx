"use client";

import { AnimatePresence, motion } from "motion/react";
import { Loader2, Megaphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PostCard } from "@/components/posts/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { getFeed } from "@/lib/api/posts";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { Post } from "@/types/api";

const PAGE_SIZE = 24;

function FeedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function PostsFeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getFeed(PAGE_SIZE, 0)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setTotal(page.total);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const hasMore = posts.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await getFeed(PAGE_SIZE, posts.length);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setTotal(page.total);
    } catch {
      /* the sentinel can retry on next scroll */
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, posts.length]);

  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "400px",
  });

  useEffect(() => {
    if (isIntersecting) loadMore();
  }, [isIntersecting, loadMore]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
        <p className="text-sm text-muted-foreground">
          What campus shops are shouting about right now — shops you follow show up first.
        </p>
      </div>

      {failed ? (
        <ErrorState
          title="Couldn't load posts"
          description="Check your connection and try again."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : loading ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No posts yet"
          description="Once shops start posting, they'll show up here."
        />
      ) : (
        <>
          <AnimatePresence initial={false}>
            <motion.div
              variants={staggerContainer(0.03)}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {posts.map((post) => (
                <motion.div key={post.id} variants={staggerItem}>
                  <PostCard post={post} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          <div ref={sentinelRef} className="flex h-16 items-center justify-center">
            {loadingMore && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading more…
              </span>
            )}
            {!hasMore && posts.length > PAGE_SIZE && (
              <span className="text-sm text-muted-foreground">That&apos;s everything — {total} posts</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
