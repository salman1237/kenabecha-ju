"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { wsClient } from "@/lib/ws/client";
import type { Conversation, Message } from "@/types/api";

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

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-2xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between border-b border-border pb-3 sm:pb-4">
        <div className="flex items-center gap-2">
          <Link href="/inbox" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted sm:hidden">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <p className="font-medium">{headerName}</p>
            <Link href={`/listings/${conversation.listing_id}`} className="text-xs text-muted-foreground hover:underline">
              {conversation.listing_title}
            </Link>
          </div>
        </div>
        <Link href="/inbox" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">
          ← Inbox
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
        {messages.map((m) => {
          const isMine = m.sender_id === user.id;
          return (
            <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                  isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}
              >
                {m.content}
              </div>
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
