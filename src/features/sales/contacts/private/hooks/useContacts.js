import { useQuery } from "@tanstack/react-query";
import { fetchContactsByClientId } from "../api/fetchContactsByClientId";

export function useContacts(clientId) {
  return useQuery({
    queryKey: ["client_contacts", clientId],
    queryFn: () => fetchContactsByClientId(clientId),
    // ONLY fetch if we have an ID and it's not the creation state
    enabled: !!clientId && clientId !== "new",
    staleTime: 1000 * 60 * 5, // Keep fresh for 5 minutes
  });
}
