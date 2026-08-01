"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ListingForm } from "@/components/listings/ListingForm";
import { useAuth } from "@/context/AuthContext";

function NewListingForm() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const shopId = useSearchParams().get("shop_id") ?? undefined;

  if (isLoading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-center text-sm text-zinc-500">
        <a href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
          Log in
        </a>{" "}
        to create a listing.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">New listing</h1>
      <ListingForm mode="create" defaultShopId={shopId} onSuccess={(listing) => router.push(`/listings/${listing.id}`)} />
    </div>
  );
}

export default function NewListingPage() {
  return (
    <Suspense>
      <NewListingForm />
    </Suspense>
  );
}
