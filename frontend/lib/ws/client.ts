import type { Message, Notification } from "@/types/api";

export interface WsMessageEvent {
  type: "message";
  conversation_id: string;
  message: Message;
}

export interface WsNotificationEvent {
  type: "notification";
  notification: Notification;
}

export interface WsTypingEvent {
  type: "typing";
  conversation_id: string;
  is_typing: boolean;
}

export interface WsReadEvent {
  type: "read";
  conversation_id: string;
  message_ids: string[];
}

/** Server liveness probe. Answered with a `pong`; never surfaced to listeners. */
export interface WsPingEvent {
  type: "ping";
}

export type WsEvent = WsMessageEvent | WsNotificationEvent | WsTypingEvent | WsReadEvent;

type Listener = (event: WsEvent) => void;

const MAX_RECONNECT_DELAY_MS = 15000;
/** Close code the /ws endpoint uses when the access-token cookie is rejected. */
const WS_UNAUTHORIZED = 4401;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempts = 0;
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshing = false;

  connect() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.shouldReconnect = true;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const wsUrl = `${apiUrl.replace(/^http/, "ws")}/ws`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent | WsPingEvent;

        // The server pings every 30s and reaps sockets silent for 90s.
        // Answering keeps us registered; it isn't an app event, so it never
        // reaches listeners.
        if (data.type === "ping") {
          this.send({ type: "pong" });
          return;
        }

        this.listeners.forEach((listener) => listener(data));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = (event) => {
      if (!this.shouldReconnect) return;

      // 4401 = the server rejected our cookie. Access tokens expire after
      // 15 minutes, so this is normal after a laptop sleeps. Reconnecting
      // on a loop would just be rejected forever, so refresh the token
      // once and only then retry.
      if (event.code === WS_UNAUTHORIZED) {
        this.handleUnauthorized();
        return;
      }

      const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
      this.reconnectAttempts += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  /** Refresh the session, then retry once. Gives up if that fails. */
  private async handleUnauthorized() {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        this.reconnectAttempts = 0;
        this.reconnectTimer = setTimeout(() => this.connect(), 500);
      } else {
        // Genuinely signed out — stop. AuthContext calls connect() again
        // on the next successful login.
        this.shouldReconnect = false;
      }
    } catch {
      // Network failure rather than an auth failure: back off and retry so
      // a brief outage doesn't sign the socket out for the whole session.
      const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
      this.reconnectAttempts += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    } finally {
      this.refreshing = false;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Fire-and-forget client→server frame. No-ops unless the socket is open. */
  send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}

export const wsClient = new WsClient();
