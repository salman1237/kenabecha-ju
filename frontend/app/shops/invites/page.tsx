"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { translateApiError } from "@/lib/i18n/errors";
import { getMyShopInvites, respondToShopInvite } from "@/lib/api/shops";
import type { ShopInvite } from "@/types/api";

export default function ShopInvitesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [invites, setInvites] = useState<ShopInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyShopInvites()
      .then(setInvites)
      .finally(() => setLoading(false));
  }, [user]);

  const onRespond = async (invite: ShopInvite, accept: boolean) => {
    setRespondingId(invite.id);
    try {
      await respondToShopInvite(invite.id, accept);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      toast.success(accept ? t.shops.inviteAccepted : t.shops.inviteDeclined);
    } catch (err) {
      toast.error(translateApiError(err, t));
    } finally {
      setRespondingId(null);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        <a href="/login?next=/shops/invites" className="font-medium text-foreground">
          Log in
        </a>{" "}
        to see your shop invites.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{t.shops.invitesTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.shops.invitesSubtitle}</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">{t.shops.noInvites}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {invites.map((invite) => (
            <Card key={invite.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  <SmartImage
                    src={invite.shop_logo_url}
                    alt=""
                    sizes="48px"
                    fallback={<span className="text-sm font-semibold">{invite.shop_name.charAt(0).toUpperCase()}</span>}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{invite.shop_name}</span>
                    <p className="text-sm text-muted-foreground">
                      {t.shops.invitedByLabel} {invite.invited_by_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={respondingId === invite.id}
                      onClick={() => onRespond(invite, false)}
                    >
                      {t.shops.declineInvite}
                    </Button>
                    <Button size="sm" disabled={respondingId === invite.id} onClick={() => onRespond(invite, true)}>
                      {t.shops.acceptInvite}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
