import { apiFetch } from "@/lib/api/client";
import type { Page, Post, PostImage } from "@/types/api";

export interface PostPayload {
  shop_id: string;
  title: string;
  description_html: string;
  listing_ids: string[];
}

export function createPost(payload: PostPayload) {
  return apiFetch<Post>("/posts", { method: "POST", body: JSON.stringify(payload) });
}

export function getFeed(limit = 24, offset = 0) {
  return apiFetch<Page<Post>>(`/posts/feed?limit=${limit}&offset=${offset}`);
}

/** Published-only for anyone but the owning shop's owner or staff. */
export function getShopPosts(shopId: string) {
  return apiFetch<Post[]>(`/posts/shop/${shopId}`);
}

/** Every status, owner-only. */
export function getMyPosts(shopId: string) {
  return apiFetch<Post[]>(`/posts/mine?shop_id=${shopId}`);
}

export function getPost(id: string) {
  return apiFetch<Post>(`/posts/${id}`);
}

export function updatePost(id: string, payload: Partial<Omit<PostPayload, "shop_id">>) {
  return apiFetch<Post>(`/posts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deletePost(id: string) {
  return apiFetch<void>(`/posts/${id}`, { method: "DELETE" });
}

export function uploadPostImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<PostImage>(`/posts/${id}/images`, { method: "POST", body: formData });
}

export function deletePostImage(id: string, imageId: string) {
  return apiFetch<void>(`/posts/${id}/images/${imageId}`, { method: "DELETE" });
}
