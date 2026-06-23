import { useQuery } from "@tanstack/react-query";
import { fetchLeadsMetadata } from "../api/leadsMetadataService";

export function useLeadsMetadata() {
  const query = useQuery({
    queryKey: ["leadsMetadata"],
    queryFn: fetchLeadsMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    owners: query.data?.owners || [],
    clients: query.data?.clients || [],
    clientContacts: query.data?.clientContacts || [],
    leadSourceTypes: query.data?.leadSourceTypes || [],
    loseReasons: query.data?.loseReasons || [],
  };
}
