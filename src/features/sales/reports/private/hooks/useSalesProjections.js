import { useQuery } from "@tanstack/react-query";
import { fetchSalesProjections } from "../api/fetchSalesProjections";

/**
 * Sales Projections, for the Projections section of Sales Reports.
 *
 * No filter params in the query key -- the projection is company-wide and does
 * not respond to the page's salesperson or date filters. Keying it on them
 * would refetch an identical result every time a filter moved.
 *
 * staleTime is 30 minutes against the dashboard's 30 SECONDS. The underlying
 * figures are rebuilt from materialized caches that only change when a month
 * closes, so anything shorter is pure waste.
 *
 * Returned flags are deliberately NOT merged into the page's shared
 * isLoading/isError chain -- see fetchSalesProjections.js.
 */
export function useSalesProjections() {
  const query = useQuery({
    queryKey: ["salesProjections"],
    queryFn: fetchSalesProjections,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  return {
    ...query,
    kpis: query.data?.kpis || null,
    fanChartData: query.data?.fanChartData || [],
    methodExhibitData: query.data?.methodExhibitData || [],
    buildUpData: query.data?.buildUpData || [],
  };
}
