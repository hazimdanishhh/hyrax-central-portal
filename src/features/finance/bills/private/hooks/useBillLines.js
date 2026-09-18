import { useQuery } from "@tanstack/react-query";
import { fetchBillLines } from "../api/fetchBillLines";

// `enabled` (default true -- existing callers unaffected) lets a
// collapsible section defer this fetch until the user actually expands it
// (BillSidebar.jsx), same pattern as useSalesOrderLines.js.
export function useBillLines(billDocEntry, enabled = true) {
  return useQuery({
    queryKey: ["bill_lines", billDocEntry],
    queryFn: () => fetchBillLines(billDocEntry),
    enabled: !!billDocEntry && enabled,
    staleTime: 1000 * 60 * 5,
  });
}
