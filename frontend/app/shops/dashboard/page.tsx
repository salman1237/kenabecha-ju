"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CompleteProfilePrompt } from "@/components/auth/CompleteProfilePrompt";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { createShop, deleteShop, getMyShops, updateShop, uploadShopCover, uploadShopLogo } from "@/lib/api/shops";
import { ApiError } from "@/lib/api/client";
import { mediaUrl } from "@/lib/utils";
import { type ShopFormValues, shopSchema } from "@/lib/validation/shop";
import type { Shop } from "@/types/api";

function ShopLogoPicker({ shop, onUpdated }: { shop: Shop; onUpdated: (shop: Shop) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onSelect = async (file: File) => {
    setUploading(true);
    try {
      const updated = await uploadShopLogo(shop.id, file);
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload logo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground"
      title="Change logo"
    >
      {shop.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(shop.logo_url)} alt="" className="h-full w-full object-cover" />
      ) : (
        shop.shop_name.charAt(0).toUpperCase()
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        {uploading ? "…" : "Change"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function ShopCoverPicker({ shop, onUpdated }: { shop: Shop; onUpdated: (shop: Shop) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onSelect = async (file: File) => {
    setUploading(true);
    try {
      const updated = await uploadShopCover(shop.id, file);
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload cover image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-md bg-muted text-xs font-medium text-muted-foreground"
    >
      {shop.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(shop.cover_url)} alt="" className="h-full w-full object-cover" />
      ) : (
        "No cover image"
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        {uploading ? "Uploading…" : "Change cover"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function ShopEditForm({
  shop,
  onUpdated,
  onSaved,
  onCancel,
}: {
  shop: Shop;
  onUpdated: (shop: Shop) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      shop_name: shop.shop_name,
      shop_type: shop.shop_type ?? "",
      description: shop.description ?? "",
    },
  });

  const onSubmit = async (values: ShopFormValues) => {
    setServerError(null);
    try {
      const updated = await updateShop(shop.id, {
        shop_name: values.shop_name,
        description: values.description || undefined,
        shop_type: values.shop_type || undefined,
      });
      onUpdated(updated);
      onSaved();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not update shop.");
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <ShopCoverPicker shop={shop} onUpdated={onUpdated} />
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`shop_name_${shop.id}`}>Shop name</Label>
            <Input id={`shop_name_${shop.id}`} {...register("shop_name")} />
            {errors.shop_name && <p className="text-xs text-destructive">{errors.shop_name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`shop_type_${shop.id}`}>Category</Label>
            <Input id={`shop_type_${shop.id}`} {...register("shop_type")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`description_${shop.id}`}>Description</Label>
            <Textarea id={`description_${shop.id}`} rows={3} {...register("description")} />
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function MyShopsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShopFormValues>({ resolver: zodResolver(shopSchema) });

  const load = () => {
    setLoading(true);
    getMyShops()
      .then(setShops)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    getMyShops()
      .then(setShops)
      .finally(() => setLoading(false));
  }, [user]);

  const onSubmit = async (values: ShopFormValues) => {
    setServerError(null);
    try {
      const shop = await createShop({
        shop_name: values.shop_name,
        description: values.description || undefined,
        shop_type: values.shop_type || undefined,
      });
      if (logoFile) {
        await uploadShopLogo(shop.id, logoFile).catch(() => {
          toast.error("Shop created, but the logo failed to upload — you can add it below.");
        });
      }
      reset();
      setLogoFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not create shop.");
    }
  };

  const onDelete = async (shopId: string) => {
    await deleteShop(shopId);
    load();
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        <a href="/login?next=/shops/dashboard" className="font-medium text-foreground">
          Log in
        </a>{" "}
        to manage your shops.
      </div>
    );
  }

  if (!authLoading && user && !user.profile_complete) {
    return <CompleteProfilePrompt next="/shops/dashboard" action="open a shop" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My Shops</h1>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Cancel" : "New shop"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shop_name">Shop name</Label>
                <Input id="shop_name" {...register("shop_name")} />
                {errors.shop_name && <p className="text-xs text-destructive">{errors.shop_name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shop_type">Category</Label>
                <Input id="shop_type" {...register("shop_type")} />
                <p className="text-xs text-muted-foreground">e.g. Food, Jewelry, Electronics</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} {...register("description")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="logo">Logo (optional)</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" disabled={isSubmitting} className="self-start">
                {isSubmitting ? "Creating…" : "Create shop"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <p className="text-sm text-muted-foreground">You don&apos;t have any shops yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shops.map((shop) =>
            editingShopId === shop.id ? (
              <ShopEditForm
                key={shop.id}
                shop={shop}
                onUpdated={(updated) =>
                  setShops((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
                }
                onSaved={() => setEditingShopId(null)}
                onCancel={() => setEditingShopId(null)}
              />
            ) : (
              <Card key={shop.id}>
                <CardContent className="flex items-center gap-3">
                  <ShopLogoPicker
                    shop={shop}
                    onUpdated={(updated) =>
                      setShops((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
                    }
                  />
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <div>
                      <Link href={`/shops/${shop.slug}`} className="font-medium hover:underline">
                        {shop.shop_name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {shop.shop_type ?? "Uncategorized"} · {shop.listing_count} active listing
                        {shop.listing_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href={`/listings/new?shop_id=${shop.id}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                        Add listing
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setEditingShopId(shop.id)}>
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
                          Delete
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete &quot;{shop.shop_name}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Its listings will remain but lose their shop association.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(shop.id)} variant="destructive">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
