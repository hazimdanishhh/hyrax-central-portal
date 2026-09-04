import { useQuery } from "@tanstack/react-query";
import { fetchBillsOverview } from "../api/billsService";

const EMPTY_KPIS = {
  outstandingCount: 0,
  outstandingValue: 0,
  dueSoonCount: 0,
  dueSoonValue: 0,
  overdueCount: 0,
  overdueValue: 0,
};

/**
 * Backs the Bills list page's OverviewCards -- independent of the paginated
 * list's search/filter/pagination state, same reasoning as
 * useProjectsOverview.
 */
export function useBillsOverview() {
  const query = useQuery({
    queryKey: ["bills", "overview"],
    queryFn: fetchBillsOverview,
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
