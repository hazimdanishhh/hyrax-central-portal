import { useQuery } from "@tanstack/react-query";
import { fetchClientById } from "../api/fetchClientById";

export function useClient(clientId) {
  return useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => fetchClientById(clientId),
    // ONLY fetch if we have an ID and it's not the creation state
    enabled: !!clientId && clientId !== "new",
    staleTime: 1000 * 60 * 5, // Keep fresh for 5 minutes
  });
}
