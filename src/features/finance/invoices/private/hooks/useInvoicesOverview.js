import { useQuery } from "@tanstack/react-query";
import { fetchInvoicesOverview } from "../api/invoicesService";

const EMPTY_KPIS = {
  outstandingCount: 0,
  outstandingValue: 0,
  dueSoonCount: 0,
  dueSoonValue: 0,
  overdueCount: 0,
  overdueValue: 0,
  totalCount: 0,
  totalValue: 0,
};

/**
 * Backs the Invoices list page's OverviewCards -- mirrors the paginated
 * list's active filters/search (added 2026-09) so the KPI strip always
 * summarizes exactly the filtered slice the table below is showing, the same
 * way the Reports pages' useDashboardQuery already behaves. filters/search
 * are the same values the page already gets from usePaginatedQuery for the
 * table -- no separate filter state.
 */
export function useInvoicesOverview(filters, search) {
  const query = useQuery({
    queryKey: ["invoices", "overview", filters, search],
    queryFn: () => fetchInvoicesOverview({ filters, search }),
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
