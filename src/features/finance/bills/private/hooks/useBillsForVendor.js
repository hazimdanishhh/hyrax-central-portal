import { useQuery } from "@tanstack/react-query";
import { fetchBills } from "../api/billsService";

// Backs the Business Partner Sidebar's "Open Bills" preview -- AP mirror of
// useInvoicesForCustomer.js, reusing fetchBills' existing vendorCode filter
// at a small page size.
export function useBillsForVendor(vendorCode, enabled = true) {
  return useQuery({
    queryKey: ["bills_for_vendor", vendorCode],
    queryFn: () =>
      fetchBills({
        page: 1,
        pageSize: 5,
        search: "",
        filters: { vendorCode },
        sortBy: "bill_date",
        sortOrder: "descending",
      }),
    enabled: !!vendorCode && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
