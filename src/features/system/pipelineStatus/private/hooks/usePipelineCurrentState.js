import { useQuery } from "@tanstack/react-query";
import { fetchPipelineCurrentState } from "../api/pipelineStatusService";

// No Supabase Realtime wired up anywhere in this app -- a short
// refetchInterval is the practical way to keep a "status" page live-ish.
export function usePipelineCurrentState() {
  const query = useQuery({
    queryKey: ["pipelineCurrentState"],
    queryFn: fetchPipelineCurrentState,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  return {
    ...query,
    pipelines: query.data || [],
  };
}
