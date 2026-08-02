"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { CompleteProfilePrompt } from "@/components/auth/CompleteProfilePrompt";
import { FormField, inputClass } from "@/components/ui/FormField";
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
    if (!confirm("Delete this shop? Its listings will remain but lose their shop association.")) return;
    await deleteShop(shopId);
    load();
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-center text-sm text-zinc-500">
        <a href="/login?next=/shops/dashboard" className="font-medium text-zinc-900 dark:text-zinc-100">
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My Shops</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {showForm ? "Cancel" : "New shop"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <FormField label="Shop name" htmlFor="shop_name" error={errors.shop_name?.message}>
            <input id="shop_name" className={inputClass} {...register("shop_name")} />
          </FormField>
          <FormField label="Category" htmlFor="shop_type" hint="e.g. Food, Jewelry, Electronics">
            <input id="shop_type" className={inputClass} {...register("shop_type")} />
          </FormField>
          <FormField label="Description" htmlFor="description">
            <textarea id="description" rows={3} className={inputClass} {...register("description")} />
          </FormField>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isSubmitting ? "Creating…" : "Create shop"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : shops.length === 0 ? (
        <p className="text-sm text-zinc-500">You don&apos;t have any shops yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shops.map((shop) => (
            <div
              key={shop.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                <Link href={`/shops/${shop.slug}`} className="font-medium hover:underline">
                  {shop.shop_name}
                </Link>
                <p className="text-sm text-zinc-500">
                  {shop.shop_type ?? "Uncategorized"} · {shop.listing_count} active listing
                  {shop.listing_count === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/listings/new?shop_id=${shop.id}`}
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Add listing
                </Link>
                <button
                  onClick={() => onDelete(shop.id)}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
