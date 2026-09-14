import { useQuery } from "@tanstack/react-query";
import { fetchProfileById } from "../api/profiles";

export function useProfileById(userId) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfileById(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
