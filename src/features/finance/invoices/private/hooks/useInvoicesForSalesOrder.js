import { useQuery } from "@tanstack/react-query";
import { fetchInvoicesForSalesOrder } from "../api/invoicesService";

// Backs the Sales Order Sidebar's "MATCHED INVOICE(S)" block -- reverse of
// useSalesOrdersForInvoice.js. See fetchInvoicesForSalesOrder's own comment
// for the base_entry/base_type document-trail logic.
export function useInvoicesForSalesOrder(soDocEntry) {
  return useQuery({
    queryKey: ["invoices_for_sales_order", soDocEntry],
    queryFn: () => fetchInvoicesForSalesOrder(soDocEntry),
    enabled: !!soDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
