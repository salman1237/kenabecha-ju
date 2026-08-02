"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

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
import { createShop, deleteShop, getMyShops } from "@/lib/api/shops";
import { ApiError } from "@/lib/api/client";
import { type ShopFormValues, shopSchema } from "@/lib/validation/shop";
import type { Shop } from "@/types/api";

export default function MyShopsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
    if (user) load();
  }, [user]);

  const onSubmit = async (values: ShopFormValues) => {
    setServerError(null);
    try {
      await createShop({
        shop_name: values.shop_name,
        description: values.description || undefined,
        shop_type: values.shop_type || undefined,
      });
      reset();
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
          {shops.map((shop) => (
            <Card key={shop.id}>
              <CardContent className="flex items-center justify-between">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
