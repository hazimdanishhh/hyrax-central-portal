import { useQuery } from "@tanstack/react-query";
import { fetchPipelineStats } from "../api/pipelineStatusService";

export function usePipelineStats(windowDays = 7) {
  const query = useQuery({
    queryKey: ["pipelineStats", windowDays],
    queryFn: () => fetchPipelineStats(windowDays),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  return {
    ...query,
    stats: query.data,
  };
}
