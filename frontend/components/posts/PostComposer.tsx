"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { ListingPicker } from "@/components/posts/ListingPicker";
import { PostEditor } from "@/components/posts/PostEditor";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/input";
import { translateApiError } from "@/lib/i18n/errors";
import { useLanguage } from "@/context/LanguageContext";
import {
  createPost,
  deletePostImage,
  updatePost,
  uploadPostImage,
  type PostPayload,
} from "@/lib/api/posts";
import { getMyShops } from "@/lib/api/shops";
import type { Post, Shop } from "@/types/api";

const MAX_IMAGES = 6;
const TITLE_MIN = 3;
const TITLE_MAX = 200;

export function PostComposer({
  mode,
  post,
  defaultShopId,
  onSuccess,
}: {
  mode: "create" | "edit";
  post?: Post;
  defaultShopId?: string;
  onSuccess: (post: Post) => void;
}) {
  const { t } = useLanguage();
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState(post?.shop.id ?? defaultShopId ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [html, setHtml] = useState(post?.description_html ?? "");
  const [listingIds, setListingIds] = useState<string[]>(post?.listings.map((l) => l.id) ?? []);
  const [images, setImages] = useState(post?.images ?? []);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    if (mode === "create") {
      getMyShops()
        .then(setShops)
        .catch(() => {});
    }
  }, [mode]);

  useEffect(() => {
    const urls = newPhotos.map((f) => URL.createObjectURL(f));
    setNewPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newPhotos]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    setNewPhotos((prev) => [...prev, ...picked].slice(0, MAX_IMAGES - images.length));
  };

  const removeNewPhoto = (index: number) =>
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));

  const removeExistingImage = async (imageId: string) => {
    if (!post) return;
    await deletePostImage(post.id, imageId).catch(() => {});
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const textLength = title.trim().length;
  const hasContent = html.replace(/<[^>]*>/g, "").trim().length > 0;
  const canSubmit =
    (mode === "create" ? Boolean(shopId) : true) &&
    textLength >= TITLE_MIN &&
    textLength <= TITLE_MAX &&
    hasContent;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      let result: Post;
      if (mode === "create") {
        const payload: PostPayload = { shop_id: shopId, title: title.trim(), description_html: html, listing_ids: listingIds };
        result = await createPost(payload);
        if (newPhotos.length > 0) {
          setUploadingImages(true);
          for (const photo of newPhotos) {
            await uploadPostImage(result.id, photo).catch(() => {
              setError((prev) => prev ?? "Post created, but one or more photos failed to upload.");
            });
          }
          setUploadingImages(false);
        }
      } else {
        result = await updatePost(post!.id, {
          title: title.trim(),
          description_html: html,
          listing_ids: listingIds,
        });
        if (newPhotos.length > 0) {
          setUploadingImages(true);
          for (const photo of newPhotos) {
            await uploadPostImage(result.id, photo).catch(() => {
              setError((prev) => prev ?? "Saved, but one or more photos failed to upload.");
            });
          }
          setUploadingImages(false);
          setNewPhotos([]);
        }
      }
      onSuccess(result);
    } catch (err) {
      setError(translateApiError(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const existingImages = mode === "edit" ? images : [];

  return (
    <div className="flex flex-col gap-5">
      {mode === "create" && (
        <FormSection title="Which shop is this for?" description="A post always belongs to one of your shops.">
          <select
            className={selectClass}
            value={shopId}
            onChange={(e) => {
              setShopId(e.target.value);
              setListingIds([]);
            }}
          >
            <option value="" disabled>
              Select a shop
            </option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name}
              </option>
            ))}
          </select>
        </FormSection>
      )}

      <FormSection title="Title" description="Short and specific — this is what shows up in the feed.">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Fresh stock just arrived!"
          maxLength={TITLE_MAX}
        />
        <p className="text-xs text-muted-foreground">
          {textLength}/{TITLE_MAX}
        </p>
      </FormSection>

      <FormSection title="Description" description="Select text to change its style, font, or colour.">
        <PostEditor value={html} onChange={setHtml} />
      </FormSection>

      <FormSection
        title="Link your products"
        description="Buyers can jump straight from this post to any linked listing. Link the same listing as often as you like."
      >
        <ListingPicker shopId={shopId || undefined} value={listingIds} onChange={setListingIds} />
      </FormSection>

      <FormSection title="Photos" description={`Up to ${MAX_IMAGES} images.`}>
        {(existingImages.length > 0 || newPhotoPreviews.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {existingImages.map((img) => (
              <div key={img.id} className="group relative size-20 overflow-hidden rounded-xl border border-border/70 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(img.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label="Remove photo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {newPhotoPreviews.map((url, i) => (
              <div key={url} className="group relative size-20 overflow-hidden rounded-xl border border-border/70 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewPhoto(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label="Remove photo"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={existingImages.length + newPhotos.length >= MAX_IMAGES}
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </FormSection>

      {mode === "edit" && (post?.status === "published" || post?.status === "rejected") && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          Saving changes resubmits this post for moderation — it won&apos;t be visible in the feed until it&apos;s approved again.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-border/60 bg-background/90 px-1 py-3 backdrop-blur-sm">
        <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
          {uploadingImages
            ? "Uploading photos…"
            : submitting
              ? t.common.saving
              : mode === "create"
                ? "Submit for review"
                : t.common.save}
        </Button>
      </div>
    </div>
  );
}
