import { useQuery } from "@tanstack/react-query";
import { fetchFinanceMetadata } from "../api/financeMetadataService";

export function useFinanceMetadata() {
  const query = useQuery({
    queryKey: ["financeMetadata"],
    queryFn: fetchFinanceMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    salesReps: query.data?.salesReps || [],
  };
}
