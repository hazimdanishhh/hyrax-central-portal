import { useQuery } from "@tanstack/react-query";
import { fetchSalesTargetById } from "../api/salesTargetsService";

export function useSalesTargetById(targetId) {
  return useQuery({
    queryKey: ["salesTarget", targetId],
    queryFn: () => fetchSalesTargetById(targetId),
    enabled: !!targetId && targetId !== "new",
    staleTime: 1000 * 60 * 5,
  });
}
