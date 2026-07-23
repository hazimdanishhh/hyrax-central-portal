import { useQuery } from "@tanstack/react-query";
import { fetchOperationsMetadata } from "../api/operationsMetadataService";

export function useOperationsMetadata() {
  const query = useQuery({
    queryKey: ["operationsMetadata"],
    queryFn: fetchOperationsMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    dataFreshness: query.data?.dataFreshness || null,
  };
}
