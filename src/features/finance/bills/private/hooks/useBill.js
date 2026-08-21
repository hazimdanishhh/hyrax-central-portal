import { useQuery } from "@tanstack/react-query";
import { fetchBillByDocEntry } from "../api/billsService";

// Fetch-by-id fallback for the /app/finance/bills/:docEntry detail route --
// covers a direct/shared URL where the bill isn't already in the in-memory
// paginated list. Mirrors useSalesOrder.js's role for Orders.jsx exactly.
export function useBill(docEntry) {
  return useQuery({
    queryKey: ["bill", docEntry],
    queryFn: () => fetchBillByDocEntry(docEntry),
    enabled: !!docEntry,
    staleTime: 1000 * 60 * 5,
  });
}
