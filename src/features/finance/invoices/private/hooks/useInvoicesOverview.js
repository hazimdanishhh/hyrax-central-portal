import { useQuery } from "@tanstack/react-query";
import { fetchInvoicesOverview } from "../api/invoicesService";

const EMPTY_KPIS = {
  outstandingCount: 0,
  outstandingValue: 0,
  dueSoonCount: 0,
  dueSoonValue: 0,
  overdueCount: 0,
  overdueValue: 0,
};

/**
 * Backs the Invoices list page's OverviewCards -- independent of the
 * paginated list's search/filter/pagination state, same reasoning as
 * useProjectsOverview.
 */
export function useInvoicesOverview() {
  const query = useQuery({
    queryKey: ["invoices", "overview"],
    queryFn: fetchInvoicesOverview,
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
