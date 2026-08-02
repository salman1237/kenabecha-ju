"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getConversations } from "@/lib/api/chat";
import { wsClient } from "@/lib/ws/client";
import type { Conversation } from "@/types/api";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function InboxPage() {
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
      <div className="mx-auto max-w-2xl px-6 py-12 text-center text-sm text-zinc-500">
        <a href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
          Log in
        </a>{" "}
        to view your inbox.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>

      {shopTabs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["all", "personal", ...shopTabs.map(([id]) => id)].map((key) => {
            const label = key === "all" ? "All" : key === "personal" ? "Personal" : shopTabs.find(([id]) => id === key)?.[1];
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === key
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No conversations yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {filtered.map((c) => {
            const displayName = c.is_seller ? c.counterparty.full_name : c.shop?.shop_name ?? c.counterparty.full_name;
            return (
              <Link
                key={c.id}
                href={`/inbox/${c.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{displayName}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                      {c.shop ? c.shop.shop_name : "Personal"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-zinc-500">{c.listing_title}</p>
                  {c.last_message_preview && (
                    <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{c.last_message_preview}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-zinc-400">{timeAgo(c.last_message_at)}</span>
                  {c.unread_count > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
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
