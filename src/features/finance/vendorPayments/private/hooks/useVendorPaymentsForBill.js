import { useQuery } from "@tanstack/react-query";
import { fetchVendorPaymentsForBill } from "../api/vendorPaymentsService";

// Backs the Bill Sidebar's "MATCHED VENDOR PAYMENT(S)" block -- reverse of
// fetchVendorPaymentApplications.js's per-vendor-payment bill enrichment. AP
// mirror of usePaymentsForInvoice.js.
export function useVendorPaymentsForBill(billDocEntry) {
  return useQuery({
    queryKey: ["vendor_payments_for_bill", billDocEntry],
    queryFn: () => fetchVendorPaymentsForBill(billDocEntry),
    enabled: !!billDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
