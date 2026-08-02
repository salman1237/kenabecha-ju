"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import {
  getConversation,
  getMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
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
      if (event.conversation_id !== params.conversationId) return;
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

  if (error) return <p className="mx-auto max-w-2xl px-6 py-12 text-sm text-red-600">{error}</p>;
  if (!conversation || !user) return null;

  const headerName = conversation.is_seller
    ? conversation.counterparty.full_name
    : conversation.shop?.shop_name ?? conversation.counterparty.full_name;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-2xl flex-col px-6 py-6">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <p className="font-medium">{headerName}</p>
          <Link href={`/listings/${conversation.listing_id}`} className="text-xs text-zinc-500 hover:underline">
            {conversation.listing_title}
          </Link>
        </div>
        <Link
          href="/inbox"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Inbox
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
        {messages.map((m) => {
          const isMine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  isMine
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <input
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Type a message…"
        />
        <button
          onClick={onSend}
          disabled={sending || !content.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </div>
    </div>
  );
}
