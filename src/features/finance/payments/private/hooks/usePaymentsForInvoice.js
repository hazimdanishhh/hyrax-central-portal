import { useQuery } from "@tanstack/react-query";
import { fetchPaymentsForInvoice } from "../api/paymentsService";

// Backs the Invoice Sidebar's "MATCHED PAYMENT(S)" block -- reverse of
// fetchPaymentApplications.js's per-payment invoice enrichment. See
// fetchPaymentsForInvoice's own comment for the confirmed FK it walks.
// `enabled` (default true -- existing callers unaffected) lets a
// collapsible section defer this fetch until the user actually expands it
// (InvoiceSidebar.jsx), same pattern as useSalesOrderLines.js.
export function usePaymentsForInvoice(invoiceDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["payments_for_invoice", invoiceDocEntry],
    queryFn: () => fetchPaymentsForInvoice(invoiceDocEntry),
    enabled: !!invoiceDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
