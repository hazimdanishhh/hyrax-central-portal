import { useQuery } from "@tanstack/react-query";
import { fetchFulfillmentOrderByDocEntry } from "../api/fulfillmentOrdersService";

// Fetch-by-id fallback for the /app/sales/fulfillment/:docEntry detail route
// -- covers a direct/shared URL where the order isn't already in the
// in-memory paginated list. Mirrors useSalesOrder.js's role for Orders.jsx.
export function useFulfillmentOrder(docEntry) {
  return useQuery({
    queryKey: ["fulfillment_order", docEntry],
    queryFn: () => fetchFulfillmentOrderByDocEntry(docEntry),
    enabled: !!docEntry,
    staleTime: 1000 * 60 * 5,
  });
}
