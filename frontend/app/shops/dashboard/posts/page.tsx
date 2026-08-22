"use client";

import { Megaphone, Pencil, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PostComposer } from "@/components/posts/PostComposer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { deletePost, getMyPosts } from "@/lib/api/posts";
import { getMyShops } from "@/lib/api/shops";
import { cn } from "@/lib/utils";
import type { Post, PostStatus, Shop } from "@/types/api";

const STATUS_VARIANT: Record<PostStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  published: "default",
  rejected: "destructive",
};

function MyPostsContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const shopId = useSearchParams().get("shop_id") ?? undefined;

  const [shops, setShops] = useState<Shop[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState<"new" | Post | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyShops()
      .then(setShops)
      .catch(() => {});
  }, [user]);

  const activeShopId = shopId ?? shops[0]?.id;

  const load = useCallback(() => {
    if (!activeShopId) return;
    setLoading(true);
    getMyPosts(activeShopId)
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [activeShopId]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (post: Post) => {
    await deletePost(post.id);
    load();
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        <Link href="/login?next=/shops/dashboard/posts" className="font-medium text-foreground">
          Log in
        </Link>{" "}
        to manage your posts.
      </div>
    );
  }

  if (composing !== null) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            {composing === "new" ? "New post" : "Edit post"}
          </h1>
          <Button variant="ghost" size="sm" onClick={() => setComposing(null)}>
            Back to posts
          </Button>
        </div>
        <PostComposer
          mode={composing === "new" ? "create" : "edit"}
          post={composing === "new" ? undefined : composing}
          defaultShopId={activeShopId}
          onSuccess={() => {
            setComposing(null);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Post about the same product as often as you like — every submission goes through moderation.
          </p>
        </div>
        {shops.length > 1 && (
          <select
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={activeShopId ?? ""}
            onChange={(e) => router.push(`/shops/dashboard/posts?shop_id=${e.target.value}`)}
          >
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name}
              </option>
            ))}
          </select>
        )}
        <Button onClick={() => setComposing("new")} disabled={!activeShopId}>
          <PlusCircle /> New post
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !activeShopId ? (
        <EmptyState
          title="Open a shop first"
          description="Posts belong to a shop — open one before creating your first post."
          action={
            <Link href="/shops/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Go to shops
            </Link>
          }
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No posts yet"
          description="Post about a product to grab attention — you can post about the same one again any time."
          action={
            <Button variant="outline" onClick={() => setComposing("new")}>
              <PlusCircle /> New post
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{post.title}</span>
                    <Badge variant={STATUS_VARIANT[post.status]} className="capitalize">
                      {post.status}
                    </Badge>
                  </div>
                  {post.status === "rejected" && post.rejection_reason && (
                    <p className="text-xs text-destructive">{post.rejection_reason}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {post.listings.length} product{post.listings.length === 1 ? "" : "s"} linked
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {post.status === "published" && (
                    <Link
                      href={`/posts/${post.slug}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      View
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setComposing(post)}>
                    <Pencil /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="ghost" size="sm" className="text-destructive" />}
                    >
                      <Trash2 /> Delete
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{post.title}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(post)} variant="destructive">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyPostsPage() {
  return (
    <Suspense>
      <MyPostsContent />
    </Suspense>
  );
}
