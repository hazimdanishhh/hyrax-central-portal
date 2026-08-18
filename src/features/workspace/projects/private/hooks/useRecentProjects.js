import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "../api/projectsService";

/**
 * Backs the home dashboard's Recent Projects widget -- calls the existing
 * paginated fetchProjects directly with fixed params (newest-created first,
 * page 1) instead of going through usePaginatedQuery, since this widget has
 * no user-driven search/filter/sort of its own.
 */
export function useRecentProjects(limit = 5) {
  const query = useQuery({
    queryKey: ["projects", "recent", limit],
    queryFn: () =>
      fetchProjects({
        page: 1,
        pageSize: limit,
        search: "",
        filters: {},
        sortBy: "created_at",
        sortOrder: "descending",
      }),
    staleTime: 1000 * 60,
  });

  return { ...query, projects: query.data?.data || [] };
}
