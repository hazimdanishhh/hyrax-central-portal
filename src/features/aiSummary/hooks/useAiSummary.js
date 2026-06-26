import { useQuery } from "@tanstack/react-query";
import { fetchAiSummary } from "../api/fetchAiSummary";

export function useAiSummary(dashboardType, startDate, endDate) {
  return useQuery({
    // Adding dates to the key ensures it refetches when dates change
    queryKey: ["ai_summary", dashboardType, startDate, endDate],
    queryFn: () => fetchAiSummary(dashboardType, startDate, endDate),
    enabled: !!dashboardType,
    staleTime: 1000 * 60 * 5, // Keep fresh for 5 minutes
  });
}
