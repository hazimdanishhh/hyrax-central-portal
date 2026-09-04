import { useQuery } from "@tanstack/react-query";
import { fetchPaymentsForSalesOrder } from "../api/paymentsService";

// Backs the Sales Order Sidebar's "MATCHED PAYMENT(S)" block -- see
// fetchPaymentsForSalesOrder's own comment for the SO -> invoice -> payment
// transitive join it walks.
export function usePaymentsForSalesOrder(soDocEntry) {
  return useQuery({
    queryKey: ["payments_for_sales_order", soDocEntry],
    queryFn: () => fetchPaymentsForSalesOrder(soDocEntry),
    enabled: !!soDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
