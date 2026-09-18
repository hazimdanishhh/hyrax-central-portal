import { useQuery } from "@tanstack/react-query";
import { fetchVendorPayments } from "../api/vendorPaymentsService";

// Backs the Business Partner Sidebar's "Vendor Payments" preview -- AP
// mirror of usePaymentsForCustomer.js, reusing fetchVendorPayments' existing
// vendorCode filter at a small page size.
export function useVendorPaymentsForVendor(vendorCode, enabled = true) {
  return useQuery({
    queryKey: ["vendor_payments_for_vendor", vendorCode],
    queryFn: () =>
      fetchVendorPayments({
        page: 1,
        pageSize: 5,
        search: "",
        filters: { vendorCode },
        sortBy: "payment_date",
        sortOrder: "descending",
      }),
    enabled: !!vendorCode && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
