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
 * Backs the Sales Orders list page's OverviewCards -- mirrors the paginated
 * list's active filters/search (added 2026-09) so the KPI strip always
 * summarizes exactly the filtered slice the table below is showing, the same
 * way the Reports pages' useDashboardQuery already behaves. filters/search
 * are the same values the page already gets from usePaginatedQuery for the
 * table -- no separate filter state.
 */
export function useSalesOrdersOverview(filters, search) {
  const query = useQuery({
    queryKey: ["sales_orders", "overview", filters, search],
    queryFn: () => fetchSalesOrdersOverview({ filters, search }),
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
