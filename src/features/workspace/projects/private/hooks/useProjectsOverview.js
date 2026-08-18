import { useQuery } from "@tanstack/react-query";
import { fetchProjectsOverview } from "../api/projectsService";

const EMPTY_KPIS = { totalCount: 0, activeCount: 0, planningCount: 0, onHoldCount: 0 };

/**
 * Backs the Projects list page's OverviewCards -- same shape as
 * usePipelineStats/useProfilesOverview, a small independent query from the
 * paginated list above so a slow overview fetch never blocks the list.
 */
export function useProjectsOverview() {
  const query = useQuery({
    queryKey: ["projects", "overview"],
    queryFn: fetchProjectsOverview,
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
