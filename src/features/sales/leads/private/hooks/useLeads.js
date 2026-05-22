import { useQuery } from "@tanstack/react-query";
import { fetchLeadsByClientId } from "../api/fetchLeadsByClientId";

export function useLeads(clientId) {
  return useQuery({
    queryKey: ["sales_leads", clientId],
    queryFn: () => fetchLeadsByClientId(clientId),
    // ONLY fetch if we have an ID and it's not the creation state
    enabled: !!clientId && clientId !== "new",
    staleTime: 1000 * 60 * 5, // Keep fresh for 5 minutes
  });
}
