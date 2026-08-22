"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { BulkBar } from "@/components/admin/BulkBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import {
  approvePost,
  listAdminPosts,
  rejectPost,
  removeAdminPost,
  unpublishPost,
} from "@/lib/api/admin";
import {
  bulkApprovePosts,
  bulkDeletePosts,
  bulkRejectPosts,
  bulkUnpublishPosts,
} from "@/lib/api/dashboard-admin";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import type { Post, PostStatus } from "@/types/api";

const STATUS_VARIANT: Record<PostStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  published: "default",
  rejected: "destructive",
};

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Post | null>(null);
  const [reason, setReason] = useState("");
  const [bulkRejecting, setBulkRejecting] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [bulkReason, setBulkReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listAdminPosts()
      .then((page) => setPosts(page.items))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runSingle = async (action: () => Promise<Post>, id: string) => {
    setBusyId(id);
    try {
      await action();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not work");
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejecting || !reason.trim()) return;
    await runSingle(() => rejectPost(rejecting.id, reason.trim()), rejecting.id);
    setRejecting(null);
    setReason("");
  };

  const confirmBulkReject = async () => {
    if (!bulkRejecting || !bulkReason.trim()) return;
    try {
      const result = await bulkRejectPosts(bulkRejecting.ids, bulkReason.trim());
      if (result.failed.length === 0) {
        toast.success(`${result.succeeded.length} rejected`);
      } else {
        toast.warning(`${result.succeeded.length} rejected, ${result.failed.length} failed`);
      }
      bulkRejecting.clear();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not work");
    } finally {
      setBulkRejecting(null);
      setBulkReason("");
    }
  };

  const columns: Column<Post>[] = [
    {
      key: "title",
      header: "Title",
      cell: (p) => <span className="font-medium">{p.title}</span>,
      sortValue: (p) => p.title,
    },
    {
      key: "shop",
      header: "Shop",
      cell: (p) => (
        <Link href={`/shops/${p.shop.slug}`} className="text-muted-foreground hover:underline">
          {p.shop.shop_name}
        </Link>
      ),
      sortValue: (p) => p.shop.shop_name,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <Badge variant={STATUS_VARIANT[p.status]} className="capitalize">
          {p.status}
        </Badge>
      ),
      sortValue: (p) => p.status,
    },
    {
      key: "listings",
      header: "Linked",
      cell: (p) => <span className="text-muted-foreground tabular-nums">{p.listings.length}</span>,
      sortValue: (p) => p.listings.length,
      hideOnMobile: true,
    },
    {
      key: "created_at",
      header: "Submitted",
      cell: (p) => <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>,
      sortValue: (p) => p.created_at,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight">Posts</h1>
      <DataTable
        selection={{
          selected,
          onChange: setSelected,
          bar: (ids, clear) => (
            <div className="flex flex-wrap items-center gap-2">
              <BulkBar
                ids={ids}
                clear={clear}
                onDone={load}
                actions={[
                  { label: "Approve", run: bulkApprovePosts },
                  { label: "Unpublish", run: bulkUnpublishPosts },
                  {
                    label: "Delete",
                    destructive: true,
                    confirm: "Delete the selected posts? Each shop owner is notified individually.",
                    run: bulkDeletePosts,
                  },
                ]}
              />
              {/* Reject needs a shared free-text reason, which BulkBar's
                  static confirm string can't collect — handled by its own
                  dialog below instead of forcing that through BulkBar. */}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkRejecting({ ids, clear })}
              >
                Reject
              </Button>
            </div>
          ),
        }}
        rows={posts}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by title or shop…"
        searchKeys={(p) => `${p.title} ${p.shop.shop_name}`}
        exportName="posts"
        emptyTitle="No posts"
        actions={(p) => (
          <div className="flex items-center gap-1">
            {p.status !== "published" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === p.id}
                onClick={() => runSingle(() => approvePost(p.id), p.id)}
              >
                Approve
              </Button>
            )}
            {p.status !== "rejected" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === p.id}
                onClick={() => setRejecting(p)}
              >
                Reject
              </Button>
            )}
            {p.status === "published" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busyId === p.id}
                onClick={() => runSingle(() => unpublishPost(p.id), p.id)}
              >
                Unpublish
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={busyId === p.id}
              onClick={() => runSingle(() => removeAdminPost(p.id), p.id)}
            >
              Delete
            </Button>
          </div>
        )}
      />

      <AlertDialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject &quot;{rejecting?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>The shop owner is notified with this reason.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this post being rejected?"
            rows={3}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!reason.trim()} onClick={confirmReject}>
              Reject
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkRejecting !== null} onOpenChange={(o) => !o && setBulkRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {bulkRejecting?.ids.length} posts?</AlertDialogTitle>
            <AlertDialogDescription>
              The same reason is sent to every owner in this batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="Why are these posts being rejected?"
            rows={3}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!bulkReason.trim()} onClick={confirmBulkReject}>
              Reject all
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
