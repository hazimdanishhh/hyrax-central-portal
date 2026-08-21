import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrdersForInvoice } from "../api/salesOrdersService";

// Backs the Invoice Sidebar's "MATCHED SALES ORDER(S)" block -- reverse of
// useInvoicesForSalesOrder.js. See fetchSalesOrdersForInvoice's own comment
// for the base_entry/base_type document-trail logic (not the free-typed PO
// number useSalesOrderByPoNumber.js uses for the Lead<->Order match).
export function useSalesOrdersForInvoice(invoiceDocEntry) {
  return useQuery({
    queryKey: ["sales_orders_for_invoice", invoiceDocEntry],
    queryFn: () => fetchSalesOrdersForInvoice(invoiceDocEntry),
    enabled: !!invoiceDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
