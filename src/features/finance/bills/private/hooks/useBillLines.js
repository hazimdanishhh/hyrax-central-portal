import { useQuery } from "@tanstack/react-query";
import { fetchBillLines } from "../api/fetchBillLines";

export function useBillLines(billDocEntry) {
  return useQuery({
    queryKey: ["bill_lines", billDocEntry],
    queryFn: () => fetchBillLines(billDocEntry),
    enabled: !!billDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
