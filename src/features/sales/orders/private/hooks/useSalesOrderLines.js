import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrderLines } from "../api/fetchSalesOrderLines";

export function useSalesOrderLines(orderDocEntry) {
  return useQuery({
    queryKey: ["sales_order_lines", orderDocEntry],
    queryFn: () => fetchSalesOrderLines(orderDocEntry),
    enabled: !!orderDocEntry,
    staleTime: 1000 * 60 * 5,
  });
}
