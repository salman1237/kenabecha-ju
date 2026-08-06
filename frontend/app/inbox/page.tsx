"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { getConversations } from "@/lib/api/chat";
import { SmartImage } from "@/components/ui/SmartImage";
import { wsClient } from "@/lib/ws/client";
import type { Conversation } from "@/types/api";

export default function InboxPage() {
  const { t, fmt } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(() => {
    getConversations()
      .then(setConversations)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    return wsClient.on(() => load());
  }, [load]);

  const shopTabs = useMemo(() => {
    const shops = new Map<string, string>();
    for (const c of conversations) {
      if (c.is_seller && c.shop) shops.set(c.shop.id, c.shop.shop_name);
    }
    return Array.from(shops.entries());
  }, [conversations]);

  const filtered = useMemo(() => {
    if (filter === "all") return conversations;
    if (filter === "personal") return conversations.filter((c) => !c.shop);
    return conversations.filter((c) => c.shop?.id === filter);
  }, [conversations, filter]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        <a href="/login?next=/inbox" className="font-medium text-foreground">
          Log in
        </a>{" "}
        to view your inbox.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.inbox.title}</h1>

      {shopTabs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["all", "personal", ...shopTabs.map(([id]) => id)].map((key) => {
            const label =
              key === "all"
                ? t.inbox.all
                : key === "personal"
                  ? t.inbox.personal
                  : shopTabs.find(([id]) => id === key)?.[1];
            return (
              <button type="button" key={key} onClick={() => setFilter(key)}>
                <Badge variant={filter === key ? "default" : "outline"} className="cursor-pointer">
                  {label}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4 py-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.inbox.noConversations}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {filtered.map((c) => {
            const displayName = c.is_seller ? c.counterparty.full_name : c.shop?.shop_name ?? c.counterparty.full_name;
            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="size-11 shrink-0 overflow-hidden rounded-md">
                  <SmartImage src={c.listing.image_url} alt="" sizes="44px" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{displayName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {c.shop ? c.shop.shop_name : t.inbox.personal}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.listing.title}</p>
                  {c.last_message_preview && (
                    <p className="truncate text-sm text-muted-foreground">{c.last_message_preview}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground/70">{c.last_message_at ? fmt.relativeTime(c.last_message_at) : ""}</span>
                  {c.unread_count > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
