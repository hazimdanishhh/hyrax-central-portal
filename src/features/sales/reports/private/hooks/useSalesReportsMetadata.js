import { useQuery } from "@tanstack/react-query";
import { fetchSalesReportsMetadata } from "../api/salesReportsMetadataService";

export function useSalesReportsMetadata() {
  const query = useQuery({
    queryKey: ["salesReportsMetadata"],
    queryFn: fetchSalesReportsMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    owners: query.data?.owners || [],
    dataFreshness: query.data?.dataFreshness || null,
  };
}
