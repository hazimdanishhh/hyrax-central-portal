import { useQuery } from "@tanstack/react-query";
import { fetchVendorPaymentsForBill } from "../api/vendorPaymentsService";

// Backs the Bill Sidebar's "MATCHED VENDOR PAYMENT(S)" block -- reverse of
// fetchVendorPaymentApplications.js's per-vendor-payment bill enrichment. AP
// mirror of usePaymentsForInvoice.js.
// `enabled` (default true -- existing callers unaffected) lets a
// collapsible section defer this fetch until the user actually expands it
// (BillSidebar.jsx), same pattern as useSalesOrderLines.js.
export function useVendorPaymentsForBill(billDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["vendor_payments_for_bill", billDocEntry],
    queryFn: () => fetchVendorPaymentsForBill(billDocEntry),
    enabled: !!billDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
