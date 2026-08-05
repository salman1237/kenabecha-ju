"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, CheckCheck, ImagePlus, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  getConversation,
  getMessages,
  markConversationRead,
  sendAttachment,
  sendMessage,
} from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import { springSoft } from "@/lib/motion";
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

/** Three bouncing dots shown while the other side is composing. */
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2.5"
      aria-label="Typing"
    >
      {[0, 0.15, 0.3].map((delay) => (
        <motion.span
          key={delay}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay, ease: "easeInOut" }}
          className="size-1.5 rounded-full bg-muted-foreground/60"
        />
      ))}
    </motion.div>
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
  const [uploading, setUploading] = useState(false);
  const [counterpartyTyping, setCounterpartyTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingSentAt = useRef(0);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    getConversation(params.conversationId).then(setConversation).catch(() => setError("Conversation not found."));
    getMessages(params.conversationId).then(setMessages);
    markConversationRead(params.conversationId).catch(() => {});
  }, [params.conversationId, user]);

  useEffect(() => {
    return wsClient.on((event) => {
      if (event.conversation_id !== params.conversationId) return;

      if (event.type === "message") {
        setMessages((prev) => [...prev, event.message]);
        // Their message arriving means they stopped typing.
        setCounterpartyTyping(false);
        markConversationRead(params.conversationId).catch(() => {});
      } else if (event.type === "typing") {
        setCounterpartyTyping(event.is_typing);
        // Self-expire: if the sender closes the tab mid-compose we never get
        // the is_typing:false frame, so the dots would hang forever.
        if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
        if (event.is_typing) {
          typingClearTimer.current = setTimeout(() => setCounterpartyTyping(false), 5000);
        }
      } else if (event.type === "read") {
        const ids = new Set(event.message_ids);
        setMessages((prev) =>
          prev.map((m) => (ids.has(m.id) ? { ...m, read_at: new Date().toISOString() } : m))
        );
      }
    });
  }, [params.conversationId]);

  useEffect(() => {
    // Scroll the message list itself rather than calling scrollIntoView on a
    // sentinel — the page is taller than the viewport (navbar + footer), so
    // scrollIntoView would scroll the *window* and push the thread off-screen.
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, counterpartyTyping]);

  // Clean up timers on unmount so a pending "stopped typing" frame doesn't
  // fire against a conversation the user already navigated away from.
  useEffect(() => {
    return () => {
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    };
  }, []);

  const signalTyping = () => {
    const now = Date.now();
    // Throttle to one frame every 2s rather than one per keystroke.
    if (now - typingSentAt.current > 2000) {
      typingSentAt.current = now;
      wsClient.send({ type: "typing", conversation_id: params.conversationId, is_typing: true });
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      typingSentAt.current = 0;
      wsClient.send({ type: "typing", conversation_id: params.conversationId, is_typing: false });
    }, 2500);
  };

  const stopTyping = () => {
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingSentAt.current = 0;
    wsClient.send({ type: "typing", conversation_id: params.conversationId, is_typing: false });
  };

  const onSend = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    stopTyping();
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

  const onAttach = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const message = await sendAttachment(params.conversationId, file, content.trim());
      setMessages((prev) => [...prev, message]);
      setContent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send photo.");
    } finally {
      setUploading(false);
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
    // Sized to the viewport minus the navbar so the thread is fully visible
    // without page scrolling; the footer sits below and is reachable by
    // scrolling past, which is the normal behaviour for every other page.
    <div className="mx-auto flex h-[calc(100vh-5rem)] w-full max-w-2xl flex-col px-4 py-4 sm:px-6 sm:py-6">
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

      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
        <ProductCard conversation={conversation} />
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isMine = m.sender_id === user.id;
            const avatar = isMine ? myAvatar : counterpartyAvatar;
            // An image message with no typed caption uses the placeholder
            // content the server stores; don't render that under the photo.
            const showCaption = !m.image_url || m.content !== "📷 Photo";
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={springSoft}
                className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}
              >
                {!isMine && <Avatar url={avatar.url} label={avatar.label} className="h-7 w-7 text-[11px]" />}
                <div className={cn("flex max-w-[75%] flex-col gap-1", isMine && "items-end")}>
                  <div
                    className={cn(
                      "overflow-hidden rounded-2xl text-sm",
                      m.image_url ? "p-1" : "px-3 py-2",
                      isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    )}
                  >
                    {m.image_url && (
                      <a
                        href={mediaUrl(m.image_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-[240px] overflow-hidden rounded-xl"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mediaUrl(m.image_url)}
                          alt={showCaption ? m.content : "Shared photo"}
                          loading="lazy"
                          className="h-auto w-full object-cover"
                        />
                      </a>
                    )}
                    {showCaption && <p className={cn(m.image_url && "px-2 py-1.5")}>{m.content}</p>}
                  </div>

                  <span className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {/* Read receipt only on your own messages — a tick on
                        theirs would be meaningless to you. */}
                    {isMine &&
                      (m.read_at ? (
                        <CheckCheck className="size-3 text-emerald-500" aria-label="Read" />
                      ) : (
                        <Check className="size-3" aria-label="Sent" />
                      ))}
                  </span>
                </div>
                {isMine && <Avatar url={avatar.url} label={avatar.label} className="h-7 w-7 text-[11px]" />}
              </motion.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {counterpartyTyping && (
            <div className="flex items-end gap-2">
              <Avatar
                url={counterpartyAvatar.url}
                label={counterpartyAvatar.label}
                className="h-7 w-7 text-[11px]"
              />
              <TypingIndicator />
            </div>
          )}
        </AnimatePresence>

      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          aria-label="Attach a photo"
          loading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {!uploading && <ImagePlus />}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttach(file);
            e.target.value = "";
          }}
        />
        <Input
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            signalTyping();
          }}
          onBlur={stopTyping}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Type a message…"
          className="h-10 flex-1"
        />
        <Button
          onClick={onSend}
          disabled={sending || !content.trim()}
          className="h-10 shrink-0"
        >
          <Send />
          <span className="sr-only sm:not-sr-only">Send</span>
        </Button>
      </div>
    </div>
  );
}
