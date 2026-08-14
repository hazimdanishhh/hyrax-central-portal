import { useQuery } from "@tanstack/react-query";
import { useProfile } from "../../../../context/ProfileContext";
import { fetchRecentNotifications } from "../api/notificationsService";

export function useRecentNotifications(limit = 4) {
  const { profile } = useProfile();
  const userId = profile?.id;

  const query = useQuery({
    queryKey: ["notifications", "recent", userId, limit],
    queryFn: () => fetchRecentNotifications(userId, limit),
    enabled: !!userId,
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 30,
  });

  return {
    ...query,
    notifications: query.data || [],
  };
}
