"use client";

import { Send, Sparkles, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { ListingCard } from "@/components/listings/ListingCard";
import { useLanguage } from "@/context/LanguageContext";
import { scaleIn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/api";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  listings?: Listing[];
  error?: boolean;
  /** A locally-seeded greeting, never sent to the API as history. */
  synthetic?: boolean;
};

export function AssistantPanel({
  messages,
  onSend,
  onClear,
  onClose,
  isStreaming,
  disabled,
}: {
  messages: AssistantMessage[];
  onSend: (text: string) => void;
  onClear: () => void;
  onClose: () => void;
  isStreaming: boolean;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isStreaming || disabled) return;
    onSend(text);
    setDraft("");
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const isWaitingForFirstToken = isStreaming && lastAssistant?.content === "" && !lastAssistant.error;

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className={cn(
        "fixed right-4 bottom-36 z-[60] flex h-[70vh] max-h-[600px] w-[calc(100vw-2rem)] flex-col overflow-hidden",
        "rounded-2xl border border-emerald-500/15 bg-background/95 shadow-[var(--shadow-soft-lg)] backdrop-blur-md",
        "dark:border-emerald-400/15",
        "md:right-6 md:bottom-24 md:w-96"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-emerald-500/10 px-4 py-3 dark:border-emerald-400/10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t.assistant.title}</p>
            <p className="truncate text-xs text-muted-foreground">{t.assistant.subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            aria-label={t.assistant.clearConversation}
            title={t.assistant.clearConversation}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex flex-col gap-2", message.role === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    message.role === "user"
                      ? "bg-emerald-600 text-white"
                      : message.error
                        ? "bg-destructive/10 text-destructive"
                        : "bg-card/80 text-foreground"
                  )}
                >
                  {message.content}
                </div>
                {message.listings && message.listings.length > 0 && (
                  <div className="flex w-full max-w-[92%] flex-col gap-2">
                    {message.listings.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} variant="list" />
                    ))}
                  </div>
                )}
                {message.listings && message.listings.length === 0 && !message.error && (
                  <p className="max-w-[85%] text-xs text-muted-foreground">{t.assistant.noListingsFound}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {isWaitingForFirstToken && (
            <div className="flex items-center gap-1 self-start rounded-2xl bg-card/80 px-3 py-2">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-emerald-500/10 p-3 dark:border-emerald-400/10">
        {disabled ? (
          <p className="text-center text-xs text-muted-foreground">{t.assistant.capReached}</p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={t.assistant.placeholder}
              disabled={isStreaming}
              className="h-9 flex-1 rounded-full border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={submit}
              disabled={isStreaming || !draft.trim()}
              aria-label={t.assistant.send}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white transition-opacity disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
