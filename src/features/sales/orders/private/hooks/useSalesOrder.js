import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrderByDocEntry } from "../api/salesOrdersService";

// Fetch-by-id fallback for the /app/sales/orders/all/:docEntry detail route
// -- covers a direct/shared URL where the order isn't already in the
// in-memory paginated list. Mirrors useLead.js's role for LeadsManagement.jsx
// exactly.
export function useSalesOrder(docEntry) {
  return useQuery({
    queryKey: ["sales_order", docEntry],
    queryFn: () => fetchSalesOrderByDocEntry(docEntry),
    enabled: !!docEntry,
    staleTime: 1000 * 60 * 5,
  });
}
