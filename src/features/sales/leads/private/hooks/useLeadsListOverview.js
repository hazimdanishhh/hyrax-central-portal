import { useQuery } from "@tanstack/react-query";
import { fetchLeadsListOverview } from "../api/leadsService";

const EMPTY_KPIS = {
  activeCount: 0,
  activeValue: 0,
  pendingSapOrderCount: 0,
  pendingSapOrderValue: 0,
  onHoldCount: 0,
  onHoldValue: 0,
  agingCount: 0,
  agingValue: 0,
};

/**
 * Backs the Leads LIST page's OverviewCards -- mirrors the paginated list's
 * active filters/search so the KPI strip always summarizes exactly the
 * filtered slice the list below is showing. filters/search are the same
 * values the page already gets from usePaginatedQuery -- no separate state.
 *
 * Distinct from useLeadsOverview.js (the legacy, unused client-side
 * aggregator) and from the Overview tab's dashboard RPC hook.
 *
 * queryKey starts with "sales_leads" on purpose: LeadsManagement's
 * handleConfirmAction already fires invalidateQueries({ queryKey:
 * ["sales_leads"] }) after every mutation, so the tiles refresh alongside
 * the list with no extra invalidation call.
 */
export function useLeadsListOverview(filters, search) {
  const query = useQuery({
    queryKey: ["sales_leads", "list-overview", filters, search],
    queryFn: () => fetchLeadsListOverview({ filters, search }),
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
