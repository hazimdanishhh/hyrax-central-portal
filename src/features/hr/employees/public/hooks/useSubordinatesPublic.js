import { useQuery } from "@tanstack/react-query";
import { fetchSubordinatesPublicById } from "../api/subordinatesPublic";

/**
 * Hook to fetch subordinates by employee ID
 */
export default function useSubordinatesPublic(employeeId) {
  return useQuery({
    queryKey: ["subordinates_public", employeeId],
    queryFn: () => fetchSubordinatesPublicById(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5,
  });
}
