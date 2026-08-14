import { useQuery } from "@tanstack/react-query";
import { useProfile } from "../../../../context/ProfileContext";
import { fetchUnreadNotificationCount } from "../api/notificationsService";

// No Supabase Realtime wired up anywhere in this app -- a short
// refetchInterval is the practical way to keep the bell badge live-ish.
export function useUnreadNotificationCount() {
  const { profile } = useProfile();
  const userId = profile?.id;

  const query = useQuery({
    queryKey: ["notifications", "unreadCount", userId],
    queryFn: () => fetchUnreadNotificationCount(userId),
    enabled: !!userId,
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 30,
  });

  return {
    ...query,
    unreadCount: query.data || 0,
  };
}
