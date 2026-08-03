"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  getConversation,
  getMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import { cn, formatPrice, mediaUrl } from "@/lib/utils";
import { wsClient } from "@/lib/ws/client";
import type { Conversation, Message } from "@/types/api";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  sold: "Sold",
  out_of_stock: "Out of stock",
  removed: "Removed",
};

function Avatar({
  url,
  label,
  className,
}: {
  url: string | null;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className
      )}
      title={label}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(url)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        label.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function ProductCard({ conversation }: { conversation: Conversation }) {
  const { listing } = conversation;
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[10px] text-muted-foreground">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(listing.image_url)} alt="" className="h-full w-full object-cover" />
        ) : (
          "No photo"
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{listing.title}</p>
        <p className="text-sm text-muted-foreground">{formatPrice(listing.price, listing.price_type, listing.unit)}</p>
      </div>
      {listing.status !== "active" && (
        <Badge variant="secondary" className="shrink-0">
          {STATUS_LABELS[listing.status]}
        </Badge>
      )}
    </Link>
  );
}

export default function ChatWindowPage() {
  const params = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    getConversation(params.conversationId).then(setConversation).catch(() => setError("Conversation not found."));
    getMessages(params.conversationId).then(setMessages);
    markConversationRead(params.conversationId).catch(() => {});
  }, [params.conversationId, user]);

  useEffect(() => {
    return wsClient.on((event) => {
      if (event.type !== "message" || event.conversation_id !== params.conversationId) return;
      setMessages((prev) => [...prev, event.message]);
      markConversationRead(params.conversationId).catch(() => {});
    });
  }, [params.conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      const message = await sendMessage(params.conversationId, trimmed);
      setMessages((prev) => [...prev, message]);
      setContent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  if (error) return <p className="mx-auto max-w-2xl px-6 py-12 text-sm text-destructive">{error}</p>;
  if (!conversation || !user) {
    return (
      <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-2xl flex-col gap-3 px-4 py-6 sm:px-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="flex-1 w-full" />
      </div>
    );
  }

  const headerName = conversation.is_seller
    ? conversation.counterparty.full_name
    : conversation.shop?.shop_name ?? conversation.counterparty.full_name;

  // The seller side of a shop listing is represented by the shop's own logo,
  // not the owner's personal avatar; the buyer side is always personal.
  const myAvatar =
    conversation.is_seller && conversation.shop
      ? { url: conversation.shop.logo_url, label: conversation.shop.shop_name }
      : { url: user.avatar_url, label: user.full_name };
  const counterpartyAvatar =
    !conversation.is_seller && conversation.shop
      ? { url: conversation.shop.logo_url, label: conversation.shop.shop_name }
      : { url: conversation.counterparty.avatar_url, label: conversation.counterparty.full_name };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-2xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between border-b border-border pb-3 sm:pb-4">
        <div className="flex items-center gap-2">
          <Link href="/inbox" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted sm:hidden">
            <ArrowLeft className="size-4" />
          </Link>
          <Avatar url={counterpartyAvatar.url} label={counterpartyAvatar.label} className="h-9 w-9 text-sm" />
          <div>
            <p className="font-medium">{headerName}</p>
            <Link href={`/listings/${conversation.listing.id}`} className="text-xs text-muted-foreground hover:underline">
              {conversation.listing.title}
            </Link>
          </div>
        </div>
        <Link href="/inbox" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
          ← Inbox
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
        <ProductCard conversation={conversation} />
        {messages.map((m) => {
          const isMine = m.sender_id === user.id;
          const avatar = isMine ? myAvatar : counterpartyAvatar;
          return (
            <div key={m.id} className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
              {!isMine && <Avatar url={avatar.url} label={avatar.label} className="h-7 w-7 text-[11px]" />}
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}
              >
                {m.content}
              </div>
              {isMine && <Avatar url={avatar.url} label={avatar.label} className="h-7 w-7 text-[11px]" />}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 border-t border-border pt-4">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Type a message…"
          className="h-10 flex-1"
        />
        <Button onClick={onSend} disabled={sending || !content.trim()} className="h-10">
          Send
        </Button>
      </div>
    </div>
  );
}
