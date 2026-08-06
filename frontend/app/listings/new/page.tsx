"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CompleteProfilePrompt } from "@/components/auth/CompleteProfilePrompt";
import { ListingForm } from "@/components/listings/ListingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

function NewListingForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const shopId = useSearchParams().get("shop_id") ?? undefined;

  if (isLoading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        <a href="/login?next=/listings/new" className="font-medium text-foreground">
          {t.auth.login}
        </a>{" "}
        {t.listingForm.loginToCreate}
      </div>
    );
  }
  if (!user.profile_complete) {
    return <CompleteProfilePrompt next="/listings/new" action="list an item" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-12 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t.listingForm.createTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm mode="create" defaultShopId={shopId} onSuccess={(listing) => router.push(`/listings/${listing.id}`)} />
        </CardContent>
      </Card>
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
