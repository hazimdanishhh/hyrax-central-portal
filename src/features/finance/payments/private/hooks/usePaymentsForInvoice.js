import { useQuery } from "@tanstack/react-query";
import { fetchPaymentsForInvoice } from "../api/paymentsService";

// Backs the Invoice Sidebar's "MATCHED PAYMENT(S)" block -- reverse of
// fetchPaymentApplications.js's per-payment invoice enrichment. See
// fetchPaymentsForInvoice's own comment for the confirmed FK it walks.
export function usePaymentsForInvoice(invoiceDocEntry) {
  return useQuery({
    queryKey: ["payments_for_invoice", invoiceDocEntry],
    queryFn: () => fetchPaymentsForInvoice(invoiceDocEntry),
    enabled: !!invoiceDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
