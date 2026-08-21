import { useQuery } from "@tanstack/react-query";
import { fetchPaymentByDocEntry } from "../api/paymentsService";

// Fetch-by-id fallback for the /app/finance/payments/:docEntry detail route
// -- covers a direct/shared URL where the payment isn't already in the
// in-memory paginated list. Mirrors useSalesOrder.js's role for Orders.jsx
// exactly.
export function usePayment(docEntry) {
  return useQuery({
    queryKey: ["payment", docEntry],
    queryFn: () => fetchPaymentByDocEntry(docEntry),
    enabled: !!docEntry,
    staleTime: 1000 * 60 * 5,
  });
}
