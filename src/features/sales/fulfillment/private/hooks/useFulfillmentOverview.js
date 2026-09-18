import { useQuery } from "@tanstack/react-query";
import { fetchFulfillmentOverview } from "../api/fulfillmentOrdersService";

const EMPTY_KPIS = {
  backlogCount: 0,
  backlogValue: 0,
  backlogOpenQty: 0,
  overdueDeliveryCount: 0,
  overdueDeliveryValue: 0,
  deliveredNotInvoicedCount: 0,
  deliveredNotInvoicedValue: 0,
  outstandingCount: 0,
  outstandingValue: 0,
  mismatchCount: 0,
  mismatchValue: 0,
};

/**
 * Backs the Fulfillment Tracker's OverviewCards -- mirrors the paginated
 * list's active filters/search so the KPI strip always summarizes exactly the
 * filtered slice the cards below are showing. filters/search are the same
 * values the page already gets from usePaginatedQuery -- no separate filter
 * state. Same shape as useInvoicesOverview.
 */
export function useFulfillmentOverview(filters, search) {
  const query = useQuery({
    queryKey: ["fulfillment", "overview", filters, search],
    queryFn: () => fetchFulfillmentOverview({ filters, search }),
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
