"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useLanguage } from "@/context/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notifications";
import { wsClient } from "@/lib/ws/client";
import type { Notification } from "@/types/api";

export function NotificationBell() {
  const { t, fmt } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    getNotifications().then((data) => {
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    });
  };

  useEffect(load, []);

  useEffect(() => {
    return wsClient.on((event) => {
      if (event.type !== "notification") return;
      setNotifications((prev) => [event.notification, ...prev].slice(0, 30));
      setUnreadCount((prev) => prev + 1);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const onNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
  };

  const onMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead().catch(() => {});
  };

  return (
    <div ref={containerRef} className="relative">
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen((v) => !v)} aria-label={t.nav.notifications}>
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="text-xs text-muted-foreground hover:text-foreground">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`flex flex-col gap-0.5 px-3 py-2 text-sm hover:bg-muted ${!n.is_read ? "bg-muted/50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={!n.is_read ? "font-medium" : ""}>{n.title}</span>
                      {!n.is_read && <Badge className="h-1.5 w-1.5 shrink-0 rounded-full p-0" />}
                    </div>
                    {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                    <span className="text-[10px] text-muted-foreground/70">{fmt.relativeTime(n.created_at)}</span>
                  </div>
                );
                return n.link_url ? (
                  <Link key={n.id} href={n.link_url} onClick={() => onNotificationClick(n)}>
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => onNotificationClick(n)} className="block w-full text-left">
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
