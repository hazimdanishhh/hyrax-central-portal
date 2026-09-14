import { useQuery } from "@tanstack/react-query";
import { fetchSalesRepMappingByCode } from "../api/salesRepMappingService";

export function useSalesRepMappingByCode(salesRepCode) {
  return useQuery({
    queryKey: ["salesRepMapping", salesRepCode],
    queryFn: () => fetchSalesRepMappingByCode(salesRepCode),
    enabled: !!salesRepCode,
    staleTime: 1000 * 60 * 5,
  });
}
