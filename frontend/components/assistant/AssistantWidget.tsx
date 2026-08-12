"use client";

import { AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AssistantFab } from "@/components/assistant/AssistantFab";
import { AssistantPanel, type AssistantMessage } from "@/components/assistant/AssistantPanel";
import { useLanguage } from "@/context/LanguageContext";
import { streamAssistantChat } from "@/lib/api/assistant";

const STORAGE_KEY = "assistant:messages";
// A soft, client-side backstop against one runaway tab — the server rate
// limit (20/hour/IP) is the real one. Disables the composer with an inline
// notice rather than silently dropping the oldest messages.
const MAX_MESSAGES = 40;
// Only the last 10 turns are ever sent to the model, matching this app's
// session-only, not-account-tied history design.
const HISTORY_TURNS = 10;

function greeting(text: string): AssistantMessage {
  return { id: "greeting", role: "assistant", content: text, synthetic: true };
}

export function AssistantWidget() {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as AssistantMessage[]) : null;
      setMessages(parsed && parsed.length > 0 ? parsed : [greeting(t.assistant.greeting)]);
    } catch {
      setMessages([greeting(t.assistant.greeting)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // sessionStorage unavailable (private mode, quota) — the session just
      // won't survive a reload, which is an acceptable degradation here.
    }
  }, [messages]);

  // Customer-facing tool: doesn't belong in the admin dashboard, and would
  // sit on top of the inbox thread's own composer on mobile. Same route
  // exclusion MobileBottomNav already uses, for the same reasons.
  const hidden = pathname.startsWith("/admin") || /^\/inbox\/[^/]+$/.test(pathname);

  const clear = () => {
    setMessages([greeting(t.assistant.greeting)]);
  };

  const send = async (text: string) => {
    const userMessage: AssistantMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantMessage: AssistantMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };

    const history = messages
      .filter((m) => !m.synthetic)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    try {
      for await (const event of streamAssistantChat({ message: text, history, locale })) {
        if (event.type === "delta") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, content: m.content + event.text } : m
            )
          );
        } else if (event.type === "listings") {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessage.id ? { ...m, listings: event.listings } : m))
          );
        } else if (event.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: t.assistant.errorGeneric, error: true }
                : m
            )
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: m.content || t.assistant.errorGeneric,
                error: m.content ? m.error : true,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  if (hidden) return null;

  return (
    <>
      <AssistantFab open={open} onClick={() => setOpen((v) => !v)} />
      <AnimatePresence>
        {open && (
          <AssistantPanel
            messages={messages}
            onSend={send}
            onClear={clear}
            onClose={() => setOpen(false)}
            isStreaming={isStreaming}
            disabled={messages.length >= MAX_MESSAGES}
          />
        )}
      </AnimatePresence>
    </>
  );
}
