"use client";

import DOMPurify from "dompurify";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ShareButton } from "@/components/ui/ShareButton";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { getPost } from "@/lib/api/posts";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { Post } from "@/types/api";

function DetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function PostDetailPage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPost(params.slug)
      .then(setPost)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const safeHtml = useMemo(() => {
    if (!post || typeof window === "undefined") return post?.description_html ?? "";
    return DOMPurify.sanitize(post.description_html, {
      ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "u", "span"],
    });
  }, [post]);

  if (loading) return <DetailSkeleton />;
  if (error || !post) {
    return <p className="mx-auto max-w-2xl px-6 py-12 text-sm text-destructive">Post not found.</p>;
  }

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <motion.div variants={staggerItem}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Posts", href: "/posts" },
            { label: post.title },
          ]}
        />
      </motion.div>

      {post.images.length > 0 && (
        <motion.div variants={staggerItem} className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
          <SmartImage src={post.images[0].image_url} alt={post.title} eager />
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="flex items-center justify-between gap-3">
        <Link href={`/shops/${post.shop.slug}`} className="flex items-center gap-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-full">
            <SmartImage
              src={post.shop.logo_url}
              alt=""
              sizes="40px"
              fallback={<span className="text-sm font-semibold">{post.shop.shop_name.charAt(0)}</span>}
            />
          </div>
          <span className="font-semibold hover:underline">{post.shop.shop_name}</span>
        </Link>
        <ShareButton title={post.title} text={`Check out "${post.title}" on KenaBecha JU`} />
      </motion.div>

      <motion.h1 variants={staggerItem} className="text-2xl font-bold tracking-tight">
        {post.title}
      </motion.h1>

      <motion.div
        variants={staggerItem}
        className="text-sm leading-relaxed text-foreground/90 [&_b]:font-semibold [&_strong]:font-semibold"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {post.images.length > 1 && (
        <motion.div variants={staggerItem} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {post.images.slice(1).map((img) => (
            <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl">
              <SmartImage src={img.image_url} alt="" />
            </div>
          ))}
        </motion.div>
      )}

      {post.listings.length > 0 && (
        <motion.section variants={staggerItem} className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            Linked products <Badge variant="secondary">{post.listings.length}</Badge>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {post.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}
