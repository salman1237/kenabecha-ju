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

export type WsEvent = WsMessageEvent | WsNotificationEvent | WsTypingEvent | WsReadEvent;

type Listener = (event: WsEvent) => void;

const MAX_RECONNECT_DELAY_MS = 15000;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempts = 0;
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
        const data = JSON.parse(event.data) as WsEvent;
        this.listeners.forEach((listener) => listener(data));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!this.shouldReconnect) return;
      const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
      this.reconnectAttempts += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
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
