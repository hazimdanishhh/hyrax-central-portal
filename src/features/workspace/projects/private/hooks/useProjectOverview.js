import { useQuery } from "@tanstack/react-query";
import { fetchProjectOverview } from "../api/projectsService";

const EMPTY_DATA = {
  kpis: {
    totalTaskCount: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    completedCount: 0,
    completedLateCount: 0,
    progressPercentage: null,
    documentCount: 0,
    memberCount: 0,
    workingMemberCount: 0,
    ccMemberCount: 0,
  },
  taskStatusData: [],
  memberPerformanceData: [],
};

/**
 * Backs the per-project Overview tab -- mirrors useMyTasksOverview.js's
 * exact shape (a small independent query, not folded into useProject's
 * own fetch, so a slow overview round trip never blocks the rest of the
 * project detail page).
 */
export function useProjectOverview(projectId) {
  const query = useQuery({
    queryKey: ["projectOverview", projectId],
    queryFn: () => fetchProjectOverview(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60,
  });

  const data = query.data || EMPTY_DATA;

  return {
    ...query,
    kpis: data.kpis || EMPTY_DATA.kpis,
    taskStatusData: data.taskStatusData || [],
    memberPerformanceData: data.memberPerformanceData || [],
  };
}
