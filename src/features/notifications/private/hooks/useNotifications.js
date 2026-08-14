import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { useProfile } from "../../../../context/ProfileContext";
import { fetchNotifications } from "../api/notificationsService";

export function useNotifications() {
  const { profile } = useProfile();
  const userId = profile?.id;

  return usePaginatedQuery({
    queryKey: "notifications",
    queryFn: fetchNotifications,
    pageSize: 20,
    defaultSortBy: "created_at",
    defaultSortOrder: "descending",
    extraParams: { userId },
    enabled: !!userId,
  });
}
