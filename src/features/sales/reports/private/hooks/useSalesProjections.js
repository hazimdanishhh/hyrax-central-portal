import { useQuery } from "@tanstack/react-query";
import { fetchSalesProjections } from "../api/fetchSalesProjections";

/**
 * The whole Projections section of Sales Reports, one fiscal year at a time.
 *
 * ── MERGED 2026-10-16 ──────────────────────────────────────────────────────
 *
 * This replaces useSalesProjections() + useSalesProjectionAccuracy(fy), which
 * between them ran the section on two clocks: the first took no arguments and
 * always described *now*, the second followed the year dropdown. One hook, one
 * query key, one loading state — and no way for the tiles and the chart to
 * disagree about which year they are describing.
 *
 * The fiscal year IS in the query key: changing it must refetch. It is NOT in
 * the URL, because every URL param on this page is swept into the Sales
 * Reports dashboard query key, so putting it there would refetch the whole
 * 1,638-line dashboard RPC on every change.
 *
 * `null` means "the fiscal year we are in", resolved server-side.
 *
 * staleTime is 30 minutes against the dashboard's 30 SECONDS. The underlying
 * figures are rebuilt from materialized caches that only change when a month
 * closes, so anything shorter is pure waste.
 *
 * Returned flags are deliberately NOT merged into the page's shared
 * isLoading/isError chain -- see fetchSalesProjections.js.
 */
export function useSalesProjections(fiscalYearStart) {
  const query = useQuery({
    queryKey: ["salesProjections", fiscalYearStart ?? "current"],
    queryFn: () => fetchSalesProjections({ fiscalYearStart }),
    staleTime: 1000 * 60 * 30,
    retry: 1,
    // The year selector is a deliberate user action and the section is small;
    // holding the previous year's numbers on screen while the new ones load
    // reads as the figures having changed rather than as a fetch in progress.
    keepPreviousData: false,
  });

  return {
    ...query,
    // kpis is NESTED -- { year, month, reliability, health }. The RPC's two
    // merged key sets are ~68 keys between them, and json_build_object raises
    // 54023 past 100 arguments, so a flat object would not compile.
    kpis: query.data?.kpis || null,
    monthlyData: query.data?.monthlyData || [],
    availableYears: query.data?.availableYears || [],
    // Keyed by 'YYYY-MM-DD'. Every month of the selected year is sent at once
    // so clicking one costs no round trip.
    exhibitsByMonth: query.data?.exhibitsByMonth || {},
    defaultExhibitMonth: query.data?.defaultExhibitMonth || null,
  };
}
