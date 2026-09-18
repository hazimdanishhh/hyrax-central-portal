import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrderLines } from "../api/fetchSalesOrderLines";

// `enabled` (added 2026-09, default true -- existing callers unaffected)
// lets a collapsible section defer this fetch until the user actually
// expands it (SalesOrderSidebar.jsx, the Sales Orders page's own detail
// sidebar).
export function useSalesOrderLines(orderDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["sales_order_lines", orderDocEntry],
    queryFn: () => fetchSalesOrderLines(orderDocEntry),
    enabled: !!orderDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
