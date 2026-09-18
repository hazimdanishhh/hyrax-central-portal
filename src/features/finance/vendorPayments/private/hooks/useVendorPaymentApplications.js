import { useQuery } from "@tanstack/react-query";
import { fetchVendorPaymentApplications } from "../api/fetchVendorPaymentApplications";

// `enabled` (default true -- existing callers unaffected) lets a
// collapsible section defer this fetch until the user actually expands it
// (VendorPaymentSidebar.jsx), same pattern as useSalesOrderLines.js.
export function useVendorPaymentApplications(vendorPaymentDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["vendor_payment_applications", vendorPaymentDocEntry],
    queryFn: () => fetchVendorPaymentApplications(vendorPaymentDocEntry),
    enabled: !!vendorPaymentDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
