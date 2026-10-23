import { useQuery } from "@tanstack/react-query";
import { fetchLeadsDashboard } from "../api/fetchLeadsDashboard";

/**
 * Leads Overview data (the Sales Reports tab hook's pattern).
 *
 * Keyed under "sales_leads" so the Leads list's mutations -- which
 * invalidate ["sales_leads"] -- refresh this page too. Keyed on the three
 * filter values only, so nothing else in the URL can trigger a refetch.
 * The previous figures stay on screen while new ones load, and isUpdating
 * says so (TabState shows "Updating figures…").
 */
export function useLeadsOverview(filters) {
  const startDate = filters?.startDate || null;
  const endDate = filters?.endDate || null;
  const owner = filters?.owner || null;

  const query = useQuery({
    queryKey: ["sales_leads", "overview", { startDate, endDate, owner }],
    queryFn: () => fetchLeadsDashboard({ startDate, endDate, owner }),
    staleTime: 1000 * 30,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  return {
    ...query,
    meta: query.data?.meta ?? null,
    kpis: query.data?.kpis ?? {},
    isUpdating: query.isFetching && query.isPlaceholderData,
  };
}
