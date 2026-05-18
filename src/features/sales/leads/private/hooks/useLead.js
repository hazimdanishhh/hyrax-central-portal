import { useQuery } from "@tanstack/react-query";
import { fetchLeadById } from "../api/fetchLeadById";

export function useLead(leadId) {
  return useQuery({
    queryKey: ["sales_lead", leadId],
    queryFn: () => fetchLeadById(leadId),
    // ONLY fetch if we have an ID and it's not the creation state
    enabled: !!leadId && leadId !== "new",
    staleTime: 1000 * 60 * 5, // Keep fresh for 5 minutes
  });
}
