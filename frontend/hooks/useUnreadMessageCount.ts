import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { getConversations } from "@/lib/api/chat";
import { wsClient } from "@/lib/ws/client";

/**
 * Total unread messages across every conversation, for the Inbox nav badge
 * (mirrors NotificationBell's own load-then-refetch-on-any-ws-event shape,
 * same as the Inbox page itself already does for its per-row counts).
 */
export function useUnreadMessageCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    const load = () => {
      getConversations()
        .then((conversations) => setCount(conversations.reduce((sum, c) => sum + c.unread_count, 0)))
        .catch(() => {});
    };
    load();
    return wsClient.on(load);
  }, [user]);

  return count;
}
