import { useQuery } from "@tanstack/react-query";
import { fetchInvoicesForSalesOrder } from "../api/invoicesService";

// Backs the Sales Order Sidebar's "MATCHED INVOICE(S)" block -- reverse of
// useSalesOrdersForInvoice.js. See fetchInvoicesForSalesOrder's own comment
// for the base_entry/base_type document-trail logic.
// `enabled` (added 2026-09, default true -- existing callers unaffected)
// lets a collapsible section defer this fetch until the user actually
// expands it (FulfillmentOrderSidebar.jsx, the Fulfillment Tracker page's
// own detail sidebar).
export function useInvoicesForSalesOrder(soDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["invoices_for_sales_order", soDocEntry],
    queryFn: () => fetchInvoicesForSalesOrder(soDocEntry),
    enabled: !!soDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
