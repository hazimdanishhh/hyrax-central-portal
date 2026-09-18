import { useQuery } from "@tanstack/react-query";
import { fetchPaymentApplications } from "../api/fetchPaymentApplications";

// `enabled` (default true -- existing callers unaffected) lets a
// collapsible section defer this fetch until the user actually expands it
// (PaymentSidebar.jsx), same pattern as useSalesOrderLines.js.
export function usePaymentApplications(paymentDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["payment_applications", paymentDocEntry],
    queryFn: () => fetchPaymentApplications(paymentDocEntry),
    enabled: !!paymentDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
