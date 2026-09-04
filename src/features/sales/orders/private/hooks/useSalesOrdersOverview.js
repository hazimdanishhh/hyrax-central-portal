import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrdersOverview } from "../api/salesOrdersService";

const EMPTY_KPIS = {
  openCount: 0,
  openValue: 0,
  dueSoonCount: 0,
  dueSoonValue: 0,
  overdueCount: 0,
  overdueValue: 0,
};

/**
 * Backs the Sales Orders list page's OverviewCards -- independent of the
 * paginated list's search/filter/pagination state, same reasoning as
 * useProjectsOverview: the KPI strip always reflects the full picture, not
 * whatever ad hoc filter the user later applies to the list below it.
 */
export function useSalesOrdersOverview() {
  const query = useQuery({
    queryKey: ["sales_orders", "overview"],
    queryFn: fetchSalesOrdersOverview,
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
