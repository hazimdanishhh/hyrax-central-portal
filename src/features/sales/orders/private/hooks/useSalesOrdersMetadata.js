import { useQuery } from "@tanstack/react-query";
import { fetchSalesOrdersMetadata } from "../api/salesOrdersMetadataService";

export function useSalesOrdersMetadata() {
  const query = useQuery({
    queryKey: ["salesOrdersMetadata"],
    queryFn: fetchSalesOrdersMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    salesReps: query.data?.salesReps || [],
    dataFreshness: query.data?.dataFreshness || null,
  };
}
