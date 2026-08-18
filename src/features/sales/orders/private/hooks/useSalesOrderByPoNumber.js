import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrders } from "../api/salesOrdersService";

// sales_leads.po_number (rep-typed at the WON transition) -> exact match
// against sap_sales_orders.customer_ref (SAP NumAtCard, the customer's own
// PO reference). Live lookup only, no persisted bridge -- see
// hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.3 for the larger,
// not-yet-built persisted version of this idea (a trigger/backfill into the
// dormant public.sales_orders table). customer_ref has no uniqueness
// constraint on the SAP side, so this can legitimately resolve to 0, 1, or
// more than 1 row -- callers must handle all three.
export function useSalesOrderByPoNumber(poNumber) {
  return useQuery({
    queryKey: ["sales_orders_by_po_number", poNumber],
    queryFn: () =>
      fetchSalesOrders({
        page: 1,
        pageSize: 5,
        filters: { customerRef: poNumber },
        sortBy: "order_date",
        sortOrder: "descending",
      }),
    enabled: !!poNumber,
    staleTime: 1000 * 60 * 5,
  });
}
