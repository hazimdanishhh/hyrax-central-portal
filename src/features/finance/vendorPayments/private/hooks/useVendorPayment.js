import { useQuery } from "@tanstack/react-query";
import { fetchVendorPaymentByDocEntry } from "../api/vendorPaymentsService";

// Fetch-by-id fallback for the /app/finance/vendor-payments/:docEntry detail
// route -- covers a direct/shared URL where the vendor payment isn't already
// in the in-memory paginated list. Mirrors useSalesOrder.js's role for
// Orders.jsx exactly.
export function useVendorPayment(docEntry) {
  return useQuery({
    queryKey: ["vendor_payment", docEntry],
    queryFn: () => fetchVendorPaymentByDocEntry(docEntry),
    enabled: !!docEntry,
    staleTime: 1000 * 60 * 5,
  });
}
