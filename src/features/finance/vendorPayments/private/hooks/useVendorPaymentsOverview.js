import { useQuery } from "@tanstack/react-query";
import { fetchVendorPaymentsOverview } from "../api/vendorPaymentsService";

const EMPTY_KPIS = {
  unallocatedCount: 0,
  unallocatedValue: 0,
  thisWeekCount: 0,
  thisWeekValue: 0,
  thisMonthCount: 0,
  thisMonthValue: 0,
};

/**
 * Backs the Vendor Payments list page's OverviewCards -- mirrors the
 * paginated list's active filters/search (added 2026-09) so the KPI strip
 * always summarizes exactly the filtered slice the table below is showing,
 * the same way the Reports pages' useDashboardQuery already behaves.
 * filters/search are the same values the page already gets from
 * usePaginatedQuery for the table -- no separate filter state.
 */
export function useVendorPaymentsOverview(filters, search) {
  const query = useQuery({
    queryKey: ["vendor_payments", "overview", filters, search],
    queryFn: () => fetchVendorPaymentsOverview({ filters, search }),
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
