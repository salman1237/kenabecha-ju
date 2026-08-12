import type { Locale } from "@/lib/i18n/config";
import type { Listing } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type AssistantTurn = { role: "user" | "assistant"; content: string };

export class AssistantApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type AssistantEvent =
  | { type: "delta"; text: string }
  | { type: "listings"; listings: Listing[] }
  | { type: "error"; message: string }
  | { type: "done" };

/**
 * Streams the assistant's reply as it's generated. Not built on `apiFetch`
 * (`lib/api/client.ts`) — that helper always resolves the whole response as
 * JSON, which doesn't fit a stream. Plain `fetch()` + `ReadableStream`
 * rather than `EventSource`: the request needs a JSON POST body (the
 * message and trimmed history), which `EventSource` (GET-only, no body)
 * can't send.
 */
export async function* streamAssistantChat(
  payload: { message: string; history: AssistantTurn[]; locale: Locale },
  signal?: AbortSignal
): AsyncGenerator<AssistantEvent> {
  const res = await fetch(`${API_URL}/assistant/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // no JSON body
    }
    throw new AssistantApiError(res.status, detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      yield JSON.parse(dataLine.slice("data: ".length)) as AssistantEvent;
    }
  }
}
