import { useQuery } from "@tanstack/react-query";
import { useProfile } from "../../../../context/ProfileContext";
import { fetchUnreadNotificationCount } from "../api/notificationsService";

// Kept fresh by the Realtime subscription in AppLayout.jsx
// (useNotificationsRealtime), which invalidates the "notifications" query
// prefix on every push -- no periodic timer here. refetchOnWindowFocus is
// a local override of this app's global `false` default (src/lib/reactQuery.js)
// since this query is cheap and focus is a reasonable "did I miss anything
// while away" trigger alongside the Realtime connection's own reconnect hook.
export function useUnreadNotificationCount() {
  const { profile } = useProfile();
  const userId = profile?.id;

  const query = useQuery({
    queryKey: ["notifications", "unreadCount", userId],
    queryFn: () => fetchUnreadNotificationCount(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    unreadCount: query.data || 0,
  };
}
