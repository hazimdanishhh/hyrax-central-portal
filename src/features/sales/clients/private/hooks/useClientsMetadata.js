import { useQuery } from "@tanstack/react-query";
import { fetchClientsMetadata } from "../api/clientsMetadataService";

export function useClientsMetadata() {
  const query = useQuery({
    queryKey: ["clientsMetadata"],
    queryFn: fetchClientsMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    industries: query.data?.industries || [],
  };
}
