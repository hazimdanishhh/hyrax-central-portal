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
 * Backs the Vendor Payments list page's OverviewCards -- independent of the
 * paginated list's search/filter/pagination state, same reasoning as
 * useProjectsOverview.
 */
export function useVendorPaymentsOverview() {
  const query = useQuery({
    queryKey: ["vendor_payments", "overview"],
    queryFn: fetchVendorPaymentsOverview,
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
