import { useQuery } from "@tanstack/react-query";
import { fetchSalesProjectionAccuracy } from "../api/fetchSalesProjectionAccuracy";

/**
 * Track record for the Sales Projections, one fiscal year at a time.
 *
 * The fiscal year IS in the query key -- changing it must refetch. That is the
 * one difference from useSalesProjections, whose figures are company-wide and
 * take no parameter at all.
 *
 * It is NOT in the URL, so changing the year refetches this section and
 * nothing else. See fetchSalesProjectionAccuracy.js for why.
 *
 * staleTime is 30 minutes, matching the forward projections: both are built
 * from caches that only change when a month closes.
 *
 * Kept out of the page's shared isLoading/isError state so a failure here
 * leaves the rest of Sales Reports -- including the forward projections --
 * standing.
 */
export function useSalesProjectionAccuracy(fiscalYearStart) {
  const query = useQuery({
    queryKey: ["salesProjectionAccuracy", fiscalYearStart ?? "current"],
    queryFn: () => fetchSalesProjectionAccuracy({ fiscalYearStart }),
    staleTime: 1000 * 60 * 30,
    retry: 1,
    // The year selector is a deliberate user action and the section is small;
    // holding the previous year's numbers on screen while the new ones load
    // reads as the figures having changed rather than as a fetch in progress.
    keepPreviousData: false,
  });

  return {
    ...query,
    kpis: query.data?.kpis || null,
    monthlyData: query.data?.monthlyData || [],
    availableYears: query.data?.availableYears || [],
  };
}
