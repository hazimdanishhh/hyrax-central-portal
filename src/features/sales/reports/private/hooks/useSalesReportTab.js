import { useQuery } from "@tanstack/react-query";
import { fetchSalesReportTab } from "../api/fetchSalesReportTab";

/**
 * React Query wrapper for one Sales Reports tab. Only the open tab's RPC
 * runs; tabs already visited stay cached (staleTime), so switching back is
 * instant and a failing tab never blanks the others.
 *
 * Keyed on the tab and the three filter values only -- never on the whole
 * URL -- so nothing unrelated in the address can trigger a refetch.
 */
export function useSalesReportTab(tab, filters) {
  const startDate = filters?.startDate || null;
  const endDate = filters?.endDate || null;
  const owner = filters?.owner || null;

  const query = useQuery({
    queryKey: ["salesReportTab", tab, { startDate, endDate, owner }],
    queryFn: () => fetchSalesReportTab(tab, { startDate, endDate, owner }),
    staleTime: 1000 * 60,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  return {
    ...query,
    meta: query.data?.meta ?? null,
    kpis: query.data?.kpis ?? {},
    // The previous period's / salesperson's figures are on screen while the
    // new ones load (placeholderData): TabState shows that as "Updating".
    isUpdating: query.isFetching && query.isPlaceholderData,
  };
}
