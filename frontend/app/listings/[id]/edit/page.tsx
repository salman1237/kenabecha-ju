"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ListingForm } from "@/components/listings/ListingForm";
import { useAuth } from "@/context/AuthContext";
import { getListing } from "@/lib/api/listings";
import type { Listing } from "@/types/api";

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getListing(params.id)
      .then(setListing)
      .catch(() => setError("Listing not found."));
  }, [params.id]);

  if (authLoading || (!listing && !error)) return null;
  if (error) return <p className="mx-auto max-w-lg px-6 py-12 text-sm text-red-600">{error}</p>;
  if (!user || (listing && listing.seller.id !== user.id)) {
    return (
      <p className="mx-auto max-w-lg px-6 py-12 text-center text-sm text-zinc-500">
        You don&apos;t have permission to edit this listing.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Edit listing</h1>
      {listing && (
        <ListingForm
          mode="edit"
          listing={listing}
          onSuccess={(updated) => router.push(`/listings/${updated.id}`)}
        />
      )}
    </div>
  );
}
