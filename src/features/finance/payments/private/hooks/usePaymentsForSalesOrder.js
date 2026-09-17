import { useQuery } from "@tanstack/react-query";
import { fetchPaymentsForSalesOrder } from "../api/paymentsService";

// Backs the Sales Order Sidebar's "MATCHED PAYMENT(S)" block -- see
// fetchPaymentsForSalesOrder's own comment for the SO -> invoice -> payment
// transitive join it walks.
// `enabled` (added 2026-09, default true -- existing callers unaffected)
// lets a collapsible section defer this fetch until the user actually
// expands it (FulfillmentOrderSidebar.jsx, the Fulfillment Tracker page's
// own detail sidebar).
export function usePaymentsForSalesOrder(soDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["payments_for_sales_order", soDocEntry],
    queryFn: () => fetchPaymentsForSalesOrder(soDocEntry),
    enabled: !!soDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
