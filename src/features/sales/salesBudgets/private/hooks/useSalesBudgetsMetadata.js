import { useQuery } from "@tanstack/react-query";
import { fetchSalesBudgetsMetadata } from "../api/salesBudgetsMetadataService";

export function useSalesBudgetsMetadata() {
  const query = useQuery({
    queryKey: ["salesBudgetsMetadata"],
    queryFn: fetchSalesBudgetsMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    salesReps: query.data?.salesReps || [],
  };
}
